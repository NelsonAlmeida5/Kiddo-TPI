<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { createChild, getFamily, leaveFamily, removeFamilyMember } from '@/services/family'
import {
  cancelInvitation,
  getInvitations,
  respondInvitation,
  sendInvitation,
} from '@/services/invitations'

const authStore = useAuthStore()

const members = ref([])
const familyName = ref(null)
const familyOwnerUserId = ref(null)
const receivedInvitations = ref([])
const sentInvitations = ref([])
const loading = ref(false)
const actionLoading = ref(false)
const error = ref(null)
const success = ref(null)

const childForm = reactive({
  username: '',
  name: '',
  password: '',
})

const invitationForm = reactive({
  invitedUsername: '',
})

const currentUserId = computed(() => authStore.user?.userId)
const isParent = computed(() => authStore.isParent)

const parents = computed(() => {
  return members.value.filter((member) => member.role === 'parent')
})

const children = computed(() => {
  return members.value.filter((member) => member.role === 'child')
})

const isFamilyOwner = computed(() => {
  return isParent.value && familyOwnerUserId.value === currentUserId.value
})

const canLeaveFamily = computed(() => {
  return isParent.value && !isFamilyOwner.value
})

const familyTitle = computed(() => {
  if (familyName.value) {
    return familyName.value
  }

  return 'Famille actuelle'
})

const pendingReceivedInvitations = computed(() => {
  return receivedInvitations.value.filter((invitation) => invitation.status === 'pending')
})

const pendingSentInvitations = computed(() => {
  return sentInvitations.value.filter((invitation) => invitation.status === 'pending')
})

const getDisplayName = (name, username, fallback) => {
  if (name) {
    return name
  }

  if (username) {
    return username
  }

  return fallback
}

const getReceivedInvitationText = (invitation) => {
  const inviterName = getDisplayName(
    invitation.inviterName,
    invitation.inviterUsername,
    'Un parent',
  )

  const targetFamilyName = invitation.familyName || 'une famille Kiddo'

  return `${inviterName} souhaite vous ajouter à ${targetFamilyName}.`
}

const getSentInvitationText = (invitation) => {
  const invitedUserName = getDisplayName(
    invitation.invitedUserName,
    invitation.invitedUsername,
    'un utilisateur',
  )

  const targetFamilyName = invitation.familyName || 'votre famille'

  return `Invitation envoyée à ${invitedUserName} pour rejoindre ${targetFamilyName}.`
}

const resetMessages = () => {
  error.value = null
  success.value = null
}

const loadFamilyPage = async () => {
  loading.value = true
  resetMessages()

  try {
    const [familyData, invitationData] = await Promise.all([getFamily(), getInvitations()])

    members.value = familyData.members || []
    familyName.value = familyData.family?.name || familyData.familyName || null
    familyOwnerUserId.value = familyData.family?.ownerUserId || familyData.ownerUserId || null

    receivedInvitations.value =
      invitationData.receivedInvitations || invitationData.invitations || []

    sentInvitations.value = invitationData.sentInvitations || []
  } catch {
    error.value = 'Impossible de charger les informations de famille.'
  } finally {
    loading.value = false
  }
}

const submitChild = async () => {
  actionLoading.value = true
  resetMessages()

  try {
    const child = await createChild({
      username: childForm.username,
      name: childForm.name,
      password: childForm.password,
    })

    members.value.push(child)

    childForm.username = ''
    childForm.name = ''
    childForm.password = ''

    success.value = 'Compte enfant créé avec succès.'
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible de créer le compte enfant.'
  } finally {
    actionLoading.value = false
  }
}

const submitInvitation = async () => {
  actionLoading.value = true
  resetMessages()

  try {
    const invitation = await sendInvitation(invitationForm.invitedUsername)

    sentInvitations.value.unshift(invitation)
    invitationForm.invitedUsername = ''

    success.value = 'Invitation envoyée avec succès.'
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible d’envoyer l’invitation.'
  } finally {
    actionLoading.value = false
  }
}

const answerInvitation = async (invitationId, decision) => {
  actionLoading.value = true
  resetMessages()

  try {
    await respondInvitation(invitationId, decision)

    success.value = decision === 'accepted' ? 'Invitation acceptée.' : 'Invitation refusée.'

    await loadFamilyPage()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible de répondre à l’invitation.'
  } finally {
    actionLoading.value = false
  }
}

const cancelPendingInvitation = async (invitationId) => {
  actionLoading.value = true
  resetMessages()

  try {
    await cancelInvitation(invitationId)

    success.value = 'Invitation annulée.'

    await loadFamilyPage()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible d’annuler l’invitation.'
  } finally {
    actionLoading.value = false
  }
}

const removeMember = async (member) => {
  const confirmed = window.confirm(`Voulez-vous vraiment retirer ${member.name} de la famille ?`)

  if (!confirmed) {
    return
  }

  actionLoading.value = true
  resetMessages()

  try {
    await removeFamilyMember(member.userId)

    success.value = 'Membre retiré de la famille.'
    await loadFamilyPage()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible de retirer ce membre.'
  } finally {
    actionLoading.value = false
  }
}

const leaveCurrentFamily = async () => {
  const confirmed = window.confirm('Voulez-vous vraiment quitter cette famille ?')

  if (!confirmed) {
    return
  }

  actionLoading.value = true
  resetMessages()

  try {
    await leaveFamily()
    await authStore.fetchMe()

    success.value = 'Vous avez quitté la famille.'
    await loadFamilyPage()
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'Impossible de quitter cette famille.'
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  loadFamilyPage()
})
</script>

