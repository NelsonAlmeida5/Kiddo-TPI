import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class Proof extends BaseModel {
  static table = 't_proof'

  @column({ isPrimary: true, columnName: 'proof_id' })
  declare proofId: number

  @column({ columnName: 'proof_type' })
  declare proofType: 'text' | 'photo' | 'text_photo'

  @column({ columnName: 'text_content' })
  declare textContent: string | null

  @column({ columnName: 'photo_path' })
  declare photoPath: string | null

  @column()
  declare status: 'pending' | 'validated' | 'refused'

  @column({ columnName: 'task_version_at_submit' })
  declare taskVersionAtSubmit: number

  @column({ columnName: 'decision_comment' })
  declare decisionComment: string | null

  @column({ columnName: 'decided_by_fk' })
  declare decidedByFk: number | null

  @column({ columnName: 'submitted_by_fk' })
  declare submittedByFk: number

  @column({ columnName: 'task_fk' })
  declare taskFk: number

  @column.dateTime({ autoCreate: true, columnName: 'submitted_at' })
  declare submittedAt: DateTime

  @column.dateTime({ columnName: 'decided_at' })
  declare decidedAt: DateTime | null
}
