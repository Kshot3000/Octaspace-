// OctaSpace Hub — sandbox on-ramp demo (all simulated, no real money).
(function(){
  "use strict";

  // Illustrative provider fee schedules — invented for the demo.
  var PROVIDERS = {
    transak:  { name: "Transak",           feePct: 0.99 },
    moonpay:  { name: "MoonPay",           feePct: 1.50 },
    coinbase: { name: "Coinbase Onramp",    feePct: 1.00 },
    banxa:    { name: "Banxa",             feePct: 1.29 }
  };
  var CARD_FEE = 0.50;   // illustrative flat card-processing estimate (USD)
  var NET_FEE  = 0.05;   // illustrative Base network fee estimate (USD)
  var DEX_FEE_PCT = 0.3; // illustrative simulated DEX fee (%)
  var MAX_USD = 10000;

  // Depth honesty: reported on-chain OCTA DEX liquidity is measured in tens of
  // USD/day — any simulated swap larger than this soft cap could NOT fill near
  // the reference price on-chain. Warn loudly instead of implying depth exists.
  var DEPTH_SOFT_CAP_USD = 100;

  var state = { usd: 0, usdc: 0, provider: "transak", octaPrice: null, priceNote: null };

  function $(id){ return document.getElementById(id); }
  function fmtUSD(n, digits){ var d = digits || 2; return "$" + n.toLocaleString("en-US",{minimumFractionDigits:d, maximumFractionDigits:d}); }
  function fmtNum(n, d){ return n.toLocaleString("en-US",{minimumFractionDigits:d, maximumFractionDigits:d}); }

  function showStep(n){
    ["step1","step2","step3"].forEach(function(id, i){
      $(id).classList.toggle("on", i === n - 1);
    });
    var target = $("step" + n);
    if(target && target.scrollIntoView) target.scrollIntoView({behavior:"smooth", block:"start"});
  }

  function refreshPriceLabel(){
    var el = $("octa-ref"), note = $("octa-ref-note");
    if(state.octaPrice){
      el.textContent = fmtUSD(state.octaPrice, 4);
      note.textContent = state.priceNote === "live" ? "(live via CoinGecko — simulated swap math only)"
        : state.priceNote === "live-octapi" ? "(live via api.octa.computer — simulated swap math only)"
        : "(cached snapshot — live feed unavailable; simulated swap math only)";
    }
  }

  // Live OCTA price via the hub's shared loader (js/app.js).
  function initPrice(){
    if(window.OCTA_PRICE){
      state.octaPrice = window.OCTA_PRICE;
      state.priceNote = window.OCTA_PRICE_NOTE || null; // already rendered by app.js
      refreshPriceLabel();
    }
    document.addEventListener("octa-price", function(e){
      if(e && e.detail && e.detail.price){
        state.octaPrice = e.detail.price;
        state.priceNote = e.detail.note || null;
        refreshPriceLabel();
      }
    });
  }

  function fakeHash(){
    var hex = "";
    var chars = "0123456789abcdef";
    for(var i = 0; i < 40; i++) hex += chars[Math.floor(Math.random() * 16)];
    return "0xSIMULATED-" + hex.slice(0, 8) + "…" + hex.slice(-6) + "-DEMO";
  }

  function step1(){
    var err = $("err1"); err.textContent = "";
    var usd = parseFloat($("fiat-amount").value);
    if(isNaN(usd) || usd <= 0){ err.textContent = "Enter an amount greater than $0 to run the simulation."; return; }
    if(usd > MAX_USD){ err.textContent = "Sandbox cap is $10,000 per simulated purchase."; return; }

    var key = $("ramp-provider").value;
    var p = PROVIDERS[key];
    var fee = usd * (p.feePct / 100);
    var usdc = usd - fee - CARD_FEE - NET_FEE;
    if(usdc <= 0){ err.textContent = "Amount too small — illustrative fees exceed the payment."; return; }

    state.usd = usd; state.usdc = usdc; state.provider = key;

    $("q1-provider").textContent = p.name;
    $("q1-pay").textContent = fmtUSD(usd);
    $("q1-feepct").textContent = p.feePct.toFixed(2);
    $("q1-fee").textContent = "−" + fmtUSD(fee);
    $("q1-card").textContent = "−" + fmtUSD(CARD_FEE);
    $("q1-usdc").textContent = fmtNum(usdc, 2) + " USDC";
    $("quote1").hidden = false;
    if($("quote1").scrollIntoView) $("quote1").scrollIntoView({behavior:"smooth", block:"nearest"});
  }

  function gotoStep2(){
    var err = $("err2"); err.textContent = "";
    if(state.usdc <= 0){ err.textContent = "Run Step 1 first to get a simulated USDC balance."; return; }
    showStep(2);
  }

  function step2(){
    var err = $("err2"); err.textContent = "";
    if(state.usdc <= 0){ err.textContent = "Run Step 1 first to get a simulated USDC balance."; return; }
    if(!state.octaPrice){ err.textContent = "Waiting on the live OCTA price feed — try again in a moment."; return; }

    var dexFeeUsdc = state.usdc * (DEX_FEE_PCT / 100);
    var swapUsdc = state.usdc - dexFeeUsdc;
    var octa = swapUsdc / state.octaPrice;
    state.octa = octa;

    $("q2-in").textContent = fmtNum(state.usdc, 2) + " USDC";
    $("q2-fee").textContent = "−" + fmtNum(dexFeeUsdc, 2) + " USDC";
    $("q2-price").textContent = fmtUSD(state.octaPrice, 4);
    $("q2-octa").textContent = fmtNum(octa, 2) + " OCTA";
    var dw = $("depth-warn");
    if(state.usdc > DEPTH_SOFT_CAP_USD){
      dw.innerHTML = "⚠️ <strong>Depth check (real-world):</strong> reported on-chain OCTA liquidity is " +
        "measured in the <strong>tens of USD per day</strong> — a " + fmtUSD(state.usdc, 2) +
        " swap could NOT fill near the reference price on-chain, and the 0.3% fee above is illustrative only. " +
        "A production ramp routes this through CEX fills or chunked conversions instead — see the RFC liquidity research.";
      dw.hidden = false;
    } else {
      dw.hidden = true;
    }
    $("quote2").hidden = false;
    if($("quote2").scrollIntoView) $("quote2").scrollIntoView({behavior:"smooth", block:"nearest"});
  }

  function gotoStep3(){
    step3();
    showStep(3);
  }

  function step3(){
    $("fake-hash").textContent = fakeHash();
    $("sum-pay").textContent = fmtUSD(state.usd);
    $("sum-provider").textContent = PROVIDERS[state.provider].name;
    $("sum-octa").textContent = fmtNum(state.octa || 0, 2) + " OCTA";
  }

  function reset(){
    ["quote1","quote2"].forEach(function(id){ $(id).hidden = true; });
    $("err1").textContent = ""; $("err2").textContent = "";
    $("fiat-amount").value = "100";
    state.usd = 0; state.usdc = 0; state.octa = 0;
    showStep(1);
  }

  document.addEventListener("DOMContentLoaded", function(){
    initPrice();
    $("btn-quote1").addEventListener("click", step1);
    $("btn-quote2").addEventListener("click", step2);
    $("btn-next2").addEventListener("click", gotoStep2);
    $("btn-next3").addEventListener("click", gotoStep3);
    $("btn-reset").addEventListener("click", reset);
    $("fiat-amount").addEventListener("keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); step1(); }
    });
  });
})();
