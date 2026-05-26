import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Family from '#models/family'
import Invitation from '#models/invitation'
import User from '#models/user'
import { createInvitationValidator, respondInvitationValidator } from '#validators/invitation'

export default class InvitationsController {
  private async serializeInvitation(invitation: Invitation) {
    const inviter = await User.find(invitation.inviterFk)
    const invitedUser = await User.find(invitation.invitedUserFk)
    const family = await Family.find(invitation.familyFk)

    return {
      invitationId: invitation.invitationId,
      status: invitation.status,

      invitedUserFk: invitation.invitedUserFk,
      invitedUsername: invitedUser?.username ?? null,
      invitedUserName: invitedUser?.name ?? null,
      invitedUserRole: invitedUser?.role ?? null,

      inviterFk: invitation.inviterFk,
      inviterUsername: inviter?.username ?? null,
      inviterName: inviter?.name ?? null,

      familyFk: invitation.familyFk,
      familyName: family?.name ?? null,

      createdAt: invitation.createdAt?.toISO(),
      respondedAt: invitation.respondedAt?.toISO(),
    }
  }

  private async serializeInvitations(invitations: Invitation[]) {
    return Promise.all(invitations.map((invitation) => this.serializeInvitation(invitation)))
  }

  /**
   * Liste les invitations reçues et envoyées par l'utilisateur connecté.
   */
  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const receivedInvitations = await Invitation.query()
      .where('invited_user_fk', user.userId)
      .orderBy('created_at', 'desc')

    const sentInvitations = await Invitation.query()
      .where('inviter_fk', user.userId)
      .orderBy('created_at', 'desc')

    const serializedReceivedInvitations = await this.serializeInvitations(receivedInvitations)
    const serializedSentInvitations = await this.serializeInvitations(sentInvitations)

