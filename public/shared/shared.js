/**
 * UMCE Virtual — Shared JavaScript
 * Partial loader, navigation, scroll observer, utilities
 */

(function () {
  'use strict';

  // Enable fade-up animations (content visible by default for crawlers/print)
  document.documentElement.classList.add('js-loaded');

  // ==========================================
  // Partial Loader
  // ==========================================
  async function loadPartial(placeholderId, url) {
    const el = document.getElementById(placeholderId);
    if (!el) return;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to load ${url}`);
      el.innerHTML = await resp.text();
    } catch (err) {
      console.warn(`Could not load partial ${url}:`, err.message);
    }
  }

  async function loadSharedComponents() {
    await Promise.all([
      loadPartial('nav-placeholder', '/shared/nav.html'),
      loadPartial('footer-placeholder', '/shared/footer.html'),
      loadPartial('chatbot-placeholder', '/shared/chatbot.html'),
    ]);

    // Initialize nav after loading
    initNavigation();
    // Initialize scroll observer
    initScrollObserver();
    // Check admin role and show admin button
    checkAdminAccess();
    // Update nav for logged-in users
    checkAuthState();
  }

  // ==========================================
  // Navigation
  // ==========================================
  function initNavigation() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    // Highlight current page
    const currentPath = window.location.pathname;
    navbar.querySelectorAll('.nav-link[data-page]').forEach(link => {
      const href = link.getAttribute('href');
      if (
        (href === '/' && currentPath === '/') ||
        (href !== '/' && currentPath.startsWith(href))
      ) {
        link.classList.add('active');
      }
    });

    // Nav: glass over dark hero, solid on other pages or after scroll
    const hasHero = !!document.querySelector('[data-hero-bg]');
    const solidBg = 'rgba(17,24,39,0.97)';
    const glassBg = 'rgba(0,0,0,0.15)';

    function setNavBg(bg) {
      navbar.style.background = bg;
      navbar.style.backdropFilter = 'blur(12px)';
      navbar.style.webkitBackdropFilter = 'blur(12px)';
    }

    // Pages without hero: always solid dark
    if (!hasHero) setNavBg(solidBg);

    function onScroll() {
      if (window.scrollY > 80) {
        navbar.classList.add('nav-scrolled');
        setNavBg(solidBg);
      } else {
        navbar.classList.remove('nav-scrolled');
        setNavBg(hasHero ? glassBg : solidBg);
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Mobile menu toggle
    const menuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (menuBtn && mobileMenu) {
      menuBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
      });
      mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => mobileMenu.classList.add('hidden'));
      });
    }
  }

  // ==========================================
  // Scroll Observer (fade-up animations)
  // ==========================================
  function initScrollObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

    // Re-observe if new elements are added dynamically
    window._umceObserver = observer;
  }

  // ==========================================
  // Admin Access Button
  // ==========================================
  async function checkAdminAccess() {
    try {
      const res = await fetch('/api/admin/role');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.role) return;

      // Inject admin button in desktop nav (before CTA div)
      const cta = document.querySelector('#navbar .flex.items-center.gap-3:last-child');
      if (cta) {
        const btn = document.createElement('a');
        btn.href = '/admin';
        btn.className = 'inline-flex items-center gap-1.5 bg-white/15 text-white font-medium text-xs px-3 py-2 rounded-lg hover:bg-white/25 transition-colors border border-white/20';
        btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> Admin';
        cta.insertBefore(btn, cta.firstChild);
      }

      // Inject in mobile menu too
      const mobileMenu = document.querySelector('#mobile-menu .flex.flex-col');
      if (mobileMenu) {
        const mobileBtn = document.createElement('a');
        mobileBtn.href = '/admin';
        mobileBtn.className = 'mt-2 inline-flex items-center justify-center gap-2 bg-white/15 text-white font-bold text-sm px-5 py-2.5 rounded-lg border border-white/20';
        mobileBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> Panel Admin';
        mobileMenu.appendChild(mobileBtn);
      }
    } catch { /* not logged in or no role — silently ignore */ }
  }

  // ==========================================
  // Auth State — update nav when logged in
  // ==========================================
  async function checkAuthState() {
    try {
      const res = await fetch('/auth/me');
      if (!res.ok) return;
      const user = await res.json();
      if (!user || !user.email) return;

      const initial = (user.name || user.email)[0].toUpperCase();
      const firstName = (user.name || user.email.split('@')[0]).split(' ')[0];

      // Desktop: replace "Mis cursos" CTA with user menu
      const cta = document.querySelector('#navbar .flex.items-center.gap-3:last-child');
      if (cta) {
        const misCursosBtn = cta.querySelector('a[href="/mis-cursos"]');
        if (misCursosBtn) {
          misCursosBtn.outerHTML =
            '<a href="/mis-cursos" class="hidden sm:inline-flex items-center gap-2 font-heading font-bold text-sm px-4 py-2.5 rounded-lg transition-colors" style="background: var(--palette-accent); color: #001D5C;">' +
              '<div class="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-xs font-bold" style="color: #001D5C;">' + initial + '</div>' +
              firstName +
            '</a>' +
            '<button onclick="if(confirm(\'¿Cerrar sesión?\'))window.location=\'/auth/logout\'" class="hidden sm:inline-flex items-center text-white/50 hover:text-white/90 text-[11px] transition-colors cursor-pointer bg-transparent border-0 px-2 py-1">' +
              'Salir' +
            '</button>';
        }
      }

      // Mobile: update mis-cursos link
      const mobileMenu = document.querySelector('#mobile-menu .flex.flex-col');
      if (mobileMenu) {
        const mobileBtn = mobileMenu.querySelector('a[href="/mis-cursos"]');
        if (mobileBtn) {
          mobileBtn.innerHTML =
            '<div class="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center text-xs font-bold" style="color: #001D5C;">' + initial + '</div> ' +
            'Mis cursos';
        }
        // Add logout link with confirmation
        const logoutLink = document.createElement('button');
        logoutLink.className = 'py-2 text-white/50 hover:text-white text-sm text-left bg-transparent border-0 cursor-pointer';
        logoutLink.textContent = 'Cerrar sesión';
        logoutLink.onclick = function() { if (confirm('¿Cerrar sesión?')) window.location = '/auth/logout'; };
        mobileMenu.appendChild(logoutLink);
      }
    } catch { /* not logged in — keep default nav */ }
  }

  // ==========================================
  // Utilities
  // ==========================================

  /** Format date to Chilean locale */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /** Format short date */
  function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** Truncate text */
  function truncate(text, maxLen = 150) {
    if (!text || text.length <= maxLen) return text || '';
    return text.substring(0, maxLen).replace(/\s+\S*$/, '') + '...';
  }

  /** Strip HTML tags */
  function stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || '';
  }

  /** Get URL parameter */
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  /** Get slug from URL path (e.g., /programa/diplomado-ia → diplomado-ia) */
  function getSlugFromPath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? parts[parts.length - 1] : null;
  }

  /** Generate badge class from type */
  function typeBadgeClass(type) {
    const map = {
      diplomado: 'badge-diplomado',
      curso_abierto: 'badge-curso',
      ruta_formativa: 'badge-ruta',
      magister: 'badge-magister',
      prosecucion: 'badge-prosecucion',
      certificacion: 'badge-certificacion',
      postitulo: 'badge-diplomado',
    };
    return map[type] || 'badge-curso';
  }

  /** Generate human-readable type label */
  function typeLabel(type) {
    const map = {
      diplomado: 'Diplomado',
      curso_abierto: 'Curso',
      ruta_formativa: 'Ruta Formativa',
      magister: 'Magíster',
      prosecucion: 'Prosecución',
      postitulo: 'Postítulo',
      certificacion: 'Certificación',
    };
    return map[type] || type;
  }

  /** Status badge class */
  function statusBadgeClass(status) {
    const map = {
      active: 'badge-active',
      upcoming: 'badge-upcoming',
      closed: 'badge-closed',
      informativo: 'badge-closed',
    };
    return map[status] || 'badge-closed';
  }

  /** Status label */
  function statusLabel(status) {
    const map = {
      active: 'Inscripciones abiertas',
      upcoming: 'Próximamente',
      closed: 'Finalizado',
      informativo: 'Informativo',
      in_progress: 'En curso',
    };
    return map[status] || status;
  }

  /** Create skeleton loading cards */
  function renderSkeletons(container, count = 6) {
    container.innerHTML = Array.from({ length: count }, () => `
      <div class="bg-white rounded-2xl overflow-hidden border border-gray-100">
        <div class="skeleton h-36"></div>
        <div class="p-5 space-y-3">
          <div class="skeleton h-4 w-20"></div>
          <div class="skeleton h-5 w-3/4"></div>
          <div class="skeleton h-4 w-full"></div>
          <div class="skeleton h-4 w-1/2"></div>
        </div>
      </div>
    `).join('');
  }

  /** Observe new elements for fade-up animation */
  function observeNewElements(container) {
    if (!container) return;
    const elements = container.querySelectorAll('.fade-up');
    if (window._umceObserver) {
      elements.forEach(el => window._umceObserver.observe(el));
    } else {
      // Observer not ready yet — make elements visible immediately
      elements.forEach(el => el.classList.add('visible'));
    }
  }

  // ==========================================
  // Expose API
  // ==========================================
  window.UMCE = {
    loadSharedComponents,
    loadPartial,
    formatDate,
    formatDateShort,
    truncate,
    stripHtml,
    getParam,
    getSlugFromPath,
    typeBadgeClass,
    typeLabel,
    statusBadgeClass,
    statusLabel,
    renderSkeletons,
    observeNewElements,
  };

  // Auto-load shared components on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSharedComponents);
  } else {
    loadSharedComponents();
  }
})();
