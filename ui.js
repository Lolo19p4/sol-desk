// Habillage "Grok Bot Terminal" : AFFICHAGE SEULEMENT. Ne trade pas, n'écrit rien dans localStorage.
(function(){var $=function(i){return document.getElementById(i)};
function ema(v,n){var k=2/(n+1),e=v[0];return v.map(function(x){return e=x*k+e*(1-k)})}
function rsi(v,n){n=n||14;var g=0,l=0;for(var i=v.length-n;i<v.length;i++){var d=v[i]-v[i-1];d>0?g+=d:l-=d}return l?100-100/(1+g/l):100}
var NM={SOL:'SOL',BTC:'wBTC',ETH:'wETH'};
function tick(){try{var st=(typeof S!=='undefined'&&S)?S:null;if(!st)return;var s=st.stats||{},stops=(st.hist||[]).filter(function(h){return /stop/.test(h.why||'')}).length,ln=(st.log||[]).length;
 [s.seen,s.killed,s.scored,s.trades,stops,ln].forEach(function(v,i){$('f'+i).textContent=v||0});
 $('l0').textContent='vus '+(s.seen||0);$('l1').textContent='éliminés '+(s.killed||0);$('l2').textContent='notés '+(s.scored||0);
 $('l3').textContent='trades '+(s.trades||0);$('l4').textContent='gagnés '+(s.wins||0)+' / perdus '+(s.losses||0);$('l5').textContent='lignes '+ln;
 var R=window.REAL||{},go=$('go').textContent.indexOf('Pause')>=0;$('runst').textContent=go?'● en marche':'● en pause';$('runst').style.color=go?'#4ade80':'#facc15';
 var np=Object.keys(st.pos||{}).length,pend=Object.keys(R.pend||{}).length;
 $('expos').innerHTML=R.on?('<b class=ok>RÉEL</b> · '+(pend?'⏳ en attente de ta signature Phantom':(R.busy?'échange en cours…':'prêt'))+(R.tot!=null?' · portefeuille $'+R.tot.toFixed(2):'')):('<b>SIM</b> · '+(np?np+' position(s) ouverte(s)':'aucune position — en attente d’une hausse'));
 $('clk').textContent=new Date().toLocaleTimeString('fr-FR')}catch(e){}}
setInterval(tick,1000);tick();
function scores(){Promise.all(['SOL','BTC','ETH'].map(function(k){return fetch('https://api.exchange.coinbase.com/products/'+k+'-USD/candles?granularity=60').then(function(r){return r.json()}).then(function(c){c=c.reverse();var cl=c.map(function(x){return x[4]}),a=ema(cl,9).at(-1),b=ema(cl,21).at(-1),r=rsi(cl),f=(a/b-1)*100;
 var sc=Math.max(0,Math.min(100,Math.round(50+f*400)));return{k:k,up:a>b,rok:r>40&&r<80,r:r,sc:sc}}).catch(function(){return null})})).then(function(L){L=L.filter(Boolean);if(!L.length)return;
 $('rules').innerHTML=L.map(function(x){return '<div class="rule"><span>'+NM[x.k]+' · EMA9 &gt; EMA21</span><span class='+(x.up?'ok':'ko')+'>'+(x.up?'✔':'✘')+'</span></div><div class="rule"><span>'+NM[x.k]+' · RSI '+x.r.toFixed(0)+' (40-80)</span><span class='+(x.rok?'ok':'ko')+'>'+(x.rok?'✔':'✘')+'</span></div>'}).join('');
 var best=L.slice().sort(function(a,b){return b.sc-a.sc})[0];$('gv').textContent=best.sc;$('gauge').style.background='conic-gradient(#22d3ee '+best.sc+'%,#1e2650 0)';
 $('gbars').innerHTML=L.map(function(x){return NM[x.k]+' '+x.sc+'<div class="bar"><i style="width:'+x.sc+'%"></i></div>'}).join('')+'<span class=sk>Affichage indicatif. Les bots décident avec EMA9/21 et RSI 40-80.</span>'})}
scores();setInterval(scores,30000);
})();
