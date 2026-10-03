// Provider earnings calculator — earn.html
(function(){
  "use strict";

  var STAKE_OCTA = 100000;

  // Live OCTA/USD captured from the calculator's own /network fetch below, so the
  // OCTA conversion stays fresh even if js/app.js failed to load. Last resort only.
  var liveMarketPrice = 0;

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


  // Baked marketplace snapshot so the GPU prefill works even if the live API
  // is unreachable. Captured from https://api.octa.computer/network 2026-10-03T00:52Z
  // (mirrors the js/market.js baked fallback — keep the two in sync; verified
  // identical to live across three identical reads at capture time).
  // NOTE: this copy had drifted to the older 11:50 UTC snapshot (5090 count 63,
  // 3090 count 52, 5080 $0.39/18) while market.js had moved to 15:54 — fixed 2026-10-02.
  var MARKETPLACE_FALLBACK = {
    captured: "2026-10-03 00:52 UTC",
    live: false,
    gpus: {
      "NVIDIA GeForce RTX 5090": {avg: 0.64, count: 59},
      "NVIDIA GeForce RTX 3090": {avg: 0.23, count: 52},
      "NVIDIA GeForce RTX 4090": {avg: 0.45, count: 33},
      "NVIDIA GeForce RTX 5080": {avg: 0.4, count: 16},
      "NVIDIA GeForce RTX 5070": {avg: 0.18, count: 8},
      "NVIDIA H100 80GB HBM3":   {avg: 0.12, count: 8},
      "NVIDIA GeForce RTX 4070": {avg: 0.23, count: 7},
      "NVIDIA GeForce RTX 4080": {avg: 0.04, count: 2},
      "NVIDIA RTX A6000":        {avg: 0.20, count: 2},
      "NVIDIA A100-SXM4-40GB":   {avg: 0.48, count: 1}
    }
  };

  function shortName(name){
    return name.replace(/^NVIDIA GeForce /,"").replace(/^NVIDIA RTX /,"RTX ").replace(/^NVIDIA /,"");
  }

  function populateGpuSelect(select, data){
    select._mpData = data;
    while(select.options.length > 1) select.remove(1); // keep the placeholder
    var names = Object.keys(data.gpus).sort(function(a,b){ return data.gpus[b].count - data.gpus[a].count; });
    names.forEach(function(name){
      var g = data.gpus[name];
      if(!g.count) return;
      var opt = document.createElement("option");
      opt.value = name;
      var flag = g.count < 5 ? " · ⚠ few listings" : "";
      opt.textContent = shortName(name) + " — avg $" + g.avg.toFixed(2) + "/hr · " + g.count + " listings" + flag;
      select.appendChild(opt);
    });
    var hint = document.getElementById("c-gpu-hint");
    if(hint){
      hint.textContent = data.live
        ? "Live marketplace rates via api.octa.computer — averages move with listings."
        : "Live feed unavailable — showing cached snapshot from " + data.captured + ".";
    }
  }

  function bindGpuPrefill(){
    var select = document.getElementById("c-gpu");
    if(!select) return;
    select.addEventListener("change", function(){
      var data = select._mpData;
      if(!data) return;
      var g = data.gpus[select.value];
      if(!g) return; // placeholder chosen — leave the manual price alone
      var priceEl = document.getElementById("c-price");
      if(priceEl) priceEl.value = g.avg.toFixed(2);
      var hint = document.getElementById("c-gpu-hint");
      if(hint){
        hint.textContent = "Prefilled $" + g.avg.toFixed(2) + "/hr from " +
          (data.live ? "live" : "cached " + data.captured) + " marketplace data — " +
          g.count + " listing" + (g.count>1?"s":"") + ". Actual rates vary; adjust freely.";
      }
      calc();
    });
    fetchT("https://api.octa.computer/network")
      .then(function(r){ if(!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function(d){
        var gpus = {};
        var raw = (d.marketplace && d.marketplace.gpus) || {};
        Object.keys(raw).forEach(function(name){
          gpus[name] = {avg: raw[name].avg_price, count: raw[name].count};
        });
        if(d && typeof d.market_price === "number" && d.market_price > 0) liveMarketPrice = d.market_price;
        populateGpuSelect(select, {captured: "", live: true, gpus: gpus});
        if(!window.OCTA_PRICE) calc(); // re-run with the fresh market_price when app.js didn't supply one
      })
      .catch(function(){ populateGpuSelect(select, MARKETPLACE_FALLBACK); });
  }

  function num(id){ var v = parseFloat(document.getElementById(id).value); return isNaN(v) ? 0 : v; }

  function calc(){
    var priceHr   = num("c-price");       // USD per GPU-hour charged to renters
    var gpus      = Math.max(1, Math.floor(num("c-gpus")));
    var util      = num("c-util");         // % of time rented
    var idleDay   = num("c-idle");         // USD/day per GPU from idle mining fallback
    var powerW    = num("c-power");        // watts per GPU
    var elecRate  = num("c-elec");         // USD per kWh
    var octaPrice = window.OCTA_PRICE || liveMarketPrice || 0.1117; // last-resort literal mirrors js/app.js FALLBACK (re-synced 2026-10-03 ~00:52 UTC) — re-sync if app.js FALLBACK changes

    var hrsMonth = 730;
    var rentedHrs = hrsMonth * (util/100);
    var idleHrs   = hrsMonth - rentedHrs;

    var rentRev   = priceHr * rentedHrs * gpus;
    var idleRev   = idleDay * 30 * gpus * (idleHrs/hrsMonth);
    var gross     = rentRev + idleRev;

    var kwhMonth  = (powerW * gpus * hrsMonth) / 1000;
    var powerCost = kwhMonth * elecRate;
    var net       = gross - powerCost;
    var netOcta   = octaPrice > 0 ? net / octaPrice : 0;
    var stakeCost = STAKE_OCTA * octaPrice;

    set("o-gross", usd(gross));
    set("o-power", "−" + usd(powerCost));
    set("o-net", usd(net));
    set("o-net-octa", netOcta.toLocaleString("en-US",{maximumFractionDigits:0}) + " OCTA / mo");
    set("o-stake", usd(stakeCost));
    var note = document.getElementById("o-note");
    if(note){
      note.textContent = "Assumes " + util + "% rental utilization at " + usd(priceHr, 2) +
        "/GPU-hr across " + gpus + " GPU" + (gpus>1?"s":"") +
        ", idle-mining fallback while unrented, and " + usd(elecRate, 2) + "/kWh power. " +
        "OCTA at " + usd(octaPrice,4) + ". Rental demand is the big unknown — treat this as a scenario planner, not a promise.";
    }
    var uv = document.getElementById("c-util-val");
    if(uv) uv.textContent = util + "%";
  }
  function usd(n, d){
    return (n<0?"−$":"$") + Math.abs(n).toLocaleString("en-US",{minimumFractionDigits:d||0, maximumFractionDigits:d||0});
  }
  function set(id, txt){ var el = document.getElementById(id); if(el) el.textContent = txt; }

  function bind(){
    ["c-price","c-gpus","c-util","c-idle","c-power","c-elec"].forEach(function(id){
      var el = document.getElementById(id);
      if(el) el.addEventListener("input", calc);
    });
    document.addEventListener("octa-price", calc);
    bindGpuPrefill();
    calc();
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
