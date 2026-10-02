"use strict";
/* OctaSpace Hub — Host Console.
   Talks directly from the visitor's browser to the octa-host-agent running
   on the host's own rig (LAN/VPN). Agent URL + token live in localStorage
   on this device only; nothing is sent anywhere else. If the agent has the
   host's OctaSpace API key configured, price changes are applied by the
   AGENT via the official OctaSpace API — the key never touches this page.

   Demo rig: fully simulated data generated locally in this file, always
   behind a persistent DEMO banner. It never pretends to be a real machine. */

var LS_RIGS = "octaConsole.rigs.v1";
var LS_ACTIVE = "octaConsole.activeRig.v1";
var REFRESH_MS = 10000;

function $(id) { return document.getElementById(id); }
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function fmtUptime(s) {
  if (s == null) return "—";
  var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return (d ? d + "d " : "") + h + "h " + m + "m";
}
function fmtMb(mb) {
  if (mb == null) return "—";
  return mb >= 1024 ? (mb / 1024).toFixed(1) + " GB" : Math.round(mb) + " MB";
}
function nowTime() { return new Date().toLocaleTimeString(); }

/* ---------------- rig store ---------------- */
function loadRigs() {
  try { return JSON.parse(localStorage.getItem(LS_RIGS) || "[]"); }
  catch (e) { return []; }
}
function saveRigs(rigs) { localStorage.setItem(LS_RIGS, JSON.stringify(rigs)); }
function activeRig() {
  var id = localStorage.getItem(LS_ACTIVE);
  var rigs = loadRigs();
  for (var i = 0; i < rigs.length; i++) if (rigs[i].id === id) return rigs[i];
  return rigs[0] || null;
}

/* ---------------- network ---------------- */
function fetchT(url, opts, ms) {
  ms = ms || 8000;
  var ctrl = new AbortController();
  var t = setTimeout(function () { ctrl.abort(); }, ms);
  opts = opts || {};
  opts.signal = ctrl.signal;
  return fetch(url, opts).then(function (r) {
    clearTimeout(t);
    return r;
  }, function (e) { clearTimeout(t); throw e; });
}
function api(rig, method, path, body) {
  var opts = { method: method, headers: { "Authorization": "Bearer " + rig.token } };
  if (body) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  return fetchT(rig.url.replace(/\/+$/, "") + path, opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      return { status: r.status, body: j };
    });
  });
}

/* ---------------- demo rig (SIMULATED — never real) ---------------- */
var demoState = {
  idleMode: "off", idleCmd: "", idleRunning: false,
  priceTarget: null, poweredOff: false
};
function demoStatus() {
  var wobble = Math.floor(Math.random() * 5) - 2;
  return {
    demo: true, data_source: "simulated-demo", hostname: "demo-rig",
    os: "Ubuntu 24.04 LTS (SIMULATED)", agent_version: "demo",
    uptime_s: 93784 + Math.floor(Math.random() * 60),
    gpus: [
      { index: 0, name: "NVIDIA GeForce RTX 4090 (SIMULATED)", temp_c: 66 + wobble, fan_percent: 54, power_w: 318.5, util_percent: 96, vram_used_mb: 19850, vram_total_mb: 24564 },
      { index: 1, name: "NVIDIA GeForce RTX 4090 (SIMULATED)", temp_c: 60 + wobble, fan_percent: 47, power_w: 121.2, util_percent: 12, vram_used_mb: 2400, vram_total_mb: 24564 }
    ],
    gpu_error: null,
    cpu: { count: 16, load_1m: 3.42, load_5m: 3.1, load_15m: 2.87, load_percent: 21.4, temp_c: 58 },
    ram: { total_mb: 65536, used_mb: 18230, available_mb: 47306, used_percent: 27.8 },
    disk: { total_gb: 2000, used_gb: 812.4, free_gb: 1187.6, used_percent: 40.6 },
    node: { state: "running", via: "simulated", target: "demo-node", detail: "SIMULATED node state — demo mode only" },
    idle_job: { mode: demoState.idleMode, command: demoState.idleCmd, process_running: demoState.idleRunning, pid: demoState.idleRunning ? 4242 : null, running_since: null, auto_detection: "demo — simulated", note: demoState.idleMode === "pause" ? "mode 'pause' is a stored preference only — the OctaSpace API has no node pause switch" : null },
    price_target: demoState.priceTarget,
    ts: Math.floor(Date.now() / 1000)
  };
}

/* ---------------- app state ---------------- */
var isDemo = false;
var lastStatus = null;
var refreshTimer = null;

