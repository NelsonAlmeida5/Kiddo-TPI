<template>
  <section class="page-card">
    <h1 class="page-title">Page introuvable</h1>
    <p class="page-subtitle">Cette page n’existe pas ou n’est plus disponible.</p>

    <RouterLink class="primary-button" :to="{ name: 'home' }">Retour à l’accueil</RouterLink>
  </section>
</template>
