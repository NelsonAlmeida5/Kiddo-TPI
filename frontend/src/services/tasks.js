import api from '@/services/api'

export const getTasks = async (sort = 'due_date') => {
  const response = await api.get('/tasks', {
    params: { sort },
  })

  return response.data.tasks
}
