<template>
  <section class="home-page">
    <div class="home-hero">
      <h1 class="kiddo-logo kiddo-logo--hero" aria-label="Kiddo">
        <span class="kiddo-logo__letter kiddo-logo__letter--k" aria-hidden="true">K</span>
        <span class="kiddo-logo__letter kiddo-logo__letter--i" aria-hidden="true">i</span>
        <span class="kiddo-logo__letter kiddo-logo__letter--d" aria-hidden="true">d</span>
        <span class="kiddo-logo__letter kiddo-logo__letter--do" aria-hidden="true">do</span>
      </h1>

      <p class="home-subtitle">Suivi des devoirs en famille</p>

      <div class="actions-row home-actions">
        <RouterLink class="primary-button" :to="{ name: 'login' }">Se connecter</RouterLink>
        <RouterLink class="secondary-button" :to="{ name: 'register' }">Créer un compte</RouterLink>
      </div>

      <img
        class="home-image"
        src="/kiddo-homework.jpg"
        alt="Enfant en train de faire ses devoirs"
      />
    </div>
  </section>
</template>
