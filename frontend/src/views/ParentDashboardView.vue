<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { getTasks } from '@/services/tasks'
import { getFamily } from '@/services/family'

const tasks = ref([])
const members = ref([])
const loading = ref(false)
const error = ref(null)
const sort = ref('due_date')

const statusLabels = {
  todo: 'En cours',
  submitted: 'À valider',
  validated: 'Validées',
  refused: 'Refusées',
}

const statusOrder = ['todo', 'submitted', 'validated', 'refused']

const childNameById = computed(() => {
  const names = {}

  members.value.forEach((member) => {
    names[member.userId] = member.name
  })

  return names
})

const groupedTasks = computed(() => {
  return statusOrder.map((status) => ({
    status,
    label: statusLabels[status],
    tasks: tasks.value.filter((task) => task.status === status),
  }))
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

const loadDashboard = async () => {
  loading.value = true
  error.value = null

  try {
    const [tasksData, familyData] = await Promise.all([getTasks(sort.value), getFamily()])

    tasks.value = tasksData
    members.value = familyData.members
  } catch {
    error.value = 'Impossible de charger les tâches.'
  } finally {
    loading.value = false
  }
}

watch(sort, () => {
  loadDashboard()
})

onMounted(() => {
  loadDashboard()
})
</script>

<template>
  <section class="dashboard-page">
    <div class="dashboard-header">
      <div>
        <h1 class="page-title">Toutes les tâches</h1>
        <p class="page-subtitle">Suivi des devoirs et tâches des enfants.</p>
      </div>

      <button class="primary-button" type="button">Ajouter une tâche</button>
    </div>

    <div class="dashboard-toolbar">
      <label for="sort">Trier par :</label>

      <select id="sort" v-model="sort">
        <option value="due_date">Date d’échéance</option>
        <option value="title">Ordre alphabétique</option>
      </select>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <p v-if="loading" class="loading-text">Chargement des tâches...</p>

    <div v-else class="task-sections">
      <section
        v-for="group in groupedTasks"
        :key="group.status"
        :class="['status-section', `status-section--${group.status}`]"
      >
        <h2>{{ group.label }} - {{ group.tasks.length }}</h2>

        <div v-if="group.tasks.length === 0" class="empty-state">
          Aucune tâche dans cette catégorie.
        </div>

        <div v-else class="task-list">
          <article v-for="task in group.tasks" :key="task.taskId" class="task-card">
            <div>
              <h3>{{ task.title }}</h3>

              <p v-if="task.description" class="task-description">
                {{ task.description }}
              </p>

              <p class="task-meta">
                {{ childNameById[task.assignedChildFk] || 'Enfant inconnu' }}
                · Échéance : {{ formatDate(task.dueDate) }}
              </p>
            </div>

            <div class="task-actions">
              <button v-if="task.status === 'submitted'" class="secondary-button" type="button">
                Voir preuve
              </button>

              <button class="secondary-button" type="button">Détail</button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </section>
</template>
