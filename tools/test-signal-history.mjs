import assert from "node:assert/strict";
import {mergeHistory} from "./record_signal_history.mjs";
const m={checked_at:"2026-11-21T00:03:00Z",status:"ok",assets:{
 SOL:{status:"ok",code:"CASSURE_CONFIRMED_1H",price:75.15},
 BTC:{status:"ok",code:"REGIME_4H_INSUFFISANT",price:60000},
 ETH:{status:"ok",code:"EN_ATTENTE",price:2000}
}};
const x=mergeHistory({checks:[]},m);
assert.equal(x.checks.length,1);
assert.deepEqual(x.checks[0].alerts,["SOL: CASSURE_CONFIRMED_1H"]);
assert.equal(x.trading_executed,false);
const y=mergeHistory(x,m);assert.equal(y.checks.length,1,"No duplicate checks");
const z=mergeHistory(y,{...m,checked_at:"2026-11-21T00:08:00Z",status:"partial",assets:{SOL:{status:"error"},BTC:{status:"ok",code:"EN_ATTENTE",price:60002}}});
assert.equal(z.checks.length,2);
assert.deepEqual(z.checks[0].alerts,[],"No alerts when the feed fails");
assert.equal(z.checks[0].assets.SOL.price,null);
assert.equal(z.checks[0].assets.ETH.price,null);
const many=mergeHistory({checks:Array.from({length:90},(_,i)=>({
 checked_at:new Date(Date.parse("2026-11-20T00:00:00Z")+i*60000).toISOString(),status:"ok",assets:{},alerts:[]
}))},m);
assert.equal(many.checks.length,72);
assert.throws(()=>mergeHistory({}, {checked_at:"invalid"}));
console.log("Historique du scanner : anti-doublon, fraîcheur, alertes, absence de trades OK");
