import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Task from '#models/task'
import User from '#models/user'
import { createTaskValidator, updateTaskValidator } from '#validators/task'

export default class TasksController {
  private getUniqueIds(ids: number[]) {
    return [...new Set(ids)]
  }

  private async serializeTask(task: Task) {
    const accessRows = await db
      .from('t_task_access')
      .select('parent_fk', 'access_level')
      .where('task_fk', task.taskId)
      .whereIn('access_level', ['read', 'write'])

    return {
      taskId: task.taskId,
      title: task.title,
      description: task.description,
      dueDate: task.dueDate?.toISO(),
      status: task.status,
      version: task.version,
      assignedChildFk: task.assignedChildFk,
      createdByFk: task.createdByFk,
      familyFk: task.familyFk,
      createdAt: task.createdAt?.toISO(),
      updatedAt: task.updatedAt?.toISO(),
      deletedAt: task.deletedAt?.toISO(),

      // Utile côté enfant pour précocher les parents visibles en modification.
      visibleParentIds: accessRows.map((row) => row.parent_fk),
      parentAccesses: accessRows.map((row) => ({
        parentFk: row.parent_fk,
        accessLevel: row.access_level,
      })),
    }
  }

  private async serializeTasks(tasks: Task[]) {
    return Promise.all(tasks.map((task) => this.serializeTask(task)))
  }

  private async hasWriteAccess(parentId: number, taskId: number) {
    const access = await db
      .from('t_task_access')
      .where('parent_fk', parentId)
      .where('task_fk', taskId)
      .where('access_level', 'write')
      .first()

    return Boolean(access)
  }

  private async findChildInSameFamily(childId: number, familyId: number) {
    const child = await User.find(childId)

    if (!child || child.role !== 'child' || child.currentFamilyFk !== familyId) {
      return null
    }

    return child
  }

  private async validateVisibleParents(parentIds: number[], familyId: number) {
    const uniqueParentIds = this.getUniqueIds(parentIds)

    if (uniqueParentIds.length !== parentIds.length) {
      return {
        isValid: false,
        uniqueParentIds,
        message: 'Un parent ne peut pas être sélectionné plusieurs fois.',
      }
    }

    if (uniqueParentIds.length === 0) {
      return {
        isValid: true,
        uniqueParentIds,
        message: null,
      }
    }

    const parents = await User.query()
      .whereIn('user_id', uniqueParentIds)
      .where('current_family_fk', familyId)
      .where('role', 'parent')

    if (parents.length !== uniqueParentIds.length) {
      return {
        isValid: false,
        uniqueParentIds,
        message: 'Un ou plusieurs parents sélectionnés ne font pas partie de votre famille.',
      }
    }

    return {
      isValid: true,
      uniqueParentIds,
      message: null,
    }
  }

  /**
   * Liste les tâches visibles par l'utilisateur connecté.
   */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const sort = request.input('sort', 'due_date')
    const sortColumn = sort === 'title' ? 'title' : 'due_date'

    if (user.role === 'child') {
      const tasks = await Task.query()
        .where('assigned_child_fk', user.userId)
        .where('family_fk', user.currentFamilyFk)
        .whereNull('deleted_at')
        .orderBy(sortColumn, 'asc')

      return response.ok({
        tasks: await this.serializeTasks(tasks),
      })
    }

    const accessRows = await db
      .from('t_task_access')
      .select('task_fk')
      .where('parent_fk', user.userId)
      .whereIn('access_level', ['read', 'write'])

    const taskIds = accessRows.map((row) => row.task_fk)

    if (taskIds.length === 0) {
      return response.ok({
        tasks: [],
      })
    }

    const tasks = await Task.query()
      .whereIn('task_id', taskIds)
      .where('family_fk', user.currentFamilyFk)
      .whereNull('deleted_at')
      .orderBy(sortColumn, 'asc')

