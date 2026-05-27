import { test } from '@japa/runner'

const extractTokenValue = (token: unknown) => {
  if (!token) {
    return null
  }

  if (typeof token === 'string') {
    return token
  }

  if (typeof token === 'object' && 'value' in token) {
    return String(token.value)
  }

  if (typeof token === 'object' && 'token' in token) {
    return String(token.token)
  }

  return null
}

// Ce test d'intégration vérifie un scénario métier complet.
// Il utilise l'API, l'authentification et la base de données MySQL.
test.group('TI-01 - scénario de validation de tâche', () => {
  test('TI-01 - une tâche validée ne peut plus être modifiée', async ({ client, assert }) => {
    // 1. Connexion du parent
    const parentLoginResponse = await client.post('/login').json({
      username: 'nelson',
      password: 'Password123!',
    })

    parentLoginResponse.assertStatus(200)

    const parentToken = extractTokenValue(parentLoginResponse.body().token)

    if (!parentToken) {
      throw new Error('Token parent introuvable.')
    }

    // 2. Connexion de l'enfant
    const childLoginResponse = await client.post('/login').json({
      username: 'lucas',
      password: 'Password123!',
    })

    childLoginResponse.assertStatus(200)

    const childToken = extractTokenValue(childLoginResponse.body().token)

    if (!childToken) {
      throw new Error('Token enfant introuvable.')
    }

    // 3. Le parent crée une tâche pour l'enfant Lucas.
    const createTaskResponse = await client
      .post('/tasks')
      .header('Authorization', `Bearer ${parentToken}`)
      .json({
        title: 'TI-01 - tâche à valider',
        description: 'Tâche créée automatiquement par le test d’intégration.',
        dueDate: '2026-06-15T18:00:00.000Z',
        assignedChildFk: 3,
        accessLevelForOtherParents: 'none',
      })

    createTaskResponse.assertStatus(201)

    const taskId = createTaskResponse.body().task?.taskId

    assert.isNumber(taskId)

    // 4. L'enfant soumet une preuve texte.
    const submitProofResponse = await client
      .post(`/tasks/${taskId}/proofs`)
      .header('Authorization', `Bearer ${childToken}`)
      .json({
        textContent: 'J’ai terminé la tâche demandée.',
      })

    submitProofResponse.assertStatus(201)

    const proofId = submitProofResponse.body().proof?.proofId

    assert.isNumber(proofId)
    assert.equal(submitProofResponse.body().proof?.status, 'pending')

    // 5. Le parent valide la preuve.
    const decideProofResponse = await client
      .post(`/proofs/${proofId}/decision`)
      .header('Authorization', `Bearer ${parentToken}`)
      .json({
        decision: 'validated',
        decisionComment: 'Travail validé par le test d’intégration.',
      })

    decideProofResponse.assertStatus(200)
    assert.equal(decideProofResponse.body().proof?.status, 'validated')

    // 6. Le parent tente ensuite de modifier la tâche validée.
    const updateAfterValidationResponse = await client
      .put(`/tasks/${taskId}`)
      .header('Authorization', `Bearer ${parentToken}`)
      .json({
        title: 'Modification interdite après validation',
      })

    // 7. Le backend doit refuser la modification.
    updateAfterValidationResponse.assertStatus(409)
    assert.equal(
      updateAfterValidationResponse.body().message,
      'Une tâche soumise ou validée ne peut pas être modifiée.'
    )

    // 8. Vérification finale : la tâche reste bien validée.
    const parentTasksResponse = await client
      .get('/tasks')
      .header('Authorization', `Bearer ${parentToken}`)

    parentTasksResponse.assertStatus(200)

    const validatedTask = parentTasksResponse
      .body()
      .tasks.find((task: { taskId: number }) => task.taskId === taskId)

    assert.exists(validatedTask)
    assert.equal(validatedTask.status, 'validated')
  })
})
