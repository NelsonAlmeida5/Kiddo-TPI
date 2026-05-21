<script setup>
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  username: '',
  password: '',
})

const submitLogin = async () => {
  const user = await authStore.login(form)

  if (user.role === 'parent') {
    router.push({ name: 'parent-dashboard' })
    return
  }

  router.push({ name: 'child-tasks' })
}
</script>

<template>
  <section class="page-card">
    <h1 class="page-title">Connexion</h1>
    <p class="page-subtitle">Connecte-toi à ton espace Kiddo.</p>

    <form class="form-grid" @submit.prevent="submitLogin">
      <div v-if="authStore.error" class="error-message">
        {{ authStore.error }}
      </div>

      <div class="form-field">
        <label for="username">Nom d’utilisateur</label>
        <input id="username" v-model="form.username" type="text" autocomplete="username" required />
      </div>

      <div class="form-field">
        <label for="password">Mot de passe</label>
        <input
          id="password"
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>

      <button class="primary-button" type="submit" :disabled="authStore.loading">
        {{ authStore.loading ? 'Connexion...' : 'Se connecter' }}
      </button>

      <RouterLink :to="{ name: 'register' }">Pas encore de compte ? Créer un compte</RouterLink>
    </form>
  </section>
</template>
