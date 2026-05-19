/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const AuthController = () => import('#controllers/auth_controller')
const FamilyController = () => import('#controllers/families_controller')

router.get('/', async () => {
  return {
    message: 'Kiddo API is running',
  }
})

router.post('/register', [AuthController, 'register'])
router.post('/login', [AuthController, 'login'])

router
  .group(() => {
    router.get('/me', [AuthController, 'me'])
    router.post('/logout', [AuthController, 'logout'])

    router.get('/family', [FamilyController, 'show'])
    router.post('/family/children', [FamilyController, 'createChild'])
  })
  .use(middleware.auth({ guards: ['api'] }))
