<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFamily } from '@/services/family'
import { deleteTask, getVisibleTaskById } from '@/services/tasks'
import { decideProof, getProofsForTask } from '@/services/proofs'

const route = useRoute()
const router = useRouter()

const task = ref(null)
const proofs = ref([])
const members = ref([])
const loading = ref(false)
const decisionLoading = ref(false)
const error = ref(null)
const decisionComment = ref('')

const statusLabels = {
  todo: 'En cours',
  submitted: 'À valider',
  validated: 'Validée',
  refused: 'Refusée',
}

const latestProof = computed(() => {
  return proofs.value[0] || null
})

const childName = computed(() => {
  if (!task.value) {
    return 'Enfant inconnu'
  }

  const child = members.value.find((member) => member.userId === task.value.assignedChildFk)

  return child?.name || 'Enfant inconnu'
})

const canDecideProof = computed(() => {
  return task.value?.status === 'submitted' && latestProof.value?.status === 'pending'
})

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

const loadTaskDetail = async () => {
  loading.value = true
  error.value = null

  try {
    const [taskData, proofsData, familyData] = await Promise.all([
      getVisibleTaskById(route.params.id),
      getProofsForTask(route.params.id),
      getFamily(),
    ])

    if (!taskData) {
      error.value = 'Tâche introuvable ou inaccessible.'
      return
    }

    task.value = taskData
    proofs.value = proofsData
    members.value = familyData.members
  } catch {
    error.value = 'Impossible de charger le détail de la tâche.'
  } finally {
    loading.value = false
  }
}

const submitDecision = async (decision) => {
  if (!latestProof.value) {
    return
  }

  decisionLoading.value = true
  error.value = null

  try {
    await decideProof(latestProof.value.proofId, {
      decision,
      decisionComment: decisionComment.value || undefined,
    })

    await loadTaskDetail()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible de traiter la preuve.'
  } finally {
    decisionLoading.value = false
  }
}

onMounted(() => {
  loadTaskDetail()
})

const isTaskEditable = computed(() => {
  return task.value && ['todo', 'refused'].includes(task.value.status)
})

const isTaskDeletable = computed(() => {
  return task.value && ['todo', 'refused'].includes(task.value.status)
})

const deleteCurrentTask = async () => {
  if (!task.value) {
    return
  }

  const confirmed = window.confirm('Voulez-vous vraiment supprimer cette tâche ?')

  if (!confirmed) {
    return
  }

  decisionLoading.value = true
  error.value = null

  try {
    await deleteTask(task.value.taskId)

    router.push({ name: 'parent-dashboard' })
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible de supprimer la tâche.'
  } finally {
    decisionLoading.value = false
  }
}
</script>

<template>
  <section class="task-detail-page">
    <button
      class="secondary-button back-button"
      type="button"
      @click="router.push({ name: 'parent-dashboard' })"
    >
      Retour au dashboard
    </button>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <p v-if="loading" class="loading-text">Chargement du détail...</p>

    <article v-else-if="task" class="task-detail-card">
      <div class="task-detail-header">
        <div>
          <h1 class="page-title">{{ task.title }}</h1>
        </div>

        <div class="task-detail-header-actions">
          <RouterLink
            v-if="isTaskEditable"
            class="secondary-button"
            :to="{ name: 'parent-task-edit', params: { id: task.taskId } }"
          >
            Modifier
          </RouterLink>
          <button
            v-if="isTaskDeletable"
            class="danger-button"
            type="button"
            :disabled="decisionLoading"
            @click="deleteCurrentTask"
          >
            Supprimer
          </button>
          <span :class="['status-badge', `status-badge--${task.status}`]">
            {{ statusLabels[task.status] || task.status }}
          </span>
        </div>
      </div>

      <div class="task-detail-grid">
        <section class="task-detail-section">
          <h2>Détail de la tâche</h2>

          <p v-if="task.description">
            {{ task.description }}
          </p>

          <p v-else class="muted-text">Aucune description renseignée.</p>

          <dl class="detail-list">
            <div>
              <dt>Enfant concerné</dt>
              <dd>{{ childName }}</dd>
            </div>

            <div>
              <dt>Date d’échéance</dt>
              <dd>{{ formatDate(task.dueDate) }}</dd>
            </div>

            <div>
              <dt>Version de la tâche</dt>
              <dd>{{ task.version }}</dd>
            </div>
          </dl>
        </section>

        <section class="task-detail-section proof-section">
          <h2>Preuve envoyée</h2>

          <div v-if="!latestProof" class="empty-state">
            Aucune preuve n’a encore été envoyée pour cette tâche.
          </div>

          <div v-else class="proof-card">
            <p v-if="latestProof.textContent" class="proof-text">
              {{ latestProof.textContent }}
            </p>

            <p v-if="latestProof.photoPath" class="proof-photo">
              Photo : {{ latestProof.photoPath }}
            </p>

            <p class="proof-meta">Soumise le {{ formatDate(latestProof.submittedAt) }}</p>

            <div v-if="canDecideProof" class="decision-box">
              <div class="form-field">
                <label for="decisionComment">Commentaire de décision</label>
                <textarea
                  id="decisionComment"
                  v-model="decisionComment"
                  placeholder="Optionnel : préciser la raison de validation ou de refus."
                ></textarea>
              </div>

              <div class="actions-row">
                <button
                  class="primary-button"
                  type="button"
                  :disabled="decisionLoading"
                  @click="submitDecision('validated')"
                >
                  Valider
                </button>

                <button
                  class="danger-button"
                  type="button"
                  :disabled="decisionLoading"
                  @click="submitDecision('refused')"
                >
                  Refuser
                </button>
              </div>
            </div>

            <p v-else-if="latestProof.decisionComment" class="proof-meta">
              Commentaire : {{ latestProof.decisionComment }}
            </p>
          </div>
        </section>
      </div>
    </article>
  </section>
</template>
