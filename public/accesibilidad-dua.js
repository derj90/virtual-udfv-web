/**
 * Botón de Accesibilidad DUA — UMCE Virtual
 * Diseño Universal para el Aprendizaje (DUA)
 *
 * Principios DUA:
 *   I.   Representación — múltiples formas de presentar información
 *   II.  Acción y Expresión — múltiples formas de interactuar
 *   III. Compromiso — múltiples formas de motivar
 *
 * Auto-init: incluir <script src="/accesibilidad-dua.js" defer></script>
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'umce_a11y';
  const defaults = {
    fontSize: 0,        // -2 to +4 steps
    contrast: 'normal', // normal | high | dark
    dyslexia: false,
    spacing: false,
    links: false,
    cursor: false,
    ruler: false,
    animations: false,  // true = paused
  };

  let state = { ...defaults };

  // Load saved preferences
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) state = { ...defaults, ...saved };
  } catch {}

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // --- Inject styles ---
  const style = document.createElement('style');
  style.id = 'a11y-dua-styles';
  style.textContent = `
    /* DUA Font size steps */
    html.a11y-fs-1 { font-size: 112.5% !important; }
    html.a11y-fs-2 { font-size: 125% !important; }
    html.a11y-fs-3 { font-size: 137.5% !important; }
    html.a11y-fs-4 { font-size: 150% !important; }
    html.a11y-fs--1 { font-size: 87.5% !important; }
    html.a11y-fs--2 { font-size: 75% !important; }

    /* High contrast */
    html.a11y-contrast-high {
      filter: contrast(1.4) !important;
    }
    html.a11y-contrast-high img,
    html.a11y-contrast-high video,
    html.a11y-contrast-high svg { filter: contrast(0.75) !important; }

    /* Dark mode */
    html.a11y-contrast-dark {
      filter: invert(1) hue-rotate(180deg) !important;
    }
    html.a11y-contrast-dark img,
    html.a11y-contrast-dark video,
    html.a11y-contrast-dark svg,
    html.a11y-contrast-dark [style*="background-image"] {
      filter: invert(1) hue-rotate(180deg) !important;
    }

    /* Dyslexia font */
    @font-face {
      font-family: 'OpenDyslexic';
      src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Regular.woff') format('woff');
      font-weight: normal;
      font-display: swap;
    }
    @font-face {
      font-family: 'OpenDyslexic';
      src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/woff/OpenDyslexic-Bold.woff') format('woff');
      font-weight: bold;
      font-display: swap;
    }
    html.a11y-dyslexia,
    html.a11y-dyslexia * {
      font-family: 'OpenDyslexic', sans-serif !important;
    }

    /* Extra spacing */
    html.a11y-spacing p,
    html.a11y-spacing li,
    html.a11y-spacing td,
    html.a11y-spacing th,
    html.a11y-spacing span,
    html.a11y-spacing div {
      line-height: 2 !important;
      letter-spacing: 0.05em !important;
      word-spacing: 0.15em !important;
    }

    /* Highlight links */
    html.a11y-links a {
      text-decoration: underline !important;
      text-decoration-thickness: 2px !important;
      text-underline-offset: 3px !important;
    }
    html.a11y-links a:not([class*="bg-"]):not([class*="btn"]) {
      outline: 2px solid #FF9E18 !important;
      outline-offset: 2px !important;
      border-radius: 2px !important;
    }

    /* Large cursor */
    html.a11y-cursor,
    html.a11y-cursor * {
      cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M5 2l20 14-10 2-4 10z' fill='%23000' stroke='%23fff' stroke-width='2'/%3E%3C/svg%3E") 4 2, auto !important;
    }

    /* Reading ruler */
    #a11y-ruler {
      position: fixed;
      left: 0;
      right: 0;
      height: 100vh;
      pointer-events: none;
      z-index: 99998;
      display: none;
    }
    #a11y-ruler.active {
      display: block;
    }
    #a11y-ruler .ruler-band {
      position: absolute;
      left: 0;
      right: 0;
      height: 3em;
      background: rgba(255, 158, 24, 0.15);
      border-top: 2px solid rgba(255, 158, 24, 0.5);
      border-bottom: 2px solid rgba(255, 158, 24, 0.5);
      transition: top 0.05s ease-out;
    }
    #a11y-ruler .ruler-shade-top,
    #a11y-ruler .ruler-shade-bottom {
      position: absolute;
      left: 0;
      right: 0;
      background: rgba(0, 0, 0, 0.15);
    }
    #a11y-ruler .ruler-shade-top { top: 0; }
    #a11y-ruler .ruler-shade-bottom { bottom: 0; }

    /* Pause animations */
    html.a11y-no-animations,
    html.a11y-no-animations * {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }

    /* ---- Widget UI ---- */
    #a11y-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 99999;
      width: 52px;
      height: 52px;
      border-radius: 16px;
      background: #0033A1;
      color: white;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 16px rgba(0,51,161,0.35);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #a11y-fab:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,51,161,0.45); }
    #a11y-fab:focus-visible { outline: 3px solid #FF9E18; outline-offset: 3px; }
    #a11y-fab svg { width: 26px; height: 26px; }

    #a11y-panel {
      position: fixed;
      bottom: 88px;
      right: 24px;
      z-index: 99999;
      width: 320px;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      background: white;
      border-radius: 20px;
      box-shadow: 0 12px 48px rgba(0,0,0,0.18);
      border: 1px solid #e5e7eb;
      padding: 20px;
      display: none;
      font-family: 'Inter', system-ui, sans-serif;
    }
    #a11y-panel.open { display: block; }

    @media (max-width: 400px) {
      #a11y-panel {
        right: 8px;
        left: 8px;
        width: auto;
        bottom: 84px;
      }
      #a11y-fab {
        bottom: 16px;
        right: 16px;
      }
    }

    #a11y-panel h3 {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-weight: 800;
      font-size: 16px;
      color: #111827;
      margin: 0 0 4px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #a11y-panel .a11y-subtitle {
      font-size: 11px;
      color: #9ca3af;
      margin-bottom: 16px;
    }

    #a11y-panel .a11y-section {
      margin-bottom: 14px;
    }
    #a11y-panel .a11y-section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b7280;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    #a11y-panel .a11y-section-title svg { width: 14px; height: 14px; opacity: 0.5; }

    .a11y-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
    }
    .a11y-row + .a11y-row {
      border-top: 1px solid #f3f4f6;
    }
    .a11y-row label {
      font-size: 13px;
      color: #374151;
      cursor: pointer;
      flex: 1;
    }

    /* Toggle switch */
    .a11y-toggle {
      position: relative;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }
    .a11y-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .a11y-toggle .slider {
      position: absolute;
      inset: 0;
      background: #d1d5db;
      border-radius: 22px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .a11y-toggle .slider::before {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .a11y-toggle input:checked + .slider {
      background: #0033A1;
    }
    .a11y-toggle input:checked + .slider::before {
      transform: translateX(18px);
    }
    .a11y-toggle input:focus-visible + .slider {
      outline: 2px solid #FF9E18;
      outline-offset: 2px;
    }

    /* Font size control */
    .a11y-fontsize {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .a11y-fontsize button {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background: white;
      color: #374151;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    .a11y-fontsize button:hover { background: #f3f4f6; border-color: #0033A1; color: #0033A1; }
    .a11y-fontsize button:disabled { opacity: 0.3; cursor: not-allowed; }
    .a11y-fontsize button:focus-visible { outline: 2px solid #FF9E18; outline-offset: 1px; }
    .a11y-fontsize span {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      min-width: 40px;
      text-align: center;
    }

    /* Contrast selector */
    .a11y-contrast-btns {
      display: flex;
      gap: 6px;
    }
    .a11y-contrast-btns button {
      flex: 1;
      padding: 6px;
      border-radius: 8px;
      border: 2px solid #e5e7eb;
      background: white;
      font-size: 11px;
      font-weight: 600;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.15s;
    }
    .a11y-contrast-btns button:hover { border-color: #0033A1; }
    .a11y-contrast-btns button.active { border-color: #0033A1; background: #EFF3FF; color: #0033A1; }
    .a11y-contrast-btns button:focus-visible { outline: 2px solid #FF9E18; outline-offset: 1px; }

    /* Reset button */
    .a11y-reset {
      width: 100%;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid #e5e7eb;
      background: white;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.15s;
      margin-top: 4px;
    }
    .a11y-reset:hover { background: #fef2f2; color: #ef4444; border-color: #fca5a5; }
    .a11y-reset:focus-visible { outline: 2px solid #FF9E18; outline-offset: 1px; }
  `;
  document.head.appendChild(style);

  // --- Create FAB button ---
  const fab = document.createElement('button');
  fab.id = 'a11y-fab';
  fab.setAttribute('aria-label', 'Abrir opciones de accesibilidad');
  fab.setAttribute('title', 'Accesibilidad');
  fab.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="M12 7.5v4m0 0l-4 7m4-7l4 7"/><path d="M7 11.5h10"/></svg>`;
  document.body.appendChild(fab);

  // --- Create panel ---
  const panel = document.createElement('div');
  panel.id = 'a11y-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Opciones de accesibilidad DUA');
  panel.innerHTML = `
    <h3>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0033A1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4.5" r="2"/><path d="M12 7.5v4m0 0l-4 7m4-7l4 7"/><path d="M7 11.5h10"/></svg>
      Accesibilidad
    </h3>
    <div class="a11y-subtitle">Dise&ntilde;o Universal para el Aprendizaje (DUA)</div>

    <div class="a11y-section">
      <div class="a11y-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
        I. Representaci&oacute;n
      </div>
      <div class="a11y-row">
        <label>Tama&ntilde;o de texto</label>
        <div class="a11y-fontsize">
          <button id="a11y-fs-dec" aria-label="Reducir texto">A-</button>
          <span id="a11y-fs-val">100%</span>
          <button id="a11y-fs-inc" aria-label="Aumentar texto">A+</button>
        </div>
      </div>
      <div class="a11y-row">
        <label>Contraste</label>
        <div class="a11y-contrast-btns">
          <button data-contrast="normal" class="active">Normal</button>
          <button data-contrast="high">Alto</button>
          <button data-contrast="dark">Oscuro</button>
        </div>
      </div>
      <div class="a11y-row">
        <label for="a11y-dyslexia">Fuente para dislexia</label>
        <div class="a11y-toggle">
          <input type="checkbox" id="a11y-dyslexia">
          <span class="slider"></span>
        </div>
      </div>
      <div class="a11y-row">
        <label for="a11y-spacing">Espaciado amplio</label>
        <div class="a11y-toggle">
          <input type="checkbox" id="a11y-spacing">
          <span class="slider"></span>
        </div>
      </div>
    </div>

    <div class="a11y-section">
      <div class="a11y-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/></svg>
        II. Acci&oacute;n y Expresi&oacute;n
      </div>
      <div class="a11y-row">
        <label for="a11y-links">Resaltar enlaces</label>
        <div class="a11y-toggle">
          <input type="checkbox" id="a11y-links">
          <span class="slider"></span>
        </div>
      </div>
      <div class="a11y-row">
        <label for="a11y-cursor">Cursor grande</label>
        <div class="a11y-toggle">
          <input type="checkbox" id="a11y-cursor">
          <span class="slider"></span>
        </div>
      </div>
      <div class="a11y-row">
        <label for="a11y-ruler">Gu&iacute;a de lectura</label>
        <div class="a11y-toggle">
          <input type="checkbox" id="a11y-ruler">
          <span class="slider"></span>
        </div>
      </div>
    </div>

    <div class="a11y-section">
      <div class="a11y-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        III. Compromiso
      </div>
      <div class="a11y-row">
        <label for="a11y-animations">Pausar animaciones</label>
        <div class="a11y-toggle">
          <input type="checkbox" id="a11y-animations">
          <span class="slider"></span>
        </div>
      </div>
    </div>

    <button class="a11y-reset" id="a11y-reset">Restablecer todo</button>
  `;
  document.body.appendChild(panel);

  // --- Create reading ruler ---
  const ruler = document.createElement('div');
  ruler.id = 'a11y-ruler';
  ruler.innerHTML = `<div class="ruler-shade-top"></div><div class="ruler-band"></div><div class="ruler-shade-bottom"></div>`;
  document.body.appendChild(ruler);

  // --- Event: toggle panel ---
  let panelOpen = false;
  fab.addEventListener('click', () => {
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
    fab.setAttribute('aria-expanded', panelOpen);
    if (panelOpen) {
      panel.querySelector('button, input').focus();
    }
  });

  // Close panel on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelOpen) {
      panelOpen = false;
      panel.classList.remove('open');
      fab.focus();
    }
  });

  // Close panel on outside click
  document.addEventListener('click', (e) => {
    if (panelOpen && !panel.contains(e.target) && e.target !== fab) {
      panelOpen = false;
      panel.classList.remove('open');
    }
  });

  // --- Apply state to DOM ---
  const html = document.documentElement;

  function applyAll() {
    // Font size
    for (let i = -2; i <= 4; i++) html.classList.remove(`a11y-fs-${i}`);
    if (state.fontSize !== 0) html.classList.add(`a11y-fs-${state.fontSize}`);
    const pct = 100 + state.fontSize * 12.5;
    document.getElementById('a11y-fs-val').textContent = `${pct}%`;
    document.getElementById('a11y-fs-dec').disabled = state.fontSize <= -2;
    document.getElementById('a11y-fs-inc').disabled = state.fontSize >= 4;

    // Contrast
    html.classList.remove('a11y-contrast-high', 'a11y-contrast-dark');
    if (state.contrast !== 'normal') html.classList.add(`a11y-contrast-${state.contrast}`);
    panel.querySelectorAll('[data-contrast]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.contrast === state.contrast);
    });

    // Toggles
    html.classList.toggle('a11y-dyslexia', state.dyslexia);
    html.classList.toggle('a11y-spacing', state.spacing);
    html.classList.toggle('a11y-links', state.links);
    html.classList.toggle('a11y-cursor', state.cursor);
    html.classList.toggle('a11y-no-animations', state.animations);

    document.getElementById('a11y-dyslexia').checked = state.dyslexia;
    document.getElementById('a11y-spacing').checked = state.spacing;
    document.getElementById('a11y-links').checked = state.links;
    document.getElementById('a11y-cursor').checked = state.cursor;
    document.getElementById('a11y-ruler').checked = state.ruler;
    document.getElementById('a11y-animations').checked = state.animations;

    // Ruler
    ruler.classList.toggle('active', state.ruler);

    save();
  }

  // --- Events: font size ---
  document.getElementById('a11y-fs-inc').addEventListener('click', () => {
    if (state.fontSize < 4) { state.fontSize++; applyAll(); }
  });
  document.getElementById('a11y-fs-dec').addEventListener('click', () => {
    if (state.fontSize > -2) { state.fontSize--; applyAll(); }
  });

  // --- Events: contrast ---
  panel.querySelectorAll('[data-contrast]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.contrast = btn.dataset.contrast;
      applyAll();
    });
  });

  // --- Events: toggles ---
  ['dyslexia', 'spacing', 'links', 'cursor', 'animations'].forEach(key => {
    document.getElementById(`a11y-${key}`).addEventListener('change', (e) => {
      state[key] = e.target.checked;
      applyAll();
    });
  });

  // Ruler toggle
  document.getElementById('a11y-ruler').addEventListener('change', (e) => {
    state.ruler = e.target.checked;
    applyAll();
  });

  // --- Ruler mouse tracking ---
  document.addEventListener('mousemove', (e) => {
    if (!state.ruler) return;
    const band = ruler.querySelector('.ruler-band');
    const shadeTop = ruler.querySelector('.ruler-shade-top');
    const shadeBottom = ruler.querySelector('.ruler-shade-bottom');
    const bandH = band.offsetHeight;
    const top = Math.max(0, e.clientY - bandH / 2);

    band.style.top = top + 'px';
    shadeTop.style.height = top + 'px';
    shadeBottom.style.top = (top + bandH) + 'px';
    shadeBottom.style.height = Math.max(0, window.innerHeight - top - bandH) + 'px';
  });

  // --- Reset ---
  document.getElementById('a11y-reset').addEventListener('click', () => {
    state = { ...defaults };
    applyAll();
  });

  // --- Init ---
  applyAll();
})();
