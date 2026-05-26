<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
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
  <header class="app-header">
    <RouterLink class="brand" :to="dashboardRoute" aria-label="Kiddo">
      <span class="kiddo-logo kiddo-logo--nav" aria-hidden="true">
        <span class="kiddo-logo__letter kiddo-logo__letter--k">K</span>
        <span class="kiddo-logo__letter kiddo-logo__letter--i">i</span>
        <span class="kiddo-logo__letter kiddo-logo__letter--d">d</span>
        <span class="kiddo-logo__letter kiddo-logo__letter--do">do</span>
      </span>
    </RouterLink>

    <nav class="main-nav">
      <template v-if="authStore.isAuthenticated">
        <RouterLink v-if="authStore.isParent" :to="{ name: 'parent-dashboard' }">
          Dashboard
        </RouterLink>

        <RouterLink v-if="authStore.isChild" :to="{ name: 'child-tasks' }"> Mes tâches </RouterLink>

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
</template>