    return response.ok({
      tasks: await this.serializeTasks(tasks),
    })
  }

  /**
   * Crée une tâche.
   *
   * Parent :
   * - crée une tâche assignée à un enfant de sa famille ;
   * - définit l'accès des co-parents.
   *
   * Enfant :
   * - crée une tâche personnelle assignée à lui-même ;
   * - choisit les parents visibles via visibleParentIds.
   */
  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const payload = await request.validateUsing(createTaskValidator)

    const dueDate = DateTime.fromISO(payload.dueDate)

    if (!dueDate.isValid) {
      return response.status(422).send({
        message: 'La date d’échéance est invalide.',
      })
    }

    if (user.role === 'parent') {
      if (!payload.assignedChildFk) {
        return response.status(422).send({
          message: 'Un enfant doit être assigné à la tâche.',
        })
      }

      const child = await this.findChildInSameFamily(payload.assignedChildFk, user.currentFamilyFk)

      if (!child) {
        return response.forbidden({
          message: 'L’enfant assigné doit appartenir à votre famille.',
        })
      }

      const task = await db.transaction(async (trx) => {
        const createdTask = new Task()

        createdTask.title = payload.title
        createdTask.description = payload.description ?? null
        createdTask.dueDate = dueDate
        createdTask.status = 'todo'
        createdTask.version = 1
        createdTask.assignedChildFk = child.userId
        createdTask.createdByFk = user.userId
        createdTask.familyFk = user.currentFamilyFk

        createdTask.useTransaction(trx)
        await createdTask.save()

        const now = new Date()
        const otherParentsAccess = payload.accessLevelForOtherParents ?? 'none'

        const otherParents = await User.query({ client: trx })
          .where('current_family_fk', user.currentFamilyFk)
          .where('role', 'parent')
          .whereNot('user_id', user.userId)

        const accessRows = [
          {
            parent_fk: user.userId,
            task_fk: createdTask.taskId,
            access_level: 'write',
            created_at: now,
            updated_at: null,
          },
          ...otherParents.map((otherParent) => ({
            parent_fk: otherParent.userId,
            task_fk: createdTask.taskId,
            access_level: otherParentsAccess,
            created_at: now,
            updated_at: null,
          })),
        ]

        await trx.table('t_task_access').insert(accessRows)

        return createdTask
      })

      return response.created({
        message: 'Tâche créée avec succès.',
        task: await this.serializeTask(task),
      })
    }

    if (user.role === 'child') {
      const visibleParentIds = payload.visibleParentIds ?? []
      const validation = await this.validateVisibleParents(visibleParentIds, user.currentFamilyFk)

      if (!validation.isValid) {
        return response.forbidden({
          message: validation.message,
        })
      }

      const task = await db.transaction(async (trx) => {
        const createdTask = new Task()

        createdTask.title = payload.title
        createdTask.description = payload.description ?? null
        createdTask.dueDate = dueDate
        createdTask.status = 'todo'
        createdTask.version = 1
        createdTask.assignedChildFk = user.userId
        createdTask.createdByFk = user.userId
        createdTask.familyFk = user.currentFamilyFk

        createdTask.useTransaction(trx)
        await createdTask.save()

        if (validation.uniqueParentIds.length > 0) {
          const now = new Date()

          await trx.table('t_task_access').insert(
            validation.uniqueParentIds.map((parentId) => ({
              parent_fk: parentId,
              task_fk: createdTask.taskId,
              access_level: 'write',
              created_at: now,
              updated_at: null,
            }))
          )
        }

        return createdTask
      })

      return response.created({
        message: 'Tâche personnelle créée avec succès.',
        task: await this.serializeTask(task),
      })
    }

    return response.forbidden({
      message: 'Rôle utilisateur non autorisé.',
    })
  }

  /**
   * Modifie une tâche non terminée.
   */
  async update({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const taskId = Number(request.param('id'))

    if (!Number.isInteger(taskId)) {
      return response.status(400).send({
        message: 'Identifiant de tâche invalide.',
      })
    }

    const task = await Task.find(taskId)

    if (!task || task.deletedAt) {
      return response.notFound({
        message: 'Tâche introuvable.',
      })
    }

    if (task.familyFk !== user.currentFamilyFk) {
      return response.forbidden({
        message: 'Cette tâche n’appartient pas à votre famille.',
      })
    }

    if (!['todo', 'refused'].includes(task.status)) {
      return response.conflict({
        message: 'Une tâche soumise ou validée ne peut pas être modifiée.',
      })
    }

    const payload = await request.validateUsing(updateTaskValidator)

    if (user.role === 'parent') {
      const canWrite = await this.hasWriteAccess(user.userId, task.taskId)

      if (!canWrite) {
        return response.forbidden({
          message: 'Vous n’avez pas le droit de modifier cette tâche.',
        })
      }

      if (payload.dueDate) {
        const dueDate = DateTime.fromISO(payload.dueDate)

        if (!dueDate.isValid) {
          return response.status(422).send({
            message: 'La date d’échéance est invalide.',
          })
        }

        task.dueDate = dueDate
      }

      if (payload.assignedChildFk) {
        const child = await this.findChildInSameFamily(
          payload.assignedChildFk,
          user.currentFamilyFk
        )

        if (!child) {
          return response.forbidden({
            message: 'L’enfant assigné doit appartenir à votre famille.',
          })
        }

        task.assignedChildFk = child.userId
      }

      if (payload.title !== undefined) {
        task.title = payload.title
      }

      if (payload.description !== undefined) {
        task.description = payload.description
      }

      task.version += 1
      await task.save()

      if (payload.accessLevelForOtherParents !== undefined) {
        await db
          .from('t_task_access')
          .where('task_fk', task.taskId)
          .whereNot('parent_fk', user.userId)
          .update({
            access_level: payload.accessLevelForOtherParents,
            updated_at: new Date(),
          })
      }

      return response.ok({
        message: 'Tâche modifiée avec succès.',
        task: await this.serializeTask(task),
      })
    }

    if (user.role === 'child') {
      if (task.createdByFk !== user.userId || task.assignedChildFk !== user.userId) {
        return response.forbidden({
          message: 'Vous ne pouvez modifier que vos propres tâches personnelles.',
        })
      }

      if (payload.dueDate) {
        const dueDate = DateTime.fromISO(payload.dueDate)

        if (!dueDate.isValid) {
          return response.status(422).send({
            message: 'La date d’échéance est invalide.',
          })
        }

        task.dueDate = dueDate
      }

      if (payload.title !== undefined) {
        task.title = payload.title
      }

      if (payload.description !== undefined) {
        task.description = payload.description
      }

      const visibleParentIds = payload.visibleParentIds ?? []
      const validation = await this.validateVisibleParents(visibleParentIds, user.currentFamilyFk)

      if (!validation.isValid) {
        return response.forbidden({
          message: validation.message,
        })
      }

      await db.transaction(async (trx) => {
        task.version += 1
        task.useTransaction(trx)
        await task.save()

        if (payload.visibleParentIds !== undefined) {
          await trx.query().from('t_task_access').where('task_fk', task.taskId).delete()

          if (validation.uniqueParentIds.length > 0) {
            const now = new Date()

            await trx.table('t_task_access').insert(
              validation.uniqueParentIds.map((parentId) => ({
                parent_fk: parentId,
                task_fk: task.taskId,
                access_level: 'write',
                created_at: now,
                updated_at: null,
              }))
            )
          }
        }
      })

      return response.ok({
        message: 'Tâche personnelle modifiée avec succès.',
        task: await this.serializeTask(task),
      })
    }

    return response.forbidden({
      message: 'Rôle utilisateur non autorisé.',
    })
  }

  /**
   * Supprime logiquement une tâche.
   */
  async destroy({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const taskId = Number(request.param('id'))

    if (!Number.isInteger(taskId)) {
      return response.status(400).send({
        message: 'Identifiant de tâche invalide.',
      })
    }

    const task = await Task.find(taskId)

    if (!task || task.deletedAt) {
      return response.notFound({
        message: 'Tâche introuvable.',
      })
    }

    if (task.familyFk !== user.currentFamilyFk) {
      return response.forbidden({
        message: 'Cette tâche n’appartient pas à votre famille.',
      })
    }

    if (!['todo', 'refused'].includes(task.status)) {
      return response.conflict({
        message: 'Une tâche soumise ou validée ne peut pas être supprimée.',
      })
    }

    if (user.role === 'parent') {
      const canWrite = await this.hasWriteAccess(user.userId, task.taskId)

      if (!canWrite) {
        return response.forbidden({
          message: 'Vous n’avez pas le droit de supprimer cette tâche.',
        })
      }

      task.deletedAt = DateTime.now()
      task.version += 1
      await task.save()

      return response.ok({
        message: 'Tâche supprimée avec succès.',
      })
    }

    if (user.role === 'child') {
      if (task.createdByFk !== user.userId || task.assignedChildFk !== user.userId) {
        return response.forbidden({
          message: 'Vous ne pouvez supprimer que vos propres tâches personnelles.',
        })
      }

      task.deletedAt = DateTime.now()
      task.version += 1
      await task.save()

      return response.ok({
        message: 'Tâche personnelle supprimée avec succès.',
      })
    }

    return response.forbidden({
      message: 'Rôle utilisateur non autorisé.',
    })
  }
}
