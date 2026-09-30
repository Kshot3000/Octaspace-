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

  // Aggregate bytes -> "22.3 TB". The /network API reports node RAM and disk
  // as raw byte totals (power.mem, power.disk).
  function fmtTB(n){
    if(n === null || n === undefined || isNaN(n)) return "—";
    var tb = Number(n) / 1e12;
    return tb >= 100 ? Math.round(tb) + " TB" : tb.toFixed(1) + " TB";
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

  function fmtCompactInt(n){
    if(n === null || n === undefined || isNaN(n)) return "—";
    if(n >= 1e6) return (n/1e6).toFixed(1) + "M";
    if(n >= 1e3) return (n/1e3).toFixed(1) + "K";
    return String(Math.round(n));
  }

  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function parseWeekKey(k){
    // API keys look like "2026-8-10" (week-starting Monday)
    var p = String(k).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  function shortDate(d){ return MONTHS[d.getMonth()] + " " + d.getDate(); }

  function longDate(d){ return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear(); }

  function renderFramesChart(framesByWeek){
    var box = document.getElementById("frames-chart");
    if(!box) return;
    var weeks = [];
    (framesByWeek || []).forEach(function(entry){
      var k = Object.keys(entry || {})[0];
      if(!k) return;
      var d = parseWeekKey(k);
      weeks.push({ date: d, value: Number(entry[k]) || 0 });
    });
    weeks.sort(function(a, b){ return a.date - b.date; });
    if(!weeks.length){
      box.innerHTML = "";
      var p = document.createElement("p");
      p.style.color = "var(--muted)";
      p.textContent = "Weekly render data unavailable.";
      box.appendChild(p);
      return;
    }
    var max = Math.max.apply(null, weeks.map(function(w){ return w.value; }).concat([1]));
    var peak = weeks.reduce(function(a, b){ return b.value > a.value ? b : a; }, weeks[0]);
    box.innerHTML = "";
    box.setAttribute("role", "img");
    box.setAttribute("aria-label",
      "Bar chart of render frames per week, " + longDate(weeks[0].date) + " to " + longDate(weeks[weeks.length - 1].date) +
      ". Peak week of " + longDate(peak.date) + ": " + fmtNum(peak.value) + " frames. The latest week is still in progress.");
    weeks.forEach(function(w, i){
      var latest = i === weeks.length - 1;
      var col = document.createElement("div");
      col.className = "bar-col";

      var val = document.createElement("div");
      val.className = "bar-val";
      val.textContent = fmtCompactInt(w.value) + " frames";
      col.appendChild(val);

      var bar = document.createElement("div");
      bar.className = "bar" + (latest ? " latest" : "");
      bar.style.height = Math.max(4, Math.round(100 * w.value / max)) + "%";
      bar.title = "Week of " + longDate(w.date) + ": " + fmtNum(w.value) + " frames" + (latest ? " (week in progress)" : "");
      col.appendChild(bar);

      var dt = document.createElement("div");
      dt.className = "bar-date";
      dt.textContent = shortDate(w.date);
      col.appendChild(dt);

      if(latest){
        var tag = document.createElement("div");
        tag.className = "bar-tag";
        tag.textContent = "in progress";
        col.appendChild(tag);
      }
      box.appendChild(col);
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
    setText("nw-sessions-total", fmtNum(mk.total_sessions));
    setText("nw-height", fmtNum(bc.height));
    setText("nw-hash", fmtHash(bc.hashrate));
    setText("nw-frames24", fmtNum(rn.frames_24h));
    setText("nw-users", fmtNum(pl.users));

    // Fleet table
    renderFleet(mk.gpus);

    // Render farm weekly activity
    renderFramesChart(rn.frames_by_week);

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
    setText("cp-mem", fmtTB(pw.mem));
    setText("cp-disk", fmtTB(pw.disk));
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
    var chart = document.getElementById("frames-chart");
    if(chart){
      chart.innerHTML = "";
      var pc = document.createElement("p");
      pc.style.color = "var(--muted)";
      pc.textContent = "Live render data unavailable — the OctaSpace API didn't respond.";
      chart.appendChild(pc);
    }
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