function log(msg, isErr) {
  var el = $("activity");
  if (!el) return;
  var line = document.createElement("div");
  line.className = "log-line" + (isErr ? " log-err" : "");
  line.textContent = nowTime() + " — " + msg;
  el.insertBefore(line, el.firstChild);
  while (el.children.length > 8) el.removeChild(el.lastChild);
}

function tempClass(t) {
  if (t == null) return "";
  if (t >= 80) return "temp-hot";
  if (t >= 68) return "temp-warm";
  return "temp-ok";
}
function meter(pct) {
  var p = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return '<div class="meter"><span style="width:' + p + '%"></span></div>';
}

/* ---------------- rendering ---------------- */
function renderRigTabs() {
  var rigs = loadRigs();
  var cur = activeRig();
  var html = "";
  rigs.forEach(function (r) {
    html += '<button type="button" class="rig-tab' + (cur && r.id === cur.id && !isDemo ? " active" : "") +
      '" data-rig="' + esc(r.id) + '">' + esc(r.name) + "</button>";
  });
  html += '<button type="button" class="rig-tab' + (isDemo ? " active" : "") + '" data-rig="__demo">Demo rig (simulated)</button>';
  $("rigTabs").innerHTML = html;
  Array.prototype.forEach.call(document.querySelectorAll("[data-rig]"), function (b) {
    b.addEventListener("click", function () { selectRig(b.getAttribute("data-rig")); });
  });
}

function gpuCard(g) {
  var vramPct = (g.vram_used_mb != null && g.vram_total_mb) ? (g.vram_used_mb / g.vram_total_mb * 100) : null;
  return '<div class="card gpu-card">' +
    '<div class="gpu-head"><h3>GPU ' + g.index + '</h3>' +
    '<span class="temp ' + tempClass(g.temp_c) + '">' + (g.temp_c == null ? "—" : Math.round(g.temp_c) + "°C") + "</span></div>" +
    '<p class="gpu-name">' + esc(g.name) + "</p>" +
    '<div class="kv"><span>Utilization</span><strong>' + (g.util_percent == null ? "—" : g.util_percent + "%") + "</strong></div>" + meter(g.util_percent) +
    '<div class="kv"><span>VRAM</span><strong>' + fmtMb(g.vram_used_mb) + " / " + fmtMb(g.vram_total_mb) + "</strong></div>" + meter(vramPct) +
    '<div class="kv"><span>Fan</span><strong>' + (g.fan_percent == null ? "— (passive/none reported)" : g.fan_percent + "%") + "</strong></div>" +
    '<div class="kv"><span>Power draw</span><strong>' + (g.power_w == null ? "—" : g.power_w + " W") + "</strong></div>" +
    "</div>";
}

