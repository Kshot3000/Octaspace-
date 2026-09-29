// Provider earnings calculator — earn.html
(function(){
  "use strict";

  var STAKE_OCTA = 100000;

  function num(id){ var v = parseFloat(document.getElementById(id).value); return isNaN(v) ? 0 : v; }

  function calc(){
    var priceHr   = num("c-price");       // USD per GPU-hour charged to renters
    var gpus      = Math.max(1, Math.floor(num("c-gpus")));
    var util      = num("c-util");         // % of time rented
    var idleDay   = num("c-idle");         // USD/day per GPU from idle mining fallback
    var powerW    = num("c-power");        // watts per GPU
    var elecRate  = num("c-elec");         // USD per kWh
    var octaPrice = window.OCTA_PRICE || 0.1198; // fallback if CoinGecko unreachable (re-synced 2026-09-29 ~20:50 UTC to api.octa.computer market_price; matches app.js)

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
    calc();
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
