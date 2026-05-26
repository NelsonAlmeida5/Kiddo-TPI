import api from '@/services/api'

export const getInvitations = async () => {
  const response = await api.get('/invitations')

  return response.data
}

export const sendInvitation = async (invitedUsername) => {
  const response = await api.post('/invitations', {
    invitedUsername,
  })

  return response.data.invitation
}

export const respondInvitation = async (invitationId, decision) => {
  const response = await api.post(`/invitations/${invitationId}/respond`, {
    decision,
  })

  return response.data.invitation
}

export const cancelInvitation = async (invitationId) => {
  const response = await api.post(`/invitations/${invitationId}/cancel`)

  return response.data.invitation
}
