/* ---------------------------------------------------------------------------
   components.js — Vue-komponenter
   Komponenterna skrivs som objekt med template, props och data enligt
   vue-dag2 och registreras i app.js med .component().

   OBS om callbacks: komponenterna nedan behöver tala om för appen att något
   har hänt, till exempel att användaren har tryckt på "Byt användare". Vues
   eget sätt är $emit, som inte finns i kursmaterialet. I stället skickas
   appens metod ned som en vanlig prop (onLogout, onNavigate) och anropas
   direkt. Det använder bara props, som vi har gått igenom.
--------------------------------------------------------------------------- */

const AppHeader = {
  props: ['user', 'view', 'onNavigate', 'onLogout'],

  template: `
    <header class="site-header">
      <div class="header-inner">
        <p class="brand">veckomenyn</p>

        <div class="header-actions" v-if="user">
          <nav class="main-nav" aria-label="Huvudmeny">
            <button
              type="button"
              class="nav-link"
              :class="{ 'nav-link--active': view === 'plan' }"
              @click="onNavigate('plan')">Veckomeny</button>

            <button
              type="button"
              class="nav-link"
              :class="{ 'nav-link--active': view === 'recept' }"
              @click="onNavigate('recept')">Recept</button>
          </nav>

          <div class="user-badge">
            <span class="user-name">{{ user }}</span>
            <button type="button" class="link-button" @click="onLogout">Byt användare</button>
          </div>
        </div>
      </div>
    </header>
  `
};

const AppFooter = {
  template: `
    <footer class="site-footer">
      <div class="footer-inner">
        <p class="brand brand--small">veckomenyn</p>
        <p class="footer-meta">
          Martin Karlsson &middot; Utveckling av webbapplikationer &middot; Labb 2
        </p>
      </div>
    </footer>
  `
};
