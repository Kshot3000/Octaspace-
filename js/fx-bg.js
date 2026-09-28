/* fx-bg.js — OctaSpace Hub live background (official octa.space theme).
 *
 * Layered canvas FX behind all content:
 *  - two giant RTX 5090 GPUs with spinning fans, purple glow, idle bobbing
 *  - falling tokens: OCTA (dark coin, purple bars, silver ring — like the
 *    real token), ETH diamond, USDC coin — with sway + 3D flip
 *  - drifting energy dust for depth
 *  - periodic lightning strikes with branches + screen flash
 *
 * Performance: DPR capped at 1.5, particle counts scale down on small
 * screens, rAF auto-throttles in background tabs.
 * Accessibility: prefers-reduced-motion renders one static frame only.
 */
(function () {
  "use strict";
  if (window.__octaFxBooted) return;
  window.__octaFxBooted = true;

  var canvas = document.createElement("canvas");
  canvas.id = "fx-bg";
  canvas.setAttribute("aria-hidden", "true");
  if (document.body.firstChild) document.body.insertBefore(canvas, document.body.firstChild);
  else document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");

  var TAU = Math.PI * 2;
  var W = 0, H = 0, DPR = 1;
  var smallScreen = false;
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  var gpus = [], tokens = [], dust = [], bolts = [];
  var flash = 0, nextStrike = 4, T = 0;
  var vig = null;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  /* ---------- setup ---------- */

  function resize() {
    DPR = Math.min(1.5, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    makeVignette();
    layout();
  }

  function makeVignette() {
    vig = ctx.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.32, W / 2, H * 0.5, Math.max(W, H) * 0.78);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.62)");
  }

  function layout() {
    smallScreen = W < 720;
    gpus = [];
    if (smallScreen) {
      gpus.push(makeGPU(W * 0.5, H * 0.30, Math.min(W * 0.94, 470), 0.0, 1));
    } else {
      gpus.push(makeGPU(W * 0.155, H * 0.36, Math.min(W * 0.34, 580), 0.0, 1));
      gpus.push(makeGPU(W * 0.865, H * 0.68, Math.min(W * 0.30, 520), 2.1, -1));
    }
    tokens = [];
    var nT = smallScreen ? 12 : 24;
    for (var i = 0; i < nT; i++) tokens.push(newToken(true));
    dust = [];
    var nD = smallScreen ? 28 : 70;
    for (var j = 0; j < nD; j++) dust.push(newDust(true));
  }

  /* ---------- GPUs ---------- */

  function makeGPU(x, y, w, phase, dir) {
    return {
      x: x, y: y, w: w, h: w * 0.40, phase: phase, dir: dir,
      fan: [rnd(0, TAU), rnd(0, TAU), rnd(0, TAU)],
      fanSpeed: [rnd(7, 10) * dir, rnd(8.5, 11.5) * dir, rnd(7, 10) * dir]
    };
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawFan(cx, cy, r, ang) {
    ctx.save();
    ctx.translate(cx, cy);
    // housing
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = "#060509"; ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.05);
    ctx.strokeStyle = "rgba(200,150,255,0.35)"; ctx.stroke();
    // spinning blades (thick arc strokes read as turbine blades in motion)
    var blades = 9;
    ctx.strokeStyle = "rgba(205,165,255,0.72)";
    ctx.lineCap = "round";
    ctx.lineWidth = r * 0.30;
    for (var i = 0; i < blades; i++) {
      var a = ang + (i / blades) * TAU;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.60, a, a + 0.55);
      ctx.stroke();
    }
    // motion-blur sheen
    ctx.beginPath(); ctx.arc(0, 0, r * 0.60, 0, TAU);
    ctx.strokeStyle = "rgba(190,140,255,0.10)";
    ctx.lineWidth = r * 0.44; ctx.stroke();
    // hub
    var hg = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 0.22);
    hg.addColorStop(0, "#f5d0fe");
    hg.addColorStop(0.45, "#a855f7");
    hg.addColorStop(1, "#2a1040");
    ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, TAU);
    ctx.fillStyle = hg; ctx.fill();
    ctx.save();
    ctx.shadowColor = "rgba(200,120,255,0.9)"; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.07, 0, TAU);
    ctx.fillStyle = "#fae8ff"; ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawGPU(g, t) {
    var bobY = Math.sin(t * 0.7 + g.phase) * 12;
    var tilt = Math.sin(t * 0.45 + g.phase) * 0.025;
    var w = g.w, h = g.h;
    ctx.save();
    ctx.translate(g.x, g.y + bobY);
    ctx.rotate(tilt);
    ctx.globalAlpha = smallScreen ? 0.50 : 0.62;

    // halo — purple brand glow
    var halo = ctx.createRadialGradient(0, 0, h * 0.2, 0, 0, w * 0.78);
    halo.addColorStop(0, "rgba(168,85,247,0.22)");
    halo.addColorStop(1, "rgba(168,85,247,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(-w * 0.78, -h * 1.3, w * 1.56, h * 2.6);

    // shroud
    ctx.shadowColor = "rgba(168,85,247,0.55)";
    ctx.shadowBlur = 34;
    rr(-w / 2, -h / 2, w, h, h * 0.16);
    var shroud = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    shroud.addColorStop(0, "#161226");
    shroud.addColorStop(0.5, "#0c0a16");
    shroud.addColorStop(1, "#070610");
    ctx.fillStyle = shroud;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(200,150,255,0.38)";
    ctx.stroke();

    // brushed-metal sheen lines
    ctx.save();
    rr(-w / 2, -h / 2, w, h, h * 0.16);
    ctx.clip();
    ctx.strokeStyle = "rgba(200,160,255,0.05)";
    ctx.lineWidth = 1;
    for (var sx = -w / 2 + 18; sx < w / 2; sx += 26) {
      ctx.beginPath(); ctx.moveTo(sx, -h / 2); ctx.lineTo(sx - 14, h / 2); ctx.stroke();
    }
    ctx.restore();

    // top light strip — magenta
    var strip = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    strip.addColorStop(0, "rgba(232,121,249,0)");
    strip.addColorStop(0.5, "rgba(232,121,249,0.95)");
    strip.addColorStop(1, "rgba(124,58,237,0)");
    ctx.save();
    ctx.shadowColor = "rgba(232,121,249,0.9)"; ctx.shadowBlur = 12;
    ctx.fillStyle = strip;
    rr(-w / 2 + 16, -h / 2 + 9, w - 32, 4, 2);
    ctx.fill();
    ctx.restore();

    // branding strip
    var fs = Math.max(11, h * 0.095);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(225,205,250,0.85)";
    ctx.font = "700 " + fs.toFixed(0) + "px Inter, system-ui, sans-serif";
    ctx.fillText("GEFORCE RTX", -w / 2 + 18, -h / 2 + h * 0.20);
    ctx.textAlign = "right";
    var tg = ctx.createLinearGradient(w / 2 - 90, 0, w / 2 - 18, 0);
    tg.addColorStop(0, "#f0abfc"); tg.addColorStop(1, "#c026d3");
    ctx.fillStyle = tg;
    ctx.font = "800 " + (fs * 1.15).toFixed(0) + "px Inter, system-ui, sans-serif";
    ctx.fillText("5090", w / 2 - 18, -h / 2 + h * 0.20);

    // fans
    var fr = h * 0.30, fy = h * 0.13;
    var fxs = [-w * 0.305, 0, w * 0.305];
    for (var i = 0; i < 3; i++) drawFan(fxs[i], fy, fr, g.fan[i]);

    // corner screws
    ctx.fillStyle = "rgba(205,185,245,0.5)";
    var sr = Math.max(2, h * 0.016);
    var mx = w / 2 - 12, my = h / 2 - 12;
    [[-mx, -my], [mx, -my], [-mx, my], [mx, my]].forEach(function (p) {
      ctx.beginPath(); ctx.arc(p[0], p[1], sr, 0, TAU); ctx.fill();
    });

    ctx.restore();
  }

  /* ---------- falling tokens ---------- */

  function newToken(anyY) {
    return {
      type: pick(["OCTA", "ETH", "USDC"]),
      x: rnd(0, W), y: anyY ? rnd(0, H) : rnd(-70, -10),
      s: rnd(13, 27),
      vy: rnd(45, 115),
      swayA: rnd(15, 48), swayF: rnd(0.4, 1.1), ph: rnd(0, TAU),
      spin: rnd(0, TAU), spinV: rnd(-1.7, 1.7),
      a: rnd(0.35, 0.8)
    };
  }

  // OCTA — matches the real token: dark coin, purple vertical bars, silver ring
  function drawOCTA(s) {
    ctx.shadowColor = "rgba(168,85,247,0.8)";
    ctx.shadowBlur = 12;
    var cg = ctx.createRadialGradient(0, 0, s * 0.15, 0, 0, s);
    cg.addColorStop(0, "#26262e");
    cg.addColorStop(1, "#0a0a0d");
    ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU);
    ctx.fillStyle = cg; ctx.fill();
    ctx.shadowBlur = 0;
    // silver ring
    ctx.lineWidth = Math.max(2, s * 0.11);
    var rg = ctx.createLinearGradient(-s, -s, s, s);
    rg.addColorStop(0, "#e8eaef"); rg.addColorStop(0.5, "#9aa0ad"); rg.addColorStop(1, "#dfe1e8");
    ctx.strokeStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, s * 0.93, 0, TAU); ctx.stroke();
    // purple bars
    var hs = [0.52, 0.74, 0.96, 0.80, 0.96, 0.74, 0.52];
    var bw = s * 0.155, gap = s * 0.235;
    var bg = ctx.createLinearGradient(0, -s, 0, s);
    bg.addColorStop(0, "#f0abfc"); bg.addColorStop(0.55, "#a855f7"); bg.addColorStop(1, "#6d28d9");
    ctx.fillStyle = bg;
    for (var i = 0; i < 7; i++) {
      var bh = hs[i] * s * 1.06;
      var bx = (i - 3) * gap;
      rr(bx - bw / 2, -bh / 2, bw, bh, bw / 2);
      ctx.fill();
    }
  }

  function drawToken(k, t) {
    var x = k.x + Math.sin(t * k.swayF + k.ph) * k.swayA;
    var y = k.y, s = k.s;
    var flip = Math.cos(k.spin);
    if (Math.abs(flip) < 0.18) flip = flip < 0 ? -0.18 : 0.18;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip, 1);
    ctx.globalAlpha = k.a;

    if (k.type === "OCTA") {
      drawOCTA(s);
    } else if (k.type === "ETH") {
      ctx.shadowColor = "rgba(160,190,230,0.8)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.62, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.62, 0);
      ctx.closePath();
      ctx.fillStyle = "#9db4d8"; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.62, 0); ctx.lineTo(-s * 0.62, 0);
      ctx.closePath();
      ctx.fillStyle = "#d9e6f8"; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.62, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.62, 0);
      ctx.closePath();
      ctx.lineWidth = Math.max(1, s * 0.06);
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.stroke();
    } else { // USDC
      ctx.shadowColor = "rgba(60,130,220,0.8)";
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU);
      ctx.fillStyle = "#2775ca"; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(1.5, s * 0.09);
      ctx.strokeStyle = "rgba(255,255,255,0.55)"; ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "800 " + (s * 0.62).toFixed(0) + "px Inter, system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("$", 0, s * 0.04);
    }
    ctx.restore();
  }

  /* ---------- dust ---------- */

  function newDust(anyY) {
    return { x: rnd(0, W), y: anyY ? rnd(0, H) : rnd(H * 0.5, H + 10), r: rnd(0.8, 2.4), vy: rnd(6, 22), tw: rnd(0, TAU), a: rnd(0.08, 0.30) };
  }

  /* ---------- lightning ---------- */

  function boltPath(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  }

  function strike() {
    var x0 = rnd(W * 0.08, W * 0.92);
    var pts = [[x0, -30]];
    var cx = x0, cy = -30;
    while (cy < H + 30) { cy += rnd(35, 85); cx += rnd(-75, 75); pts.push([cx, cy]); }
    var branches = [];
    for (var i = 2; i < pts.length - 2; i += 2) {
      if (Math.random() < 0.55) {
        var bp = [[pts[i][0], pts[i][1]]];
        var bx = pts[i][0], by = pts[i][1];
        var d = Math.random() < 0.5 ? -1 : 1;
        for (var j = 0; j < 4; j++) { bx += d * rnd(25, 70); by += rnd(25, 60); bp.push([bx, by]); }
        branches.push(bp);
      }
    }
    bolts.push({ pts: pts, branches: branches, life: 1 });
    flash = Math.min(1, flash + rnd(0.55, 0.95));
    nextStrike = T + rnd(5, 13);
    if (Math.random() < 0.35) nextStrike = Math.min(nextStrike, T + rnd(0.15, 0.4)); // double-strike
  }

  function drawBolt(b) {
    var a = Math.max(0, b.life);
    if (a <= 0) return;
    ctx.save();
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.shadowColor = "rgba(190,140,255,0.85)"; ctx.shadowBlur = 12;
    ctx.strokeStyle = "rgba(210,170,255," + (a * 0.5).toFixed(3) + ")";
    ctx.lineWidth = 1.5;
    for (var i = 0; i < b.branches.length; i++) { boltPath(b.branches[i]); ctx.stroke(); }
    ctx.shadowBlur = 26;
    ctx.strokeStyle = "rgba(190,140,255," + a.toFixed(3) + ")";
    ctx.lineWidth = 4;
    boltPath(b.pts); ctx.stroke();
    ctx.shadowBlur = 8;
    ctx.strokeStyle = "rgba(255,255,255," + a.toFixed(3) + ")";
    ctx.lineWidth = 1.6;
    boltPath(b.pts); ctx.stroke();
    ctx.restore();
  }

  /* ---------- main loop ---------- */

  function step(dt) {
    var i, j;
    for (i = 0; i < gpus.length; i++) {
      var g = gpus[i];
      for (j = 0; j < 3; j++) g.fan[j] += g.fanSpeed[j] * dt;
    }
    for (i = 0; i < tokens.length; i++) {
      var k = tokens[i];
      k.y += k.vy * dt;
      k.spin += k.spinV * dt;
      if (k.y - k.s > H + 40) tokens[i] = newToken(false);
    }
    for (i = 0; i < dust.length; i++) {
      var p = dust[i];
      p.y -= p.vy * dt;
      p.tw += dt * 3;
      if (p.y < -10) { p.y = H + 10; p.x = rnd(0, W); }
    }
    if (T >= nextStrike) strike();
    for (i = bolts.length - 1; i >= 0; i--) {
      bolts[i].life -= dt * 2.4;
      if (bolts[i].life <= 0) bolts.splice(i, 1);
    }
    if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var i;
    // dust (behind)
    for (i = 0; i < dust.length; i++) {
      var p = dust[i];
      var tw = p.a * (0.6 + 0.4 * Math.sin(p.tw));
      ctx.globalAlpha = tw;
      ctx.fillStyle = "#d8b4fe";
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // GPUs
    for (i = 0; i < gpus.length; i++) drawGPU(gpus[i], T);
    // tokens
    for (i = 0; i < tokens.length; i++) drawToken(tokens[i], T);
    // lightning
    for (i = 0; i < bolts.length; i++) drawBolt(bolts[i]);
    // screen flash
    if (flash > 0.01) {
      ctx.fillStyle = "rgba(225,195,255," + (flash * 0.20).toFixed(3) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    // vignette keeps text readable at edges
    if (vig) { ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H); }
  }

  var last = 0, raf = 0;
  function frame(ts) {
    var t = ts / 1000;
    var dt = Math.min(0.05, last ? t - last : 0.016);
    last = t;
    T = t;
    step(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();

  if (reduceMotion) {
    // single static frame: GPUs + tokens frozen, no lightning
    T = 1.2;
    step(0);
    draw();
  } else {
    raf = requestAnimationFrame(frame);
  }
})();
