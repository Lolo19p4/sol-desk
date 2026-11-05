// Habillage "Grok Bot Terminal" : AFFICHAGE SEULEMENT. Ne trade pas, n'écrit rien dans localStorage.
(function(){var $=function(i){return document.getElementById(i)};
function ema(v,n){var k=2/(n+1),e=v[0];return v.map(function(x){return e=x*k+e*(1-k)})}
function rsi(v,n){n=n||14;var g=0,l=0;for(var i=v.length-n;i<v.length;i++){var d=v[i]-v[i-1];d>0?g+=d:l-=d}return l?100-100/(1+g/l):100}
var NM={SOL:'SOL',BTC:'wBTC',ETH:'wETH',BONK:'BONK',WIF:'WIF',RAY:'RAY',LTC:'cbLTC'};
function tick(){try{var st=(typeof S!=='undefined'&&S)?S:null;if(!st)return;var s=st.stats||{},stops=(st.hist||[]).filter(function(h){return /stop/.test(h.why||'')}).length,ln=(st.log||[]).length;
 [s.seen,s.killed,s.scored,s.trades,stops,ln].forEach(function(v,i){$('f'+i).textContent=v||0});
 $('l0').textContent='vus '+(s.seen||0);$('l1').textContent='éliminés '+(s.killed||0);$('l2').textContent='notés '+(s.scored||0);
 $('l3').textContent='trades '+(s.trades||0);$('l4').textContent='gagnés '+(s.wins||0)+' / perdus '+(s.losses||0);$('l5').textContent='lignes '+ln;
 var R=window.REAL||{},go=$('go').textContent.indexOf('Pause')>=0;$('runst').textContent=go?'● en marche':'● en pause';$('runst').style.color=go?'#4ade80':'#facc15';
 var np=Object.keys(st.pos||{}).length,pend=Object.keys(R.pend||{}).length;
 $('expos').innerHTML=R.on?('<b class=ok>RÉEL</b> · '+(pend?'⏳ en attente de ta signature Phantom':(R.busy?'échange en cours…':'prêt'))+(R.tot!=null?' · portefeuille $'+R.tot.toFixed(2):'')):('<b>SIM</b> · '+(np?np+' position(s) ouverte(s)':'aucune position — en attente d’une hausse'));
 $('clk').textContent=new Date().toLocaleTimeString('fr-FR')}catch(e){}}
setInterval(tick,1000);tick();
function scores(){Promise.all(['SOL','BTC','ETH','BONK','WIF','RAY','LTC'].map(function(k){return fetch('https://api.exchange.coinbase.com/products/'+k+'-USD/candles?granularity=60').then(function(r){return r.json()}).then(function(c){c=c.reverse();var cl=c.map(function(x){return x[4]}),a=ema(cl,9).at(-1),b=ema(cl,21).at(-1),r=rsi(cl),f=(a/b-1)*100;
 var sc=Math.max(0,Math.min(100,Math.round(50+f*400)));return{k:k,up:a>b,rok:r>40&&r<80,r:r,sc:sc}}).catch(function(){return null})})).then(function(L){L=L.filter(Boolean);if(!L.length)return;
 $('rules').innerHTML=L.map(function(x){return '<div class="rule"><span>'+NM[x.k]+' · EMA9 &gt; EMA21</span><span class='+(x.up?'ok':'ko')+'>'+(x.up?'✔':'✘')+'</span></div><div class="rule"><span>'+NM[x.k]+' · RSI '+x.r.toFixed(0)+' (40-80)</span><span class='+(x.rok?'ok':'ko')+'>'+(x.rok?'✔':'✘')+'</span></div>'}).join('');
 var best=L.slice().sort(function(a,b){return b.sc-a.sc})[0];$('gv').textContent=best.sc;$('gauge').style.background='conic-gradient(#22d3ee '+best.sc+'%,#1e2650 0)';
 $('gbars').innerHTML=L.map(function(x){return NM[x.k]+' '+x.sc+'<div class="bar"><i style="width:'+x.sc+'%"></i></div>'}).join('')+'<span class=sk>Affichage indicatif. Les bots décident avec EMA9/21 et RSI 40-80.</span>'})}
scores();setInterval(scores,30000);
})();
// Ajout : SIZER, EQUITY, dernier trade, résultat, journal avec « raison : » (lecture seule)
(function(){var $=function(i){return document.getElementById(i)},CAP=60,esc=function(t){return String(t).replace(/</g,'&lt;')};
function raison(l){var m=l.match(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)/);return m?m[1]:(/rotation|garde|cible/.test(l)?'tendance 1 min (EMA9/21, RSI)':'')}
function t2(){try{if(typeof S==='undefined'||!S)return;var s=S.stats||{},h=S.hist||[],R=window.REAL||{};
 $('hT').textContent=s.trades||0;$('hW').textContent=s.wins||0;$('hL').textContent=s.losses||0;
 var eqv=S.bal+Object.values(S.pos||{}).reduce(function(a,p){return a+p.amt*(p.pts.at(-1).value/p.entry)},0);
 $('sz').textContent=R.on?'RÉEL : 100 % du solde (0,03 SOL gardé)':'SIM : 30 % de $'+S.bal.toFixed(2)+' = $'+(S.bal*0.3).toFixed(2);
 $('eq').textContent='$'+eqv.toFixed(2)+' · '+h.length+' clôtures';
 $('flow2').innerHTML=[['c2','🔻','CONTRÔLE',(s.scored||0)+' notés'],['c3','◆','TAILLE',R.on?'100 %':'30 %'],['c4','⚡','ÉCHANGE',(s.trades||0)+' trades'],['c6','☰','JOURNAL',(S.log||[]).length+' lignes']].map(function(x){return '<div class="'+x[0]+'"><div class="ic">'+x[1]+'</div>'+x[2]+'<br><b>'+x[3]+'</b></div>'}).join('');
 if(h[0]){var l=h[0],tl=(S.log||[]).find(function(x){return x.indexOf(l.sym)>=0&&/ACHAT/.test(x)})||'',en=tl.match(/(\d+(?:\.\d+)?)\$ @ ([\d.e-]+)/);
  $('lt').innerHTML='<b style="font-size:18px">'+esc(l.sym)+'</b> <b class='+(l.pnl>=0?'ok':'ko')+'>'+(l.pnl>=0?'+':'')+l.pnl.toFixed(2)+' $</b><br>entrée : '+(en?en[2]:'–')+'<br>sortie : '+(en?(+en[2]*(1+l.pnl/+en[1])).toPrecision(6):'–')+'<br>glissement : '+(R.on?'max 1 %':'0 (simulation)')+'<br>taille : '+(en?'$'+en[1]:'–')+'<br><span style="color:#facc15">raison :</span> '+esc(l.why)}
 var pct=Math.max(0,Math.min(100,eqv/Math.max(CAP,eqv)*100));
 $('res').innerHTML='DÉPART <b>$'+CAP.toFixed(2)+'</b><div class="bar"><i style="width:'+(CAP/Math.max(CAP,eqv)*100)+'%;background:#7b84b0"></i></div>MAINTENANT <b class='+(eqv>=CAP?'ok':'ko')+'>$'+eqv.toFixed(2)+'</b><div class="bar"><i style="width:'+pct+'%"></i></div><span class=sk>'+(s.wins||0)+' G / '+(s.losses||0)+' P · '+(R.on?'historique test':'simulation')+'</span>'+(R.on&&R.tot!=null?'<br>Portefeuille réel : <b>$'+R.tot.toFixed(2)+'</b>':'');
 var c=$('eqc'),x=c.getContext('2d'),w=c.width=c.clientWidth||300,H=90,pts=[CAP],v=CAP;h.slice().reverse().forEach(function(e){v+=e.pnl;pts.push(v)});
 x.clearRect(0,0,w,H);var mn=Math.min.apply(0,pts),mx=Math.max.apply(0,pts);if(mx===mn){mx+=1;mn-=1}x.strokeStyle='#22d3ee';x.lineWidth=2;x.shadowColor='#22d3ee';x.shadowBlur=6;x.beginPath();pts.forEach(function(p,i){var px=pts.length>1?i/(pts.length-1)*(w-8)+4:w/2,py=H-6-(p-mn)/(mx-mn)*(H-12);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();
 var _lg=$('log2');if(_lg)_lg.innerHTML=(S.log||[]).slice(0,80).map(function(l){var t=l.slice(0,8),m=l.slice(10),tg=/ACHAT|devis|envoy/.test(m)?'ENTRÉE':/VENTE/.test(m)?'SORTIE':/Analyst|Filter|contrôle|rotation/.test(m)?'DÉCISION':'INFO',r=tg==='INFO'?'':raison(m);
  return '<div class="lg"><span class=sk>'+t+'</span><span class="tg">'+tg+'</span><span>'+esc(m)+(r?'<br><span class="rs">raison :</span> '+esc(r):'')+'</span></div>'}).join('')}catch(e){}}
setInterval(t2,2000);t2()})();
