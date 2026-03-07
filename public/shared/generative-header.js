// =============================================
// UMCE VIRTUAL — Arte Generativo Header Interior
// Versión estática: render único + noLoop()
// Mucho más sutil que el hero principal
// Acepta data-variant en el contenedor
// =============================================

(function() {
  'use strict';

  const AZUL       = [0, 51, 161];
  const AZUL_DARK  = [0, 29, 92];
  const AZUL_LIGHT = [232, 240, 254];
  const AMARILLO   = [255, 158, 24];

  // VARIANTES:
  // 1 = Deriva (flow field) → noticias
  // 3 = Sinapsis (nodes)    → competencias
  // 4 = Resonancia (waves)  → servicios
  // 5 = Trama (hexagons)    → catalogo

  let headerSketch = function(p) {
    let variant = 5;
    let containerEl;

    p.setup = function() {
      containerEl = document.getElementById('p5-header');
      if (!containerEl) return;

      // Leer variante desde data-variant del contenedor
      let dv = parseInt(containerEl.getAttribute('data-variant'), 10);
      if ([1, 3, 4, 5].indexOf(dv) !== -1) variant = dv;

      let canvas = p.createCanvas(containerEl.offsetWidth, containerEl.offsetHeight);
      canvas.parent('p5-header');
      p.pixelDensity(1);

      // Render único — sin animación para no gastar CPU en páginas interiores
      renderVariant();
      p.noLoop();
    };

    function renderVariant() {
      if (variant === 1) drawDeriva();
      else if (variant === 3) drawSinapsis();
      else if (variant === 4) drawResonancia();
      else if (variant === 5) drawTrama();
    }

    // ---- 1: DERIVA — campo de flujo Perlin, muy sutil ----
    function drawDeriva() {
      p.clear();
      let scl = 22;
      let cols = p.floor(p.width / scl) + 1;
      let rows = p.floor(p.height / scl) + 1;
      let seed = Math.floor(Math.random() * 10000);

      // Dibujar líneas de flujo cortas
      p.strokeWeight(0.8);
      for (let i = 0; i < 300; i++) {
        let x = p.random(p.width);
        let y = p.random(p.height);
        let col = p.random() < 0.12 ? AMARILLO : p.random() < 0.25 ? AZUL_LIGHT : AZUL;
        let alpha = p.random(8, 20);
        p.stroke(col[0], col[1], col[2], alpha);
        p.strokeWeight(p.random(0.5, 1.5));

        // Trazar 8 pasos de flujo
        let px = x, py = y;
        for (let s = 0; s < 8; s++) {
          let angle = p.noise(px * 0.04, py * 0.04, seed * 0.01) * p.TWO_PI * 2;
          let nx = px + p.cos(angle) * scl * 0.5;
          let ny = py + p.sin(angle) * scl * 0.5;
          if (nx < 0 || nx > p.width || ny < 0 || ny > p.height) break;
          p.line(px, py, nx, ny);
          px = nx; py = ny;
        }
      }
    }

    // ---- 3: SINAPSIS — red de nodos, alpha muy bajo ----
    function drawSinapsis() {
      p.clear();
      let nodes = [];

      // Crear clusters de nodos
      let clusterCenters = [];
      for (let c = 0; c < 6; c++) {
        clusterCenters.push({ x: p.random(p.width), y: p.random(p.height) });
      }
      for (let i = 0; i < 80; i++) {
        let cluster = clusterCenters[p.floor(p.random(clusterCenters.length))];
        let inCluster = p.random() < 0.65;
        nodes.push({
          x: inCluster ? cluster.x + p.randomGaussian() * p.width * 0.10 : p.random(p.width),
          y: inCluster ? cluster.y + p.randomGaussian() * p.height * 0.10 : p.random(p.height),
          r: p.random(1.2, 3.5),
          isGold: p.random() < 0.12
        });
      }

      // Dibujar conexiones
      let cd = 120;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          let d = p.dist(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
          if (d < cd) {
            let alpha = p.map(d, 0, cd, 12, 0);
            let col = (nodes[i].isGold || nodes[j].isGold) ? AMARILLO : AZUL_LIGHT;
            p.stroke(col[0], col[1], col[2], alpha);
            p.strokeWeight(0.4);
            p.line(nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y);
          }
        }
      }

      // Dibujar nodos
      p.noStroke();
      for (let nd of nodes) {
        let col = nd.isGold ? AMARILLO : AZUL_LIGHT;
        // Halo exterior
        p.fill(col[0], col[1], col[2], 6);
        p.circle(nd.x, nd.y, nd.r * 10);
        // Nodo central
        p.fill(col[0], col[1], col[2], nd.isGold ? 25 : 15);
        p.circle(nd.x, nd.y, nd.r * 2);
      }
    }

    // ---- 4: RESONANCIA — ondas sinusoidales, alpha muy bajo ----
    function drawResonancia() {
      p.clear();
      let layers = [
        { color: AZUL,       alpha: 12, amp: 22, freq: 0.006, yBase: p.height * 0.15, off: 0 },
        { color: AZUL_LIGHT, alpha:  8, amp: 18, freq: 0.009, yBase: p.height * 0.28, off: 1.2 },
        { color: AZUL,       alpha: 14, amp: 28, freq: 0.007, yBase: p.height * 0.42, off: 0.5 },
        { color: AMARILLO,   alpha:  7, amp: 15, freq: 0.013, yBase: p.height * 0.55, off: 2.1 },
        { color: AZUL_LIGHT, alpha:  9, amp: 20, freq: 0.010, yBase: p.height * 0.68, off: 0.8 },
        { color: AZUL,       alpha: 11, amp: 24, freq: 0.008, yBase: p.height * 0.82, off: 1.7 },
      ];

      p.noFill();
      for (let layer of layers) {
        for (let offset = -12; offset <= 12; offset += 4) {
          let a = p.map(p.abs(offset), 0, 12, layer.alpha, 0);
          p.stroke(layer.color[0], layer.color[1], layer.color[2], a);
          p.strokeWeight(p.map(p.abs(offset), 0, 12, 0.9, 0.2));
          p.beginShape();
          for (let x = 0; x <= p.width; x += 4) {
            let y = layer.yBase + offset
              + p.sin(x * layer.freq + layer.off) * layer.amp
              + p.sin(x * layer.freq * 2.1 + layer.off * 1.5) * layer.amp * 0.3
              + p.noise(x * 0.003, layer.yBase * 0.01) * layer.amp * 0.4;
            p.vertex(x, y);
          }
          p.endShape();
        }
      }
    }

    // ---- 5: TRAMA — tesela hexagonal, alpha muy bajo ----
    function drawTrama() {
      p.clear();
      let hexR = 36;
      let hexH = hexR * p.sqrt(3);
      let hCols = p.ceil(p.width / (hexR * 1.5)) + 2;
      let hRows = p.ceil(p.height / hexH) + 2;

      for (let r = -1; r < hRows; r++) {
        for (let c = -1; c < hCols; c++) {
          let x = c * hexR * 1.5;
          let y = r * hexH + (c % 2 === 0 ? 0 : hexH * 0.5);

          let dx = x - p.width * 0.5;
          let dy = y - p.height * 0.5;
          let distCenter = p.sqrt(dx * dx + dy * dy);
          let maxDist = p.sqrt(p.width * p.width + p.height * p.height) * 0.5;

          let isGold = p.random() < 0.04;
          let isAccent = p.random() < 0.07;
          let baseAlpha = p.map(distCenter, 0, maxDist, 14, 4);
          let col = isGold ? AMARILLO : (isAccent ? AZUL_LIGHT : AZUL);

          p.noFill();
          p.stroke(col[0], col[1], col[2], baseAlpha * (isGold ? 2.5 : 1));
          p.strokeWeight(isGold ? 1.2 : 0.5);
          drawHex(x, y, hexR * 0.88, 1.0);

          // Relleno suave solo para acentuados
          if (isAccent || isGold) {
            p.noStroke();
            p.fill(col[0], col[1], col[2], isGold ? 6 : 3);
            drawHex(x, y, hexR * 0.88, 1.0);
          }

          // Punto central
          if (isGold || isAccent) {
            p.noStroke();
            p.fill(col[0], col[1], col[2], isGold ? 18 : 6);
            p.circle(x, y, isGold ? 2.5 : 1.2);
          }
        }
      }

      // Conexiones entre algunos acentuados
      let accented = [];
      // Re-collect — simpler: draw a few random lines as "connections"
      for (let i = 0; i < 12; i++) {
        let ax = p.random(p.width), ay = p.random(p.height);
        let bx = ax + p.random(-120, 120), by = ay + p.random(-120, 120);
        p.stroke(AZUL_LIGHT[0], AZUL_LIGHT[1], AZUL_LIGHT[2], 5);
        p.strokeWeight(0.3);
        p.line(ax, ay, bx, by);
      }
    }

    function drawHex(cx, cy, r, depth) {
      p.beginShape();
      for (let i = 0; i < 6; i++) {
        let angle = p.PI / 6 + i * p.PI / 3;
        p.vertex(cx + p.cos(angle) * r, cy + p.sin(angle) * r * depth);
      }
      p.endShape(p.CLOSE);
    }

    p.windowResized = function() {
      if (!containerEl) return;
      p.resizeCanvas(containerEl.offsetWidth, containerEl.offsetHeight);
      renderVariant();
      p.noLoop();
    };
  };

  // Boot con retry hasta que p5 esté disponible y el contenedor tenga dimensiones
  let instance = null;

  function boot() {
    if (typeof p5 === 'undefined') {
      if (boot.attempts < 20) { boot.attempts++; setTimeout(boot, 200); }
      return;
    }
    let el = document.getElementById('p5-header');
    if (!el || el.offsetWidth === 0) {
      if (boot.attempts < 20) { boot.attempts++; setTimeout(boot, 200); }
      return;
    }
    if (instance) { instance.remove(); instance = null; }
    instance = new p5(headerSketch);
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
