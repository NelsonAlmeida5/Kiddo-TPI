import { test } from '@japa/runner'
import {
  canChangeTaskStatus,
  canEditTaskStatus,
  canUseParentAction,
  getInvalidLoginMessage,
  hasWriteAccess,
  isOwnChildTask,
  isRequiredTextValid,
  isValidTaskStatus,
  isValidUserRole,
} from '#services/business_rules'

// Ces tests unitaires vérifient des règles métier isolées.

test.group('Règles métier - tests unitaires', () => {
  test('TU-01 - un parent peut effectuer une action parent', ({ assert }) => {
    const user = {
      userId: 1,
      role: 'parent' as const,
    }

    assert.isTrue(canUseParentAction(user))
  })

  test('TU-02 - un enfant ne peut pas effectuer une action parent', ({ assert }) => {
    const user = {
      userId: 2,
      role: 'child' as const,
    }

    assert.isFalse(canUseParentAction(user))
  })

  test('TU-03 - un champ obligatoire vide est refusé', ({ assert }) => {
    assert.isFalse(isRequiredTextValid(''))
    assert.isFalse(isRequiredTextValid('   '))
    assert.isFalse(isRequiredTextValid(null))
    assert.isTrue(isRequiredTextValid('Faire les exercices'))
  })

  test('TU-04 - une valeur de statut valide est acceptée', ({ assert }) => {
    assert.isTrue(isValidTaskStatus('todo'))
    assert.isTrue(isValidTaskStatus('submitted'))
    assert.isTrue(isValidTaskStatus('validated'))
    assert.isTrue(isValidTaskStatus('refused'))

    assert.isFalse(isValidTaskStatus('deleted'))
    assert.isFalse(isValidTaskStatus('finished'))
  })

  test('TU-05 - une transition de statut interdite est refusée', ({ assert }) => {
    assert.isTrue(canChangeTaskStatus('todo', 'submitted'))
    assert.isTrue(canChangeTaskStatus('refused', 'submitted'))
    assert.isTrue(canChangeTaskStatus('submitted', 'validated'))
    assert.isTrue(canChangeTaskStatus('submitted', 'refused'))

    assert.isFalse(canChangeTaskStatus('validated', 'todo'))
    assert.isFalse(canChangeTaskStatus('validated', 'refused'))
    assert.isFalse(canChangeTaskStatus('submitted', 'todo'))
    assert.isFalse(canChangeTaskStatus('refused', 'validated'))
  })

  test('TU-06 - un parent sans droit de modification est refusé', ({ assert }) => {
    assert.isFalse(hasWriteAccess('none'))
    assert.isFalse(hasWriteAccess('read'))
    assert.isTrue(hasWriteAccess('write'))
  })

  test('TU-07 - un enfant ne peut gérer que ses propres tâches', ({ assert }) => {
    const child = {
      userId: 3,
      role: 'child' as const,
    }

    const ownTask = {
      createdByFk: 3,
      assignedChildFk: 3,
    }

    const taskCreatedByParent = {
      createdByFk: 1,
      assignedChildFk: 3,
    }

    const taskCreatedByAnotherChild = {
      createdByFk: 4,
      assignedChildFk: 3,
    }

    assert.isTrue(isOwnChildTask(ownTask, child))
    assert.isFalse(isOwnChildTask(taskCreatedByParent, child))
    assert.isFalse(isOwnChildTask(taskCreatedByAnotherChild, child))
  })

  test('TU-08 - une tâche validée ne peut plus être modifiée directement', ({ assert }) => {
    assert.isTrue(canEditTaskStatus('todo'))
    assert.isTrue(canEditTaskStatus('refused'))
    assert.isFalse(canEditTaskStatus('submitted'))
    assert.isFalse(canEditTaskStatus('validated'))
  })

  test('TU-09 - le message de connexion invalide ne révèle pas quelle donnée est fausse', ({
    assert,
  }) => {
    const message = getInvalidLoginMessage()

    assert.equal(message, 'Nom d’utilisateur ou mot de passe incorrect.')
    assert.notInclude(message.toLowerCase(), 'utilisateur inexistant')
    assert.notInclude(message.toLowerCase(), 'mot de passe faux')
    assert.notInclude(message.toLowerCase(), 'username inexistant')
  })

  test('TU-10 - un rôle utilisateur manipulé est refusé', ({ assert }) => {
    assert.isTrue(isValidUserRole('parent'))
    assert.isTrue(isValidUserRole('child'))

    assert.isFalse(isValidUserRole('admin'))
    assert.isFalse(isValidUserRole('teacher'))
    assert.isFalse(isValidUserRole(''))
    assert.isFalse(isValidUserRole('   '))
  })
})
