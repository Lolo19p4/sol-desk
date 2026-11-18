// Section Marchés : carte USDC (solde + portefeuille) puis une carte par crypto. Affichage seulement, aucune clé.
(function(){
  var WALLET='FoFjucbrcvAK8bqYM3W4iKkorFJD6b2YuSScT2CzActx';
  var USDC_MINT='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  var RPCS=['https://solana-rpc.publicnode.com','https://api.mainnet-beta.solana.com'];
  var TOKEN_PROG='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  var TOKEN_2022='TokenzQdBNbLqP5VEhdkAS6EtFNwCb2EB4yF4bFUH5vcg';
  var MINTS={
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':'USDC',
    'So11111111111111111111111111111111111111112':'SOL',
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN':'JUP',
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263':'BONK',
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm':'WIF',
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R':'RAY',
    'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL':'JTO',
    'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3':'PYTH',
    'rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof':'RENDER',
    '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN':'TRUMP',
    '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh':'BTC',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs':'ETH'
  };
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
  function fmtUsd(x){
    if(x==null||!isFinite(x))return '–';
    return x.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' $';
  }
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

  var usdc={id:'USDC',sym:'USDCUSDT',nom:'dollar'};
  (function makeUsdc(){
    var el=document.createElement('div');
    el.className='mk-card mk-usdc';
    el.id='mk-USDC';
    el.innerHTML='<div class="mk-head"><span class="mk-name">'+esc(usdc.id)+' <span class="sk" style="font-weight:400;font-size:11px">'+esc(usdc.nom)+'</span></span><span class="mk-tag wait" data-tag>Ton solde</span></div>'+
      '<div class="mk-px" data-px>Chargement…</div>'+
      '<div class="mk-chg"><span>1 h <b data-h1 class="sk">–</b></span><span>24 h <b data-h24 class="sk">–</b></span></div>'+
      '<div class="mk-hold"><span>Solde <b data-usdc class="sk">Chargement…</b></span><span>Portefeuille <b data-tot class="sk">Chargement…</b></span></div>'+
      '<canvas height="120" aria-label="Courbe 48 h de USDC"></canvas>';
    grid.appendChild(el);
    usdc.el=el; usdc.cv=el.querySelector('canvas');
  })();

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

  function apply(a, d, opts){
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
    if(!(opts&&opts.keepTag)){
      tag.textContent=up?'Ça monte':'Ça baisse';
      tag.className='mk-tag '+(up?'up':'dn');
    }
    draw(a.cv, rows);
  }

  function fail(a, msg){
    var el=a.el;
    el.querySelector('[data-px]').textContent='Indisponible';
    if(a!==usdc){
      el.querySelector('[data-tag]').textContent='Pas de données';
      el.querySelector('[data-tag]').className='mk-tag wait';
    }
    var cv=a.cv, w=cv.clientWidth||280, x=cv.getContext('2d');
    if(x){cv.width=w; cv.height=120; x.fillStyle='#121a23'; x.fillRect(0,0,w,120); x.fillStyle='#8a94c4'; x.font='12px sans-serif'; x.fillText(msg||'Données indisponibles',10,64)}
  }

  async function rpc(method, params){
    var body=JSON.stringify({jsonrpc:'2.0',id:1,method:method,params:params});
    var lastErr;
    for(var i=0;i<RPCS.length;i++){
      try{
        var r=await fetch(RPCS[i],{method:'POST',headers:{'Content-Type':'application/json'},body:body});
        if(!r.ok) throw new Error('HTTP '+r.status);
        var d=await r.json();
        if(d.error) throw new Error(d.error.message||'rpc');
        return d.result;
      }catch(e){ lastErr=e }
    }
    throw lastErr||new Error('rpc indisponible');
  }

  function addAccounts(res, hold){
    var vals=(res&&res.value)||[];
    vals.forEach(function(a){
      var info=a.account&&a.account.data&&a.account.data.parsed&&a.account.data.parsed.info;
      if(!info||!info.tokenAmount)return;
      var id=MINTS[info.mint], ui=+info.tokenAmount.uiAmount;
      if(!id||!isFinite(ui)||ui<=0)return;
      hold[id]=(hold[id]||0)+ui;
    });
  }

  var hold=null, holdErr=null;
  function pxOf(id){
    if(id==='USDC'){
      if(usdc._last&&usdc._last.length)return usdc._last[usdc._last.length-1].c;
      return 1;
    }
    for(var i=0;i<ASSETS.length;i++){
      var a=ASSETS[i];
      if(a.id===id&&a._last&&a._last.length)return a._last[a._last.length-1].c;
    }
    return null;
  }
  function fillHold(){
    var el=usdc.el; if(!el)return;
    var uEl=el.querySelector('[data-usdc]'), tEl=el.querySelector('[data-tot]');
    if(holdErr||!hold){
      uEl.textContent='Indisponible'; uEl.className='ko';
      tEl.textContent='Indisponible'; tEl.className='ko';
      return;
    }
    var u=hold.USDC||0;
    uEl.textContent=u.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDC';
    uEl.className='';
    var tot=0;
    Object.keys(hold).forEach(function(id){
      var px=pxOf(id);
      if(px==null){ if(id==='USDC')px=1; else return; }
      tot+=hold[id]*px;
    });
    tEl.textContent=fmtUsd(tot);
    tEl.className='';
  }

  async function loadWallet(){
    holdErr=null;
    try{
      var parts=await Promise.all([
        rpc('getBalance',[WALLET]),
        rpc('getTokenAccountsByOwner',[WALLET,{programId:TOKEN_PROG},{encoding:'jsonParsed'}]),
        rpc('getTokenAccountsByOwner',[WALLET,{programId:TOKEN_2022},{encoding:'jsonParsed'}])
      ]);
      var native=parts[0], tok=parts[1], tok2=parts[2];
      var h={};
      var sol=((native&&native.value)||0)/1e9;
      if(sol>0)h.SOL=sol;
      addAccounts(tok,h);
      addAccounts(tok2,h);
      // Au cas où l'USDC n'apparaîtrait pas dans la liste complète, on le relit par mint.
      if(h.USDC==null){
        try{
          var only=await rpc('getTokenAccountsByOwner',[WALLET,{mint:USDC_MINT},{encoding:'jsonParsed'}]);
          addAccounts(only,h);
        }catch(e){}
      }
      hold=h;
    }catch(e){
      hold=null; holdErr=e;
    }
    fillHold();
  }

  var loading=false;
  async function load(){
    if(loading)return; loading=true;
    var ok=0, ko=0;
    var jobs=[
      (async function(){
        try{ apply(usdc, await klines(usdc.sym), {keepTag:true}); ok++ }
        catch(e){ fail(usdc, 'Paire '+usdc.sym+' absente ou réseau coupé'); ko++ }
      })(),
      loadWallet()
    ].concat(ASSETS.map(async function(a){
      try{ apply(a, await klines(a.sym)); ok++ }
      catch(e){ fail(a, 'Paire '+a.sym+' absente ou réseau coupé'); ko++ }
    }));
    await Promise.all(jobs);
    fillHold();
    if(st){
      var wtxt=hold&&hold.USDC!=null?('solde '+hold.USDC.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDC'): (holdErr?'solde USDC indisponible':'');
      st.textContent=(ok?ok+' courbes à jour':'Aucune donnée')+(ko?' · '+ko+' indisponible(s)':'')+(wtxt?' · '+wtxt:'')+' · '+new Date().toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris'})+' (heure de Paris) · rafraîchi toutes les 60 s';
    }
    loading=false;
  }

  load();
  setInterval(load, 60000);
  var resizeT;
  window.addEventListener('resize', function(){
    clearTimeout(resizeT);
    resizeT=setTimeout(function(){
      if(usdc._last) draw(usdc.cv, usdc._last);
      ASSETS.forEach(function(a){ if(a._last) draw(a.cv, a._last) });
    }, 150);
  });
})();
