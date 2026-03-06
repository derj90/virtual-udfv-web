/**
 * UMCE Virtual — Shared JavaScript
 * Partial loader, navigation, scroll observer, utilities
 */

(function () {
  'use strict';

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

    // Nav shrink on scroll
    function onScroll() {
      if (window.scrollY > 80) {
        navbar.classList.add('nav-scrolled');
      } else {
        navbar.classList.remove('nav-scrolled');
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
    };
    return map[type] || 'badge-curso';
  }

  /** Generate human-readable type label */
  function typeLabel(type) {
    const map = {
      diplomado: 'Diplomado',
      curso_abierto: 'Curso',
      ruta_formativa: 'Ruta Formativa',
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
    };
    return map[status] || 'badge-closed';
  }

  /** Status label */
  function statusLabel(status) {
    const map = {
      active: 'Inscripciones abiertas',
      upcoming: 'Próximamente',
      closed: 'Finalizado',
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
    if (window._umceObserver && container) {
      container.querySelectorAll('.fade-up').forEach(el => window._umceObserver.observe(el));
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
