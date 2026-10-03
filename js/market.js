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
  var OCTA_LITERAL = 0.1118; // keep in sync with js/app.js FALLBACK.price

  // Baked fallback: captured from https://api.octa.computer/network at
  // 2026-10-03T04:06:56Z. Used ONLY when the live fetch fails — the page
  // always labels it as a snapshot. Inline (not fetched) so it works from
  // any origin, including file://. Mirrors data/market.json — if you update
  // one, update the other.
  var FALLBACK = {
    "snapshot_captured": "2026-10-03T04:06:56Z",
    "octaspace_gpus": {
      "NVIDIA A100-SXM4-40GB": { "avg_price": 0.48, "count": 1 },
      "NVIDIA GeForce RTX 3090": { "avg_price": 0.23, "count": 53 },
      "NVIDIA GeForce RTX 4070": { "avg_price": 0.23, "count": 7 },
      "NVIDIA GeForce RTX 4080": { "avg_price": 0.04, "count": 2 },
      "NVIDIA GeForce RTX 4090": { "avg_price": 0.46, "count": 32 },
      "NVIDIA GeForce RTX 5070": { "avg_price": 0.18, "count": 8 },
      "NVIDIA GeForce RTX 5080": { "avg_price": 0.4, "count": 15 },
      "NVIDIA GeForce RTX 5090": { "avg_price": 0.64, "count": 61 },
      "NVIDIA H100 80GB HBM3": { "avg_price": 0.12, "count": 8 },
      "NVIDIA RTX A6000": { "avg_price": 0.2, "count": 2 }
    },
    "competitors": {
      "rtx3090":  { "name": "RTX 3090",  "vram": 24, "vast": 0.11, "saladcloud": 0.09, "runpod_community": 0.22, "runpod_secure": 0.5 },
      "rtx4070":  { "name": "RTX 4070",  "vram": 12, "vast": 0.09 },
      "rtx4080":  { "name": "RTX 4080",  "vram": 16, "vast": 0.19 },
      "rtx4090":  { "name": "RTX 4090",  "vram": 24, "vast": 0.2, "saladcloud": 0.16, "runpod_community": 0.34, "runpod_secure": 0.74 },
      "rtx5070":  { "name": "RTX 5070",  "vram": 12, "vast": 0.13 },
      "rtx5080":  { "name": "RTX 5080",  "vram": 16, "vast": 0.17, "saladcloud": 0.15 },
      "rtx5090":  { "name": "RTX 5090",  "vram": 32, "vast": 0.27, "saladcloud": 0.25, "runpod_community": 0.69, "runpod_secure": 0.99 },
      "rtxa6000": { "name": "RTX A6000", "vram": 48, "vast": 0.2, "runpod_community": 0.33, "runpod_secure": 0.53 },
      "a100":     { "name": "A100 40GB", "vram": 40, "vast": 0.75, "runpod_community": 1.19, "runpod_secure": 1.59,
                    "note": "OctaSpace listing is the 40 GB SXM4 variant; RunPod Secure rate is the 80 GB variant" },
      "h100":     { "name": "H100 80GB", "vram": 80, "vast": 0.9, "runpod_community": 1.99, "runpod_secure": 2.89 }
    },
    "provenance": {
      "vast": "Vast.ai spot = cheapest offer found via the madebyagents.com GPU-rental index (aggregates the Vast.ai public API; not queried from Vast.ai directly). Feed back 2026-10-02 ~03:05 UTC after the HTTP 429 stretch (page header 'Prices refreshed: Oct 2, 2026, 2:19 AM UTC'; rows re-verified across two identical reads). 4 moved: 3090 $0.11->$0.13, 4070 $0.08->$0.09, 5090 $0.28->$0.25, H100 SXM $1.00->$0.89. 4090 $0.17, 5070 $0.11, 5080 $0.16 unchanged. 4080 retains 2026-10-01 17:50 UTC ($0.15, no spot row this pull — only On-Demand $0.22); A6000 retains 2026-10-01 17:50 UTC ($0.20, no Vast row); A100 retains 2026-09-27 ($0.75, no 40GB SXM4 spot row — this pull 80GB SXM $0.13). Pulled 2026-10-02 ~06:50 UTC (page header 'Prices refreshed: Oct 2, 2026, 6:22 AM UTC'; per-SKU rows re-verified across two identical reads). 3 moved this pull: 3090 $0.13->$0.11, 4080 $0.15->$0.19, 4090 $0.17->$0.22 (merged per-SKU Vast Spot 'Cheapest Offer' rows; featured-card headlines ignored per methodology). 4070 $0.09, 5080 $0.16, 5090 $0.25, H100 SXM $0.89 unchanged. 5070 retains the 2026-10-02 03:05 UTC pull ($0.11): no Vast.ai spot row this pull (only On-Demand $0.15). A6000 retains the 2026-10-01 17:50 UTC pull ($0.20): no Vast.ai row this pull. A100 retains the 2026-09-27 snapshot ($0.75): no matching 40GB SXM4 spot row. Pulled 2026-10-02 ~09:50 UTC (page header 'Prices refreshed: Oct 2, 2026, 9:23 AM UTC'; per-SKU rows re-verified across two identical reads). 5 moved this pull: 4070 $0.09->$0.07, 4080 $0.19->$0.18, 4090 $0.22->$0.21, 5070 $0.11->$0.10, 5090 $0.25->$0.29 (merged per-SKU Vast Spot 'Cheapest Offer' rows; featured-card headlines ignored per methodology). 3090 $0.11, 5080 $0.16, H100 SXM $0.89 unchanged. A6000 retains the 2026-10-01 17:50 UTC pull ($0.20): no Vast.ai row this pull. A100 retains the 2026-09-27 snapshot ($0.75): no matching 40GB SXM4 spot row (this pull 80GB SXM $0.35 / 80GB PCIe $0.18). Pulled 2026-10-02 ~11:50 UTC (page header 'Prices refreshed: Oct 2, 2026, 11:23 AM UTC'; per-SKU rows re-verified across two identical reads). 6 moved this pull: 3090 $0.11->$0.10, 4070 $0.07->$0.09, 4080 $0.18->$0.17, 4090 $0.21->$0.20, 5070 $0.10->$0.11, 5090 $0.29->$0.27 (merged per-SKU Vast Spot 'Cheapest Offer' rows; featured-card headlines ignored per methodology). 5080 $0.16, H100 SXM $0.89 unchanged. A6000 retains the 2026-10-01 17:50 UTC pull ($0.20): no Vast.ai row this pull (cheapest A6000 offer shown is RunPod Community). A100 retains the 2026-09-27 snapshot ($0.75): no matching 40GB SXM4 spot row (this pull 80GB SXM $0.40 / 80GB PCIe $0.19). Pulled 2026-10-03 ~00:52 UTC (page header 'Prices refreshed: Oct 3, 2026, 12:44 AM UTC'; per-SKU rows re-verified across two identical reads). Feed back after the 23:43 UTC pull showed 'Vast API returned 429'. 7 moved this pull: 3090 $0.10->$0.11, 4070 $0.09->$0.07, 4080 $0.17->$0.13, 4090 $0.20->$0.21, 5080 $0.16->$0.24, 5090 $0.27->$0.29, H100 SXM $0.89->$0.80 (merged per-SKU Vast Spot 'Cheapest Offer' rows; featured-card headlines ignored per methodology). 5070 $0.11 unchanged. A6000 retains the 2026-10-01 17:50 UTC pull ($0.20): no Vast.ai row this pull (cheapest A6000 offer shown is RunPod Community). A100 retains the 2026-09-27 snapshot ($0.75): no matching 40GB SXM4 spot row (this pull 80GB SXM $0.35 / 80GB PCIe $0.28). Pulled 2026-10-03 ~04:07 UTC (page header 'Prices refreshed: Oct 3, 2026, 3:46 AM UTC'; per-SKU rows re-verified across two identical reads). 4 moved this pull: 5070 $0.11->$0.10, 5080 $0.24->$0.18, 5090 $0.29->$0.27, H100 SXM $0.80->$0.89 (merged per-SKU Vast Spot 'Cheapest Offer' rows; featured-card headlines ignored per methodology). 3090 $0.11, 4090 $0.21 unchanged. 4070 retains the 2026-10-02 09:50 UTC pull ($0.07): no rows for that SKU this pull. 4080 retains the 2026-10-03 00:52 UTC pull ($0.13): no Vast.ai row this pull. A6000 retains the 2026-10-01 17:50 UTC pull ($0.20): no Vast.ai row this pull. A100 retains the 2026-09-27 snapshot ($0.75): no matching 40GB SXM4 spot row (this pull 80GB SXM $0.32 / 80GB PCIe $0.45). Pulled 2026-10-03 ~04:48 UTC (page header 'Prices refreshed: Oct 3, 2026, 4:48 AM UTC'; per-SKU rows re-verified across two identical reads). 3 moved this pull: 4080 $0.13->$0.19, 5080 $0.18->$0.16, 5090 $0.27->$0.25 (merged per-SKU Vast Spot 'Cheapest Offer' rows; featured-card headlines ignored per methodology). 3090 $0.11, 4090 $0.21, 5070 $0.10, H100 SXM $0.89 unchanged. 4070 retains the 2026-10-02 09:50 UTC pull ($0.07): no Vast.ai row for that SKU this pull. A6000 retains the 2026-10-01 17:50 UTC pull ($0.20): no Vast.ai row this pull (cheapest A6000 offer shown is RunPod Community). A100 retains the 2026-09-27 snapshot ($0.75): no matching 40GB SXM4 spot row (this pull 80GB SXM $0.40 / 80GB PCIe $0.40). Pulled 2026-10-03 ~05:48 UTC (page header 'Prices refreshed: Oct 3, 2026, 5:48 AM UTC'; per-SKU rows re-verified across two identical reads). 6 moved this pull: 4070 $0.07->$0.09, 4090 $0.21->$0.20, 5070 $0.10->$0.13, 5080 $0.16->$0.17, 5090 $0.25->$0.27, H100 SXM $0.89->$0.90 (merged per-SKU Vast Spot 'Cheapest Offer' rows; featured-card headlines ignored per methodology). 3090 $0.11 unchanged. 4080 retains the 2026-10-03 04:48 UTC pull ($0.19): no Vast.ai spot row this pull (only On-Demand $0.22). A6000 retains the 2026-10-01 17:50 UTC pull ($0.20): no Vast.ai row this pull (cheapest A6000 offer shown is RunPod Community). A100 retains the 2026-09-27 snapshot ($0.75): no matching 40GB SXM4 spot row (this pull 80GB SXM $0.60 / 80GB PCIe $0.45).",
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

  function fetchJSON(url, signal) {
    return fetch(url, { signal: signal }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  // fetch() has no built-in timeout. Without this wrapper, a hung API call
  // (neither resolving nor rejecting) would leave every tool page stuck on
  // "Loading market data…" forever — no error, no fallback. The 8s abort
  // turns a hang into a rejection so the loudly-labeled snapshot path runs
  // instead (same timeout as the GPU Price Index live fetch).
  var FETCH_TIMEOUT_MS = 8000;
  function withTimeout(url) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, FETCH_TIMEOUT_MS);
    return fetchJSON(url, ctrl.signal).then(function (d) {
      clearTimeout(t);
      return d;
    }, function (e) {
      clearTimeout(t);
      throw e;
    });
  }

  var CG_URL = "https://api.coingecko.com/api/v3/simple/price?ids=octaspace&vs_currencies=usd";

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

    // Both feeds are kicked off in parallel and bounded by FETCH_TIMEOUT_MS.
    // We wait for BOTH to settle before rendering so the documented priority
    // (CoinGecko -> octapi market_price -> cached literal) actually holds:
    // previously the octapi fetch's .then fired as soon as it resolved and
    // used a still-null CoinGecko price, making the priority order a race.
    var octapi = withTimeout(API).then(function (d) { return d; }, function () { return null; });
    var coingecko = withTimeout(CG_URL).then(
      function (d) { return Number(d && d.octaspace && d.octaspace.usd); },
      function () { return null; } // coingecko often 403s from builder egress — fine
    );

    Promise.all([octapi, coingecko]).then(function (pair) {
      var d = pair[0], cgPrice = pair[1];
      var res = d ? liveResult(d) : snapshotResult();
      done(resolveOcta(res, cgPrice));
    });
  }

  window.OctaMarket = { load: load, SPECS: SPECS, FALLBACK: FALLBACK };
})();
