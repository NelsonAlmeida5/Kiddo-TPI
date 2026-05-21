import api from '@/services/api'

export const getTasks = async (sort = 'due_date') => {
  const response = await api.get('/tasks', {
    params: { sort },
  })

  return response.data.tasks
}

export const createTask = async (payload) => {
  const response = await api.post('/tasks', payload)

  return response.data.task
}
