import api from '@/services/api'

export const getFamily = async () => {
  const response = await api.get('/family')

  return response.data
}
