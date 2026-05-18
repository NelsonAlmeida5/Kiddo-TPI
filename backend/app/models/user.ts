import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'

const AuthFinder = withAuthFinder(() => hash.use('argon'), {
  uids: ['username'],
  passwordColumnName: 'passwordHash',
})

export default class User extends compose(BaseModel, AuthFinder) {
  static table = 't_user'

  @column({ isPrimary: true, columnName: 'user_id' })
  declare userId: number

  @column()
  declare username: string

  @column({ serializeAs: null, columnName: 'password_hash' })
  declare passwordHash: string

  @column()
  declare name: string

  @column()
  declare role: 'parent' | 'child'

  @column({ columnName: 'current_family_fk' })
  declare currentFamilyFk: number

  @column.dateTime({ autoCreate: true, columnName: 'created_at' })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, columnName: 'updated_at' })
  declare updatedAt: DateTime | null

  static accessTokens = DbAccessTokensProvider.forModel(User)
}
