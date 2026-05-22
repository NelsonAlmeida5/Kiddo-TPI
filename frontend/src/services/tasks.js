import api from '@/services/api'

export const getTasks = async (sort = 'due_date') => {
  const response = await api.get('/tasks', {
    params: { sort },
  })

  return response.data.tasks
}

export const getVisibleTaskById = async (taskId) => {
  const tasks = await getTasks()

  return tasks.find((task) => task.taskId === Number(taskId)) || null
}

export const createTask = async (payload) => {
  const response = await api.post('/tasks', payload)

  return response.data.task
}

export const updateTask = async (taskId, payload) => {
  const response = await api.put(`/tasks/${taskId}`, payload)

  return response.data.task
}
