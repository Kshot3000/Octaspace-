# OctaSpace Hub

Community mission control for **OctaSpace** — helping the decentralized GPU cloud overtake Vast.ai and Salad.

**Live site:** https://kshot3000.github.io/Octaspace-/

## What's here

- `index.html` — mission, live OCTA stats (CoinGecko), live network pulse (nodes, utilization, sessions, chain height via api.octa.computer), why-OctaSpace pillars, comparison snapshot
- `network.html` — live OctaChain network dashboard: chain vitals (height, block time, hashrate, era, supply, staked), GPU fleet table, rental/render activity, weekly render-farm bar chart, VPN stats — all pulled fresh from `api.octa.computer/network` per visit with honest unavailable states
- `compare.html` — honest head-to-head: OctaSpace vs Vast.ai vs Salad, with sources, dates, and billing tiers; competitor snapshots refreshed from live pulls
- `earn.html` — provider playbook: requirements, 5-step setup, idle mining, earnings calculator fed by the live marketplace
- `build.html` — developer resources: SDKs with one-click install snippets, CLIs, node software, live API playground (query `api.octa.computer/network` in the browser, no key needed), and community-built tooling (octa-fee-converter)
- `rfc-base-fiat.html` — RFC-001: design options for official OCTA on Base + fiat on/off-ramps, with a scam-copycat token warning list (`data/octa-tokenlist.json`); research status re-verified regularly — no official OCTA token on Base as of 2026-10-04
- `onramp-demo.html` — on-ramp UX walkthrough demo, loudly labeled sandbox/simulation
- `find.html` — GPU finder: search live OctaSpace marketplace rates by model, VRAM, and price
- `plan.html` — job cost planner: GPU count × hours → total cost in USD and OCTA vs competitor snapshots
- `deals.html` — deals feed: where OctaSpace beats Vast.ai spot right now, ranked by savings (OctaSpace avgs from live marketplace or clearly labeled baked snapshot)
- `roi.html` — hardware ROI calculator: purchase price + power + utilization → monthly profit and break-even (illustrative math, network fees excluded)
- `pricing.html` — listing price optimizer: suggested ask-price band around the marketplace average per GPU
- `host.html` — host onboarding guide: step-by-step provider setup (no OCTA stake required to run a node)
- `console.html` — Host Console: monitor and control your own rigs (GPU temps, node service, power, rental prices, idle jobs) via the open-source [octa-host-agent](https://github.com/Kshot3000/octa-host-agent) running on each rig; installable PWA for Android/iOS; demo mode is simulated and labeled
- `js/market.js` (shared live/snapshot market-data layer with 8s abort timeouts) and `js/tools.js` (find/plan/deals/roi/pricing logic, dispatched by `<body data-page>`)
- `data/octa-tokenlist.json` — unofficial community scam-warning token list (copycat OCTA contracts on Base); clearly labeled unofficial, kept current
- `css/style.css`, `js/app.js` (live price + network pulse), `js/calculator.js` (earn calculator), `js/network.js` (dashboard), `js/playground.js` (API playground), `js/onramp-demo.js`, `js/fx-bg.js` (animated background)

## Mission

1. Honest comparisons that rank and bring renters/providers to OctaSpace
2. Provider onboarding that lowers the real friction (staking, setup, idle mining)
3. Upstream code fixes — auditing `github.com/octaspace` repos and opening PRs (11 open from Kshot3000 forks as of 2026-10-07, all mergeable, no CI failures or maintainer changes requested)

## Freshness

Price comparisons are maintained with scheduled live pulls (Vast.ai spot from the madebyagents.com GPU rental index, OctaSpace marketplace via api.octa.computer). Every figure carries its source and as-of date; the network dashboard and playground fetch live data per visit — nothing is cached or mocked.

## Support

- OCTA / ETH: `0x4b6f3BC697D9dAF3e8dE182aEc56eD208B9087f1`
- BTC: `3GnR7TWBXAB3pPztBWpNF4LMNEX5yX8vZK`
- X: [@kshot9000](https://x.com/kshot9000) · GitHub: [Kshot3000](https://github.com/Kshot3000)

Unofficial community project — not affiliated with the OctaSpace team, Vast.ai, or Salad.
