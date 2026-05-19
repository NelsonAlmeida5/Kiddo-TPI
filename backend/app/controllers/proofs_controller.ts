import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Proof from '#models/proof'
import Task from '#models/task'
import { decideProofValidator, submitProofValidator } from '#validators/proof'

export default class ProofsController {
  private serializeProof(proof: Proof) {
    return {
      proofId: proof.proofId,
      proofType: proof.proofType,
      textContent: proof.textContent,
      photoPath: proof.photoPath,
      status: proof.status,
      taskVersionAtSubmit: proof.taskVersionAtSubmit,
      decisionComment: proof.decisionComment,
      submittedAt: proof.submittedAt?.toISO(),
      decidedAt: proof.decidedAt?.toISO(),
      decidedByFk: proof.decidedByFk,
      submittedByFk: proof.submittedByFk,
      taskFk: proof.taskFk,
    }
  }

  private getProofType(textContent: string | null, photoPath: string | null) {
    const hasText = Boolean(textContent)
    const hasPhoto = Boolean(photoPath)

    if (hasText && hasPhoto) {
      return 'text_photo' as const
    }

    if (hasText) {
      return 'text' as const
    }

    return 'photo' as const
  }

  private async hasReadOrWriteAccess(parentId: number, taskId: number) {
    const access = await db
      .from('t_task_access')
      .where('parent_fk', parentId)
      .where('task_fk', taskId)
      .whereIn('access_level', ['read', 'write'])
      .first()

    return Boolean(access)
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

  /**
   * Liste les preuves liées à une tâche.
   *
   * Un enfant peut voir les preuves de ses propres tâches.
   * Un parent peut les voir s'il possède un accès read ou write.
   */
  async indexForTask({ auth, request, response }: HttpContext) {
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

    if (user.role === 'child') {
      if (task.assignedChildFk !== user.userId) {
        return response.forbidden({
          message: 'Vous ne pouvez consulter que les preuves de vos tâches.',
        })
      }
    } else {
      if (task.familyFk !== user.currentFamilyFk) {
        return response.forbidden({
          message: 'Cette tâche n’appartient pas à votre famille.',
        })
      }

      const canRead = await this.hasReadOrWriteAccess(user.userId, task.taskId)

      if (!canRead) {
        return response.forbidden({
          message: 'Vous n’avez pas accès aux preuves de cette tâche.',
        })
      }
    }

    const proofs = await Proof.query().where('task_fk', task.taskId).orderBy('submitted_at', 'desc')

    return response.ok({
      proofs: proofs.map((proof) => this.serializeProof(proof)),
    })
  }

  /**
   * Soumission d'une preuve par un enfant.
   *
   * Règles :
   * - seul l'enfant assigné peut soumettre une preuve ;
   * - la preuve doit contenir du texte, une photo, ou les deux ;
   * - la tâche doit être en statut todo ou refused ;
   * - la tâche passe ensuite en statut submitted.
   */
  async submit({ auth, request, response }: HttpContext) {
    const child = auth.getUserOrFail()

    if (child.role !== 'child') {
      return response.forbidden({
        message: 'Seul un enfant peut soumettre une preuve.',
      })
    }

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

    if (task.assignedChildFk !== child.userId) {
      return response.forbidden({
        message: 'Vous ne pouvez soumettre une preuve que pour vos propres tâches.',
      })
    }

    if (!['todo', 'refused'].includes(task.status)) {
      return response.conflict({
        message: 'Cette tâche ne peut pas recevoir de nouvelle preuve actuellement.',
      })
    }

    const payload = await request.validateUsing(submitProofValidator)

    const textContent = payload.textContent?.trim() || null
    const photoPath = payload.photoPath?.trim() || null

    if (!textContent && !photoPath) {
      return response.status(422).send({
        message: 'Une preuve doit contenir du texte, une photo, ou les deux.',
      })
    }

    const proof = await db.transaction(async (trx) => {
      const createdProof = new Proof()

      createdProof.proofType = this.getProofType(textContent, photoPath)
      createdProof.textContent = textContent
      createdProof.photoPath = photoPath
      createdProof.status = 'pending'
      createdProof.taskVersionAtSubmit = task.version
      createdProof.decisionComment = null
      createdProof.decidedAt = null
      createdProof.decidedByFk = null
      createdProof.submittedByFk = child.userId
      createdProof.taskFk = task.taskId

      createdProof.useTransaction(trx)
      await createdProof.save()

      task.status = 'submitted'
      task.useTransaction(trx)
      await task.save()

      return createdProof
    })

    return response.created({
      message: 'Preuve soumise avec succès.',
      proof: this.serializeProof(proof),
    })
  }

  /**
   * Décision parentale sur une preuve.
   *
   * Règles :
   * - seul un parent avec accès write peut décider ;
   * - une preuve déjà décidée ne peut pas être redécidée ;
   * - la version de la tâche doit correspondre à celle au moment de l'envoi ;
   * - la tâche passe en validated ou refused.
   */
  async decide({ auth, request, response }: HttpContext) {
    const parent = auth.getUserOrFail()

    if (parent.role !== 'parent') {
      return response.forbidden({
        message: 'Seul un parent peut valider ou refuser une preuve.',
      })
    }

    const proofId = Number(request.param('id'))

    if (!Number.isInteger(proofId)) {
      return response.status(400).send({
        message: 'Identifiant de preuve invalide.',
      })
    }

    const payload = await request.validateUsing(decideProofValidator)

    const proof = await Proof.find(proofId)

    if (!proof) {
      return response.notFound({
        message: 'Preuve introuvable.',
      })
    }

    if (proof.status !== 'pending') {
      return response.conflict({
        message: 'Cette preuve a déjà été traitée.',
      })
    }

    const task = await Task.find(proof.taskFk)

    if (!task || task.deletedAt) {
      return response.notFound({
        message: 'Tâche associée introuvable.',
      })
    }

    if (task.familyFk !== parent.currentFamilyFk) {
      return response.forbidden({
        message: 'Cette tâche n’appartient pas à votre famille.',
      })
    }

    const canWrite = await this.hasWriteAccess(parent.userId, task.taskId)

    if (!canWrite) {
      return response.forbidden({
        message: 'Vous n’avez pas le droit de valider ou refuser cette preuve.',
      })
    }

    if (task.status !== 'submitted') {
      return response.conflict({
        message: 'La tâche n’est pas en attente de validation.',
      })
    }

    if (proof.taskVersionAtSubmit !== task.version) {
      return response.conflict({
        message: 'La preuve est liée à une ancienne version de la tâche.',
      })
    }

    await db.transaction(async (trx) => {
      proof.status = payload.decision
      proof.decisionComment = payload.decisionComment ?? null
      proof.decidedByFk = parent.userId
      proof.decidedAt = DateTime.now()

      proof.useTransaction(trx)
      await proof.save()

      task.status = payload.decision
      task.version += 1

      task.useTransaction(trx)
      await task.save()
    })

    return response.ok({
      message:
        payload.decision === 'validated'
          ? 'Preuve validée avec succès.'
          : 'Preuve refusée avec succès.',
      proof: this.serializeProof(proof),
    })
  }
}
