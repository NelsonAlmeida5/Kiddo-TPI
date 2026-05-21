<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getFamily } from '@/services/family'
import { createTask } from '@/services/tasks'

const router = useRouter()
const authStore = useAuthStore()

const members = ref([])
const loading = ref(false)
const error = ref(null)

const form = reactive({
  title: '',
  description: '',
  dueDate: '',
  assignedChildFk: '',
  parentAccesses: {},
})

const children = computed(() => {
  return members.value.filter((member) => member.role === 'child')
})

const otherParents = computed(() => {
  return members.value.filter((member) => {
    return member.role === 'parent' && member.userId !== authStore.user?.userId
  })
})

const loadFamily = async () => {
  try {
    const familyData = await getFamily()

    members.value = familyData.members

    if (children.value.length > 0) {
      form.assignedChildFk = children.value[0].userId
    }

    otherParents.value.forEach((parent) => {
      form.parentAccesses[parent.userId] = 'none'
    })
  } catch {
    error.value = 'Impossible de charger les membres de la famille.'
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
      assignedChildFk: Number(form.assignedChildFk),
      parentAccesses: otherParents.value.map((parent) => ({
        parentId: parent.userId,
        accessLevel: form.parentAccesses[parent.userId] ?? 'none',
      })),
    })

    router.push({ name: 'parent-dashboard' })
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
    <form class="task-form-card" @submit.prevent="submitTask">
      <div class="task-form-header">
        <h1 class="page-title">Nouvelle tâche</h1>

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
            <h2>Gestion des droits par co-parent</h2>
            <p>Définissez qui peut voir ou modifier cette tâche.</p>

            <div v-if="otherParents.length === 0" class="empty-state">
              Aucun autre parent dans cette famille.
            </div>

            <div v-else class="rights-list">
              <div v-for="parent in otherParents" :key="parent.userId" class="co-parent-access-row">
                <div>
                  <strong>{{ parent.name }}</strong>
                </div>

                <select v-model="form.parentAccesses[parent.userId]">
                  <option value="read">Lecture seule</option>
                  <option value="write">Modification</option>
                  <option value="none">Aucun accès</option>
                </select>
              </div>
            </div>

            <p class="help-text">
              Une tâche est privée entre parent et enfant si les autres parents ont aucun accès.
            </p>
          </div>
        </div>

        <div class="task-form-right">
          <div class="form-field">
            <label for="dueDate">Date d’échéance</label>
            <input id="dueDate" v-model="form.dueDate" type="date" required />
          </div>

          <div class="form-field">
            <label for="assignedChild">Enfant concerné *</label>
            <select id="assignedChild" v-model="form.assignedChildFk" required>
              <option v-for="child in children" :key="child.userId" :value="child.userId">
                {{ child.name }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </form>
  </section>
</template>
