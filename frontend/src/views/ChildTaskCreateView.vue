<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getFamily } from '@/services/family'
import { createTask } from '@/services/tasks'

const router = useRouter()

const members = ref([])
const loading = ref(false)
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

const loadFamily = async () => {
  error.value = null

  try {
    const familyData = await getFamily()

    members.value = familyData.members || []
  } catch {
    error.value = 'Impossible de charger les parents de la famille.'
  }
}

const submitTask = async () => {
  loading.value = true
  error.value = null

  try {
    await createTask({
      title: form.title,
      description: form.description || undefined,
      dueDate: `${form.dueDate}T18:00:00`,
      visibleParentIds: form.visibleParentIds.map(Number),
    })

    router.push({ name: 'child-tasks' })
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible de créer la tâche.'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadFamily()
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

    <form class="task-form-card" @submit.prevent="submitTask">
      <div class="task-form-header">
        <div>
          <h1 class="page-title">Nouvelle tâche</h1>
          <p class="page-subtitle">
            Crée une tâche personnelle et choisis quels parents peuvent la voir.
          </p>
        </div>

        <button class="primary-button" type="submit" :disabled="loading">
          {{ loading ? 'Création...' : 'Créer la tâche' }}
        </button>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div class="task-form-grid">
        <div class="task-form-left">
          <div class="form-field">
            <label for="title">Titre de la tâche *</label>
            <input id="title" v-model="form.title" type="text" required maxlength="200" />
          </div>

          <div class="form-field">
            <label for="description">Description</label>
            <textarea id="description" v-model="form.description" maxlength="1000"></textarea>
          </div>

          <div class="rights-panel">
            <h2>Visibilité</h2>
            <p>Choisis les parents qui pourront voir cette tâche.</p>

            <div v-if="parents.length === 0" class="empty-state">
              Aucun parent disponible dans la famille.
            </div>

            <div v-else class="visibility-parent-list">
              <label v-for="parent in parents" :key="parent.userId" class="visibility-parent-card">
                <span>
                  <strong>{{ parent.name }}</strong>
                  <small>{{ parent.username }}</small>
                </span>

                <input v-model="form.visibleParentIds" type="checkbox" :value="parent.userId" />
              </label>
            </div>

            <p class="help-text">
              Si aucun parent n’est coché, la tâche reste personnelle à toi-même.
            </p>
          </div>
        </div>

        <div class="task-form-right">
          <div class="form-field">
            <label for="dueDate">Date d’échéance *</label>
            <input id="dueDate" v-model="form.dueDate" type="date" required />
          </div>
        </div>
      </div>
    </form>
  </section>
</template>
