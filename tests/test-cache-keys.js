/* Cache-key regression guard for the OctaSpace Hub.
   Every local css/*.css and js/*.js referenced from HTML must carry a
   ?v=pxNNNN cache key, and all pages must agree on the key for each asset.
   Additionally, the key must be at least as fresh as the key assigned in
   the commit that last changed that asset's content — a stale key means
   returning visitors run cached JS/CSS that no longer matches the page
   (this exact pattern once left 6 hub pages on style.css?v=scrim1 while
   network.html moved to ?v=chart1 after a content change, and compare.html
   alone on app.js?v=px1205).
   Run: node tests/test-cache-keys.js (needs git; skipped gracefully without). */
"use strict";
var fs = require("fs"), path = require("path"), cp = require("child_process");
var ROOT = path.join(__dirname, "..");
var fails = 0;
function ok(name, cond, extra){
  if(!cond){ fails++; console.error("FAIL", name, extra === undefined ? "" : extra); }
  else console.log("ok  ", name);
}
function keyNum(k){ var m = /^px(\d+)$/.exec(k); return m ? parseInt(m[1], 10) : null; }
var hasGit = true;
try{ cp.execSync("git rev-parse --git-dir", {cwd: ROOT, stdio: "ignore"}); }
catch(e){ hasGit = false; }
if(!hasGit){ console.log("SKIP: no git repo available"); process.exit(0); }

function htmlFiles(dir, out){
  out = out || [];
  fs.readdirSync(dir).forEach(function(f){
    if(f === ".git" || f === "node_modules" || f === "tests") return;
    var p = path.join(dir, f), st = fs.statSync(p);
    if(st.isDirectory()) htmlFiles(p, out);
    else if(/\.html$/.test(f)) out.push(p);
  });
  return out;
}
/* last commit that changed the asset's content (not its key in HTML) */
function lastContentCommit(rel){
  try{
    var h = cp.execSync("git log --format=%H -1 -- " + JSON.stringify(rel),
                        {cwd: ROOT, encoding: "utf8"}).trim();
    return h || null;
  }catch(e){ return null; }
}
/* max pxNNNN/bare-numeric key for `asset` found in HTML at commit `sha` */
function baselineKey(asset, sha){
  var files = htmlFiles(ROOT).map(function(p){ return path.relative(ROOT, p); });
  var best = null;
  files.forEach(function(rel){
    var src;
    try{ src = cp.execSync("git show " + sha + ":" + JSON.stringify(rel),
                           {cwd: ROOT, encoding: "utf8", stdio: ["ignore","pipe","ignore"]}); }
    catch(e){ return; }
    var esc = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp(esc + "\\?v=(px\\d+|\\d+)(?![0-9A-Za-z])", "g"), m;
    while((m = re.exec(src))){
      var n = keyNum(m[1]); if(n === null) n = parseInt(m[1], 10);
      if(best === null || n > best) best = n;
    }
  });
  return best;
}

var refs = {}; /* asset -> {key, pages:{page:key}} */
htmlFiles(ROOT).forEach(function(html){
  var src = fs.readFileSync(html, "utf8");
  var re = /((?:css|js)\/[a-z0-9-]+\.(?:css|js))\?v=([A-Za-z0-9]+)/g, m;
  var seen = {};
  while((m = re.exec(src))){
    var asset = m[1], key = m[2];
    if(!fs.existsSync(path.join(ROOT, asset))) continue;
    refs[asset] = refs[asset] || {keys: {}};
    refs[asset].keys[path.relative(ROOT, html)] = key;
    if(seen[asset]) refs[asset].dup = true;
    seen[asset] = true;
  }
  /* unkeyed local scripts/styles are failures here (hub convention: always keyed) */
  var re2 = /(?:src|href)="((?:css|js)\/[a-z0-9-]+\.(?:css|js))"/g;
  while((m = re2.exec(src))){
    if(fs.existsSync(path.join(ROOT, m[1])) && !refs[m[1]]){
      refs[m[1]] = refs[m[1]] || {keys: {}};
      refs[m[1]].keys[path.relative(ROOT, html)] = null;
    }
  }
});

Object.keys(refs).sort().forEach(function(asset){
  var pages = refs[asset].keys, keys = {};
  Object.keys(pages).forEach(function(p){
    ok(asset + " referenced on " + p + " has a cache key", pages[p] !== null);
    ok(asset + " key on " + p + " uses pxNNNN scheme",
       pages[p] === null || keyNum(pages[p]) !== null, pages[p]);
    if(pages[p]) keys[pages[p]] = true;
  });
  var uniq = Object.keys(keys);
  ok(asset + " key uniform across all pages (" + uniq.join(", ") + ")",
     uniq.length === 1, JSON.stringify(pages));
  if(refs[asset].dup) ok(asset + " referenced at most once per page", false);
  if(uniq.length !== 1 || keyNum(uniq[0]) === null) return;
  var cur = keyNum(uniq[0]);
  var sha = lastContentCommit(asset);
  if(!sha) return;
  var base = baselineKey(asset, sha);
  if(base === null) return; /* no comparable px/bare-numeric baseline at change */
  ok(asset + " key " + uniq[0] + " >= baseline at last content change (" + base + ")",
     cur >= base);
});

console.log(fails ? "\n" + fails + " FAILURE(S)" : "\nALL CHECKS PASSED");
process.exit(fails ? 1 : 0);
