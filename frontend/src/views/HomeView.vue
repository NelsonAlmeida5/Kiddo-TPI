<template>
  <section class="page-card">
    <h1 class="page-title">Kiddo</h1>
    <p class="page-subtitle">Suivi des devoirs en famille</p>

    <div class="actions-row">
      <RouterLink class="primary-button" :to="{ name: 'login' }">Se connecter</RouterLink>
      <RouterLink class="secondary-button" :to="{ name: 'register' }">Créer un compte</RouterLink>
    </div>
  </section>
</template>
