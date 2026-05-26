<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getFamily } from '@/services/family'
import { getVisibleTaskById, updateTask } from '@/services/tasks'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const task = ref(null)
const members = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref(null)

const form = reactive({
  title: '',
  description: '',
  dueDate: '',
  visibleParentIds: [],
})

const parents = computed(() => {
  return members.value.filter((member) => member.role === 'parent')
})

const isOwnTask = computed(() => {
  return (
    task.value &&
    task.value.createdByFk === authStore.user?.userId &&
    task.value.assignedChildFk === authStore.user?.userId
  )
})

const isTaskEditable = computed(() => {
  return task.value && isOwnTask.value && ['todo', 'refused'].includes(task.value.status)
})

const formatDateForInput = (dateValue) => {
  if (!dateValue) {
    return ''
  }

  return new Date(dateValue).toISOString().slice(0, 10)
}

const getTaskVisibleParentIds = (taskData) => {
  if (Array.isArray(taskData.visibleParentIds)) {
    return taskData.visibleParentIds
  }

  if (Array.isArray(taskData.parentAccesses)) {
    return taskData.parentAccesses.map((access) => access.parentFk)
  }

  return []
}

const loadEditPage = async () => {
  loading.value = true
  error.value = null

  try {
    const [taskData, familyData] = await Promise.all([
      getVisibleTaskById(route.params.id),
      getFamily(),
    ])

    if (!taskData) {
      error.value = 'Tâche introuvable ou inaccessible.'
      return
    }

    task.value = taskData
    members.value = familyData.members || []

    form.title = taskData.title
    form.description = taskData.description || ''
    form.dueDate = formatDateForInput(taskData.dueDate)
    form.visibleParentIds = getTaskVisibleParentIds(taskData)
  } catch {
    error.value = 'Impossible de charger la tâche.'
  } finally {
    loading.value = false
  }
}

const submitEdit = async () => {
  if (!task.value) {
    return
  }

  if (!isTaskEditable.value) {
    error.value = 'Cette tâche ne peut pas être modifiée.'
    return
  }

  saving.value = true
  error.value = null

  try {
    await updateTask(task.value.taskId, {
      title: form.title,
      description: form.description || undefined,
      dueDate: `${form.dueDate}T18:00:00`,
      visibleParentIds: form.visibleParentIds.map(Number),
    })

    router.push({ name: 'child-tasks' })
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible de modifier la tâche.'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadEditPage()
})
</script>

<template>
  <section class="task-form-page">
    <button
      class="secondary-button back-button"
      type="button"
      @click="router.push({ name: 'child-tasks' })"
    >
      Retour à mes tâches
    </button>

    <form v-if="task" class="task-form-card" @submit.prevent="submitEdit">
      <div class="task-form-header">
        <div>
          <h1 class="page-title">Modifier ma tâche</h1>
          <p class="page-subtitle">
            Tu peux modifier uniquement les tâches personnelles non terminées.
          </p>
        </div>

        <button class="primary-button" type="submit" :disabled="saving || !isTaskEditable">
          {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="!isOwnTask" class="error-message">
        Tu ne peux modifier que les tâches que tu as créées.
      </div>

      <div v-else-if="!isTaskEditable" class="error-message">
        Cette tâche est déjà soumise ou validée. Elle ne peut plus être modifiée.
      </div>

      <div class="task-form-grid">
        <div class="task-form-left">
          <div class="form-field">
            <label for="title">Titre de la tâche *</label>
            <input
              id="title"
              v-model="form.title"
              type="text"
              required
              maxlength="200"
              :disabled="!isTaskEditable"
            />
          </div>

          <div class="form-field">
            <label for="description">Description</label>
            <textarea
              id="description"
              v-model="form.description"
              maxlength="1000"
              :disabled="!isTaskEditable"
            ></textarea>
          </div>

          <div class="rights-panel">
            <h2>Visibilité</h2>
            <p>Choisis les parents qui peuvent voir cette tâche.</p>

            <div v-if="parents.length === 0" class="empty-state">
              Aucun parent disponible dans la famille.
            </div>

            <div v-else class="visibility-parent-list">
              <label v-for="parent in parents" :key="parent.userId" class="visibility-parent-card">
                <span>
                  <strong>{{ parent.name }}</strong>
                  <small>{{ parent.username }}</small>
                </span>

                <input
                  v-model="form.visibleParentIds"
                  type="checkbox"
                  :value="parent.userId"
                  :disabled="!isTaskEditable"
                />
              </label>
            </div>
          </div>
        </div>

        <div class="task-form-right">
          <div class="form-field">
            <label for="dueDate">Date d’échéance *</label>
            <input
              id="dueDate"
              v-model="form.dueDate"
              type="date"
              required
              :disabled="!isTaskEditable"
            />
          </div>
        </div>
      </div>
    </form>

    <p v-else-if="loading" class="loading-text">Chargement...</p>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>
  </section>
</template>