<template>
  <section class="family-page">
    <header class="family-header">
      <h1 class="page-title">Famille</h1>
      <p class="page-subtitle">Gestion des membres et invitations Kiddo.</p>
    </header>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="success" class="success-message">
      {{ success }}
    </div>

    <p v-if="loading" class="loading-text">Chargement de la famille...</p>

    <div v-else class="family-layout">
      <section class="page-card family-card family-card--members">
        <div class="family-card-header">
          <div>
            <h2>{{ familyTitle }}</h2>
            <p>{{ members.length }} membre{{ members.length > 1 ? 's' : '' }}</p>
          </div>

          <button
            v-if="canLeaveFamily"
            class="secondary-button"
            type="button"
            :disabled="actionLoading"
            @click="leaveCurrentFamily"
          >
            Quitter la famille
          </button>
        </div>

        <div class="family-member-section">
          <h3>Parents</h3>

          <div v-if="parents.length === 0" class="empty-state">Aucun parent.</div>

          <div v-else class="family-member-list">
            <article v-for="parent in parents" :key="parent.userId" class="family-member-card">
              <div class="family-member-info">
                <strong>{{ parent.name }}</strong>
                <span>{{ parent.username }}</span>
              </div>

              <div class="family-member-actions">
                <span v-if="parent.userId === currentUserId" class="member-badge">Vous</span>

                <span v-else-if="parent.userId === familyOwnerUserId" class="member-badge">
                  Propriétaire
                </span>

                <button
                  v-if="isFamilyOwner && parent.userId !== currentUserId"
                  class="danger-button danger-button--small"
                  type="button"
                  :disabled="actionLoading"
                  @click="removeMember(parent)"
                >
                  Retirer
                </button>
              </div>
            </article>
          </div>
        </div>

        <div class="family-member-section">
          <h3>Enfants</h3>

          <div v-if="children.length === 0" class="empty-state">Aucun enfant.</div>

          <div v-else class="family-member-list">
            <article v-for="child in children" :key="child.userId" class="family-member-card">
              <div class="family-member-info">
                <strong>{{ child.name }}</strong>
                <span>{{ child.username }}</span>
              </div>

              <div class="family-member-actions">
                <span v-if="child.userId === currentUserId" class="member-badge">Toi-même</span>

                <button
                  v-if="isFamilyOwner"
                  class="danger-button danger-button--small"
                  type="button"
                  :disabled="actionLoading"
                  @click="removeMember(child)"
                >
                  Retirer
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <aside class="family-side">
        <section class="page-card family-card">
          <h2>Invitations reçues</h2>

          <div v-if="pendingReceivedInvitations.length === 0" class="empty-state">
            Aucune invitation reçue.
          </div>

          <article
            v-for="invitation in pendingReceivedInvitations"
            :key="invitation.invitationId"
            class="invitation-card"
          >
            <p>{{ getReceivedInvitationText(invitation) }}</p>

            <div class="inline-actions">
              <button
                class="primary-button"
                type="button"
                :disabled="actionLoading"
                @click="answerInvitation(invitation.invitationId, 'accepted')"
              >
                Accepter
              </button>

              <button
                class="danger-button"
                type="button"
                :disabled="actionLoading"
                @click="answerInvitation(invitation.invitationId, 'refused')"
              >
                Refuser
              </button>
            </div>
          </article>
        </section>

        <section v-if="isParent" class="page-card family-card">
          <h2>Inviter un nouveau membre</h2>
          <p class="help-text">
            L’invitation est visible dans l’espace Kiddo de l’utilisateur invité.
          </p>

          <form class="family-form family-form--inline" @submit.prevent="submitInvitation">
            <div class="form-field">
              <label for="invitedUsername">Nom d’utilisateur Kiddo</label>
              <input
                id="invitedUsername"
                v-model="invitationForm.invitedUsername"
                type="text"
                required
                minlength="3"
                maxlength="50"
                placeholder="ex. john.doe"
              />
            </div>

            <button class="primary-button" type="submit" :disabled="actionLoading">
              Envoyer l’invitation
            </button>
          </form>

          <div class="sent-invitations">
            <h3>Invitations en attente</h3>

            <div v-if="pendingSentInvitations.length === 0" class="empty-state">
              Aucune invitation envoyée en attente.
            </div>

            <article
              v-for="invitation in pendingSentInvitations"
              :key="invitation.invitationId"
              class="invitation-card"
            >
              <p>{{ getSentInvitationText(invitation) }}</p>

              <button
                class="secondary-button"
                type="button"
                :disabled="actionLoading"
                @click="cancelPendingInvitation(invitation.invitationId)"
              >
                Annuler
              </button>
            </article>
          </div>
        </section>

        <section v-if="isParent" class="page-card family-card">
          <h2>Créer un compte enfant</h2>
          <p class="help-text">Le compte enfant créé est automatiquement ajouté à votre famille.</p>

          <form class="family-form" @submit.prevent="submitChild">
            <div class="form-field">
              <label for="childUsername">Nom d’utilisateur</label>
              <input
                id="childUsername"
                v-model="childForm.username"
                type="text"
                required
                minlength="3"
                maxlength="50"
              />
            </div>

            <div class="form-field">
              <label for="childName">Nom de l’enfant</label>
              <input
                id="childName"
                v-model="childForm.name"
                type="text"
                required
                minlength="2"
                maxlength="200"
              />
            </div>

            <div class="form-field">
              <label for="childPassword">Mot de passe</label>
              <input
                id="childPassword"
                v-model="childForm.password"
                type="password"
                required
                minlength="8"
                maxlength="100"
              />
            </div>

            <button class="primary-button" type="submit" :disabled="actionLoading">
              Créer le compte enfant
            </button>
          </form>
        </section>
      </aside>
    </div>
  </section>
</template>
