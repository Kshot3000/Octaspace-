// OctaSpace Hub — shared behavior: live OCTA stats from CoinGecko, nav state, footer year.
(function(){
  "use strict";

  // Active nav link
  var page = (location.pathname.split("/").pop() || "index.html").replace(".html","");
  document.querySelectorAll(".nav-links a[data-page]").forEach(function(a){
    if(a.getAttribute("data-page") === page) a.classList.add("active");
  });

  // Footer year
  document.querySelectorAll("[data-year]").forEach(function(el){ el.textContent = new Date().getFullYear(); });

  // Live OCTA stats
  var FALLBACK = { price: 0.1149, mcap: 5160000, vol24h: 31300, change24h: 8.33, note: "cached" }; // refreshed 2026-09-28

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
      chg.textContent = (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
      chg.classList.toggle("neg", v < 0);
    }
    setText("octa-stake-usd", fmtUSD(d.price * 100000, 0));
    var stakeUsd = fmtUSD(d.price * 100000, 0);
    document.querySelectorAll(".stake-usd-live").forEach(function(el){ el.textContent = stakeUsd; });
    var ts = document.getElementById("octa-updated");
    if(ts) ts.textContent = d.note === "live"
      ? "Live via CoinGecko"
      : "Cached snapshot — live feed unavailable";
    // expose for calculator
    window.OCTA_PRICE = d.price;
    document.dispatchEvent(new CustomEvent("octa-price", {detail: d}));
  }
  function setText(id, txt){
    var el = document.getElementById(id);
    if(el) el.textContent = txt;
  }

  function load(){
    render(FALLBACK);
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=octaspace&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true")
      .then(function(r){ if(!r.ok) throw new Error("cg "+r.status); return r.json(); })
      .then(function(j){
        var o = j && j.octaspace;
        if(!o || !o.usd) throw new Error("no data");
        render({
          price: o.usd,
          mcap: o.usd_market_cap || null,
          vol24h: o.usd_24h_vol || null,
          change24h: (o.usd_24h_change == null ? 0 : o.usd_24h_change),
          note: "live"
        });
      })
      .catch(function(){ /* fallback already rendered */ });
  }

  // Live OctaSpace marketplace averages (compare.html). Falls back to the
  // baked snapshot text in the markup if the fetch fails.
  function loadMarketplace(){
    var price = document.getElementById("octa-4090-price");
    if(!price) return; // page doesn't show a marketplace average
    fetch("https://api.octa.computer/network")
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
    fetch("https://api.octa.computer/network")
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

  function init(){
    load();
    loadMarketplace();
    loadNetwork();
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
