import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Family from '#models/family'
import User from '#models/user'
import { createChildValidator } from '#validators/family'

export default class FamiliesController {
  /**
   * Retourne uniquement les informations utiles d'un membre de famille.
   */
  private serializeMember(user: User) {
    return {
      userId: user.userId,
      username: user.username,
      name: user.name,
      role: user.role,
      currentFamilyFk: user.currentFamilyFk,
    }
  }

  /**
   * Affiche les membres de la famille courante de l'utilisateur connecté.
   */
  async show({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const members = await User.query()
      .where('current_family_fk', user.currentFamilyFk)
      .orderBy('role', 'desc')
      .orderBy('name', 'asc')

    return response.ok({
      familyId: user.currentFamilyFk,
      members: members.map((member) => this.serializeMember(member)),
    })
  }

  /**
   * Crée un compte enfant depuis l'espace parent.
   *
   * L'enfant est directement rattaché à la famille courante du parent.
   * En parallèle, une famille personnelle archivée est créée pour l'enfant.
   *
   * Cette famille personnelle permettra de le rattacher automatiquement
   * quelque part s'il est retiré plus tard d'une famille.
   */
  async createChild({ auth, request, response }: HttpContext) {
    const parent = auth.getUserOrFail()

    if (parent.role !== 'parent') {
      return response.forbidden({
        message: 'Seul un parent peut créer un compte enfant.',
      })
    }

    const payload = await request.validateUsing(createChildValidator)

    const existingUser = await User.findBy('username', payload.username)

    if (existingUser) {
      return response.conflict({
        message: 'Ce nom d’utilisateur est déjà utilisé.',
      })
    }

    const child = await db.transaction(async (trx) => {
      const personalFamily = new Family()

      personalFamily.ownerUserId = null
      personalFamily.name = `Famille ${payload.name}`
      personalFamily.status = 'archived'
      personalFamily.useTransaction(trx)
      await personalFamily.save()

      const createdChild = new User()

      createdChild.username = payload.username
      createdChild.passwordHash = payload.password
      createdChild.name = payload.name
      createdChild.role = 'child'
      createdChild.currentFamilyFk = parent.currentFamilyFk
      createdChild.useTransaction(trx)
      await createdChild.save()

      personalFamily.ownerUserId = createdChild.userId
      personalFamily.useTransaction(trx)
      await personalFamily.save()

      return createdChild
    })

    return response.created({
      message: 'Compte enfant créé avec succès.',
      child: this.serializeMember(child),
    })
  }

  /**
   * Retire un membre de la famille courante.
   *
   * Règles :
   * - seul un parent peut retirer un membre ;
   * - le membre doit appartenir à la même famille ;
   * - un utilisateur ne peut pas se retirer lui-même avec cette route ;
   * - le propriétaire de la famille ne peut pas être retiré ;
   * - un enfant avec des tâches actives ne peut pas être retiré ;
   * - le membre retiré est rattaché à sa famille personnelle.
   */
  async removeMember({ auth, request, response }: HttpContext) {
    const parent = auth.getUserOrFail()

    if (parent.role !== 'parent') {
      return response.forbidden({
        message: 'Seul un parent peut retirer un membre de la famille.',
      })
    }

    const memberId = Number(request.param('id'))

    if (!Number.isInteger(memberId)) {
      return response.status(400).send({
        message: 'Identifiant de membre invalide.',
      })
    }

    if (memberId === parent.userId) {
      return response.conflict({
        message: 'Vous ne pouvez pas vous retirer vous-même avec cette action.',
      })
    }

    const currentFamily = await Family.find(parent.currentFamilyFk)

    if (!currentFamily || currentFamily.status !== 'active') {
      return response.conflict({
        message: 'Famille courante introuvable ou inactive.',
      })
    }

    const member = await User.find(memberId)

    if (!member || member.currentFamilyFk !== parent.currentFamilyFk) {
      return response.notFound({
        message: 'Membre introuvable dans votre famille.',
      })
    }

    if (currentFamily.ownerUserId === member.userId) {
      return response.conflict({
        message: 'Le propriétaire de la famille ne peut pas être retiré.',
      })
    }

    if (member.role === 'child') {
      const activeTasksResult = await db
        .from('t_task')
        .where('family_fk', currentFamily.familyId)
        .where('assigned_child_fk', member.userId)
        .whereNull('deleted_at')
        .count('* as total')
        .first()

      const activeTasksCount = Number(activeTasksResult?.total ?? 0)

      if (activeTasksCount > 0) {
        return response.conflict({
          message:
            'Cet enfant possède encore des tâches dans la famille. Elles doivent être supprimées ou traitées avant de le retirer.',
        })
      }
    }

    await db.transaction(async (trx) => {
      let personalFamily = await Family.query({ client: trx })
        .where('owner_user_id', member.userId)
        .first()

      if (!personalFamily) {
        personalFamily = new Family()
        personalFamily.ownerUserId = member.userId
        personalFamily.name = `Famille ${member.name}`
      }

      personalFamily.status = 'active'
      personalFamily.useTransaction(trx)
      await personalFamily.save()

      if (member.role === 'parent') {
        const taskRows = await trx
          .query()
          .from('t_task')
          .select('task_id')
          .where('family_fk', currentFamily.familyId)

        const taskIds = taskRows.map((taskRow) => taskRow.task_id)

        if (taskIds.length > 0) {
          await trx
            .query()
            .from('t_task_access')
            .where('parent_fk', member.userId)
            .whereIn('task_fk', taskIds)
            .delete()
        }
      }

      member.currentFamilyFk = personalFamily.familyId
      member.useTransaction(trx)
      await member.save()
    })

    return response.ok({
      message: 'Membre retiré de la famille avec succès.',
    })
  }

  /**
   * Permet à un parent de quitter une famille rejointe.
   *
   * Règles :
   * - seul un parent peut quitter une famille ;
   * - un parent ne peut pas quitter sa propre famille personnelle ;
   * - le parent est rattaché à sa famille personnelle ;
   * - sa famille personnelle est réactivée ;
   * - ses accès aux tâches de l'ancienne famille sont supprimés ;
   * - il ne se retrouve jamais sans famille courante.
   */
  async leave({ auth, response }: HttpContext) {
    const parent = auth.getUserOrFail()

    if (parent.role !== 'parent') {
      return response.forbidden({
        message: 'Seul un parent peut quitter une famille.',
      })
    }

    const currentFamily = await Family.find(parent.currentFamilyFk)

    if (!currentFamily || currentFamily.status !== 'active') {
      return response.conflict({
        message: 'Famille courante introuvable ou inactive.',
      })
    }

    if (currentFamily.ownerUserId === parent.userId) {
      return response.conflict({
        message: 'Vous ne pouvez pas quitter votre propre famille personnelle.',
      })
    }

    await db.transaction(async (trx) => {
      let personalFamily = await Family.query({ client: trx })
        .where('owner_user_id', parent.userId)
        .first()

      if (!personalFamily) {
        personalFamily = new Family()
        personalFamily.ownerUserId = parent.userId
        personalFamily.name = `Famille ${parent.name}`
      }

      personalFamily.status = 'active'
      personalFamily.useTransaction(trx)
      await personalFamily.save()

      const taskRows = await trx
        .query()
        .from('t_task')
        .select('task_id')
        .where('family_fk', currentFamily.familyId)

      const taskIds = taskRows.map((taskRow) => taskRow.task_id)

      if (taskIds.length > 0) {
        await trx
          .query()
          .from('t_task_access')
          .where('parent_fk', parent.userId)
          .whereIn('task_fk', taskIds)
          .delete()
      }

      parent.currentFamilyFk = personalFamily.familyId
      parent.useTransaction(trx)
      await parent.save()
    })

    return response.ok({
      message: 'Vous avez quitté la famille avec succès.',
    })
  }
}
