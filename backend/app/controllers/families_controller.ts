import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import { createChildValidator } from '#validators/family'

export default class FamilyController {
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
   * Le compte enfant est directement rattaché à la famille courante
   * du parent connecté.
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

    const child = await User.create({
      username: payload.username,
      passwordHash: payload.password,
      name: payload.name,
      role: 'child',
      currentFamilyFk: parent.currentFamilyFk,
    })

    return response.created({
      message: 'Compte enfant créé avec succès.',
      child: this.serializeMember(child),
    })
  }
}
