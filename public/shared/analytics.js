/**
 * UMCE Virtual — Analytics & Tracking
 *
 * Integrates Google Analytics 4 (GA4) and Microsoft Clarity.
 * Respects cookie consent: scripts only initialize after the user
 * accepts analytics cookies (or immediately if no consent banner
 * is present — set ANALYTICS_REQUIRE_CONSENT = true to enforce).
 *
 * ─────────────────────────────────────────────────────────────
 *  CONFIGURACIÓN: reemplaza los valores de abajo con los IDs reales
 * ─────────────────────────────────────────────────────────────
 *  GA_MEASUREMENT_ID   → Tu ID de GA4, ej.: "G-XXXXXXXXXX"
 *  CLARITY_PROJECT_ID  → Tu Project ID de Clarity, ej.: "abc123xyz"
 * ─────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // CONFIGURACIÓN — reemplazar con IDs reales
  // ──────────────────────────────────────────────
  var GA_MEASUREMENT_ID  = 'G-29SZ3XD1YE';
  var CLARITY_PROJECT_ID = 'vtp9i7byej';

  // Poner en true para requerir consentimiento explícito antes de cargar los scripts.
  // En false, los scripts se cargan inmediatamente (útil mientras no hay banner de cookies).
  var ANALYTICS_REQUIRE_CONSENT = false;

  // Clave usada en localStorage para recordar el consentimiento del usuario
  var CONSENT_KEY = 'umce_analytics_consent';

  // ──────────────────────────────────────────────
  // Validación — no ejecutar si los IDs son placeholders
  // ──────────────────────────────────────────────
  var ga4Ready     = GA_MEASUREMENT_ID  !== 'GA_MEASUREMENT_ID';
  var clarityReady = CLARITY_PROJECT_ID !== 'CLARITY_PROJECT_ID';

  if (!ga4Ready && !clarityReady) {
    console.info('[UMCE Analytics] IDs de tracking no configurados. Edita shared/analytics.js para activar GA4 y Clarity.');
    return;
  }

  // ──────────────────────────────────────────────
  // Helpers de consentimiento
  // ──────────────────────────────────────────────
  function hasConsent() {
    try {
      return localStorage.getItem(CONSENT_KEY) === 'granted';
    } catch (e) {
      return false;
    }
  }

  function grantConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, 'granted');
    } catch (e) {}
  }

  function revokeConsent() {
    try {
      localStorage.setItem(CONSENT_KEY, 'denied');
    } catch (e) {}
  }

  // Exponer API pública para integración con banners de cookies externos
  window.UMCEAnalytics = {
    grant: function () {
      grantConsent();
      initAll();
    },
    revoke: revokeConsent,
    hasConsent: hasConsent
  };

  // ──────────────────────────────────────────────
  // Google Analytics 4 (GA4)
  // ──────────────────────────────────────────────
  function initGA4() {
    if (window._ga4Initialized) return;
    window._ga4Initialized = true;

    // Snippet estándar de gtag.js
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
      // Anonimizar IPs (buena práctica GDPR/privacidad)
      anonymize_ip: true,
      // Enviar page_view automático en SPA si cambias de ruta manualmente
      send_page_view: true
    });

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(script);

    console.info('[UMCE Analytics] GA4 inicializado:', GA_MEASUREMENT_ID);
  }

  // ──────────────────────────────────────────────
  // Microsoft Clarity
  // ──────────────────────────────────────────────
  function initClarity() {
    if (window._clarityInitialized) return;
    window._clarityInitialized = true;

    // Snippet estándar de Microsoft Clarity
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r);
      t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_PROJECT_ID);

    console.info('[UMCE Analytics] Microsoft Clarity inicializado:', CLARITY_PROJECT_ID);
  }

  // ──────────────────────────────────────────────
  // Inicialización conjunta
  // ──────────────────────────────────────────────
  function initAll() {
    if (ga4Ready) initGA4();
    if (clarityReady) initClarity();
  }

  // ──────────────────────────────────────────────
  // Punto de entrada — respeta política de consentimiento
  // ──────────────────────────────────────────────
  function boot() {
    if (!ANALYTICS_REQUIRE_CONSENT) {
      // Modo sin banner: cargar inmediatamente
      initAll();
      return;
    }

    // Modo con banner: cargar solo si ya hay consentimiento previo
    if (hasConsent()) {
      initAll();
    }
    // Si no hay consentimiento, espera a que el banner llame a window.UMCEAnalytics.grant()
  }

  // Ejecutar después de que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
