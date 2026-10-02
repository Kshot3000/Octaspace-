// OctaSpace Hub — shared market data layer (js/market.js).
// One fetch of https://api.octa.computer/network gives every tool page the
// live GPU aggregates (avg asking price + listing count per model) and the
// live OCTA market price. If the fetch fails, we fall back to the baked
// data/market.json snapshot — the page MUST label that as a snapshot.
//
// Contract: OctaMarket.load(cb) -> cb(result)
//   result = {
//     status: "live" | "snapshot",
//     label:  human-readable provenance line for the page header,
//     captured: ISO timestamp string of the snapshot (snapshot mode only),
//     gpus:   [{ name, short, avg, count, vram, watts }],
//     octa:  { price, note }   // USD per OCTA, with its own provenance note
//   }
// The API exposes aggregates only (avg + count per GPU model) — there are no
// per-listing prices, so no page may claim to show individual listings.
(function () {
  "use strict";

  var API = "https://api.octa.computer/network";
  var OCTA_LITERAL = 0.1132; // keep in sync with js/app.js FALLBACK.price

  // Baked fallback: captured from https://api.octa.computer/network at
  // 2026-10-02T00:55:00Z. Used ONLY when the live fetch fails — the page
  // always labels it as a snapshot. Inline (not fetched) so it works from
  // any origin, including file://. Mirrors data/market.json — if you update
  // one, update the other.
  var FALLBACK = {
    "snapshot_captured": "2026-10-02T00:55:00Z",
    "octaspace_gpus": {
      "NVIDIA A100-SXM4-40GB": { "avg_price": 0.48, "count": 1 },
      "NVIDIA GeForce RTX 3090": { "avg_price": 0.22, "count": 50 },
      "NVIDIA GeForce RTX 4070": { "avg_price": 0.23, "count": 7 },
      "NVIDIA GeForce RTX 4080": { "avg_price": 0.19, "count": 1 },
      "NVIDIA GeForce RTX 4090": { "avg_price": 0.44, "count": 32 },
      "NVIDIA GeForce RTX 5070": { "avg_price": 0.17, "count": 7 },
      "NVIDIA GeForce RTX 5080": { "avg_price": 0.39, "count": 18 },
      "NVIDIA GeForce RTX 5090": { "avg_price": 0.64, "count": 62 },
      "NVIDIA H100 80GB HBM3": { "avg_price": 0.12, "count": 8 },
      "NVIDIA RTX A6000": { "avg_price": 0.2, "count": 2 }
    },
    "competitors": {
      "rtx3090":  { "name": "RTX 3090",  "vram": 24, "vast": 0.11, "saladcloud": 0.09, "runpod_community": 0.22, "runpod_secure": 0.5 },
      "rtx4070":  { "name": "RTX 4070",  "vram": 12, "vast": 0.08 },
      "rtx4080":  { "name": "RTX 4080",  "vram": 16, "vast": 0.15 },
      "rtx4090":  { "name": "RTX 4090",  "vram": 24, "vast": 0.17, "saladcloud": 0.16, "runpod_community": 0.34, "runpod_secure": 0.74 },
      "rtx5070":  { "name": "RTX 5070",  "vram": 12, "vast": 0.11 },
      "rtx5080":  { "name": "RTX 5080",  "vram": 16, "vast": 0.16, "saladcloud": 0.15 },
      "rtx5090":  { "name": "RTX 5090",  "vram": 32, "vast": 0.28, "saladcloud": 0.25, "runpod_community": 0.69, "runpod_secure": 0.99 },
      "rtxa6000": { "name": "RTX A6000", "vram": 48, "vast": 0.2, "runpod_community": 0.33, "runpod_secure": 0.53 },
      "a100":     { "name": "A100 40GB", "vram": 40, "vast": 0.75, "runpod_community": 1.19, "runpod_secure": 1.59,
                    "note": "OctaSpace listing is the 40 GB SXM4 variant; RunPod Secure rate is the 80 GB variant" },
      "h100":     { "name": "H100 80GB", "vram": 80, "vast": 1.0, "runpod_community": 1.99, "runpod_secure": 2.89 }
    },
    "provenance": {
      "vast": "Vast.ai spot = cheapest offer found via the madebyagents.com GPU-rental index (aggregates the Vast.ai public API; not queried from Vast.ai directly). Values pulled 2026-10-01 17:50 UTC and retained — the index feed returned HTTP 429 from ~18:50 UTC onward.",
      "runpod_community": "Official published Community Cloud rates (vetted third-party hosts), runpod.io/pricing — verified 2026-09-30, unchanged since 2026-09-13.",
      "runpod_secure": "Official published Secure Cloud rates (Tier 3/4 data centers), runpod.io/pricing — re-verified 2026-10-01.",
      "saladcloud": "Official 'from' rates on the Lowest priority tier, salad.com — re-verified 2026-10-01. Per-second billing while instances run; lower tiers can be preempted.",
      "tiers": "Vast.ai = spot tier. SaladCloud = Lowest priority tier. Platform fees, storage, and egress are excluded from all columns."
    }
  };

  // VRAM (GB) and manufacturer-TDP defaults (watts) by short model id.
  // Used for filters and editable defaults — never presented as measured.
  var SPECS = {
    rtx3090:  { vram: 24, watts: 350 },
    rtx4070:  { vram: 12, watts: 200 },
    rtx4080:  { vram: 16, watts: 320 },
    rtx4090:  { vram: 24, watts: 450 },
    rtx5070:  { vram: 12, watts: 250 },
    rtx5080:  { vram: 16, watts: 360 },
    rtx5090:  { vram: 32, watts: 575 },
    rtxa6000: { vram: 48, watts: 300 },
    a100:     { vram: 40, watts: 400 },
    h100:     { vram: 80, watts: 700 }
  };

  function idOf(apiName) {
    var n = String(apiName || "").toLowerCase();
    if (/a100/.test(n)) return "a100";
    if (/h100/.test(n)) return "h100";
    if (/a6000/.test(n)) return "rtxa6000";
    var m = /rtx\s?(\d{4})/.exec(n);
    return m ? "rtx" + m[1] : "rtx" + n.replace(/[^a-z0-9]/g, "").slice(0, 12);
  }

  function shortName(apiName) {
    var n = String(apiName || "");
    var m = /RTX\s?(\d{4})/i.exec(n);
    if (m) return "RTX " + m[1];
    if (/A100/i.test(n)) return "A100 40GB";
    if (/H100/i.test(n)) return "H100 80GB";
    if (/A6000/i.test(n)) return "RTX A6000";
    return n;
  }

  function normalize(apiGpus) {
    var out = [];
    Object.keys(apiGpus || {}).forEach(function (name) {
      var g = apiGpus[name] || {};
      var id = idOf(name);
      var spec = SPECS[id] || { vram: 0, watts: 0 };
      out.push({
        name: name,
        short: shortName(name),
        id: id,
        avg: Number(g.avg_price),
        count: Number(g.count),
        vram: spec.vram,
        watts: spec.watts
      });
    });
    return out.filter(function (g) { return isFinite(g.avg) && isFinite(g.count); });
  }

  function fetchJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function liveResult(d) {
    var apiPrice = Number(d && d.market_price);
    return {
      status: "live",
      label: "● Live via api.octa.computer",
      captured: null,
      gpus: normalize(d && d.marketplace && d.marketplace.gpus),
      octa: {
        price: isFinite(apiPrice) && apiPrice > 0 ? apiPrice : null,
        note: "live via api.octa.computer"
      },
      competitors: FALLBACK.competitors,
      provenance: FALLBACK.provenance
    };
  }

  function snapshotResult() {
    return {
      status: "snapshot",
      label: "● Snapshot — live fetch failed",
      captured: FALLBACK.snapshot_captured,
      gpus: normalize(FALLBACK.octaspace_gpus),
      octa: { price: null, note: "snapshot" },
      competitors: FALLBACK.competitors,
      provenance: FALLBACK.provenance
    };
  }

  // Resolve OCTA price: CoinGecko -> octapi market_price -> literal fallback.
  // Every step is labeled so pages can say where the number came from.
  function resolveOcta(res, cgPrice) {
    if (isFinite(cgPrice) && cgPrice > 0) {
      res.octa = { price: cgPrice, note: "live via CoinGecko" };
    } else if (res.octa.price) {
      // already set from the live octapi fetch (liveResult) — keep it
    } else {
      res.octa = { price: OCTA_LITERAL, note: "cached fallback literal — both live feeds failed" };
    }
    return res;
  }

  function load(cb) {
    var settled = false;
    function done(res) {
      if (settled) return;
      settled = true;
      cb(res);
    }

    var cgPrice = null;
    fetchJSON("https://api.coingecko.com/api/v3/simple/price?ids=octaspace&vs_currencies=usd")
      .then(function (d) { cgPrice = Number(d && d.octaspace && d.octaspace.usd); })
      .catch(function () { /* coingecko often 403s from builder egress — fine */ });

    fetchJSON(API)
      .then(function (d) { done(resolveOcta(liveResult(d), cgPrice)); })
      .catch(function () { done(resolveOcta(snapshotResult(), cgPrice)); });
  }

  window.OctaMarket = { load: load, SPECS: SPECS, FALLBACK: FALLBACK };
})();
