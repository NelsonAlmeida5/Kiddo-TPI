import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Task extends BaseModel {
  static table = 't_task'

  @column({ isPrimary: true, columnName: 'task_id' })
  declare taskId: number

  @column()
  declare title: string

  @column()
  declare description: string | null

  @column.dateTime({ columnName: 'due_date' })
  declare dueDate: DateTime

  @column()
  declare status: 'todo' | 'submitted' | 'validated' | 'refused'

  @column()
  declare version: number

  @column({ columnName: 'assigned_child_fk' })
  declare assignedChildFk: number

  @column({ columnName: 'created_by_fk' })
  declare createdByFk: number

  @column({ columnName: 'family_fk' })
  declare familyFk: number

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime | null

  @column.dateTime({ columnName: 'deleted_at' })
  declare deletedAt: DateTime | null
}
