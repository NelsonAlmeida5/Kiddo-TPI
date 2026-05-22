import api from '@/services/api'

export const getProofsForTask = async (taskId) => {
  const response = await api.get(`/tasks/${taskId}/proofs`)

  return response.data.proofs
}

export const submitProof = async (taskId, payload) => {
  const response = await api.post(`/tasks/${taskId}/proofs`, payload)

  return response.data.proof
}

export const decideProof = async (proofId, payload) => {
  const response = await api.post(`/proofs/${proofId}/decision`, payload)

  return response.data.proof
}
