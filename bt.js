// v21 : backtest, rapport, marqueurs, journal des décisions (IndexedDB). LECTURE SEULE : ne trade pas, ne touche pas localStorage.
(function(){var $=function(i){return document.getElementById(i)},CAP=60,esc=function(t){return String(t).replace(/[<&]/g,function(c){return c=='<'?'&lt;':'&amp;'})};
function ema(v,n){var k=2/(n+1),e=v[0];return v.map(function(x){return e=x*k+e*(1-k)})}
function rsiA(v,n){n=n||14;var o=[];for(var j=0;j<v.length;j++){if(j<n){o.push(50);continue}var g=0,l=0;for(var i=j-n+1;i<=j;i++){var d=v[i]-v[i-1];d>0?g+=d:l-=d}o.push(l?100-100/(1+g/l):100)}return o}
function stats(eq){var pk=eq[0],dd=0,per=0,cur=0,rets=[];for(var i=0;i<eq.length;i++){if(eq[i]>=pk){pk=eq[i];if(cur)per++;cur=0}else{cur++;dd=Math.max(dd,1-eq[i]/pk)}if(i)rets.push(eq[i]/eq[i-1]-1)}if(cur)per++;
 var m=rets.reduce(function(a,b){return a+b},0)/(rets.length||1),sd=Math.sqrt(rets.reduce(function(a,b){return a+(b-m)*(b-m)},0)/(rets.length||1));return{ret:eq.at(-1)/eq[0]-1,dd:dd,per:per,vol:sd}}
function draw(cv,eq,col){var x=cv.getContext('2d'),w=cv.width=cv.clientWidth||300,H=cv.height;x.clearRect(0,0,w,H);if(eq.length<2)return;var mn=Math.min.apply(0,eq),mx=Math.max.apply(0,eq);if(mx==mn){mx+=1;mn-=1}
 x.strokeStyle=col||'#22d3ee';x.lineWidth=2;x.beginPath();eq.forEach(function(p,i){var px=i/(eq.length-1)*(w-8)+4,py=H-6-(p-mn)/(mx-mn)*(H-12);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()}
var pc=function(v){return (v>=0?'+':'')+(v*100).toFixed(2)+' %'};
async function hist(s,gr,pages){var out=[],end=Math.floor(Date.now()/1e3);for(var p=0;p<pages;p++){var st=end-300*gr;try{var r=await fetch('https://api.exchange.coinbase.com/products/'+s+'-USD/candles?granularity='+gr+'&start='+new Date(st*1e3).toISOString()+'&end='+new Date(end*1e3).toISOString());var c=await r.json();if(Array.isArray(c))out=out.concat(c)}catch(e){}end=st;await new Promise(function(z){setTimeout(z,350)})}
 var m={};out.forEach(function(c){m[c[0]]=c[4]});return m}
async function backtest(){var fee=(+$('btfee').value||0.3)/100+(+$('btslip').value||0.2)/100,pages=+$('btpg').value||4;$('btout').innerHTML='Téléchargement des bougies Coinbase…';
 var A=['SOL','BTC','ETH'],D={};for(var a of A)D[a]=await hist(a,60,pages);
 var ts=Object.keys(D.SOL).map(Number).filter(function(t){return D.BTC[t]&&D.ETH[t]}).sort(function(a,b){return a-b});if(ts.length<60){$('btout').innerHTML='<span class=ko>Pas assez de données.</span>';return}
 var cl={},e9={},e21={},rs={};A.forEach(function(a){cl[a]=ts.map(function(t){return D[a][t]});e9[a]=ema(cl[a],9);e21[a]=ema(cl[a],21);rs[a]=rsiA(cl[a])});
 // RÉEL : rotation 100 % vers l'actif le plus fort, sinon USDC (contrôle chaque minute ; le vrai bot contrôle toutes les 15 s)
 var hold='USDC',v=CAP,eq=[],tr=0,wins=0,entryV=v;for(var i=30;i<ts.length;i++){if(hold!='USDC')v*=cl[hold][i]/cl[hold][i-1];
  var best=null,bf=-1e9;A.forEach(function(a){var b=e9[a][i]>e21[a][i]&&rs[a][i]>40&&rs[a][i]<80,f=(e9[a][i]/e21[a][i]-1);if(b&&f>bf){bf=f;best=a}});var tgt=best||'USDC';
  if(tgt!=hold){v*=1-fee;if(hold!='USDC'){tr++;if(v>entryV)wins++}entryV=v;hold=tgt}eq.push(v)}
 var r1=stats(eq);
 // SIM : bougies 5 min reconstruites, EMA20/50, entrée RSI 45-70, 30 % du cash, sortie RSI>75 / baisse / stop -6 % / suiveur
 var cash=CAP,pos={},eq2=[],tr2=0,w2=0,c5={};A.forEach(function(a){c5[a]=cl[a].filter(function(_,k){return k%5==4})});var n5=c5.SOL.length;
 var E20={},E50={},R5={};A.forEach(function(a){E20[a]=ema(c5[a],20);E50[a]=ema(c5[a],50);R5[a]=rsiA(c5[a])});
 for(var k=50;k<n5;k++){A.forEach(function(a){var px=c5[a][k],P=pos[a];if(P){P.pk=Math.max(P.pk,px);var ch=px/P.e-1;if(R5[a][k]>75||E20[a][k]<E50[a][k]||ch<=-0.06||(P.pk/P.e-1>=0.12&&px<=P.pk*0.85)){var val=P.amt*(1+ch)*(1-fee);cash+=val;tr2++;if(val>P.amt)w2++;delete pos[a]}}
  else if(E20[a][k]>E50[a][k]&&R5[a][k]>45&&R5[a][k]<70){var amt=cash*0.3;if(amt>=0.5){cash-=amt;pos[a]={e:px,pk:px,amt:amt*(1-fee)}}}});
  eq2.push(cash+Object.keys(pos).reduce(function(s,a){return s+pos[a].amt*c5[a][k]/pos[a].e},0))}
 var r2=stats(eq2),h=((ts.at(-1)-ts[0])/3600).toFixed(1);
 var row=function(n,r,t,w,col){return '<tr><td style="color:'+col+'">'+n+'</td><td class='+(r.ret>=0?'ok':'ko')+'>'+pc(r.ret)+'</td><td>'+t+'</td><td>'+(t?Math.round(w/t*100)+' %':'–')+'</td><td class=ko>-'+(r.dd*100).toFixed(2)+' %</td></tr>'};
 $('btout').innerHTML='<div class=sk>'+h+' h de bougies 1 min · frais '+(fee*100).toFixed(2)+' % par échange · départ 60 $</div><table><tr><th>Stratégie</th><th>Résultat</th><th>Trades</th><th>Gagnants</th><th>Baisse max</th></tr>'+row('RÉEL rotation',r1,tr,wins,'#22d3ee')+row('SIM 30 %',r2,tr2,w2,'#f472b6')+'</table>';
 draw($('bteq'),eq,'#22d3ee');var x=$('bteq2');draw(x,eq2,'#f472b6')}
// RAPPORT depuis l'historique réel enregistré (S.hist, simulation)
function report(){if(typeof S=='undefined'||!S)return;var h=(S.hist||[]).slice().reverse(),eq=[CAP],v=CAP;h.forEach(function(e){v+=e.pnl;eq.push(v)});var r=stats(eq),w=h.filter(function(e){return e.pnl>=0}).length;
 var b=h.slice().sort(function(a,c){return c.pnl-a.pnl});$('rep').innerHTML=h.length?'<table><tr><td>Rendement total</td><td class='+(r.ret>=0?'ok':'ko')+'>'+pc(r.ret)+'</td></tr><tr><td>Volatilité (par trade)</td><td>'+(r.vol*100).toFixed(2)+' %</td></tr><tr><td>Baisse max</td><td class=ko>-'+(r.dd*100).toFixed(2)+' %</td></tr><tr><td>Périodes de baisse</td><td>'+r.per+'</td></tr><tr><td>Meilleur trade</td><td class=ok>'+esc(b[0].sym)+' '+b[0].pnl.toFixed(2)+' $</td></tr><tr><td>Pire trade</td><td class=ko>'+esc(b.at(-1).sym)+' '+b.at(-1).pnl.toFixed(2)+' $</td></tr><tr><td>Gagnés / perdus</td><td>'+w+' / '+(h.length-w)+'</td></tr></table>':'<span class=sk>Aucun trade clôturé enregistré pour l’instant.</span>';draw($('repc'),eq)}
// MARQUEURS sur le graphique SOL principal (heures du journal du jour)
function marks(){try{if(typeof line=='undefined'||!line.setMarkers||typeof S=='undefined')return;var o=new Date().getTimezoneOffset()*60,d0=new Date();d0.setHours(0,0,0,0);var M=[];
 (S.log||[]).forEach(function(l){var m=l.match(/^(\d\d):(\d\d):(\d\d)/);if(!m)return;var buy=/ACHAT|transaction envoyée/.test(l),sell=/VENTE/.test(l);if(!buy&&!sell)return;if(!/SOL/.test(l)&&!S.pos[$('sel').value])return;
  var t=Math.floor(d0/1e3)+m[1]*3600+m[2]*60+ +m[3];t=t-t%60-o;M.push({time:t,position:buy?'belowBar':'aboveBar',color:buy?'#4ade80':'#f87171',shape:buy?'arrowUp':'arrowDown',text:buy?'achat':'vente'})});
 M.sort(function(a,b){return a.time-b.time});line.setMarkers(M)}catch(e){}}
// JOURNAL DES DÉCISIONS : IndexedDB "soldesk_decisions" (nouvelle base séparée)
var db=null,rq=indexedDB.open('soldesk_decisions',1);rq.onupgradeneeded=function(){rq.result.createObjectStore('d',{keyPath:'id',autoIncrement:true})};rq.onsuccess=function(){db=rq.result;show()};
function put(o){if(!db)return;try{db.transaction('d','readwrite').objectStore('d').add(o).onsuccess=show}catch(e){}}
function all(cb){if(!db)return cb([]);var r=db.transaction('d').objectStore('d').getAll();r.onsuccess=function(){cb(r.result.reverse())}}
function show(){all(function(L){var q=($('dq').value||'').toLowerCase();L=L.filter(function(x){return !q||JSON.stringify(x).toLowerCase().indexOf(q)>=0});$('dn').textContent=L.length+' décisions';
 $('dt').innerHTML='<tr><th>Heure</th><th>Mode</th><th>Cible</th><th>Raison / scores</th></tr>'+L.slice(0,60).map(function(x){return '<tr><td>'+new Date(x.t).toLocaleString('fr-FR')+'</td><td>'+x.mode+'</td><td>'+esc(x.cible)+'</td><td>'+esc(x.raison)+'</td></tr>'}).join('')})}
var lastR='';new MutationObserver(function(){var t=$('rchk').innerText;if(t==lastR||!/cible/.test(t))return;lastR=t;var m=t.match(/cible : (\S+) → ([^\n]*)/);put({t:Date.now(),mode:'RÉEL',cible:m?m[1]:'',raison:(m?m[2]+' | ':'')+t.split('\n').slice(1).join(' | ')})}).observe($('rchk'),{childList:true,subtree:true,characterData:true});
var lastL=null;setInterval(function(){if(typeof S=='undefined'||!S||!S.log)return;var top=S.log[0];if(lastL===null){lastL=top;return}if(top==lastL)return;var i=S.log.indexOf(lastL);if(i<0)i=Math.min(5,S.log.length);
 S.log.slice(0,i).reverse().forEach(function(l){var m=l.slice(10);if(!/Analyst|Executor|Risk|Filter|RÉEL/.test(m))return;var c=m.match(/(?:ACHAT FICTIF|VENTE FICTIVE|signal \S+|Analyst :|Filter :) ?(\S+)/);var r=m.match(/\(([^)]*(?:\([^)]*\))?[^)]*)\)/);put({t:Date.now(),mode:window.REAL&&REAL.on?'RÉEL':'SIM',cible:c?c[1]:'',raison:(r?r[1]+' | ':'')+m})});lastL=top},2000);
$('dq').oninput=show;$('dcsv').onclick=function(){all(function(L){var csv='heure;mode;cible;raison\n'+L.map(function(x){return [new Date(x.t).toISOString(),x.mode,x.cible,'"'+String(x.raison).replace(/"/g,'""')+'"'].join(';')}).join('\n');var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='soldesk_decisions.csv';a.click()})};
$('btgo').onclick=backtest;report();setInterval(report,10000);setInterval(marks,5000);setTimeout(marks,1500);
})();