function renderStatus(s) {
  lastStatus = s;
  $("dashboard").hidden = false;
  $("demoBanner").hidden = !(isDemo || s.demo);
  var rig = activeRig();
  $("rigTitle").textContent = (isDemo ? "Demo rig (simulated)" : (rig ? rig.name : "Rig")) + " — " + (s.hostname || "");
  $("rigMeta").textContent =
    (s.demo ? "SIMULATED DATA — not a real machine · " : "") +
    (s.os || "") + " · agent v" + (s.agent_version || "?") +
    " · uptime " + fmtUptime(s.uptime_s) +
    " · updated " + nowTime();
  $("connState").textContent = s.demo ? "Demo" : "Connected";
  $("connState").className = "pill " + (s.demo ? "pill-demo" : "pill-live");

  var gpusHtml = "";
  if (s.gpus && s.gpus.length) s.gpus.forEach(function (g) { gpusHtml += gpuCard(g); });
  else gpusHtml = '<div class="card"><h3>No GPU telemetry</h3><p>' + esc(s.gpu_error || "The agent reported no GPUs.") + "</p></div>";
  $("gpuGrid").innerHTML = gpusHtml;

  var cpu = s.cpu || {}, ram = s.ram || {}, disk = s.disk || {};
  $("sysCard").innerHTML =
    '<div class="kv"><span>CPU load</span><strong>' + (cpu.load_percent == null ? "—" : cpu.load_percent + "%") + " (" + (cpu.count || "?") + " threads, 1m avg " + (cpu.load_1m == null ? "—" : cpu.load_1m) + ")</strong></div>" +
    '<div class="kv"><span>CPU temp</span><strong>' + (cpu.temp_c == null ? "not reported by this rig" : cpu.temp_c + "°C") + "</strong></div>" +
    '<div class="kv"><span>RAM</span><strong>' + (ram.used_percent == null ? "—" : ram.used_percent + "%") + " (" + fmtMb(ram.used_mb) + " / " + fmtMb(ram.total_mb) + ")</strong></div>" + meter(ram.used_percent) +
    '<div class="kv"><span>Disk</span><strong>' + (disk.used_percent == null ? "—" : disk.used_percent + "%") + " (" + (disk.used_gb == null ? "—" : disk.used_gb + " / " + disk.total_gb + " GB") + ")</strong></div>" + meter(disk.used_percent);

  var node = s.node || {};
  $("nodeState").textContent = node.state || "unknown";
  $("nodeState").className = "pill " + (node.state === "running" ? "pill-live" : node.state === "stopped" ? "pill-off" : "pill-demo");
  $("nodeDetail").textContent = node.detail || "";

  var ij = s.idle_job || {};
  $("idleState").innerHTML =
    "<strong>Mode:</strong> " + esc(ij.mode || "off") +
    (ij.command ? "<br><strong>Command:</strong> <code>" + esc(ij.command) + "</code>" : "") +
    "<br><strong>Process:</strong> " + (ij.process_running ? "running (pid " + ij.pid + ")" : "not running") +
    (ij.auto_detection ? "<br><strong>Auto-detection:</strong> " + esc(ij.auto_detection) : "") +
    (ij.note ? '<br><span class="warn-note">' + esc(ij.note) + "</span>" : "");
  if (!$("idleMode").dataset.touched) $("idleMode").value = ij.mode || "off";
  if (!$("idleCmd").dataset.touched) $("idleCmd").value = ij.command || "";

  var pt = s.price_target;
  $("priceState").innerHTML = pt ?
    "Saved target: node " + esc(pt.node_id == null ? "—" : pt.node_id) +
    " · base " + (pt.base_cents == null ? "—" : pt.base_cents + "¢") +
    " · storage " + (pt.storage_cents == null ? "—" : pt.storage_cents + "¢") +
    " · traffic " + (pt.traffic_cents == null ? "—" : pt.traffic_cents + "¢") + "<br>" +
    (pt.applied ? "✅ Applied via the official OctaSpace API." : "⚠️ Not applied to OctaSpace — ") +
    esc(pt.apply_detail || "") :
    "No price target saved on this rig yet.";
}

/* ---------------- data flow ---------------- */
function setUnreachable(msg) {
  $("connState").textContent = "Agent unreachable";
  $("connState").className = "pill pill-off";
  $("unreachable").hidden = false;
  $("unreachableMsg").textContent = msg;
}
function clearUnreachable() { $("unreachable").hidden = true; }

function refresh() {
  if (isDemo) { clearUnreachable(); renderStatus(demoStatus()); loadOctaNodes(); return; }
  var rig = activeRig();
  if (!rig) return;
  api(rig, "GET", "/api/status").then(function (res) {
    if (res.status === 401) { setUnreachable("The agent rejected the token (HTTP 401). Re-check the token from the agent's startup output / config file on the rig."); return; }
    if (!res.body || !res.body.status) { setUnreachable("The agent answered HTTP " + res.status + " without status data."); return; }
    clearUnreachable();
    renderStatus(res.body.status);
    loadOctaNodes();
  }).catch(function (e) {
    setUnreachable("Could not reach the agent at " + rig.url + " (" + (e.name === "AbortError" ? "timed out after 8s" : "network error") + "). This means the console can't talk to the agent — the rig may be off, the agent may be stopped, or the address/network may be wrong. It does NOT prove the rig itself is off.");
  });
}

