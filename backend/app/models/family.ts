import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Family extends BaseModel {
  static table = 't_family'

  @column({ isPrimary: true, columnName: 'family_id' })
  declare familyId: number

  @column({ columnName: 'owner_user_id' })
  declare ownerUserId: number | null

  @column()
  declare name: string

  @column()
  declare status: 'active' | 'archived'

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime | null
}
