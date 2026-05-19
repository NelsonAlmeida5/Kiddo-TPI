import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import Task from '#models/task'
import User from '#models/user'
import { createTaskValidator } from '#validators/task'

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

  /**
   * Liste les tâches visibles par l'utilisateur connecté.
   *
   * Parent :
   * - voit les tâches auxquelles il possède un accès dans t_task_access.
   *
   * Enfant :
   * - voit uniquement les tâches qui lui sont assignées.
   */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()

    const sort = request.input('sort', 'due_date')
    const sortColumn = sort === 'title' ? 'title' : 'due_date'

    if (user.role === 'child') {
      const tasks = await Task.query()
        .where('assigned_child_fk', user.userId)
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
   * Crée une tâche pour un enfant.
   *
   * Règles appliquées :
   * - seul un parent peut créer une tâche ;
   * - l'enfant assigné doit appartenir à la même famille ;
   * - la tâche est créée avec le statut todo ;
   * - le parent créateur reçoit automatiquement un accès write ;
   * - les autres parents de la famille reçoivent le niveau d'accès choisi.
   */
  async store({ auth, request, response }: HttpContext) {
    const parent = auth.getUserOrFail()

    if (parent.role !== 'parent') {
      return response.forbidden({
        message: 'Seul un parent peut créer une tâche.',
      })
    }

    const payload = await request.validateUsing(createTaskValidator)

    const dueDate = DateTime.fromISO(payload.dueDate)

    if (!dueDate.isValid) {
      return response.status(422).send({
        message: 'La date d’échéance est invalide.',
      })
    }

    const child = await User.find(payload.assignedChildFk)

    if (!child || child.role !== 'child' || child.currentFamilyFk !== parent.currentFamilyFk) {
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
      createdTask.createdByFk = parent.userId
      createdTask.familyFk = parent.currentFamilyFk

      createdTask.useTransaction(trx)
      await createdTask.save()

      const now = new Date()
      const otherParentsAccess = payload.accessLevelForOtherParents ?? 'none'

      const otherParents = await User.query({ client: trx })
        .where('current_family_fk', parent.currentFamilyFk)
        .where('role', 'parent')
        .whereNot('user_id', parent.userId)

      const accessRows = [
        {
          parent_fk: parent.userId,
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
}
