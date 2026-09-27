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
  var FALLBACK = { price: 0.1269, mcap: 5070000, vol24h: 20800, change24h: 4.28, note: "cached" };

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

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", load);
  else load();
})();
