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
const TasksController = () => import('#controllers/tasks_controller')

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

    router.get('/tasks', [TasksController, 'index'])
    router.post('/tasks', [TasksController, 'store'])
    router.put('/tasks/:id', [TasksController, 'update'])
    router.delete('/tasks/:id', [TasksController, 'destroy'])
  })
  .use(middleware.auth({ guards: ['api'] }))
