import assert from "node:assert/strict";
import fs from "node:fs";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {analyze}=require("../performance-core.js");
const empty=analyze([]);
assert.equal(empty.closed,0);
assert.equal(empty.winRate,null);
assert.equal(empty.pnl,0);
const sample=analyze([
 {actif:"SOL",sens:"achat",pnl_usd:null,date:"2026-01-01"},
 {actif:"SOL",sens:"vente",pnl_usd:2,date:"2026-01-02"},
 {actif:"ETH",sens:"vente",pnl_usd:-3,date:"2026-01-03"},
 {actif:"ETH",sens:"vente",pnl_usd:-1,date:"2026-01-04"},
 {actif:"ETH",sens:"vente",pnl_usd:null,date:"2026-01-05"}
]);
assert.equal(sample.closed,3);
assert.equal(sample.wins,1);
assert.equal(sample.losses,2);
assert.equal(sample.pnl,-2);
assert.equal(sample.profitFactor,0.5);
assert.equal(sample.maxLossStreak,2);
const ledger=JSON.parse(fs.readFileSync("trades.json","utf8"));
assert.ok(Array.isArray(ledger.trades),"trades.json: tableau trades absent");
const result=analyze(ledger.trades);
assert.ok(Number.isFinite(result.pnl));
assert.equal(result.wins+result.losses+result.assets.reduce((n,a)=>n+a.zeros,0),result.closed);
assert.ok(result.assets.every(a=>Number.isFinite(a.pnl)));
console.log("Tests P&L historiques OK",JSON.stringify({
  closed:result.closed,wins:result.wins,losses:result.losses,
  pnl:Number(result.pnl.toFixed(4)),profitFactor:result.profitFactor,
  maxLossStreak:result.maxLossStreak
}));
if(process.env.GITHUB_STEP_SUMMARY){
const lines=[
"# Audit du journal de performances",
"",
"- Ventes avec P&L enregistré : "+result.closed,
"- Gagnantes : "+result.wins,
"- Perdantes : "+result.losses,
"- Résultat cumulé déclaré : "+result.pnl.toFixed(4)+" $",
"- Facteur de profit déclaré : "+(result.profitFactor==null?"n/d":result.profitFactor.toFixed(3)),
"- Série maximale de pertes enregistrées : "+result.maxLossStreak,
"",
"Ce journal n'est pas une preuve de solde on-chain ni de profit futur."
];
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join("\n")+"\n")
}
