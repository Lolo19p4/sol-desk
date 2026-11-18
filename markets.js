// Section Marchés : cartes et courbes en direct via le WebSocket public Binance. Affichage seulement, aucune clé.
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
  var WS_HOSTS=['wss://stream.binance.com:443','wss://data-stream.binance.vision','wss://stream.binance.com:9443'];
  var IVS={
    '1m': {label:'1 min', limit:60, cap:'60 min · bougies 1 min'},
    '15m':{label:'15 min',limit:48, cap:'12 h · bougies 15 min'},
    '1h': {label:'1 h',   limit:48, cap:'48 h · bougies 1 h'}
  };
  var grid=document.getElementById('mkgrid'), st=document.getElementById('mkst');
  if(!grid)return;

  var iv='1m';
  try{ var saved=localStorage.getItem('mk_iv'); if(IVS[saved]) iv=saved }catch(e){}

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
  function parisHeure(){return new Date().toLocaleTimeString('fr-FR',{timeZone:'Europe/Paris'})}

  var usdc={id:'USDC',sym:'USDCUSDT',nom:'dollar'};
  (function makeUsdc(){
    var el=document.createElement('div');
    el.className='mk-card mk-usdc';
    el.id='mk-USDC';
    el.innerHTML='<div class="mk-head"><span class="mk-name">'+esc(usdc.id)+' <span class="sk" style="font-weight:400;font-size:11px">'+esc(usdc.nom)+'</span></span><span class="mk-tag wait" data-tag>Ton solde</span></div>'+
      '<div class="mk-px" data-px>Chargement…</div>'+
      '<div class="mk-chg"><span>1 h <b data-h1 class="sk">–</b></span><span>24 h <b data-h24 class="sk">–</b></span></div>'+
      '<div class="mk-hold"><span>Solde <b data-usdc class="sk">Chargement…</b></span><span>Portefeuille <b data-tot class="sk">Chargement…</b></span></div>'+
      '<canvas height="120" aria-label="Courbe de USDC"></canvas>';
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
      '<canvas height="120" aria-label="Courbe de '+esc(a.id)+'"></canvas>';
    grid.appendChild(el);
    a.el=el; a.cv=el.querySelector('canvas');
  });

  var ALL=[usdc].concat(ASSETS);
  var bySym={};
  ALL.forEach(function(a){ bySym[a.sym]=a });

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
    x.fillText((IVS[iv]&&IVS[iv].cap)||'', pad, h-2);
  }

  var drawQ={};
  function scheduleDraw(a){
    if(drawQ[a.id])return;
    drawQ[a.id]=1;
    requestAnimationFrame(function(){
      drawQ[a.id]=0;
      if(a._last) draw(a.cv, a._last);
    });
  }

  function ref1hFrom(rows){
    if(!rows||!rows.length)return null;
    var ago=Date.now()-3600000, found=null;
    for(var i=0;i<rows.length;i++){
      if(rows[i].t<=ago) found=rows[i].c;
    }
    if(found!=null)return found;
    if(iv==='1h'&&rows.length>=2)return rows[rows.length-2].c;
    if(iv==='15m'&&rows.length>=5)return rows[rows.length-5].c;
    if(iv==='1m'&&rows.length>=60)return rows[0].c;
    return rows[0].c;
  }

  function paint(a){
    var el=a.el; if(!el)return;
    var px=a._px;
    if(px==null&&a._last&&a._last.length) px=a._last[a._last.length-1].c;
    el.querySelector('[data-px]').textContent=px==null?'–':fmtPx(px);
    var h1=null, h24=null;
    if(px!=null&&a._ref1h) h1=(px/a._ref1h-1)*100;
    else if(a._h1!=null) h1=a._h1;
    if(px!=null&&a._o24) h24=(px/a._o24-1)*100;
    else if(a._h24!=null) h24=a._h24;
    var b1=el.querySelector('[data-h1]'), b24=el.querySelector('[data-h24]');
    b1.textContent=fmtPct(h1); b1.className=(h1==null)?'sk':(h1>=0?'ok':'ko');
    b24.textContent=fmtPct(h24); b24.className=(h24==null)?'sk':(h24>=0?'ok':'ko');
    if(a!==usdc){
      var tag=el.querySelector('[data-tag]');
      if(h1==null){ tag.textContent='—'; tag.className='mk-tag wait' }
      else{ tag.textContent=h1>=0?'Ça monte':'Ça baisse'; tag.className='mk-tag '+(h1>=0?'up':'dn') }
    }
  }

  var holdT;
  function scheduleFillHold(){
    clearTimeout(holdT);
    holdT=setTimeout(fillHold, 400);
  }

  function apply(a, d, opts){
    var rows=d.map(function(x){return {t:+x[0],o:+x[1],h:+x[2],l:+x[3],c:+x[4]}});
    a._last=rows;
    if(rows.length){
      a._px=rows[rows.length-1].c;
      var r1=ref1hFrom(rows);
      if(r1!=null) a._ref1h=r1;
    }
    paint(a);
    if(!(opts&&opts.silentDraw)) draw(a.cv, rows);
  }

  function fail(a, msg){
    if(a._last&&a._last.length) return;
    var el=a.el;
    el.querySelector('[data-px]').textContent='Indisponible';
    if(a!==usdc){
      el.querySelector('[data-tag]').textContent='Pas de données';
      el.querySelector('[data-tag]').className='mk-tag wait';
    }
    var cv=a.cv, w=cv.clientWidth||280, x=cv.getContext('2d');
    if(x){cv.width=w; cv.height=120; x.fillStyle='#121a23'; x.fillRect(0,0,w,120); x.fillStyle='#8a94c4'; x.font='12px sans-serif'; x.fillText(msg||'Données indisponibles',10,64)}
  }

  function onTicker(a, t){
    var px=+(t.c), o=+(t.o);
    if(isFinite(px)) a._px=px;
    if(isFinite(o)&&o>0) a._o24=o;
    paint(a);
    scheduleFillHold();
  }

  function onKline(a, k){
    var row={t:+k.t,o:+k.o,h:+k.h,l:+k.l,c:+k.c};
    if(!isFinite(row.c)||!isFinite(row.t))return;
    if(!a._last) a._last=[];
    var last=a._last[a._last.length-1];
    if(last&&last.t===row.t) a._last[a._last.length-1]=row;
    else if(!last||row.t>last.t){
      a._last.push(row);
      var lim=(IVS[iv]&&IVS[iv].limit)||60;
      if(a._last.length>lim) a._last=a._last.slice(-lim);
      var r1=ref1hFrom(a._last);
      if(r1!=null) a._ref1h=r1;
    } else return;
    a._px=row.c;
    paint(a);
    scheduleDraw(a);
    scheduleFillHold();
  }

  async function klines(sym, interval, limit){
    var lastErr;
    for(var i=0;i<BASES.length;i++){
      try{
        var r=await fetch(BASES[i]+'/api/v3/klines?symbol='+sym+'&interval='+interval+'&limit='+limit);
        if(!r.ok) throw new Error('HTTP '+r.status);
        var d=await r.json();
        if(!Array.isArray(d)||!d.length) throw new Error('vide');
        return d;
      }catch(e){ lastErr=e }
    }
    throw lastErr||new Error('indisponible');
  }

  async function ticker24(){
    var list=ALL.map(function(a){return a.sym});
    var q='symbols='+encodeURIComponent(JSON.stringify(list));
    var lastErr;
    for(var i=0;i<BASES.length;i++){
      try{
        var r=await fetch(BASES[i]+'/api/v3/ticker/24hr?'+q);
        if(!r.ok) throw new Error('HTTP '+r.status);
        var d=await r.json();
        if(!Array.isArray(d)) throw new Error('vide');
        var map={};
        d.forEach(function(t){ map[t.symbol]=t });
        return map;
      }catch(e){ lastErr=e }
    }
    throw lastErr||new Error('ticker indisponible');
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

  function addAccounts(res, holdMap){
    var vals=(res&&res.value)||[];
    vals.forEach(function(acc){
      var info=acc.account&&acc.account.data&&acc.account.data.parsed&&acc.account.data.parsed.info;
      if(!info||!info.tokenAmount)return;
      var id=MINTS[info.mint], ui=+info.tokenAmount.uiAmount;
      if(!id||!isFinite(ui)||ui<=0)return;
      holdMap[id]=(holdMap[id]||0)+ui;
    });
  }

  var hold=null, holdErr=null;
  function pxOf(id){
    var a=id==='USDC'?usdc:null;
    if(!a){
      for(var i=0;i<ASSETS.length;i++){ if(ASSETS[i].id===id){ a=ASSETS[i]; break } }
    }
    if(!a){ return id==='USDC'?1:null }
    if(a._px!=null&&isFinite(a._px)) return a._px;
    if(a._last&&a._last.length) return a._last[a._last.length-1].c;
    return id==='USDC'?1:null;
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

  var chartsOk=0, chartsKo=0, chartsLoading=false;
  async function loadCharts(){
    if(chartsLoading)return; chartsLoading=true;
    chartsOk=0; chartsKo=0;
    var meta=IVS[iv];
    var jobs=ALL.map(async function(a){
      try{ apply(a, await klines(a.sym, iv, meta.limit)); chartsOk++ }
      catch(e){ fail(a, 'Paire '+a.sym+' absente ou réseau coupé'); chartsKo++ }
    });
    try{
      var tmap=await ticker24();
      ALL.forEach(function(a){
        var t=tmap[a.sym]; if(!t)return;
        var px=+t.lastPrice, o=+t.openPrice;
        if(isFinite(px)) a._px=px;
        if(isFinite(o)&&o>0) a._o24=o;
        if(isFinite(+t.priceChangePercent)) a._h24=+t.priceChangePercent;
        paint(a);
      });
    }catch(e){}
    await Promise.all(jobs);
    fillHold();
    setStatus();
    chartsLoading=false;
  }

  var ws=null, wsOk=false, wsTimer=null, wsHost=0, backoff=1000, lastMsg=0, stopWs=false;
  function setLive(on, txt){
    wsOk=!!on;
    var pill=document.getElementById('mklive');
    if(pill){
      pill.textContent=txt||(on?'EN DIRECT':'HORS LIGNE');
      pill.className='mk-live '+(on?'on':'off');
    }
    setStatus();
  }
  function setStatus(){
    if(!st)return;
    var wtxt=hold&&hold.USDC!=null?('solde '+hold.USDC.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' USDC'):(holdErr?'solde USDC indisponible':'');
    var n=chartsOk||ALL.filter(function(a){return a._last&&a._last.length}).length;
    var head=wsOk?(n+' courbes en direct'):(n?n+' courbes à jour (repli)':'Aucune donnée');
    var tail=wsOk?'en direct':(ws?'reconnexion au direct…':'rafraîchi toutes les 60 s');
    st.textContent=head+(chartsKo?' · '+chartsKo+' indisponible(s)':'')+(wtxt?' · '+wtxt:'')+' · '+parisHeure()+' (heure de Paris) · '+tail;
  }
  function wsUrl(host){
    var parts=[];
    ALL.forEach(function(a){
      var s=a.sym.toLowerCase();
      parts.push(s+'@miniTicker');
      parts.push(s+'@kline_'+iv);
    });
    return host+'/stream?streams='+parts.join('/');
  }
  function closeWs(){
    if(!ws)return;
    var old=ws; ws=null;
    try{ old.onclose=null; old.onerror=null; old.onmessage=null; old.close() }catch(e){}
  }
  function scheduleReconnect(){
    if(stopWs)return;
    clearTimeout(wsTimer);
    setLive(false, 'RECONNEXION…');
    wsTimer=setTimeout(connect, backoff);
    backoff=Math.min(backoff*2, 30000);
    wsHost=(wsHost+1)%WS_HOSTS.length;
  }
  function connect(){
    if(stopWs)return;
    closeWs();
    var url=wsUrl(WS_HOSTS[wsHost]);
    var sock;
    try{ sock=new WebSocket(url) }catch(e){ scheduleReconnect(); return }
    ws=sock;
    sock.onopen=function(){ if(ws!==sock)return; backoff=1000; lastMsg=Date.now(); setLive(true) };
    sock.onmessage=function(ev){
      if(ws!==sock)return;
      lastMsg=Date.now();
      var msg;
      try{ msg=JSON.parse(ev.data) }catch(e){ return }
      var stream=msg&&msg.stream, data=msg&&msg.data;
      if(!stream||!data)return;
      var sym=(stream.split('@')[0]||'').toUpperCase();
      var a=bySym[sym]; if(!a)return;
      if(stream.indexOf('@miniTicker')!==-1) onTicker(a, data);
      else if(stream.indexOf('@kline_')!==-1&&data.k) onKline(a, data.k);
    };
    sock.onerror=function(){ if(ws===sock){ try{ sock.close() }catch(e){} } };
    sock.onclose=function(){ if(ws===sock){ ws=null; scheduleReconnect() } };
  }

  function bindInterval(){
    var bar=document.getElementById('mkiv'); if(!bar)return;
    function sync(){
      var btns=bar.querySelectorAll('button[data-iv]');
      for(var i=0;i<btns.length;i++){
        btns[i].className=btns[i].getAttribute('data-iv')===iv?'on':'';
      }
    }
    sync();
    bar.addEventListener('click', function(e){
      var b=e.target.closest('button[data-iv]'); if(!b)return;
      e.preventDefault(); e.stopPropagation();
      var next=b.getAttribute('data-iv');
      if(!IVS[next]||next===iv)return;
      iv=next;
      try{ localStorage.setItem('mk_iv', iv) }catch(err){}
      sync();
      ALL.forEach(function(a){
        if(a.cv) a.cv.setAttribute('aria-label','Courbe '+IVS[iv].label+' de '+a.id);
      });
      closeWs();
      clearTimeout(wsTimer);
      setLive(false, 'RECONNEXION…');
      loadCharts().then(function(){
        wsHost=0; backoff=1000; connect();
      });
    });
  }

  bindInterval();
  loadCharts().then(function(){ connect() });
  loadWallet();
  setInterval(function(){
    loadWallet();
    if(!wsOk) loadCharts();
  }, 60000);
  setInterval(function(){
    if(wsOk&&lastMsg&&Date.now()-lastMsg>20000){
      try{ if(ws) ws.close() }catch(e){}
    }
  }, 5000);
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState!=='visible')return;
    if(!wsOk){ backoff=1000; connect() }
    loadWallet();
  });
  var resizeT;
  window.addEventListener('resize', function(){
    clearTimeout(resizeT);
    resizeT=setTimeout(function(){
      ALL.forEach(function(a){ if(a._last) draw(a.cv, a._last) });
    }, 150);
  });
})();
