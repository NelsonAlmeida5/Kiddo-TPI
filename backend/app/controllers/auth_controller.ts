import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import { loginValidator, registerValidator } from '#validators/auth'

export default class AuthController {
  /**
   * Retourne uniquement les données utilisateur utiles au frontend.
   * Le hash du mot de passe n'est jamais exposé.
   */
  private serializeUser(user: User) {
    return {
      userId: user.userId,
      username: user.username,
      name: user.name,
      role: user.role,
      currentFamilyFk: user.currentFamilyFk,
    }
  }

  /**
   * Création d'un compte Kiddo.
   *
   * Flux retenu :
   * 1. créer une famille personnelle sans owner_user_id ;
   * 2. créer l'utilisateur rattaché à cette famille ;
   * 3. mettre à jour owner_user_id avec l'id de l'utilisateur.
   *
   * Les trois opérations sont faites dans une transaction pour éviter
   * un état incomplet en base.
   */
  async register({ request, response }: HttpContext) {
    const payload = await request.validateUsing(registerValidator)

    const existingUser = await User.findBy('username', payload.username)

    if (existingUser) {
      return response.conflict({
        message: 'Ce nom d’utilisateur est déjà utilisé.',
      })
    }

    const user = await db.transaction(async (trx) => {
      const now = new Date()

      const insertedFamilyIds = await trx.table('t_family').insert({
        owner_user_id: null,
        name: `Famille ${payload.name}`,
        status: 'active',
        created_at: now,
        updated_at: null,
      })

      const familyId = Number(insertedFamilyIds[0])

      const createdUser = new User()

      createdUser.username = payload.username
      createdUser.passwordHash = payload.password
      createdUser.name = payload.name
      createdUser.role = payload.role
      createdUser.currentFamilyFk = familyId

      createdUser.useTransaction(trx)
      await createdUser.save()

      await trx.query().from('t_family').where('family_id', familyId).update({
        owner_user_id: createdUser.userId,
        updated_at: new Date(),
      })

      return createdUser
    })

    const token = await User.accessTokens.create(user, ['*'], {
      name: 'kiddo_web',
    })

    return response.created({
      message: 'Compte créé avec succès.',
      user: this.serializeUser(user),
      token,
    })
  }

  /**
   * Connexion d'un utilisateur existant.
   *
   * User.verifyCredentials utilise AuthFinder et évite les vérifications
   * manuelles vulnérables aux attaques par timing.
   */
  async login({ request, response }: HttpContext) {
    const payload = await request.validateUsing(loginValidator)

    const user = await User.verifyCredentials(payload.username, payload.password)

    const token = await User.accessTokens.create(user, ['*'], {
      name: 'kiddo_web',
    })

    return response.ok({
      message: 'Connexion réussie.',
      user: this.serializeUser(user),
      token,
    })
  }

  /**
   * Retourne l'utilisateur actuellement authentifié.
   */
  async me({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail()

    return response.ok({
      user: this.serializeUser(user),
    })
  }

  /**
   * Déconnexion : invalide le token courant.
   */
  async logout({ auth, response }: HttpContext) {
    await auth.use('api').invalidateToken()

    return response.ok({
      message: 'Déconnexion réussie.',
    })
  }
}
