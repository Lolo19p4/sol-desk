// Section Marchés : une carte et une courbe par crypto. Affichage seulement, aucune clé.
(function(){
  var ASSETS=[
    {id:'SOL',sym:'SOLUSDT',nom:'Solana'},
    {id:'BTC',sym:'BTCUSDT',nom:'Bitcoin'},
    {id:'ETH',sym:'ETHUSDT',nom:'Ethereum'},
    {id:'JUP',sym:'JUPUSDT',nom:'Jupiter'},
    {id:'BONK',sym:'BONKUSDT',nom:'Bonk'},
    {id:'WIF',sym:'WIFUSDT',nom:'dogwifhat'},
    {id:'RAY',sym:'RAYUSDT',nom:'Raydium'},
    {id:'JTO',sym:'JTOUSDT',nom:'Jito'},
    {id:'PYTH',sym:'PYTHUSDT',nom:'Pyth'},
    {id:'RENDER',sym:'RENDERUSDT',nom:'Render'},
    {id:'TRUMP',sym:'TRUMPUSDT',nom:'Trump'}
  ];
  var BASES=['https://api.binance.com','https://data-api.binance.vision'];
  var grid=document.getElementById('mkgrid'), st=document.getElementById('mkst');
  if(!grid)return;

  function ema(v,n){var k=2/(n+1),e=v[0];return v.map(function(x){return e=x*k+e*(1-k)})}
  function fmtPx(x){
    x=+x; if(!isFinite(x))return '–';
    var d=x>=1000?2:x>=1?4:x>=0.01?6:10;
    return x.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:d})+' $';
  }
  function fmtPct(p){
    if(p==null||!isFinite(p))return '–';
    return (p>=0?'+':'')+p.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %';
  }
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

  ASSETS.forEach(function(a){
    var el=document.createElement('div');
    el.className='mk-card';
    el.id='mk-'+a.id;
    el.innerHTML='<div class="mk-head"><span class="mk-name">'+esc(a.id)+' <span class="sk" style="font-weight:400;font-size:11px">'+esc(a.nom)+'</span></span><span class="mk-tag wait" data-tag>—</span></div>'+
      '<div class="mk-px" data-px>Chargement…</div>'+
      '<div class="mk-chg"><span>1 h <b data-h1 class="sk">–</b></span><span>24 h <b data-h24 class="sk">–</b></span></div>'+
      '<canvas height="120" aria-label="Courbe 1 h de '+esc(a.id)+'"></canvas>';
    grid.appendChild(el);
    a.el=el; a.cv=el.querySelector('canvas');
  });

  function draw(cv, rows){
    var w=cv.clientWidth||(cv.parentNode&&cv.parentNode.clientWidth)||280, h=120, dp=window.devicePixelRatio||1;
    cv.width=Math.max(1,Math.round(w*dp)); cv.height=Math.round(h*dp);
    cv.style.width=w+'px'; cv.style.height=h+'px';
    var x=cv.getContext('2d'); if(!x||!rows||!rows.length)return;
    x.setTransform(dp,0,0,dp,0,0);
    x.clearRect(0,0,w,h);
    x.fillStyle='#121a23'; x.fillRect(0,0,w,h);
    var pad=6, highs=rows.map(function(r){return r.h}), lows=rows.map(function(r){return r.l});
    var mn=Math.min.apply(null,lows), mx=Math.max.apply(null,highs);
    if(mx===mn){mx+=mx*0.001||1; mn-=mn*0.001||1}
    var n=rows.length, bw=Math.max(2,(w-pad*2)/n-1), gap=(w-pad*2)/n;
    function Y(v){return pad+(mx-v)/(mx-mn)*(h-pad*2)}
    rows.forEach(function(r,i){
      var cx=pad+i*gap+gap/2, y1=Y(r.h), y2=Y(r.l), yo=Y(r.o), yc=Y(r.c);
      var col=r.c>=r.o?'#4ade80':'#f87171';
      x.strokeStyle=col; x.lineWidth=1;
      x.beginPath(); x.moveTo(cx,y1); x.lineTo(cx,y2); x.stroke();
      var top=Math.min(yo,yc), bot=Math.max(yo,yc); if(bot-top<1)bot=top+1;
      x.fillStyle=col; x.fillRect(cx-bw/2,top,bw,bot-top);
    });
    x.fillStyle='#8a94c4';
    x.font='10px ui-monospace,Menlo,Consolas,monospace';
    x.fillText('48 h · bougies 1 h', pad, h-2);
  }

  async function klines(sym){
    var lastErr;
    for(var i=0;i<BASES.length;i++){
      try{
        var r=await fetch(BASES[i]+'/api/v3/klines?symbol='+sym+'&interval=1h&limit=48');
        if(!r.ok) throw new Error('HTTP '+r.status);
        var d=await r.json();
        if(!Array.isArray(d)||!d.length) throw new Error('vide');
        return d;
      }catch(e){ lastErr=e }
    }
    throw lastErr||new Error('indisponible');
  }

  function apply(a, d){
    var rows=d.map(function(x){return {t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4]}});
    a._last=rows;
    var cl=rows.map(function(r){return r.c});
    var px=cl[cl.length-1];
    var h1=cl.length>=2?(px/cl[cl.length-2]-1)*100:null;
    var h24=cl.length>24?(px/cl[cl.length-25]-1)*100:null;
    var e9=ema(cl,9), e21=ema(cl,21);
    var up=e9[e9.length-1]>e21[e21.length-1];
    var el=a.el;
    el.querySelector('[data-px]').textContent=fmtPx(px);
    var b1=el.querySelector('[data-h1]'), b24=el.querySelector('[data-h24]');
    b1.textContent=fmtPct(h1); b1.className=h1>=0?'ok':'ko';
    b24.textContent=fmtPct(h24); b24.className=h24>=0?'ok':'ko';
    var tag=el.querySelector('[data-tag]');
    tag.textContent=up?'Ça monte':'Ça baisse';
    tag.className='mk-tag '+(up?'up':'dn');
    draw(a.cv, rows);
  }

  function fail(a, msg){
    var el=a.el;
    el.querySelector('[data-px]').textContent='Indisponible';
    el.querySelector('[data-tag]').textContent='Pas de données';
    el.querySelector('[data-tag]').className='mk-tag wait';
    var cv=a.cv, w=cv.clientWidth||280, x=cv.getContext('2d');
    if(x){cv.width=w; cv.height=120; x.fillStyle='#121a23'; x.fillRect(0,0,w,120); x.fillStyle='#8a94c4'; x.font='12px sans-serif'; x.fillText(msg||'Données indisponibles',10,64)}
  }

  var loading=false;
  async function load(){
    if(loading)return; loading=true;
    var ok=0, ko=0;
    await Promise.all(ASSETS.map(async function(a){
      try{ apply(a, await klines(a.sym)); ok++ }
      catch(e){ fail(a, 'Paire '+a.sym+' absente ou réseau coupé'); ko++ }
    }));
    if(st) st.textContent=(ok?ok+' courbes à jour':'Aucune donnée')+(ko?' · '+ko+' indisponible(s)':'')+' · '+new Date().toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris'})+' (heure de Paris) · rafraîchi toutes les 60 s';
    loading=false;
  }

  load();
  setInterval(load, 60000);
  var resizeT;
  window.addEventListener('resize', function(){
    clearTimeout(resizeT);
    resizeT=setTimeout(function(){
      ASSETS.forEach(function(a){ if(a._last) draw(a.cv, a._last) });
    }, 150);
  });
})();
