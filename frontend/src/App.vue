<script setup>
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const dashboardRoute = computed(() => {
  if (authStore.isParent) {
    return { name: 'parent-dashboard' }
  }

  if (authStore.isChild) {
    return { name: 'child-tasks' }
  }

  return { name: 'home' }
})

const logout = async () => {
  await authStore.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink class="brand" :to="dashboardRoute">
        <span class="brand-mark">K</span>
        <span>Kiddo</span>
      </RouterLink>

      <nav class="main-nav">
        <template v-if="authStore.isAuthenticated">
          <RouterLink v-if="authStore.isParent" :to="{ name: 'parent-dashboard' }">
            Dashboard
          </RouterLink>

          <RouterLink v-if="authStore.isChild" :to="{ name: 'child-tasks' }">Mes tâches</RouterLink>

          <RouterLink :to="{ name: 'family' }">Famille</RouterLink>

          <button class="link-button" type="button" @click="logout">Déconnexion</button>
        </template>

        <template v-else>
          <RouterLink :to="{ name: 'home' }">Accueil</RouterLink>
          <RouterLink :to="{ name: 'login' }">Connexion</RouterLink>
          <RouterLink :to="{ name: 'register' }">Inscription</RouterLink>
        </template>
      </nav>
    </header>

    <main class="app-main">
      <RouterView />
    </main>

    <footer class="app-footer">2026 Kiddo - ETML TPI</footer>
  </div>
</template>
