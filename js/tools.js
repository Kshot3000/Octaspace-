// OctaSpace Hub — host & renter tools (js/tools.js).
// Page logic for find / plan / deals / roi / pricing, dispatched via
// <body data-page="...">. Shared data comes from js/market.js
// (OctaMarket.load). Competitor snapshot figures come from data/market.json
// and always carry source + observation-date labels — never live claims.
(function () {
  "use strict";

  var page = (document.body && document.body.getAttribute("data-page")) || "";
  if (!page) return;

  function $(id) { return document.getElementById(id); }
  function usd(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return "—";
    return "$" + Number(n).toLocaleString("en-US", {
      minimumFractionDigits: d === undefined ? 2 : d,
      maximumFractionDigits: d === undefined ? 2 : d
    });
  }
  function pct(n) {
    if (!isFinite(n)) return "—";
    return (n > 0 ? "+" : "") + n.toFixed(1) + "%";
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Status pill: live vs snapshot vs unavailable. Loud about fallback.
  function statusPill(el, res) {
    if (!el) return;
    var cls = res.status === "live" ? "win" : (res.status === "snapshot" ? "mid" : "lose");
    var txt = res.status === "live" ? res.label
      : res.status === "snapshot"
        ? "● Snapshot " + (res.captured || "") + " — live fetch failed, showing baked fallback"
        : "● Data unavailable — live fetch failed and no fallback loaded";
    el.innerHTML = '<span class="tag ' + cls + '">' + esc(txt) + "</span>";
  }

  function thinNote(count) {
    return count < 5 ? ' <span class="tag mid">thin market</span>' : "";
  }

  /* Competitor display names for the plan/deals tables. */
  var COMP_LABELS = {
    vast: "Vast.ai spot",
    runpod_community: "RunPod Community",
    runpod_secure: "RunPod Secure",
    saladcloud: "SaladCloud Lowest"
  };

  function gpuOptions(sel, gpus, keepId) {
    sel.innerHTML = "";
    var sorted = gpus.slice().sort(function (a, b) { return a.short < b.short ? -1 : 1; });
    sorted.forEach(function (g) {
      var o = document.createElement("option");
      o.value = g.id;
      o.textContent = g.short + " — " + g.vram + " GB VRAM · " + usd(g.avg) + "/hr avg";
      sel.appendChild(o);
    });
    if (keepId) sel.value = keepId;
  }

  function byId(gpus, id) {
    for (var i = 0; i < gpus.length; i++) if (gpus[i].id === id) return gpus[i];
    return null;
  }

  /* ---------------- FIND ---------------- */
  function initFind(res) {
    statusPill($("find-status"), res);
    var note = $("find-note");
    if (res.status !== "live" && note) {
      note.textContent = "Showing the baked " + (res.captured || "") +
        " snapshot from api.octa.computer. Individual listing details (host, region, exact price) live on octa.space — this finder shows market aggregates only.";
    }
    var q = $("f-q"), vram = $("f-vram"), maxp = $("f-maxp"), sort = $("f-sort"), body = $("find-body"), count = $("find-count");
    function render() {
      var term = (q.value || "").toLowerCase();
      var minV = Number(vram.value) || 0;
      var mp = parseFloat(maxp.value);
      var rows = res.gpus.filter(function (g) {
        if (term && (g.short + " " + g.name).toLowerCase().indexOf(term) < 0) return false;
        if (minV && g.vram < minV) return false;
        if (isFinite(mp) && g.avg > mp) return false;
        return true;
      });
      var key = sort.value;
      rows.sort(function (a, b) {
        if (key === "price-desc") return b.avg - a.avg;
        if (key === "count-desc") return b.count - a.count;
        if (key === "vram-desc") return b.vram - a.vram;
        return a.avg - b.avg;
      });
      body.innerHTML = "";
      rows.forEach(function (g) {
        var tr = document.createElement("tr");
        tr.innerHTML =
          "<td><strong>" + esc(g.short) + "</strong></td>" +
          "<td>" + (g.vram ? g.vram + " GB" : "—") + "</td>" +
          "<td class=\"hl\">" + usd(g.avg) + "/hr</td>" +
          "<td>" + g.count + thinNote(g.count) + "</td>" +
          "<td>" + usd(g.avg * 730) + "/mo</td>";
        body.appendChild(tr);
      });
      if (!rows.length) {
        var tr0 = document.createElement("tr");
        tr0.innerHTML = '<td colspan="5" style="color:var(--muted)">No GPUs match those filters.</td>';
        body.appendChild(tr0);
      }
      count.textContent = rows.length + " of " + res.gpus.length + " GPU models";
    }
    [q, vram, maxp, sort].forEach(function (el) {
      el.addEventListener("input", render);
      el.addEventListener("change", render);
    });
    render();
  }

  /* ---------------- PLAN ---------------- */
  function initPlan(res, comp, prov) {
    statusPill($("plan-status"), res);
    var sel = $("p-gpu"), n = $("p-count"), hrs = $("p-hours"), out = $("plan-out");
    gpuOptions(sel, res.gpus, "rtx4090");
    function provLine() {
      return "OctaSpace: " + (res.status === "live" ? "live avg via api.octa.computer" : "baked snapshot " + (res.captured || "")) +
        " · Vast.ai: " + (prov.vast || "see GPU Price Index methodology") +
        " · RunPod: " + (prov.runpod_community || "see GPU Price Index methodology") +
        " · SaladCloud: " + (prov.saladcloud || "see GPU Price Index methodology") +
        ". " + (prov.tiers || "");
    }
    function render() {
      var g = byId(res.gpus, sel.value) || res.gpus[0];
      if (!g) { out.innerHTML = "<p>No market data available.</p>"; return; }
      var cnt = Math.max(1, parseInt(n.value, 10) || 1);
      var h = Math.max(1, parseFloat(hrs.value) || 1);
      var c = comp[g.id] || {};
      var octaUsd = g.avg * cnt * h;
      var octaAmt = octaUsd / (res.octa.price || NaN);
      var rows = [];
      rows.push({ name: "OctaSpace (market avg)", usd: octaUsd, note: res.status === "live" ? "live avg" : "snapshot" });
      var alt = [];
      [["vast", c.vast], ["runpod_community", c.runpod_community], ["runpod_secure", c.runpod_secure], ["saladcloud", c.saladcloud]]
        .forEach(function (pair) {
          if (isFinite(pair[1])) {
            var cost = pair[1] * cnt * h;
            rows.push({ name: COMP_LABELS[pair[0]], usd: cost, note: "snapshot" });
            alt.push(cost);
          }
        });
      var cheapest = alt.length ? Math.min.apply(null, alt) : null;
      var save = cheapest ? ((cheapest - octaUsd) / cheapest) * 100 : null;
      var html = '<div class="calc-out"><div class="big">' + usd(octaUsd) + "</div>" +
        '<div class="sub">' + cnt + "× " + esc(g.short) + " for " + h + " hr" +
        (isFinite(octaAmt) ? " ≈ <strong>" + octaAmt.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " OCTA</strong> <span style='color:var(--muted)'>(" + esc(res.octa.note) + ": " + usd(res.octa.price, 4) + "/OCTA)</span>" : "") +
        "</div></div>";
      html += '<div class="table-wrap"><table><thead><tr><th>Platform</th><th>Total</th><th>vs OctaSpace</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        var d = r.usd - octaUsd;
        html += "<tr><td>" + esc(r.name) + ' <span class="tag ' + (r.note === "live avg" ? "win" : "mid") + '">' + esc(r.note) + "</span></td>" +
          "<td class=\"hl\">" + usd(r.usd) + "</td>" +
          "<td>" + (r.name.indexOf("OctaSpace") === 0 ? "—" : (d >= 0 ? "+" : "−") + usd(Math.abs(d)) + (d >= 0 ? " more" : " less")) + "</td></tr>";
      });
      html += "</tbody></table></div>";
      if (save !== null && save > 0) {
        html += '<p class="calc-note">OctaSpace comes out <strong>' + save.toFixed(0) + "% cheaper</strong> than the cheapest snapshot alternative for this workload.</p>";
      }
      html += '<p class="calc-note">' + esc(provLine()) + "</p>";
      out.innerHTML = html;
    }
    [sel, n, hrs].forEach(function (el) { el.addEventListener("input", render); el.addEventListener("change", render); });
    render();
  }

  /* ---------------- DEALS ---------------- */
  function initDeals(res, comp, prov) {
    statusPill($("deals-status"), res);
    var body = $("deals-body");
    var rows = [];
    res.gpus.forEach(function (g) {
      var c = comp[g.id] || {};
      var vast = c.vast;
      var save = (isFinite(vast) && vast > 0) ? ((vast - g.avg) / vast) * 100 : null;
      rows.push({ g: g, vast: vast, save: save });
    });
    rows.sort(function (a, b) { return (b.save === null ? -1e9 : b.save) - (a.save === null ? -1e9 : a.save); });
    var html = "";
    rows.forEach(function (r) {
      var g = r.g, badge;
      if (r.save === null) badge = '<span style="color:var(--muted)">—</span>';
      else if (r.save >= 30) badge = '<span class="tag win">' + r.save.toFixed(0) + "% below Vast.ai spot</span>";
      else if (r.save >= 10) badge = '<span class="tag mid">' + r.save.toFixed(0) + "% below Vast.ai spot</span>";
      else if (r.save >= 0) badge = '<span class="tag">' + r.save.toFixed(0) + "% below Vast.ai spot</span>";
      else badge = '<span class="tag lose">' + Math.abs(r.save).toFixed(0) + "% ABOVE Vast.ai spot</span>";
      html += "<tr><td><strong>" + esc(g.short) + "</strong>" + thinNote(g.count) + "</td>" +
        '<td class="hl">' + usd(g.avg) + "/hr</td>" +
        "<td>" + g.count + "</td>" +
        "<td>" + (isFinite(r.vast) ? usd(r.vast) + "/hr" : "—") + "</td>" +
        "<td>" + badge + "</td></tr>";
    });
    body.innerHTML = html;
    var provEl = $("deals-prov");
    if (provEl) provEl.textContent = "OctaSpace avgs: " + (res.status === "live" ? "live via api.octa.computer" : "baked snapshot " + (res.captured || "")) +
      ". Vast.ai: " + (prov.vast || "see methodology") + " Averages move with listings — the cheapest individual listing may be lower or higher than the average.";
  }

  /* ---------------- ROI ---------------- */
  function initRoi(res) {
    statusPill($("roi-status"), res);
    var sel = $("r-gpu"), price = $("r-price"), elec = $("r-elec"), watts = $("r-watts"),
        util = $("r-util"), utilVal = $("r-util-val"), out = $("roi-out");
    gpuOptions(sel, res.gpus, "rtx4090");
    function syncWatts() {
      var g = byId(res.gpus, sel.value);
      if (g && g.watts) watts.value = g.watts;
    }
    function render() {
      var g = byId(res.gpus, sel.value);
      var p = parseFloat(price.value), e = parseFloat(elec.value),
          w = parseFloat(watts.value), u = (parseFloat(util.value) || 0) / 100;
      utilVal.textContent = Math.round(u * 100) + "%";
      if (!g || !(p >= 0) || !(e >= 0) || !(w >= 0)) { out.innerHTML = "<p>Fill in the fields above.</p>"; return; }
      var HRS = 730; // avg month
      var revenue = g.avg * HRS * u;
      var powerKwh = (w * HRS * u) / 1000;
      var powerCost = powerKwh * e;
      var profit = revenue - powerCost;
      var breakeven = profit > 0 ? p / profit : null;
      var years = breakeven !== null ? breakeven / 12 : null;
      var html = '<div class="calc-out"><div class="big">' + (profit >= 0 ? "+" : "−") + usd(Math.abs(profit)) + '<span style="font-size:1.1rem">/mo</span></div>' +
        '<div class="sub">Estimated monthly profit · ' + esc(g.short) + " at " + usd(g.avg) + "/hr avg, " + Math.round(u * 100) + "% rented</div></div>" +
        '<div class="table-wrap"><table><tbody>' +
        "<tr><td>Monthly rental revenue</td><td class=\"hl\">" + usd(revenue) + "</td></tr>" +
        "<tr><td>Monthly power cost (" + powerKwh.toFixed(0) + " kWh)</td><td class=\"hl\">" + usd(powerCost) + "</td></tr>" +
        "<tr><td>Hardware break-even</td><td class=\"hl\">" + (breakeven !== null ? breakeven.toFixed(1) + " months" + (years >= 2 ? " (" + years.toFixed(1) + " yrs)" : "") : "never at these inputs") + "</td></tr>" +
        "</tbody></table></div>" +
        '<p class="calc-note">Assumes power is drawn only while rented. Excludes OctaSpace network fees, hardware wear, downtime, and price drift — illustrative math, not financial advice. Rate: ' +
        (res.status === "live" ? "live avg via api.octa.computer" : "baked snapshot " + (res.captured || "")) + ".</p>";
      out.innerHTML = html;
    }
    sel.addEventListener("change", function () { syncWatts(); render(); });
    [price, elec, watts, util].forEach(function (el) {
      el.addEventListener("input", render); el.addEventListener("change", render);
    });
    syncWatts();
    render();
  }

  /* ---------------- PRICING ---------------- */
  function initPricing(res) {
    statusPill($("pricing-status"), res);
    var sel = $("x-gpu"), util = $("x-util"), utilVal = $("x-util-val"), out = $("pricing-out");
    gpuOptions(sel, res.gpus, "rtx4090");
    function render() {
      var g = byId(res.gpus, sel.value);
      var u = (parseFloat(util.value) || 40) / 100;
      utilVal.textContent = Math.round(u * 100) + "%";
      if (!g) { out.innerHTML = "<p>No market data available.</p>"; return; }
      var lo = g.avg * 0.8, hi = g.avg * 0.9, mid = (lo + hi) / 2;
      var monthly = mid * 730 * u;
      var read = g.count < 5 ? "Thin market (" + g.count + " listings) — demand may support pricing near the average."
        : g.count > 30 ? "Crowded market (" + g.count + " listings) — pricing under the average wins rentals."
        : "Balanced market (" + g.count + " listings).";
      out.innerHTML =
        '<div class="calc-out"><div class="big">' + usd(lo) + " – " + usd(hi) + '<span style="font-size:1.1rem">/hr</span></div>' +
        '<div class="sub">Suggested listing band for ' + esc(g.short) + ' · market avg ' + usd(g.avg) + '/hr across ' + g.count + ' listings</div></div>' +
        '<div class="table-wrap"><table><tbody>' +
        "<tr><td>Market average</td><td class=\"hl\">" + usd(g.avg) + "/hr</td></tr>" +
        "<tr><td>Band midpoint revenue</td><td class=\"hl\">" + usd(monthly) + "/mo at " + Math.round(u * 100) + "% rented</td></tr>" +
        "<tr><td>Market read</td><td>" + esc(read) + "</td></tr>" +
        "</tbody></table></div>" +
        '<p class="calc-note">Heuristic band (roughly 10–20% under the current average) to attract first renters — market data, not financial advice. Averages move with listings; re-check before you set a price.</p>';
    }
    sel.addEventListener("change", render);
    [util].forEach(function (el) { el.addEventListener("input", render); el.addEventListener("change", render); });
    render();
  }

  /* ---------------- BOOT ---------------- */
  function boot() {
    if (!window.OctaMarket) {
      var el = $("find-status") || $("plan-status") || $("deals-status") || $("roi-status") || $("pricing-status");
      if (el) el.innerHTML = '<span class="tag lose">Tool scripts failed to load</span>';
      return;
    }
    OctaMarket.load(function (res) {
      var comp = res.competitors || {}, prov = res.provenance || {};
      if (page === "plan") initPlan(res, comp, prov);
      else if (page === "deals") initDeals(res, comp, prov);
      else if (page === "find") initFind(res);
      else if (page === "roi") initRoi(res);
      else if (page === "pricing") initPricing(res);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
