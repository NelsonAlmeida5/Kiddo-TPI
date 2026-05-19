import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Invitation extends BaseModel {
  static table = 't_invitation'

  @column({ isPrimary: true, columnName: 'invitation_id' })
  declare invitationId: number

  @column()
  declare status: 'pending' | 'accepted' | 'refused' | 'cancelled'

  @column({ columnName: 'invited_user_fk' })
  declare invitedUserFk: number

  @column({ columnName: 'inviter_fk' })
  declare inviterFk: number

  @column({ columnName: 'family_fk' })
  declare familyFk: number

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ columnName: 'responded_at' })
  declare respondedAt: DateTime | null
}
