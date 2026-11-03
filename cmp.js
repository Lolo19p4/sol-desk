// Graphique superposé SOL/ETH/BTC en % (n'utilise pas localStorage)
(function(){try{
var C={SOL:'#a78bfa',ETH:'#60a5fa',BTC:'#f59e0b'},S={},box=document.getElementById('cmp');
var ch=LightweightCharts.createChart(box,{height:240,layout:{background:{color:'#121a23'},textColor:'#d6e2ee'},grid:{vertLines:{color:'#1f2a36'},horzLines:{color:'#1f2a36'}},timeScale:{timeVisible:true},localization:{priceFormatter:function(v){return v.toFixed(2)+' %'}}});
Object.keys(C).forEach(function(k){S[k]=ch.addLineSeries({color:C[k],lineWidth:2,title:k})});
var fit=function(){ch.applyOptions({width:box.clientWidth})};window.addEventListener('resize',fit);fit();var first=1;
function load(){var ok=0;Promise.all(Object.keys(C).map(function(k){return fetch('https://api.exchange.coinbase.com/products/'+k+'-USD/candles?granularity=60').then(function(r){return r.json()}).then(function(c){
 c=c.slice(0,120).reverse();var b=c[0][4];S[k].setData(c.map(function(x){return{time:x[0]-new Date().getTimezoneOffset()*60,value:(x[4]/b-1)*100}}));var v=(c[c.length-1][4]/b-1)*100;
 document.getElementById('v'+k).textContent=(v>=0?'+':'')+v.toFixed(2)+' %';ok++}).catch(function(){document.getElementById('v'+k).textContent='indispo'})}))
 .then(function(){document.getElementById('cmpst').textContent=(ok?'Mis à jour ':'Données indisponibles ')+new Date().toLocaleTimeString('fr-FR')+' · 0 % = il y a 2 h · rafraîchi toutes les 30 s';if(ok&&first){ch.timeScale().fitContent();first=0}})}
load();setInterval(load,30000);
}catch(e){window.__err&&__err('courbes : '+e.message)}})();
