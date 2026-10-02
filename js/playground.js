/* OctaSpace Hub — live API playground (build.html).
   Queries the public, CORS-open https://api.octa.computer/network in the visitor's
   browser and renders three views: network summary, GPU marketplace averages,
   and the full JSON response. Everything shown is live data fetched at click time.
   When the API is unreachable the error state says so explicitly — nothing
   cached or mocked is ever presented as live. */
(function () {
  "use strict";

  var ENDPOINT = "https://api.octa.computer/network";

  // fetch() has no built-in timeout: a hung feed (neither resolving nor
  // rejecting) would never reach the .catch fallbacks below. An 8s abort
  // turns a hang into a rejection so the labeled fallback paths run
  // (same pattern as js/market.js and the GPU Price Index live fetch).
  function fetchT(url){
    var ctrl = new AbortController();
    var t = setTimeout(function(){ ctrl.abort(); }, 8000);
    return fetch(url, { signal: ctrl.signal }).then(function(r){
      clearTimeout(t); return r;
    }, function(e){ clearTimeout(t); throw e; });
  }


  var out = document.getElementById("pg-out");
  var statusEl = document.getElementById("pg-status");
  var runBtn = document.getElementById("pg-run");
  var viewBtns = Array.prototype.slice.call(document.querySelectorAll(".pg-btn"));
  if (!out || !runBtn || !statusEl) return; // playground section not on this page

  var view = "summary";
  var cache = null; // last successful payload

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString("en-US"); }
  function fmtUSD(n, d) { return "$" + Number(n || 0).toFixed(d == null ? 4 : d); }

  function setStatus(txt, ok) {
    statusEl.textContent = txt;
    statusEl.classList.toggle("ok", !!ok);
  }

  function renderSummary(d) {
    var mp = d.marketplace || {}, n = d.nodes || {}, bc = d.blockchain || {},
        pw = d.power || {}, pl = d.platform || {};
    var rented = mp.nodes_rented || 0, idle = mp.nodes_idle || 0, tot = rented + idle;
    var rows = [
      ["Nodes online", fmtInt(n.count)],
      ["Countries", fmtInt(n.locations)],
      ["Rented now", fmtInt(rented) + (tot ? " (" + Math.round(rented / tot * 100) + "% of nodes)" : "")],
      ["Sessions (24h)", fmtInt(mp.sessions_24h)],
      ["Block height", fmtInt(bc.height)],
      ["OCTA staked network-wide", fmtInt(d.staked)],
      ["OCTA market price", fmtUSD(d.market_price)],
      ["GPU compute online", fmtInt(pw.gpus) + " GPUs · " + fmtInt(pw.tflops) + " TFLOPS"],
      ["Platform users", fmtInt(pl.users) + " (+" + fmtInt(pl.users_24h) + " in 24h)"]
    ];
    out.innerHTML = '<dl class="pg-grid">' + rows.map(function (r) {
      return '<div class="pg-stat"><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join("") + "</dl>";
  }

  function renderGpus(d) {
    var gpus = (d.marketplace || {}).gpus || {};
    var list = Object.keys(gpus).map(function (name) {
      var g = gpus[name];
      return { name: name, avg: g.avg_price, count: g.count || 0 };
    }).filter(function (g) { return typeof g.avg === "number"; })
      .sort(function (a, b) { return b.count - a.count; });
    if (!list.length) {
      out.innerHTML = '<p class="pg-err">The API responded but included no GPU marketplace data.</p>';
      return;
    }
    out.innerHTML =
      '<div class="table-wrap"><table class="pg-table"><thead><tr>' +
      '<th scope="col">GPU</th><th scope="col">Avg asking price</th><th scope="col">Listings</th>' +
      '</tr></thead><tbody>' +
      list.map(function (g) {
        return '<tr><td>' + esc(g.name) + '</td><td>' + fmtUSD(g.avg, 2) +
          ' <span class="pg-unit">/ GPU-hr</span></td><td>' + fmtInt(g.count) + '</td></tr>';
      }).join("") + "</tbody></table></div>" +
      '<p class="pg-note">Live asking-price averages across current marketplace listings — they move constantly; hit Refresh to re-pull.</p>';
  }

  function renderRaw(d) {
    var pretty = JSON.stringify(d, null, 2);
    out.innerHTML =
      '<div class="pg-raw-head"><span>Full <code>/network</code> response</span>' +
      '<button type="button" class="copy-btn" id="pg-copy">Copy JSON</button></div>' +
      '<pre class="pg-pre" tabindex="0"><code>' + esc(pretty) + '</code></pre>';
    var cp = document.getElementById("pg-copy");
    if (cp) cp.addEventListener("click", function () { copyText(pretty, cp); });
  }

  function copyText(text, btn) {
    function done() {
      btn.textContent = "Copied ✓";
      btn.classList.add("copied");
      setTimeout(function () {
        btn.textContent = "Copy JSON";
        btn.classList.remove("copied");
      }, 1600);
    }
    function legacy() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta);
      done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, legacy);
    } else {
      legacy();
    }
  }

  function render() {
    if (!cache) return;
    if (view === "gpus") renderGpus(cache);
    else if (view === "raw") renderRaw(cache);
    else renderSummary(cache);
  }

  function load() {
    out.innerHTML = '<p class="pg-loading">Querying api.octa.computer…</p>';
    setStatus("fetching…", false);
    runBtn.disabled = true;
    var t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    fetchT(ENDPOINT)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        cache = d;
        render();
        var t1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        var stamp = new Date().toISOString().slice(11, 19);
        setStatus("✓ live — fetched " + stamp + " UTC in " + Math.round(t1 - t0) + " ms", true);
      })
      .catch(function () {
        cache = null;
        out.innerHTML = '<p class="pg-err">⚠️ Live feed unavailable — api.octa.computer didn\'t respond. ' +
          'Hit Refresh to try again; nothing shown here is a cached stand-in.</p>';
        setStatus("unavailable — hit Refresh to retry", false);
      })
      .then(function () { runBtn.disabled = false; });
  }

  viewBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      viewBtns.forEach(function (x) {
        x.classList.remove("active");
        x.setAttribute("aria-pressed", "false");
      });
      b.classList.add("active");
      b.setAttribute("aria-pressed", "true");
      view = b.getAttribute("data-view");
      if (cache) render(); else load();
    });
  });
  runBtn.addEventListener("click", load);

  load(); // pull the network summary as soon as the section is on the page
})();
