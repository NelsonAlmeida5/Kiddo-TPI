<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  role: 'parent',
  username: '',
  name: '',
  password: '',
  passwordConfirmation: '',
})

const submitRegister = async () => {
  if (form.password !== form.passwordConfirmation) {
    authStore.error = 'Les mots de passe ne correspondent pas.'
    return
  }

  const user = await authStore.register({
    role: form.role,
    username: form.username,
    name: form.name,
    password: form.password,
  })

  if (user.role === 'parent') {
    router.push({ name: 'parent-dashboard' })
    return
  }

  router.push({ name: 'child-tasks' })
}
</script>

<template>
  <section class="page-card">
    <h1 class="page-title">Inscription</h1>
    <p class="page-subtitle">Crée ton compte Kiddo.</p>

    <form class="form-grid" @submit.prevent="submitRegister">
      <div v-if="authStore.error" class="error-message">
        {{ authStore.error }}
      </div>

      <div class="form-field">
        <label for="role">Je suis...</label>
        <select id="role" v-model="form.role">
          <option value="parent">Parent</option>
          <option value="child">Enfant</option>
        </select>
      </div>

      <div class="form-field">
        <label for="username">Nom d’utilisateur</label>
        <input id="username" v-model="form.username" type="text" required />
      </div>

      <div class="form-field">
        <label for="name">Votre nom</label>
        <input id="name" v-model="form.name" type="text" required />
      </div>

      <div class="form-field">
        <label for="password">Mot de passe</label>
        <input id="password" v-model="form.password" type="password" required />
      </div>

      <div class="form-field">
        <label for="passwordConfirmation">Confirmer mot de passe</label>
        <input
          id="passwordConfirmation"
          v-model="form.passwordConfirmation"
          type="password"
          required
        />
      </div>

      <button class="primary-button" type="submit" :disabled="authStore.loading">
        {{ authStore.loading ? 'Création...' : 'Créer un compte' }}
      </button>

      <RouterLink :to="{ name: 'login' }">Vous avez déjà un compte ? Connexion</RouterLink>
    </form>
  </section>
</template>