    return response.ok({
      // Compatibilité avec le frontend existant
      invitations: serializedReceivedInvitations,

      receivedInvitations: serializedReceivedInvitations,
      sentInvitations: serializedSentInvitations,
    })
  }

  /**
   * Création d'une invitation.
   *
   * Règles :
   * - seul un parent peut inviter ;
   * - l'utilisateur invité doit exister ;
   * - on ne peut pas s'inviter soi-même ;
   * - on ne crée pas deux invitations pending identiques.
   */
  async store({ auth, request, response }: HttpContext) {
    const inviter = auth.getUserOrFail()

    if (inviter.role !== 'parent') {
      return response.forbidden({
        message: 'Seul un parent peut envoyer une invitation.',
      })
    }

    const payload = await request.validateUsing(createInvitationValidator)

    const invitedUser = await User.findBy('username', payload.invitedUsername)

    if (!invitedUser) {
      return response.notFound({
        message: 'Utilisateur invité introuvable.',
      })
    }

    if (invitedUser.userId === inviter.userId) {
      return response.conflict({
        message: 'Vous ne pouvez pas vous inviter vous-même.',
      })
    }

    if (invitedUser.currentFamilyFk === inviter.currentFamilyFk) {
      return response.conflict({
        message: 'Cet utilisateur appartient déjà à votre famille.',
      })
    }

    const existingPendingInvitation = await Invitation.query()
      .where('invited_user_fk', invitedUser.userId)
      .where('family_fk', inviter.currentFamilyFk)
      .where('status', 'pending')
      .first()

    if (existingPendingInvitation) {
      return response.conflict({
        message: 'Une invitation est déjà en attente pour cet utilisateur.',
      })
    }

    const invitation = await Invitation.create({
      status: 'pending',
      invitedUserFk: invitedUser.userId,
      inviterFk: inviter.userId,
      familyFk: inviter.currentFamilyFk,
      respondedAt: null,
    })

    return response.created({
      message: 'Invitation envoyée avec succès.',
      invitation: await this.serializeInvitation(invitation),
    })
  }

  /**
   * Réponse à une invitation.
   *
   * Si l'invitation est acceptée :
   * - l'utilisateur rejoint la famille invitante ;
   * - si sa famille personnelle est vide, elle est archivée ;
   * - si sa famille personnelle contient d'autres membres, l'acceptation est bloquée.
   */
  async respond({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const invitationId = Number(request.param('id'))

    if (!Number.isInteger(invitationId)) {
      return response.status(400).send({
        message: 'Identifiant d’invitation invalide.',
      })
    }

    const payload = await request.validateUsing(respondInvitationValidator)

    const invitation = await Invitation.find(invitationId)

    if (!invitation) {
      return response.notFound({
        message: 'Invitation introuvable.',
      })
    }

    if (invitation.invitedUserFk !== user.userId) {
      return response.forbidden({
        message: 'Vous ne pouvez répondre qu’à vos propres invitations.',
      })
    }

    if (invitation.status !== 'pending') {
      return response.conflict({
        message: 'Cette invitation a déjà été traitée.',
      })
    }

    if (payload.decision === 'refused') {
      invitation.status = 'refused'
      invitation.respondedAt = DateTime.now()
      await invitation.save()

      return response.ok({
        message: 'Invitation refusée.',
        invitation: await this.serializeInvitation(invitation),
      })
    }

    const targetFamily = await Family.find(invitation.familyFk)

    if (!targetFamily || targetFamily.status !== 'active') {
      return response.conflict({
        message: 'La famille liée à cette invitation n’est plus active.',
      })
    }

    const currentFamily = await Family.find(user.currentFamilyFk)

    if (!currentFamily) {
      return response.conflict({
        message: 'Famille courante introuvable.',
      })
    }

    if (currentFamily.ownerUserId === user.userId) {
      const countResult = await db
        .from('t_user')
        .where('current_family_fk', currentFamily.familyId)
        .count('* as total')
        .first()

      const membersCount = Number(countResult?.total ?? 0)

      if (membersCount > 1) {
        return response.conflict({
          message:
            'Votre famille personnelle contient encore d’autres membres. Vous devez d’abord les retirer avant de rejoindre une autre famille.',
        })
      }
    }

    await db.transaction(async (trx) => {
      const invitationToUpdate = await Invitation.query({ client: trx })
        .where('invitation_id', invitation.invitationId)
        .firstOrFail()

      const userToUpdate = await User.query({ client: trx })
        .where('user_id', user.userId)
        .firstOrFail()

      userToUpdate.currentFamilyFk = invitationToUpdate.familyFk
      userToUpdate.useTransaction(trx)
      await userToUpdate.save()

      if (currentFamily.ownerUserId === user.userId) {
        const familyToArchive = await Family.query({ client: trx })
          .where('family_id', currentFamily.familyId)
          .firstOrFail()

        familyToArchive.status = 'archived'
        familyToArchive.useTransaction(trx)
        await familyToArchive.save()
      }

      invitationToUpdate.status = 'accepted'
      invitationToUpdate.respondedAt = DateTime.now()
      invitationToUpdate.useTransaction(trx)
      await invitationToUpdate.save()
    })

    const updatedInvitation = await Invitation.findOrFail(invitation.invitationId)

    return response.ok({
      message: 'Invitation acceptée.',
      invitation: await this.serializeInvitation(updatedInvitation),
    })
  }

  /**
   * Annulation d'une invitation par le parent qui l'a envoyée.
   */
  async cancel({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const invitationId = Number(request.param('id'))

    if (!Number.isInteger(invitationId)) {
      return response.status(400).send({
        message: 'Identifiant d’invitation invalide.',
      })
    }

    const invitation = await Invitation.find(invitationId)

    if (!invitation) {
      return response.notFound({
        message: 'Invitation introuvable.',
      })
    }

    if (invitation.inviterFk !== user.userId) {
      return response.forbidden({
        message: 'Vous ne pouvez annuler que vos propres invitations.',
      })
    }

    if (invitation.status !== 'pending') {
      return response.conflict({
        message: 'Seule une invitation en attente peut être annulée.',
      })
    }

    invitation.status = 'cancelled'
    invitation.respondedAt = DateTime.now()
    await invitation.save()

    return response.ok({
      message: 'Invitation annulée.',
      invitation: await this.serializeInvitation(invitation),
    })
  }
}