function loadOctaNodes() {
  var box = $("octaNodes");
  if (isDemo) {
    box.innerHTML = '<p class="calc-note">Demo rig: connect a real rig whose agent has your OctaSpace API key configured to list your real nodes here.</p>';
    return;
  }
  var rig = activeRig();
  if (!rig) return;
  api(rig, "GET", "/api/octa/nodes").then(function (res) {
    if (res.status === 400) {
      box.innerHTML = '<p class="calc-note">This rig\'s agent has no OctaSpace API key configured, so your node list, API price application, and API reboot are off. Add <code>octa_api_key</code> to the agent config on the rig to enable them — the key stays on the rig.</p>';
      return;
    }
    var nodes = res.body.nodes;
    if (!Array.isArray(nodes)) nodes = (nodes && nodes.data) || [];
    if (!nodes.length) { box.innerHTML = '<p class="calc-note">The official API returned no nodes for this account.</p>'; return; }
    var html = '<div class="cards">';
    nodes.forEach(function (n) {
      var gpu = n.gpu && n.gpu.nvidia && n.gpu.nvidia[0];
      html += '<div class="card"><h3>Node ' + esc(n.id) + '</h3>' +
        '<div class="kv"><span>State</span><strong>' + esc(n.state || "—") + '</strong></div>' +
        (gpu ? '<div class="kv"><span>GPU</span><strong>' + esc(gpu.model || "—") + '</strong></div>' +
               '<div class="kv"><span>GPU temp</span><strong>' + (gpu.gpu_temperature == null ? "—" : gpu.gpu_temperature + "°C") + '</strong></div>' : "") +
        '<div class="kv"><span>Reliability</span><strong>' + (n.reliability == null ? "—" : n.reliability) + '</strong></div>' +
        '<p><button type="button" class="btn btn-ghost btn-sm" data-use-node="' + esc(n.id) + '">Use for price changes</button> ' +
        '<button type="button" class="btn btn-ghost btn-sm" data-api-reboot="' + esc(n.id) + '">Reboot via API</button></p></div>';
    });
    box.innerHTML = html + "</div>";
    Array.prototype.forEach.call(box.querySelectorAll("[data-use-node]"), function (b) {
      b.addEventListener("click", function () {
        $("priceNode").value = b.getAttribute("data-use-node");
        log("Price form now targets node " + b.getAttribute("data-use-node"));
      });
    });
    Array.prototype.forEach.call(box.querySelectorAll("[data-api-reboot]"), function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-api-reboot");
        if (!window.confirm("Reboot OctaSpace node " + id + " via the official API? Any active rental on it will be interrupted.")) return;
        api(rig, "POST", "/api/octa/reboot", { node_id: isNaN(+id) ? id : +id }).then(function (res) {
          log(res.body.detail || ("API reboot node " + id), !res.body.ok);
        }).catch(function () { log("API reboot request failed — agent unreachable.", true); });
      });
    });
  }).catch(function () {
    box.innerHTML = '<p class="calc-note">Could not load your OctaSpace nodes (agent unreachable).</p>';
  });
}

function startAutoRefresh() {
  stopAutoRefresh();
  if ($("autoRefresh").checked) refreshTimer = setInterval(refresh, REFRESH_MS);
}
function stopAutoRefresh() { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } }

function selectRig(id) {
  stopAutoRefresh();
  if (id === "__demo") {
    isDemo = true;
  } else {
    isDemo = false;
    localStorage.setItem(LS_ACTIVE, id);
  }
  renderRigTabs();
  refresh();
  startAutoRefresh();
}

/* ---------------- actions ---------------- */
function act(path, body, okMsg) {
  if (isDemo) {
    var detail = "DEMO MODE: simulated — nothing real happened.";
    if (path === "/api/idle-job" && body.mode) { demoState.idleMode = body.mode; demoState.idleCmd = body.command || ""; detail = "Demo: idle-job setting saved (simulated)."; }
    if (path === "/api/idle-job" && body.action === "start") { demoState.idleRunning = true; detail = "Demo: idle command started (simulated)."; }
    if (path === "/api/idle-job" && body.action === "stop") { demoState.idleRunning = false; detail = "Demo: idle command stopped (simulated)."; }
    if (path === "/api/price") {
      demoState.priceTarget = { node_id: body.node_id, base_cents: body.base_cents, storage_cents: body.storage_cents, traffic_cents: body.traffic_cents, applied: false, apply_detail: "Demo rig — prices are never applied from demo mode. On a real rig with your OctaSpace API key configured on the agent, this applies via the official API." };
      detail = "Demo: price target saved (simulated, not applied).";
    }
    log(detail);
    renderStatus(demoStatus());
    return Promise.resolve();
  }
  var rig = activeRig();
  if (!rig) { log("Add a rig first.", true); return Promise.resolve(); }
  return api(rig, "POST", path, body).then(function (res) {
    log(res.body.detail || okMsg || "Done.", !res.body.ok);
    if (path === "/api/price" && res.body.price_target) { /* status refresh shows it */ }
    setTimeout(refresh, 600);
  }).catch(function () { log("Request failed — agent unreachable.", true); });
}

function usdToCents(id) {
  var v = parseFloat($(id).value);
  if (isNaN(v)) return null;
  return Math.round(v * 100);
}

