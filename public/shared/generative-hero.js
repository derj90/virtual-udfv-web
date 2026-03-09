// =============================================
// UMCE VIRTUAL — Arte Generativo Hero
// 5 variantes que rotan por día de la semana
// 6 paletas seleccionables por el usuario
// p5.js instance mode (no contamina global scope)
// =============================================

(function() {
  'use strict';

  // ---- PALETAS ----
  // Cada paleta: bg (fondo hero+canvas), dark, primary, secondary, accent, white
  const PALETTES = {
    umce:      { name: 'UMCE',      bg: '#001D5C', dark: [0,29,92],   primary: [0,51,161],   secondary: [232,240,254], accent: [255,158,24],  white: [255,255,255], dot: '#0033A1' },
    oceano:    { name: 'Oc\u00e9ano',    bg: '#0A1628', dark: [10,22,40],  primary: [33,150,243], secondary: [168,230,207], accent: [78,205,196],  white: [255,255,255], dot: '#4ECDC4' },
    atardecer: { name: 'Atardecer', bg: '#1A0A2E', dark: [26,10,46],  primary: [168,85,247], secondary: [255,230,109], accent: [255,107,107], white: [255,255,255], dot: '#FF6B6B' },
    bosque:    { name: 'Bosque',    bg: '#0D1B0E', dark: [13,27,14],  primary: [52,211,153], secondary: [110,231,183], accent: [252,211,77],  white: [255,255,255], dot: '#34D399' },
    editorial: { name: 'Editorial', bg: '#111827', dark: [17,24,39],  primary: [129,140,248], secondary: [229,231,235], accent: [244,114,182], white: [255,255,255], dot: '#818CF8' },
    coral:     { name: 'Coral',     bg: '#1C1017', dark: [28,16,23],  primary: [251,146,60],  secondary: [254,215,170], accent: [56,189,248],  white: [255,255,255], dot: '#FB923C' },
  };

  const PALETTE_KEYS = Object.keys(PALETTES);
  let currentPaletteKey = localStorage.getItem('udfv-palette') || 'umce';
  if (!PALETTES[currentPaletteKey]) currentPaletteKey = 'umce';

  // Active color references (mutable)
  let PAL = PALETTES[currentPaletteKey];
  let AZUL, AZUL_DARK, AZUL_LIGHT, AMARILLO, BLANCO;

  function applyPalette(key) {
    currentPaletteKey = key;
    PAL = PALETTES[key];
    AZUL_DARK  = PAL.dark;
    AZUL       = PAL.primary;
    AZUL_LIGHT = PAL.secondary;
    AMARILLO   = PAL.accent;
    BLANCO     = PAL.white;
    localStorage.setItem('udfv-palette', key);
    // Update hero background
    let heroSection = document.querySelector('[data-hero-bg]');
    if (heroSection) heroSection.style.background = PAL.bg;
    // Propagate palette to full page via CSS custom properties
    document.documentElement.style.setProperty('--palette-primary', 'rgb(' + PAL.primary.join(',') + ')');
    document.documentElement.style.setProperty('--palette-accent', 'rgb(' + PAL.accent.join(',') + ')');
    document.documentElement.style.setProperty('--palette-dark', PAL.bg);
    document.documentElement.style.setProperty('--palette-secondary', 'rgb(' + PAL.secondary.join(',') + ')');
    // Update picker active state
    updatePickerUI();
  }

  applyPalette(currentPaletteKey);

  // ---- FONT SYSTEM ----
  const FONTS = {
    system:   { name: 'Helvetica', family: "'Helvetica Neue', Helvetica, Arial, sans-serif", google: null },
    space:    { name: 'Space Grotesk', family: "'Space Grotesk', sans-serif", google: 'Space+Grotesk:wght@400;500;600;700' },
    jakarta:  { name: 'Jakarta', family: "'Plus Jakarta Sans', sans-serif", google: 'Plus+Jakarta+Sans:wght@400;500;600;700;800' },
    outfit:   { name: 'Outfit', family: "'Outfit', sans-serif", google: 'Outfit:wght@400;500;600;700;800' },
    sora:     { name: 'Sora', family: "'Sora', sans-serif", google: 'Sora:wght@400;500;600;700;800' },
    inter:    { name: 'Inter', family: "'Inter', sans-serif", google: 'Inter:wght@400;500;600;700;800' },
  };

  const FONT_KEYS = Object.keys(FONTS);
  let currentFontKey = localStorage.getItem('udfv-font') || 'system';
  if (!FONTS[currentFontKey]) currentFontKey = 'system';

  // Load Google Font stylesheet
  let loadedFonts = {};
  function loadGoogleFont(key) {
    let font = FONTS[key];
    if (!font.google || loadedFonts[key]) return;
    let link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=' + font.google + '&display=swap';
    document.head.appendChild(link);
    loadedFonts[key] = true;
  }

  function applyFont(key) {
    currentFontKey = key;
    let font = FONTS[key];
    loadGoogleFont(key);
    localStorage.setItem('udfv-font', key);
    // Apply to body and headings
    document.body.style.fontFamily = font.family;
    let headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6,.font-heading');
    headings.forEach(function(h) { h.style.fontFamily = font.family; });
    updateFontPickerUI();
  }

  // Preload saved font
  if (currentFontKey !== 'system') loadGoogleFont(currentFontKey);

  function buildFontPicker() {
    let container = document.getElementById('font-picker');
    if (!container) return;
    container.innerHTML = '';
    for (let key of FONT_KEYS) {
      let font = FONTS[key];
      let btn = document.createElement('button');
      btn.className = 'font-dot';
      btn.dataset.font = key;
      btn.title = font.name;
      btn.textContent = 'Aa';
      btn.style.cssText = 'width:28px;height:20px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);cursor:pointer;transition:all 0.2s;background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.5);font-size:9px;padding:0;flex-shrink:0;line-height:20px;text-align:center;';
      btn.addEventListener('click', function() {
        applyFont(key);
      });
      container.appendChild(btn);
    }
    updateFontPickerUI();
  }

  function updateFontPickerUI() {
    let dots = document.querySelectorAll('.font-dot');
    dots.forEach(function(d) {
      let font = FONTS[d.dataset.font];
      if (font && font.google) {
        loadGoogleFont(d.dataset.font);
        d.style.fontFamily = font.family;
      }
      if (d.dataset.font === currentFontKey) {
        d.style.borderColor = 'rgba(255,255,255,0.9)';
        d.style.color = 'rgba(255,255,255,0.95)';
        d.style.background = 'rgba(255,255,255,0.15)';
      } else {
        d.style.borderColor = 'rgba(255,255,255,0.15)';
        d.style.color = 'rgba(255,255,255,0.5)';
        d.style.background = 'rgba(255,255,255,0.05)';
      }
    });
  }

  // ---- PALETTE PICKER UI ----
  function buildPicker() {
    let container = document.getElementById('palette-picker');
    if (!container) return;
    container.innerHTML = '';
    for (let key of PALETTE_KEYS) {
      let pal = PALETTES[key];
      let btn = document.createElement('button');
      btn.className = 'palette-dot';
      btn.dataset.palette = key;
      btn.title = pal.name;
      btn.style.cssText = 'width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,0.2);cursor:pointer;transition:all 0.2s;background:' + pal.dot + ';padding:0;flex-shrink:0;';
      btn.addEventListener('click', function() {
        applyPalette(key);
        // Restart generative art with new colors
        if (restartSketch) restartSketch();
      });
      container.appendChild(btn);
    }
    updatePickerUI();
  }

  function updatePickerUI() {
    let dots = document.querySelectorAll('.palette-dot');
    dots.forEach(function(d) {
      if (d.dataset.palette === currentPaletteKey) {
        d.style.borderColor = 'rgba(255,255,255,0.9)';
        d.style.transform = 'scale(1.25)';
        d.style.boxShadow = '0 0 8px ' + PALETTES[d.dataset.palette].dot;
      } else {
        d.style.borderColor = 'rgba(255,255,255,0.2)';
        d.style.transform = 'scale(1)';
        d.style.boxShadow = 'none';
      }
    });
  }

  // Rotación por día
  const DAY_MAP = [3, 1, 2, 3, 4, 5, 2];
  const NAMES = {
    1: { title: 'Deriva', medium: 'Arte generativo \u00b7 Campo de flujo Perlin \u00b7 p5.js' },
    2: { title: 'Aurora', medium: 'Arte generativo \u00b7 Gradientes radiales en movimiento \u00b7 p5.js' },
    3: { title: 'Sinapsis', medium: 'Arte generativo interactivo \u00b7 Red de nodos \u00b7 p5.js' },
    4: { title: 'Resonancia', medium: 'Arte generativo \u00b7 Superposici\u00f3n arm\u00f3nica sinusoidal \u00b7 p5.js' },
    5: { title: 'Trama', medium: 'Arte generativo \u00b7 Tesela hexagonal isom\u00e9trica \u00b7 p5.js' },
  };

  let variant = DAY_MAP[new Date().getDay()];

  function updateCaption() {
    let cap = NAMES[variant];
    let el = document.getElementById('art-caption');
    if (el) {
      el.querySelector('.ac-title').textContent = cap.title;
      el.querySelector('.ac-medium').textContent = cap.medium;
    }
  }

  // ---- P5 SKETCH ----
  let restartSketch = null;
  let isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  let heroSketch = function(p) {
    let particles = [];
    let flowField = [];
    let hexGrid = [];
    let cols, rows;
    let scl = 20;
    let zoff = 0;
    let t = 0;
    let heroEl, isVisible = true;

    // Expose restart for palette changes
    restartSketch = function() {
      particles = []; hexGrid = [];
      t = 0; zoff = 0;
      setupVariant();
    };

    p.setup = function() {
      heroEl = document.getElementById('p5-hero');
      if (!heroEl) return;
      let canvas = p.createCanvas(heroEl.offsetWidth, heroEl.offsetHeight);
      canvas.parent('p5-hero');
      p.pixelDensity(1);
      setupVariant();
      updateCaption();

      let observer = new IntersectionObserver(function(entries) {
        isVisible = entries[0].isIntersecting;
        if (isVisible) p.loop(); else p.noLoop();
      }, { threshold: 0.1 });
      observer.observe(heroEl);
    };

    function setupVariant() {
      p.background(...AZUL_DARK);
      particles = [];
      hexGrid = [];

      if (variant === 1) {
        cols = p.floor(p.width / scl);
        rows = p.floor(p.height / scl);
        flowField = new Array(cols * rows);
        for (let i = 0; i < 600; i++) {
          particles.push({
            pos: p.createVector(p.random(p.width), p.random(p.height)),
            vel: p.createVector(0, 0),
            acc: p.createVector(0, 0),
            maxSpeed: p.random(1, 3),
            color: p.random() < 0.15 ? AMARILLO : p.random() < 0.3 ? AZUL_LIGHT : AZUL,
            alpha: p.random(15, 50),
            weight: p.random(1, 2.5)
          });
        }
      }
      else if (variant === 2) {
        let colors2 = [AMARILLO, AMARILLO, AZUL, AZUL, AZUL_LIGHT, AZUL_LIGHT,
                       AMARILLO, AZUL, AZUL_LIGHT, AZUL, BLANCO, AZUL];
        for (let i = 0; i < 12; i++) {
          particles.push({
            x: p.random(p.width), y: p.random(p.height),
            vx: p.random(-0.4, 0.4), vy: p.random(-0.4, 0.4),
            radius: p.random(150, 400),
            color: colors2[i],
            phase: p.random(p.TWO_PI)
          });
        }
      }
      else if (variant === 3) {
        let clusterCenters = [];
        for (let c = 0; c < 8; c++) {
          clusterCenters.push({ x: p.random(p.width), y: p.random(p.height) });
        }
        for (let i = 0; i < 150; i++) {
          let cluster = clusterCenters[p.floor(p.random(clusterCenters.length))];
          let useCluster = p.random() < 0.6;
          particles.push({
            x: useCluster ? cluster.x + p.randomGaussian() * p.width * 0.12 : p.random(p.width),
            y: useCluster ? cluster.y + p.randomGaussian() * p.height * 0.12 : p.random(p.height),
            vx: p.random(-0.3, 0.3), vy: p.random(-0.3, 0.3),
            radius: p.random(1.5, 4.5),
            color: p.random() < 0.2 ? AMARILLO : p.random() < 0.5 ? AZUL_LIGHT : BLANCO,
            alpha: p.random(80, 220),
            pulseSpeed: p.random(0.5, 2)
          });
        }
      }
      else if (variant === 4) {
        for (let i = 0; i < 50; i++) {
          particles.push({
            x: p.random(p.width), y: p.random(p.height),
            size: p.random(1, 3), alpha: p.random(30, 80)
          });
        }
      }
      else if (variant === 5) {
        buildHexGrid();
      }
    }

    p.draw = function() {
      if (!isVisible) return;
      t += 0.005;
      if (variant === 1) drawDeriva();
      else if (variant === 2) drawAurora();
      else if (variant === 3) drawSinapsis();
      else if (variant === 4) drawResonancia();
      else if (variant === 5) drawTrama();
    };

    // 1: DERIVA
    function drawDeriva() {
      p.fill(AZUL_DARK[0], AZUL_DARK[1], AZUL_DARK[2], 8);
      p.noStroke(); p.rect(0, 0, p.width, p.height);
      let yoff = 0;
      for (let y = 0; y < rows; y++) {
        let xoff = 0;
        for (let x = 0; x < cols; x++) {
          let angle = p.noise(xoff, yoff, zoff) * p.TWO_PI * 2;
          let v = p5.Vector.fromAngle(angle); v.setMag(0.5);
          flowField[x + y * cols] = v;
          xoff += 0.08;
        }
        yoff += 0.08;
      }
      zoff += 0.003;
      for (let pt of particles) {
        let x = p.floor(pt.pos.x / scl), y = p.floor(pt.pos.y / scl);
        let force = flowField[x + y * cols];
        if (force) pt.acc.add(force);
        pt.vel.add(pt.acc); pt.vel.limit(pt.maxSpeed);
        pt.pos.add(pt.vel); pt.acc.mult(0);
        if (pt.pos.x > p.width) pt.pos.x = 0;
        if (pt.pos.x < 0) pt.pos.x = p.width;
        if (pt.pos.y > p.height) pt.pos.y = 0;
        if (pt.pos.y < 0) pt.pos.y = p.height;
        p.stroke(pt.color[0], pt.color[1], pt.color[2], pt.alpha);
        p.strokeWeight(pt.weight);
        p.point(pt.pos.x, pt.pos.y);
      }
    }

    // 2: AURORA
    function drawAurora() {
      p.background(...AZUL_DARK);
      for (let pt of particles) {
        pt.x += pt.vx + p.sin(t * 1.5 + pt.phase) * 0.8;
        pt.y += pt.vy + p.cos(t * 1.2 + pt.phase * 1.3) * 0.8;
        if (pt.x < -200 || pt.x > p.width + 200) pt.vx *= -1;
        if (pt.y < -200 || pt.y > p.height + 200) pt.vy *= -1;
      }
      let ctx = p.drawingContext;
      let baseGrd = ctx.createRadialGradient(p.width*0.5, p.height*0.4, 0, p.width*0.5, p.height*0.4, p.width*0.6);
      baseGrd.addColorStop(0, `rgba(${AZUL[0]},${AZUL[1]},${AZUL[2]},0.15)`);
      baseGrd.addColorStop(1, `rgba(${AZUL_DARK[0]},${AZUL_DARK[1]},${AZUL_DARK[2]},0)`);
      ctx.fillStyle = baseGrd; ctx.fillRect(0,0,p.width,p.height);
      ctx.globalCompositeOperation = 'screen';
      for (let pt of particles) {
        let r = pt.radius * (1 + p.sin(t * 0.8 + pt.phase) * 0.15);
        let grd = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
        grd.addColorStop(0, `rgba(${pt.color[0]},${pt.color[1]},${pt.color[2]},0.35)`);
        grd.addColorStop(0.3, `rgba(${pt.color[0]},${pt.color[1]},${pt.color[2]},0.15)`);
        grd.addColorStop(0.7, `rgba(${pt.color[0]},${pt.color[1]},${pt.color[2]},0.04)`);
        grd.addColorStop(1, `rgba(${pt.color[0]},${pt.color[1]},${pt.color[2]},0)`);
        ctx.fillStyle = grd; ctx.fillRect(0,0,p.width,p.height);
      }
      for (let i = 0; i < 5; i++) {
        let pt = particles[i];
        let grd2 = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.radius * 0.3);
        grd2.addColorStop(0, 'rgba(255,255,255,0.12)');
        grd2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd2; ctx.fillRect(0,0,p.width,p.height);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // 3: SINAPSIS
    function drawSinapsis() {
      p.fill(AZUL_DARK[0], AZUL_DARK[1], AZUL_DARK[2], 30);
      p.noStroke(); p.rect(0,0,p.width,p.height);
      for (let pt of particles) {
        pt.x += pt.vx; pt.y += pt.vy;
        if (pt.x < -20) { pt.x = -20; pt.vx *= -1; }
        if (pt.x > p.width+20) { pt.x = p.width+20; pt.vx *= -1; }
        if (pt.y < -20) { pt.y = -20; pt.vy *= -1; }
        if (pt.y > p.height+20) { pt.y = p.height+20; pt.vy *= -1; }
      }
      let cd = 140;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i+1; j < particles.length; j++) {
          let d = p.dist(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
          if (d < cd) {
            let a = p.map(d, 0, cd, 70, 0);
            let isGold = (particles[i].color === AMARILLO || particles[j].color === AMARILLO);
            if (isGold) p.stroke(AMARILLO[0], AMARILLO[1], AMARILLO[2], a*0.5);
            else p.stroke(AZUL_LIGHT[0], AZUL_LIGHT[1], AZUL_LIGHT[2], a);
            p.strokeWeight(p.map(d, 0, cd, 1.2, 0.3));
            p.line(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
          }
        }
      }
      p.noStroke();
      for (let pt of particles) {
        let pulse = 1 + p.sin(t * pt.pulseSpeed * 3) * 0.3;
        p.fill(pt.color[0], pt.color[1], pt.color[2], pt.alpha * 0.1);
        p.circle(pt.x, pt.y, pt.radius * 8 * pulse);
        p.fill(pt.color[0], pt.color[1], pt.color[2], pt.alpha * 0.25);
        p.circle(pt.x, pt.y, pt.radius * 4 * pulse);
        p.fill(pt.color[0], pt.color[1], pt.color[2], pt.alpha);
        p.circle(pt.x, pt.y, pt.radius * pulse);
      }
      if (!isTouchDevice && p.mouseX > 0 && p.mouseY > 50) {
        for (let pt of particles) {
          let d = p.dist(p.mouseX, p.mouseY, pt.x, pt.y);
          if (d < 200) {
            let force = p.map(d, 0, 200, 0.6, 0);
            pt.vx += (p.mouseX - pt.x) * force * 0.002;
            pt.vy += (p.mouseY - pt.y) * force * 0.002;
            pt.vx = p.constrain(pt.vx, -2, 2);
            pt.vy = p.constrain(pt.vy, -2, 2);
          }
        }
      }
      let ctx = p.drawingContext;
      ctx.globalCompositeOperation = 'screen';
      let corners = [[p.width*0.1,p.height*0.15,AZUL],[p.width*0.85,p.height*0.8,AMARILLO],[p.width*0.5,p.height*0.5,AZUL_LIGHT]];
      for (let c of corners) {
        let grd = ctx.createRadialGradient(c[0],c[1],0,c[0],c[1],250);
        grd.addColorStop(0, `rgba(${c[2][0]},${c[2][1]},${c[2][2]},0.05)`);
        grd.addColorStop(1, `rgba(${c[2][0]},${c[2][1]},${c[2][2]},0)`);
        ctx.fillStyle = grd; ctx.fillRect(0,0,p.width,p.height);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // 4: RESONANCIA
    function drawResonancia() {
      p.background(...AZUL_DARK);
      p.noFill();
      let layers = [
        { color: AZUL, alpha: 30, amp: 50, freq: 0.005, speed: 0.7, yBase: p.height*0.1 },
        { color: AZUL_LIGHT, alpha: 18, amp: 40, freq: 0.008, speed: 1.0, yBase: p.height*0.2 },
        { color: AZUL, alpha: 35, amp: 70, freq: 0.007, speed: 0.9, yBase: p.height*0.3 },
        { color: AMARILLO, alpha: 22, amp: 35, freq: 0.012, speed: 0.6, yBase: p.height*0.38 },
        { color: AZUL_LIGHT, alpha: 20, amp: 55, freq: 0.009, speed: 1.2, yBase: p.height*0.45 },
        { color: AZUL, alpha: 35, amp: 80, freq: 0.006, speed: 1.0, yBase: p.height*0.55 },
        { color: AMARILLO, alpha: 18, amp: 30, freq: 0.015, speed: 0.8, yBase: p.height*0.62 },
        { color: AZUL_LIGHT, alpha: 22, amp: 60, freq: 0.01, speed: 1.3, yBase: p.height*0.7 },
        { color: AZUL, alpha: 28, amp: 45, freq: 0.008, speed: 1.5, yBase: p.height*0.8 },
        { color: AZUL_LIGHT, alpha: 15, amp: 35, freq: 0.013, speed: 0.9, yBase: p.height*0.9 },
      ];
      for (let layer of layers) {
        p.stroke(layer.color[0], layer.color[1], layer.color[2], layer.alpha);
        for (let offset = -20; offset <= 20; offset += 4) {
          p.strokeWeight(p.map(p.abs(offset), 0, 20, 1.5, 0.4));
          p.beginShape();
          for (let x = 0; x <= p.width; x += 3) {
            let y = layer.yBase + offset +
              p.sin(x * layer.freq + t * layer.speed * 2) * layer.amp * 0.6 +
              p.sin(x * layer.freq * 2.2 + t * layer.speed * 2.5 + 2) * layer.amp * 0.25 +
              p.noise(x * 0.002, t * layer.speed * 0.4 + layer.yBase * 0.01) * layer.amp * 0.5;
            p.vertex(x, y);
          }
          p.endShape();
        }
      }
      p.noStroke();
      for (let pt of particles) {
        let wave = p.sin(pt.x * 0.008 + t * 1.5) * 60;
        let yy = pt.y + wave;
        let sz = pt.size * (1 + p.sin(t * 3 + pt.x * 0.01) * 0.5);
        p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], pt.alpha * (0.5 + p.sin(t * 2 + pt.x) * 0.5));
        p.circle(pt.x, yy, sz);
        p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], pt.alpha * 0.15);
        p.circle(pt.x, yy, sz * 5);
      }
      let ctx = p.drawingContext;
      ctx.globalCompositeOperation = 'multiply';
      let edgeGrd = ctx.createLinearGradient(0, 0, 0, p.height);
      edgeGrd.addColorStop(0, `rgba(${AZUL_DARK[0]},${AZUL_DARK[1]},${AZUL_DARK[2]},0.6)`);
      edgeGrd.addColorStop(0.3, `rgba(${AZUL_DARK[0]},${AZUL_DARK[1]},${AZUL_DARK[2]},0)`);
      edgeGrd.addColorStop(0.7, `rgba(${AZUL_DARK[0]},${AZUL_DARK[1]},${AZUL_DARK[2]},0)`);
      edgeGrd.addColorStop(1, `rgba(${AZUL_DARK[0]},${AZUL_DARK[1]},${AZUL_DARK[2]},0.5)`);
      ctx.fillStyle = edgeGrd; ctx.fillRect(0,0,p.width,p.height);
      ctx.globalCompositeOperation = 'source-over';
    }

    // 5: TRAMA
    function buildHexGrid() {
      hexGrid = [];
      let hexR = 40;
      let hexH = hexR * p.sqrt(3);
      let hCols = p.ceil(p.width / (hexR * 1.5)) + 2;
      let hRows = p.ceil(p.height / hexH) + 2;
      for (let r = -1; r < hRows; r++) {
        for (let c = -1; c < hCols; c++) {
          let x = c * hexR * 1.5;
          let y = r * hexH + (c % 2 === 0 ? 0 : hexH * 0.5);
          let dx = x - p.width * 0.5, dy = y - p.height * 0.5;
          let distCenter = p.sqrt(dx*dx + dy*dy);
          let maxDist = p.sqrt(p.width*p.width + p.height*p.height) * 0.5;
          hexGrid.push({
            x, y, baseR: hexR,
            color: p.random() < 0.05 ? AMARILLO : p.random() < 0.08 ? AZUL_LIGHT : AZUL,
            alpha: p.map(distCenter, 0, maxDist, 0.5, 0.1),
            phase: p.random(p.TWO_PI), speed: p.random(0.3, 1.2),
            depth: p.random(0.5, 1.5),
            isGold: p.random() < 0.05, isAccent: p.random() < 0.08
          });
        }
      }
    }

    function drawHex(cx, cy, r, depth) {
      p.beginShape();
      for (let i = 0; i < 6; i++) {
        let angle = p.PI/6 + i * p.PI/3;
        p.vertex(cx + p.cos(angle)*r, cy + p.sin(angle)*r*depth);
      }
      p.endShape(p.CLOSE);
    }

    function drawTrama() {
      p.background(...AZUL_DARK);
      let ctx = p.drawingContext;
      ctx.globalCompositeOperation = 'screen';
      let zones = [
        {x:p.width*0.3,y:p.height*0.3,r:p.width*0.35,c:AZUL},
        {x:p.width*0.7,y:p.height*0.6,r:p.width*0.3,c:AMARILLO},
        {x:p.width*0.5,y:p.height*0.5,r:p.width*0.4,c:AZUL_LIGHT},
      ];
      for (let z of zones) {
        let pr = z.r * (1 + p.sin(t*0.5 + z.x*0.001) * 0.1);
        let grd = ctx.createRadialGradient(z.x,z.y,0,z.x,z.y,pr);
        grd.addColorStop(0, `rgba(${z.c[0]},${z.c[1]},${z.c[2]},0.04)`);
        grd.addColorStop(0.5, `rgba(${z.c[0]},${z.c[1]},${z.c[2]},0.015)`);
        grd.addColorStop(1, `rgba(${z.c[0]},${z.c[1]},${z.c[2]},0)`);
        ctx.fillStyle = grd; ctx.fillRect(0,0,p.width,p.height);
      }
      ctx.globalCompositeOperation = 'source-over';

      for (let hex of hexGrid) {
        let pulse = p.sin(t * hex.speed + hex.phase);
        let r = hex.baseR * (0.85 + pulse * 0.15);
        let a = hex.alpha;
        if (!isTouchDevice && p.mouseX > 0 && p.mouseY > 50) {
          let md = p.dist(p.mouseX, p.mouseY, hex.x, hex.y);
          if (md < 200) a *= p.map(md, 0, 200, 2.5, 1);
        }
        p.noFill();
        p.stroke(hex.color[0], hex.color[1], hex.color[2], a * 60);
        p.strokeWeight(hex.isGold ? 1.5 : 0.6);
        drawHex(hex.x, hex.y, r, hex.depth);
        if (hex.isAccent || hex.isGold) {
          p.noStroke();
          p.fill(hex.color[0], hex.color[1], hex.color[2], a * (hex.isGold ? 20 : 8));
          drawHex(hex.x, hex.y, r, hex.depth);
          if (hex.isGold) {
            p.fill(AMARILLO[0], AMARILLO[1], AMARILLO[2], a * 6);
            drawHex(hex.x, hex.y, r * 1.6, hex.depth);
          }
        }
        p.noStroke();
        let dotA = a * (hex.isGold ? 80 : 20) * (0.5 + pulse * 0.5);
        p.fill(hex.color[0], hex.color[1], hex.color[2], dotA);
        p.circle(hex.x, hex.y, hex.isGold ? 3 : 1.5);
      }

      let accented = hexGrid.filter(h => h.isAccent || h.isGold);
      for (let i = 0; i < accented.length; i++) {
        for (let j = i+1; j < accented.length; j++) {
          let d = p.dist(accented[i].x, accented[i].y, accented[j].x, accented[j].y);
          if (d < 250) {
            let la = p.map(d, 0, 250, 25, 0);
            let isG = accented[i].isGold || accented[j].isGold;
            p.stroke(isG ? AMARILLO[0] : AZUL_LIGHT[0], isG ? AMARILLO[1] : AZUL_LIGHT[1], isG ? AMARILLO[2] : AZUL_LIGHT[2], isG ? la*0.4 : la);
            p.strokeWeight(0.4);
            p.line(accented[i].x, accented[i].y, accented[j].x, accented[j].y);
          }
        }
      }
    }

    p.windowResized = function() {
      if (!heroEl) return;
      p.resizeCanvas(heroEl.offsetWidth, heroEl.offsetHeight);
      particles = []; hexGrid = [];
      t = 0; zoff = 0;
      setupVariant();
    };
  };

  // ---- BOOT ----
  let instance = null;

  function boot() {
    if (typeof p5 === 'undefined') {
      if (boot.attempts < 25) { boot.attempts++; setTimeout(boot, 200); }
      return;
    }
    if (instance) { instance.remove(); instance = null; }
    let el = document.getElementById('p5-hero');
    if (!el || el.offsetWidth === 0) {
      if (boot.attempts < 25) { boot.attempts++; setTimeout(boot, 200); }
      return;
    }
    instance = new p5(heroSketch);
    buildPicker();
    buildFontPicker();
    applyFont(currentFontKey);
  }
  boot.attempts = 0;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('pageshow', function(e) {
    if (e.persisted) { boot.attempts = 0; boot(); }
  });
})();
