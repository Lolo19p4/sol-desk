// Graphique superposé SOL/ETH/BTC en % (n'utilise pas localStorage)
(function(){var box=document.getElementById('cmp');
function W(){return Math.max(280,box.clientWidth||box.parentNode.clientWidth-16||window.innerWidth-36)}
if(typeof LightweightCharts==='undefined'){return fallback()}
try{
var C={SOL:'#a78bfa',ETH:'#60a5fa',BTC:'#f59e0b'},S={};
var ch=LightweightCharts.createChart(box,{width:W(),height:240,layout:{background:{color:'#121a23'},textColor:'#d6e2ee'},grid:{vertLines:{color:'#1f2a36'},horzLines:{color:'#1f2a36'}},timeScale:{timeVisible:true},localization:{priceFormatter:function(v){return v.toFixed(2)+' %'}}});
Object.keys(C).forEach(function(k){S[k]=ch.addLineSeries({color:C[k],lineWidth:2,title:k})});
var fit=function(){ch.applyOptions({width:W()})};window.addEventListener('resize',fit);if(window.ResizeObserver)new ResizeObserver(fit).observe(box);setTimeout(fit,500);fit();var first=1;
function load(){var ok=0;Promise.all(Object.keys(C).map(function(k){return fetch('https://api.exchange.coinbase.com/products/'+k+'-USD/candles?granularity=60').then(function(r){return r.json()}).then(function(c){
 c=c.slice(0,120).reverse();var b=c[0][4];S[k].setData(c.map(function(x){return{time:x[0]-new Date().getTimezoneOffset()*60,value:(x[4]/b-1)*100}}));var v=(c[c.length-1][4]/b-1)*100;
 document.getElementById('v'+k).textContent=(v>=0?'+':'')+v.toFixed(2)+' %';ok++}).catch(function(){document.getElementById('v'+k).textContent='indispo'})}))
 .then(function(){document.getElementById('cmpst').textContent=(ok?'Mis à jour ':'Données indisponibles ')+new Date().toLocaleTimeString('fr-FR')+' · 0 % = il y a 2 h · rafraîchi toutes les 30 s';if(ok&&first){ch.timeScale().fitContent();first=0}})}
load();setInterval(load,30000);
}catch(e){window.__err&&__err('courbes : '+e.message);fallback()}
// secours : dessin simple sur <canvas> si lightweight-charts ne marche pas
function fallback(){var C={SOL:'#a78bfa',ETH:'#60a5fa',BTC:'#f59e0b'};box.innerHTML='';var cv=document.createElement('canvas');box.appendChild(cv);
 function draw(){var D={};var ks=Object.keys(C);var n=0;ks.forEach(function(k){fetch('https://api.exchange.coinbase.com/products/'+k+'-USD/candles?granularity=60').then(function(r){return r.json()}).then(function(c){c=c.slice(0,120).reverse();var b=c[0][4];D[k]=c.map(function(x){return (x[4]/b-1)*100});
  var v=D[k][D[k].length-1];document.getElementById('v'+k).textContent=(v>=0?'+':'')+v.toFixed(2)+' %'}).catch(function(){}).then(function(){if(++n<3)return;
  var w=W(),h=240,dp=window.devicePixelRatio||1;cv.width=w*dp;cv.height=h*dp;cv.style.width=w+'px';cv.style.height=h+'px';var x=cv.getContext('2d');x.scale(dp,dp);x.fillStyle='#121a23';x.fillRect(0,0,w,h);
  var all=[].concat.apply([],ks.map(function(k){return D[k]||[]}));if(!all.length)return;var mn=Math.min.apply(0,all),mx=Math.max.apply(0,all);if(mx===mn)mx=mn+1;
  ks.forEach(function(k){var d=D[k];if(!d)return;x.strokeStyle=C[k];x.lineWidth=2;x.beginPath();d.forEach(function(v,i){var px=i/(d.length-1)*(w-10)+5,py=h-10-(v-mn)/(mx-mn)*(h-20);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()});
  document.getElementById('cmpst').textContent='Mis à jour '+new Date().toLocaleTimeString('fr-FR')+' (mode simple) · 0 % = il y a 2 h'})})}
 draw();setInterval(draw,30000)}
})();
