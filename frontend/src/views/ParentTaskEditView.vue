<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFamily } from '@/services/family'
import { getVisibleTaskById, updateTask } from '@/services/tasks'

const route = useRoute()
const router = useRouter()

const task = ref(null)
const members = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref(null)

const form = reactive({
  title: '',
  description: '',
  dueDate: '',
  assignedChildFk: '',
})

const children = computed(() => {
  return members.value.filter((member) => member.role === 'child')
})

const isTaskEditable = computed(() => {
  return task.value && ['todo', 'refused'].includes(task.value.status)
})

const formatDateForInput = (dateValue) => {
  if (!dateValue) {
    return ''
  }

  return new Date(dateValue).toISOString().slice(0, 10)
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
    members.value = familyData.members

    form.title = taskData.title
    form.description = taskData.description || ''
    form.dueDate = formatDateForInput(taskData.dueDate)
    form.assignedChildFk = taskData.assignedChildFk
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
    error.value = 'Cette tâche ne peut plus être modifiée.'
    return
  }

  saving.value = true
  error.value = null

  try {
    await updateTask(task.value.taskId, {
      title: form.title,
      description: form.description || undefined,
      dueDate: `${form.dueDate}T18:00:00`,
      assignedChildFk: Number(form.assignedChildFk),
    })

    router.push({
      name: 'parent-task-detail',
      params: { id: task.value.taskId },
    })
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
      @click="router.push({ name: 'parent-task-detail', params: { id: route.params.id } })"
    >
      Retour au détail
    </button>

    <form v-if="task" class="task-form-card" @submit.prevent="submitEdit">
      <div class="task-form-header">
        <div>
          <h1 class="page-title">Modifier la tâche</h1>
          <p class="page-subtitle">
            Modification possible uniquement si la tâche n’est pas validée.
          </p>
        </div>

        <button class="primary-button" type="submit" :disabled="saving || !isTaskEditable">
          {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="!isTaskEditable" class="error-message">
        Cette tâche est à valider ou déjà validée. Elle ne peut plus être modifiée.
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
        </div>

        <div class="task-form-right">
          <div class="form-field">
            <label for="dueDate">Date d’échéance</label>
            <input
              id="dueDate"
              v-model="form.dueDate"
              type="date"
              required
              :disabled="!isTaskEditable"
            />
          </div>

          <div class="form-field">
            <label for="assignedChild">Enfant concerné *</label>
            <select
              id="assignedChild"
              v-model="form.assignedChildFk"
              required
              :disabled="!isTaskEditable"
            >
              <option v-for="child in children" :key="child.userId" :value="child.userId">
                {{ child.name }}
              </option>
            </select>
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