/* ---------------- init ---------------- */
document.addEventListener("DOMContentLoaded", function () {
  renderRigTabs();
  var rig = activeRig();
  if (rig) { $("dashboard").hidden = false; refresh(); startAutoRefresh(); }

  $("connectForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("rigName").value.trim() || "My rig";
    var url = $("rigUrl").value.trim().replace(/\/+$/, "");
    var token = $("rigToken").value.trim();
    if (!/^https?:\/\//.test(url)) { log("Agent URL must start with http:// or https://", true); return; }
    if (!token) { log("Paste the agent token (printed by the agent on startup).", true); return; }
    var rigs = loadRigs();
    var id = "rig-" + Date.now().toString(36);
    rigs.push({ id: id, name: name, url: url, token: token });
    saveRigs(rigs);
    $("rigToken").value = "";
    selectRig(id);
    log("Rig '" + name + "' added and saved on this device only.");
  });

  $("demoBtn").addEventListener("click", function () { selectRig("__demo"); });
  $("removeRig").addEventListener("click", function () {
    var cur = activeRig();
    if (isDemo || !cur) { log("No saved rig selected."); return; }
    if (!window.confirm("Remove rig '" + cur.name + "' from this device? (Only the saved connection is removed — nothing on the rig changes.)")) return;
    saveRigs(loadRigs().filter(function (r) { return r.id !== cur.id; }));
    localStorage.removeItem(LS_ACTIVE);
    isDemo = false;
    renderRigTabs();
    $("dashboard").hidden = true;
    log("Rig removed from this device.");
  });
  $("refreshBtn").addEventListener("click", refresh);
  $("autoRefresh").addEventListener("change", startAutoRefresh);

  $("nodeStart").addEventListener("click", function () { act("/api/node", { action: "start" }, "Node start sent."); });
  $("nodeStop").addEventListener("click", function () {
    if (window.confirm("Stop the OctaSpace node service on this rig? The rig will stop taking rentals until the node is started again.")) act("/api/node", { action: "stop" }, "Node stop sent.");
  });
  $("nodeRestart").addEventListener("click", function () { act("/api/node", { action: "restart" }, "Node restart sent."); });

  $("rebootBtn").addEventListener("click", function () {
    if (window.confirm("Reboot the whole rig now? Any active rental will be interrupted. The rig should come back on its own once it restarts.")) act("/api/power", { action: "reboot", confirm: "REBOOT" }, "Reboot sent.");
  });
  $("shutdownBtn").addEventListener("click", function () {
    if (window.confirm("SHUT DOWN the whole rig?\n\nThis is final: the rig stays off until someone powers it on locally, sends a Wake-on-LAN packet from another machine on the LAN, or uses a smart plug. Any active rental will be interrupted.")) act("/api/power", { action: "shutdown", confirm: "SHUTDOWN" }, "Shutdown sent.");
  });
  $("wolBtn").addEventListener("click", function () {
    var mac = $("wolMac").value.trim();
    if (!mac) { log("Enter the target rig's MAC address first.", true); return; }
    act("/api/wol", { mac: mac }, "Wake-on-LAN packet sent.");
  });

  $("priceForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var nodeRaw = $("priceNode").value.trim();
    var body = {
      node_id: nodeRaw === "" ? null : (isNaN(+nodeRaw) ? nodeRaw : +nodeRaw),
      base_cents: usdToCents("priceBase"),
      storage_cents: usdToCents("priceStorage"),
      traffic_cents: usdToCents("priceTraffic")
    };
    if (body.base_cents == null && body.storage_cents == null && body.traffic_cents == null) {
      log("Enter at least one price.", true); return;
    }
    if (!isDemo && !activeRig()) { log("Add a rig first.", true); return; }
    if (body.node_id == null) { log("Set the OctaSpace node ID — without it the target is saved on the rig but cannot be applied to a listing.", false); }
    act("/api/price", body, "Price target sent to the agent.");
  });

  ["idleMode", "idleCmd"].forEach(function (id) {
    $(id).addEventListener("input", function () { $(id).dataset.touched = "1"; });
  });
  $("idleForm").addEventListener("submit", function (e) {
    e.preventDefault();
    act("/api/idle-job", { mode: $("idleMode").value, command: $("idleCmd").value.trim() }, "Idle-job setting saved.");
  });
  $("idleStart").addEventListener("click", function () { act("/api/idle-job", { action: "start" }, "Idle command start sent."); });
  $("idleStop").addEventListener("click", function () { act("/api/idle-job", { action: "stop" }, "Idle command stop sent."); });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () { /* PWA is a bonus; the page works without it */ });
  }
});
