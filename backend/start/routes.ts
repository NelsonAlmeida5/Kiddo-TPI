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
const ProofsController = () => import('#controllers/proofs_controller')
const InvitationsController = () => import('#controllers/invitations_controller')

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
    router.delete('/family/members/:id', [FamilyController, 'removeMember'])

    router.get('/tasks', [TasksController, 'index'])
    router.post('/tasks', [TasksController, 'store'])
    router.put('/tasks/:id', [TasksController, 'update'])
    router.delete('/tasks/:id', [TasksController, 'destroy'])

    router.get('/tasks/:id/proofs', [ProofsController, 'indexForTask'])
    router.post('/tasks/:id/proofs', [ProofsController, 'submit'])
    router.post('/proofs/:id/decision', [ProofsController, 'decide'])

    router.get('/invitations', [InvitationsController, 'index'])
    router.post('/invitations', [InvitationsController, 'store'])
    router.post('/invitations/:id/respond', [InvitationsController, 'respond'])
    router.post('/invitations/:id/cancel', [InvitationsController, 'cancel'])
  })
  .use(middleware.auth({ guards: ['api'] }))
