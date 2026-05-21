import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Task from '#models/task'
import User from '#models/user'
import { createTaskValidator, updateTaskValidator } from '#validators/task'

export default class TasksController {
  private serializeTask(task: Task) {
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
    }
  }

  private getUniqueIds(ids?: number[]) {
    return [...new Set(ids ?? [])]
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

  private async findParentsInSameFamily(parentIds: number[], familyId: number) {
    if (parentIds.length === 0) {
      return []
    }

    return User.query()
      .whereIn('user_id', parentIds)
      .where('role', 'parent')
      .where('current_family_fk', familyId)
  }

  /**
   * Liste les tâches visibles par l'utilisateur connecté.
   *
   * Parent :
   * - voit les tâches auxquelles il possède un accès read ou write.
   *
   * Enfant :
   * - voit uniquement les tâches qui lui sont assignées dans sa famille courante.
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
        tasks: tasks.map((task) => this.serializeTask(task)),
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
      tasks: tasks.map((task) => this.serializeTask(task)),
    })
  }

  /**
   * Crée une tâche.
   *
   * Parent :
   * - crée une tâche pour un enfant de sa famille ;
   * - définit l'accès des autres parents présents.
   *
   * Enfant :
   * - crée une tâche personnelle pour lui-même ;
   * - choisit les parents qui peuvent la voir.
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
      if (payload.assignedChildFk === undefined) {
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
        task: this.serializeTask(task),
      })
    }

    const visibleParentIds = this.getUniqueIds(payload.visibleParentIds)
    const visibleParents = await this.findParentsInSameFamily(
      visibleParentIds,
      user.currentFamilyFk
    )

    if (visibleParents.length !== visibleParentIds.length) {
      return response.forbidden({
        message: 'Un ou plusieurs parents sélectionnés ne font pas partie de votre famille.',
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

      if (visibleParents.length > 0) {
        const now = new Date()

        await trx.table('t_task_access').insert(
          visibleParents.map((parent) => ({
            parent_fk: parent.userId,
            task_fk: createdTask.taskId,
            access_level: 'read',
            created_at: now,
            updated_at: null,
          }))
        )
      }

      return createdTask
    })

    return response.created({
      message: 'Tâche personnelle créée avec succès.',
      task: this.serializeTask(task),
    })
  }

  /**
   * Modifie une tâche.
   *
   * Parent :
   * - doit avoir l'accès write.
   *
   * Enfant :
   * - peut modifier uniquement une tâche qu'il a créée lui-même.
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

    const payload = await request.validateUsing(updateTaskValidator)

    if (task.status === 'submitted' || task.status === 'validated') {
      return response.conflict({
        message: 'Une tâche soumise ou validée ne peut pas être modifiée.',
      })
    }

    if (user.role === 'parent') {
      const canWrite = await this.hasWriteAccess(user.userId, task.taskId)

      if (!canWrite) {
        return response.forbidden({
          message: 'Vous n’avez pas le droit de modifier cette tâche.',
        })
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

      if (payload.dueDate) {
        const dueDate = DateTime.fromISO(payload.dueDate)

        if (!dueDate.isValid) {
          return response.status(422).send({
            message: 'La date d’échéance est invalide.',
          })
        }

        task.dueDate = dueDate
      }

      task.version += 1
      await task.save()

      if (payload.accessLevelForOtherParents) {
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
        task: this.serializeTask(task),
      })
    }

    if (task.createdByFk !== user.userId || task.assignedChildFk !== user.userId) {
      return response.forbidden({
        message: 'Un enfant peut modifier uniquement les tâches qu’il a créées.',
      })
    }

    if (payload.assignedChildFk !== undefined) {
      return response.forbidden({
        message: 'Un enfant ne peut pas réassigner une tâche.',
      })
    }

    const visibleParentIds = this.getUniqueIds(payload.visibleParentIds)
    const visibleParents = await this.findParentsInSameFamily(
      visibleParentIds,
      user.currentFamilyFk
    )

    if (visibleParents.length !== visibleParentIds.length) {
      return response.forbidden({
        message: 'Un ou plusieurs parents sélectionnés ne font pas partie de votre famille.',
      })
    }

    await db
      .transaction(async (trx) => {
        if (payload.title !== undefined) {
          task.title = payload.title
        }

        if (payload.description !== undefined) {
          task.description = payload.description
        }

        if (payload.dueDate) {
          const dueDate = DateTime.fromISO(payload.dueDate)

          if (!dueDate.isValid) {
            throw new Error('INVALID_DUE_DATE')
          }

          task.dueDate = dueDate
        }

        task.version += 1
        task.useTransaction(trx)
        await task.save()

        if (payload.visibleParentIds !== undefined) {
          await trx.query().from('t_task_access').where('task_fk', task.taskId).delete()

          if (visibleParents.length > 0) {
            const now = new Date()

            await trx.table('t_task_access').insert(
              visibleParents.map((parent) => ({
                parent_fk: parent.userId,
                task_fk: task.taskId,
                access_level: 'read',
                created_at: now,
                updated_at: null,
              }))
            )
          }
        }
      })
      .catch((error) => {
        if (error.message === 'INVALID_DUE_DATE') {
          return response.status(422).send({
            message: 'La date d’échéance est invalide.',
          })
        }

        throw error
      })

    return response.ok({
      message: 'Tâche personnelle modifiée avec succès.',
      task: this.serializeTask(task),
    })
  }

  /**
   * Supprime logiquement une tâche.
   *
   * Parent :
   * - doit avoir l'accès write.
   *
   * Enfant :
   * - peut supprimer uniquement les tâches qu'il a créées.
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

    if (task.createdByFk !== user.userId || task.assignedChildFk !== user.userId) {
      return response.forbidden({
        message: 'Un enfant peut supprimer uniquement les tâches qu’il a créées.',
      })
    }

    if (task.status === 'submitted' || task.status === 'validated') {
      return response.conflict({
        message: 'Une tâche soumise ou validée ne peut pas être supprimée.',
      })
    }

    task.deletedAt = DateTime.now()
    task.version += 1
    await task.save()

    return response.ok({
      message: 'Tâche personnelle supprimée avec succès.',
    })
  }
}
