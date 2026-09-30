// OctaSpace Hub — network dashboard (network.html).
// Pulls api.octa.computer/network once per visit and renders every section.
// No caching on this site: reload the page to refresh. On API failure the
// placeholders stay and the status line says so honestly.
(function(){
  "use strict";

  var API = "https://api.octa.computer/network";

  function setText(id, txt){
    var el = document.getElementById(id);
    if(el) el.textContent = txt;
  }

  function fmtNum(n){
    if(n === null || n === undefined || isNaN(n)) return "—";
    return Math.round(n).toLocaleString("en-US");
  }

  function fmtCompact(n){
    if(n === null || n === undefined || isNaN(n)) return "—";
    if(n >= 1e12) return (n/1e12).toFixed(2) + "T";
    if(n >= 1e9)  return (n/1e9).toFixed(2) + "B";
    if(n >= 1e6)  return (n/1e6).toFixed(2) + "M";
    if(n >= 1e3)  return (n/1e3).toFixed(1) + "K";
    return String(n);
  }

  function fmtHash(h){
    if(h === null || h === undefined || isNaN(h)) return "—";
    if(h >= 1e15) return (h/1e15).toFixed(2) + " PH/s";
    if(h >= 1e12) return (h/1e12).toFixed(2) + " TH/s";
    if(h >= 1e9)  return (h/1e9).toFixed(2) + " GH/s";
    return fmtNum(h) + " H/s";
  }

  function fmtPrice(p){
    if(p === null || p === undefined || isNaN(p)) return "—";
    return "$" + Number(p).toFixed(4);
  }

  function renderFleet(gpus){
    var body = document.getElementById("fleet-body");
    if(!body) return;
    var rows = Object.keys(gpus || {}).map(function(name){
      return { name: name, avg: gpus[name].avg_price, count: gpus[name].count };
    }).sort(function(a,b){ return b.count - a.count; });
    if(!rows.length){
      body.innerHTML = "";
      var tr0 = document.createElement("tr");
      var td0 = document.createElement("td");
      td0.colSpan = 3;
      td0.style.color = "var(--muted)";
      td0.textContent = "No live fleet data returned.";
      tr0.appendChild(td0);
      body.appendChild(tr0);
      return;
    }
    body.innerHTML = "";
    rows.forEach(function(r){
      var tr = document.createElement("tr");
      var tdName = document.createElement("td");
      tdName.textContent = r.name;
      var tdAvg = document.createElement("td");
      tdAvg.className = "hl";
      tdAvg.textContent = "$" + Number(r.avg).toFixed(2) + "/hr";
      var tdCount = document.createElement("td");
      tdCount.textContent = fmtNum(r.count);
      tr.appendChild(tdName);
      tr.appendChild(tdAvg);
      tr.appendChild(tdCount);
      body.appendChild(tr);
    });
  }

  function render(d){
    var bc = d.blockchain || {};
    var mk = d.marketplace || {};
    var nd = d.nodes || {};
    var pl = d.platform || {};
    var pw = d.power || {};
    var rn = d.render || {};

    var rented = Number(mk.nodes_rented || 0);
    var idle = Number(mk.nodes_idle || 0);
    var listed = rented + idle;

    // Hero strip
    setText("nw-price", fmtPrice(d.market_price));
    setText("nw-nodes", fmtNum(nd.count));
    setText("nw-locs", fmtNum(nd.locations) + " locations");
    setText("nw-util", listed ? (100 * rented / listed).toFixed(1) + "%" : "—");
    setText("nw-sessions24", fmtNum(mk.sessions_24h));
    setText("nw-height", fmtNum(bc.height));
    setText("nw-hash", fmtHash(bc.hashrate));
    setText("nw-frames24", fmtNum(rn.frames_24h));
    setText("nw-users", fmtNum(pl.users));

    // Fleet table
    renderFleet(mk.gpus);

    // Blockchain vitals
    setText("nv-height", fmtNum(bc.height));
    setText("nv-blocktime", bc.blocktime ? Number(bc.blocktime).toFixed(1) + " s" : "—");
    setText("nv-difficulty", fmtCompact(bc.difficulty));
    setText("nv-era", bc.era || "—");
    setText("nv-hash", fmtHash(bc.hashrate));
    setText("nv-circ", fmtCompact(bc.circulating_supply));
    setText("nv-total", fmtCompact(bc.total_supply));
    setText("nv-staked", fmtCompact(d.staked));

    // Compute, rendering & VPN
    setText("cp-tflops", fmtNum(pw.tflops));
    setText("cp-gpus", fmtNum(pw.gpus));
    setText("cp-cpus", fmtNum(pw.cpus));
    setText("cp-frames24", fmtNum(rn.frames_24h));
    setText("cp-frames-total", fmtNum(rn.frames_total));
    setText("cp-users24", "+" + fmtNum(pl.users_24h));
    setText("cp-vpn", fmtNum(nd.vpn));
    setText("cp-vpn-locs", fmtNum(nd.vpn_locations));

    var when = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    setText("nw-updated", "Live from api.octa.computer/network · refreshed " + when);
  }

  function fail(){
    setText("nw-updated", "⚠ Live data unavailable — api.octa.computer didn't respond. Figures below show placeholders; try reloading.");
    var body = document.getElementById("fleet-body");
    if(body){
      body.innerHTML = "";
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = 3;
      td.style.color = "var(--muted)";
      td.textContent = "Live data unavailable — the OctaSpace API didn't respond.";
      tr.appendChild(td);
      body.appendChild(tr);
    }
  }

  if(!document.getElementById("fleet-body")) return; // not the network page
  fetch(API)
    .then(function(r){ if(!r.ok) throw new Error("octa " + r.status); return r.json(); })
    .then(render)
    .catch(fail);
})();
