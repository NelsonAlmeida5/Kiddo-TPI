import api from '@/services/api'

export const getFamily = async () => {
  const response = await api.get('/family')

  return response.data
}

export const createChild = async (payload) => {
  const response = await api.post('/family/children', payload)

  return response.data.child
}

export const removeFamilyMember = async (memberId) => {
  const response = await api.delete(`/family/members/${memberId}`)

  return response.data
}

export const leaveFamily = async () => {
  const response = await api.post('/family/leave')

  return response.data
}
