<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { getTasks } from '@/services/tasks'
import { getProofsForTask, submitProof } from '@/services/proofs'

const tasks = ref([])
const proofsByTaskId = ref({})
const loading = ref(false)
const submittingTaskId = ref(null)
const error = ref(null)
const successMessage = ref(null)

const proofTexts = reactive({})

const actionableTasks = computed(() => {
  return tasks.value.filter((task) => ['todo', 'refused'].includes(task.status))
})

const pendingTasks = computed(() => {
  return tasks.value.filter((task) => task.status === 'submitted')
})

const completedTasks = computed(() => {
  return tasks.value.filter((task) => task.status === 'validated')
})

const latestProofForTask = (taskId) => {
  return proofsByTaskId.value[taskId]?.[0] || null
}

const formatDate = (dateValue) => {
  if (!dateValue) {
    return 'Aucune date'
  }

  return new Intl.DateTimeFormat('fr-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateValue))
}

const loadProofsForRelevantTasks = async (loadedTasks) => {
  const tasksWithProofs = loadedTasks.filter((task) => {
    return ['submitted', 'validated', 'refused'].includes(task.status)
  })

  const proofEntries = await Promise.all(
    tasksWithProofs.map(async (task) => {
      const proofs = await getProofsForTask(task.taskId)

      return [task.taskId, proofs]
    }),
  )

  proofsByTaskId.value = Object.fromEntries(proofEntries)
}

const loadTasks = async () => {
  loading.value = true
  error.value = null
  successMessage.value = null

  try {
    const tasksData = await getTasks('due_date')

    tasks.value = tasksData

    tasksData.forEach((task) => {
      if (proofTexts[task.taskId] === undefined) {
        proofTexts[task.taskId] = ''
      }
    })

    await loadProofsForRelevantTasks(tasksData)
  } catch {
    error.value = 'Impossible de charger les tâches.'
  } finally {
    loading.value = false
  }
}

const submitTaskProof = async (task) => {
  const textContent = proofTexts[task.taskId]?.trim()

  if (!textContent) {
    error.value = 'La preuve texte ne peut pas être vide.'
    return
  }

  submittingTaskId.value = task.taskId
  error.value = null
  successMessage.value = null

  try {
    await submitProof(task.taskId, {
      textContent,
    })

    proofTexts[task.taskId] = ''
    successMessage.value = 'Preuve envoyée avec succès. La tâche est en attente de validation.'

    await loadTasks()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible d’envoyer la preuve.'
  } finally {
    submittingTaskId.value = null
  }
}

onMounted(() => {
  loadTasks()
})
</script>

<template>
  <section class="child-tasks-page">
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">Mes tâches</h1>
        <p class="page-subtitle">Consulte tes tâches et envoie une preuve quand c’est terminé.</p>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <p v-if="loading" class="loading-text">Chargement des tâches...</p>

    <template v-else>
      <div class="child-tasks-layout">
        <div class="child-tasks-main">
          <section class="child-section child-section--tasks">
            <h2>Tâches</h2>

            <div v-if="actionableTasks.length === 0" class="empty-state">
              Aucune tâche à faire pour le moment.
            </div>

            <div v-else class="child-task-list">
              <article v-for="task in actionableTasks" :key="task.taskId" class="child-task-card">
                <div class="child-task-header">
                  <div>
                    <h3>{{ task.title }}</h3>
                    <p class="task-meta">Échéance : {{ formatDate(task.dueDate) }}</p>
                  </div>

                  <span :class="['child-status-pill', `child-status-pill--${task.status}`]">
                    {{ task.status === 'refused' ? 'À corriger' : 'À faire' }}
                  </span>
                </div>

                <p v-if="task.description" class="task-description">
                  {{ task.description }}
                </p>

                <div v-if="task.status === 'refused'" class="refused-box">
                  <strong>Preuve refusée</strong>
                  <p v-if="latestProofForTask(task.taskId)?.decisionComment">
                    {{ latestProofForTask(task.taskId).decisionComment }}
                  </p>
                  <p v-else>Tu peux corriger et envoyer une nouvelle preuve.</p>
                </div>

                <div class="form-field">
                  <label :for="`proof-${task.taskId}`">J’ai fait quoi ?</label>
                  <textarea
                    :id="`proof-${task.taskId}`"
                    v-model="proofTexts[task.taskId]"
                    placeholder="Explique brièvement ce que tu as terminé."
                  ></textarea>
                </div>

                <button
                  class="primary-button"
                  type="button"
                  :disabled="submittingTaskId === task.taskId"
                  @click="submitTaskProof(task)"
                >
                  {{ submittingTaskId === task.taskId ? 'Envoi...' : 'Envoyer la preuve' }}
                </button>
              </article>
            </div>
          </section>

          <section class="child-section child-section--pending">
            <h2>En attente de validation</h2>

            <div v-if="pendingTasks.length === 0" class="empty-state">
              Aucune tâche en attente de validation.
            </div>

            <div v-else class="child-task-list">
              <article v-for="task in pendingTasks" :key="task.taskId" class="child-task-card">
                <div class="child-task-header">
                  <div>
                    <h3>{{ task.title }}</h3>
                    <p class="task-meta">Échéance : {{ formatDate(task.dueDate) }}</p>
                  </div>

                  <span class="child-status-pill child-status-pill--submitted">En attente</span>
                </div>

                <p v-if="task.description" class="task-description">
                  {{ task.description }}
                </p>

                <div class="proof-preview">
                  <strong>Preuve envoyée</strong>
                  <p v-if="latestProofForTask(task.taskId)?.textContent">
                    {{ latestProofForTask(task.taskId).textContent }}
                  </p>
                  <p v-else>La preuve a été envoyée au parent.</p>
                </div>
              </article>
            </div>
          </section>
        </div>

        <aside class="child-tasks-side">
          <section class="child-section child-section--completed">
            <h2>Tâches terminées</h2>

            <div v-if="completedTasks.length === 0" class="empty-state">
              Aucune tâche validée pour le moment.
            </div>

            <div v-else class="child-task-list">
              <article v-for="task in completedTasks" :key="task.taskId" class="child-task-card">
                <div class="child-task-header">
                  <div>
                    <h3>{{ task.title }}</h3>
                    <p class="task-meta">Échéance : {{ formatDate(task.dueDate) }}</p>
                  </div>

                  <span class="child-status-pill child-status-pill--validated">Validée</span>
                </div>

                <p v-if="task.description" class="task-description">
                  {{ task.description }}
                </p>
              </article>
            </div>
          </section>
        </aside>
      </div>
    </template>
  </section>
</template>
