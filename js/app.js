// OctaSpace Hub — shared behavior: OCTA price (CoinGecko, then api.octa.computer
// market_price, then a baked fallback), live network pulse, nav state, footer year.
(function(){
  "use strict";

  // Active nav link
  var page = (location.pathname.split("/").pop() || "index.html").replace(".html","");
  document.querySelectorAll(".nav-links a[data-page]").forEach(function(a){
    if(a.getAttribute("data-page") === page){
      a.classList.add("active");
      a.setAttribute("aria-current", "page");
    }
  });

  // Footer year
  document.querySelectorAll("[data-year]").forEach(function(el){ el.textContent = new Date().getFullYear(); });

  // Live OCTA stats
  var FALLBACK = { price: 0.1131, mcap: 4939221, vol24h: 6944, change24h: -2.35, note: "cached" }; // price re-synced 2026-10-02 ~20:50 UTC to api.octa.computer market_price ($0.11308974, verified across three identical reads) — mcap recomputed from live circulating supply (43,675,234); vol/change refreshed from a fresh CoinGecko pull this run (usd $0.112136, vol $6,944.35, change -2.3497% at ~20:50 UTC)

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

  function fmtUSD(n, digits){
    if(n == null || isNaN(n)) return "—";
    return "$" + n.toLocaleString("en-US",{minimumFractionDigits:digits||2, maximumFractionDigits:digits||2});
  }
  function fmtBig(n){
    if(n == null || isNaN(n)) return "—";
    if(n >= 1e9) return "$" + (n/1e9).toFixed(2) + "B";
    if(n >= 1e6) return "$" + (n/1e6).toFixed(2) + "M";
    if(n >= 1e3) return "$" + (n/1e3).toFixed(1) + "K";
    return fmtUSD(n);
  }

  function render(d){
    setText("octa-price", fmtUSD(d.price, 4));
    setText("octa-mcap", fmtBig(d.mcap));
    setText("octa-vol", fmtBig(d.vol24h));
    var chg = document.getElementById("octa-change");
    if(chg){
      var v = d.change24h;
      chg.textContent = (v == null || isNaN(v)) ? "—" : (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
      chg.classList.toggle("neg", v != null && v < 0);
    }
    setText("octa-stake-usd", fmtUSD(d.price * 100000, 0));
    var stakeUsd = fmtUSD(d.price * 100000, 0);
    document.querySelectorAll(".stake-usd-live").forEach(function(el){ el.textContent = stakeUsd; });
    var ts = document.getElementById("octa-updated");
    if(ts) ts.textContent = d.note === "live" ? "Live via CoinGecko"
      : d.note === "live-octapi" ? "Live via api.octa.computer"
      : "Cached snapshot — live feed unavailable";
    // expose for calculator + on-ramp demo
    window.OCTA_PRICE = d.price;
    window.OCTA_PRICE_NOTE = d.note;
    document.dispatchEvent(new CustomEvent("octa-price", {detail: d}));
  }
  function setText(id, txt){
    var el = document.getElementById(id);
    if(el) el.textContent = txt;
  }

  function load(){
    render(FALLBACK);
    fetchT("https://api.coingecko.com/api/v3/simple/price?ids=octaspace&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true")
      .then(function(r){ if(!r.ok) throw new Error("cg "+r.status); return r.json(); })
      .then(function(j){
        var o = j && j.octaspace;
        if(!o || !o.usd) throw new Error("no data");
        render({
          price: o.usd,
          mcap: o.usd_market_cap || null,
          vol24h: o.usd_24h_vol || null,
          change24h: (o.usd_24h_change == null ? null : o.usd_24h_change),
          note: "live"
        });
      })
      .catch(function(){ loadOctaApiPrice(); });
  }

  // Second price source: api.octa.computer exposes a live market_price and is
  // already CORS-open for our network-pulse features. Keeps the price live for
  // visitors whose browser can't reach CoinGecko.
  function loadOctaApiPrice(){
    fetchT("https://api.octa.computer/network")
      .then(function(r){ if(!r.ok) throw new Error("octa "+r.status); return r.json(); })
      .then(function(j){
        var p = j && typeof j.market_price === "number" ? j.market_price : null;
        if(!p) throw new Error("no market_price");
        render({ price: p, mcap: null, vol24h: null, change24h: null, note: "live-octapi" });
      })
      .catch(function(){ /* FALLBACK already rendered */ });
  }

  // Live OctaSpace marketplace averages (compare.html). Falls back to the
  // baked snapshot text in the markup if the fetch fails.
  function loadMarketplace(){
    var price = document.getElementById("octa-4090-price");
    if(!price) return; // page doesn't show a marketplace average
    fetchT("https://api.octa.computer/network")
      .then(function(r){ if(!r.ok) throw new Error("octa "+r.status); return r.json(); })
      .then(function(j){
        var g = j && j.marketplace && j.marketplace.gpus;
        var o = g && g["NVIDIA GeForce RTX 4090"];
        if(!o || typeof o.avg_price !== "number") return;
        price.textContent = "$" + o.avg_price.toFixed(2);
        var count = document.getElementById("octa-4090-count");
        if(count) count.textContent = String(o.count);
        var when = document.getElementById("octa-4090-when");
        if(when) when.textContent = "live " + new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
      })
      .catch(function(){ /* baked snapshot text stays */ });
  }

  // Live network pulse (index.html "Network pulse" section). api.octa.computer is CORS-open.
  function loadNetwork(){
    if(!document.getElementById("net-nodes")) return; // page has no network-pulse section
    var note = document.getElementById("net-updated");
    fetchT("https://api.octa.computer/network")
      .then(function(r){ if(!r.ok) throw new Error("octa "+r.status); return r.json(); })
      .then(function(j){
        var mp = j.marketplace || {}, n = j.nodes || {}, bc = j.blockchain || {};
        var rented = mp.nodes_rented || 0, idle = mp.nodes_idle || 0, tot = rented + idle;
        setText("net-nodes", (n.count || tot).toLocaleString("en-US"));
        setText("net-locs", String(n.locations || 0));
        setText("net-rented", rented.toLocaleString("en-US"));
        setText("net-rented-sub", tot ? Math.round(rented / tot * 100) + "% of nodes" : "—");
        setText("net-sessions", (mp.sessions_24h || 0).toLocaleString("en-US"));
        setText("net-height", (bc.height || 0).toLocaleString("en-US"));
        if(note) note.textContent = "live via api.octa.computer";
      })
      .catch(function(){ if(note) note.textContent = "live feed unavailable"; });
  }

  // Live total OCTA staked network-wide (earn.html staking card).
  function loadStaked(){
    var el = document.getElementById("net-staked");
    if(!el) return; // page has no staking stat
    var note = document.getElementById("net-staked-note");
    fetchT("https://api.octa.computer/network")
      .then(function(r){ if(!r.ok) throw new Error("octa "+r.status); return r.json(); })
      .then(function(j){
        var staked = (j && typeof j.staked === "number") ? j.staked : null;
        if(staked == null) throw new Error("no staked figure");
        el.textContent = staked.toLocaleString("en-US",{maximumFractionDigits:0});
        if(note) note.textContent = "live via api.octa.computer";
      })
      .catch(function(){ if(note) note.textContent = "live figure unavailable"; });
  }

  // Copy buttons on install snippets (build.html SDK cards).
  function fallbackCopy(text){
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch(e){}
    document.body.removeChild(ta);
  }
  function bindCopyButtons(){
    document.querySelectorAll(".copy-btn[data-copy]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var text = btn.getAttribute("data-copy");
        function done(){
          btn.textContent = "Copied ✓";
          btn.classList.add("copied");
          setTimeout(function(){ btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1600);
        }
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(text).then(done, function(){ fallbackCopy(text); done(); });
        } else { fallbackCopy(text); done(); }
      });
    });
  }

  function init(){
    load();
    loadMarketplace();
    loadNetwork();
    loadStaked();
    bindCopyButtons();
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
