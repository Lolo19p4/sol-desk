// Terminal de trading : étapes de la variante C, soldes et vrais trades. Affichage seulement, aucune clé.
(function(){
  var ROOT=document.getElementById('terminal');
  if(!ROOT) return;

  var WALLET='FoFjucbrcvAK8bqYM3W4iKkorFJD6b2YuSScT2CzActx';
  var USDC_MINT='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  var RPCS=['https://solana-rpc.publicnode.com','https://api.mainnet-beta.solana.com'];
  var TOKEN_PROG='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  var TOKEN_2022='TokenzQdBNbLqP5VEhdkAS6EtFNwCb2EB4yF4bFUH5vcg';
  var MINTS={
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':'USDC',
    'So11111111111111111111111111111111111111112':'SOL',
    '3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh':'BTC',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs':'ETH',
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263':'BONK',
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN':'JUP',
    'VVV4UdRywr7SLafPHzqXwRCw7myXkmgCtitXUvj8g8c':'VVV',
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm':'WIF'
  };
  var BINANCE_SYM={SOL:'solusdt',ETH:'ethusdt',BTC:'btcusdt',BONK:'bonkusdt',JUP:'jupusdt',WIF:'wifusdt'};
  var JUP_PRICE='https://lite-api.jup.ag/price/v3?ids=';
  var ASSETS=[
    {id:'SOL',sym:'SOLUSDT',nom:'Solana'},
    {id:'ETH',sym:'ETHUSDT',nom:'Ethereum'},
    {id:'BTC',sym:'BTCUSDT',nom:'Bitcoin'}
  ];
  var BASES=['https://api.binance.com','https://data-api.binance.vision'];
  var RESERVE_SOL=0.02;

  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function parisHeure(d){
    return (d||new Date()).toLocaleString('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  function fmtUsd(x,d){
    if(x==null||!isFinite(x)) return '–';
    d=d==null?2:d;
    return x.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d})+' $';
  }
  function fmtPx(x){
    if(x==null||!isFinite(x)) return '–';
    var d=x>=1000?2:x>=1?4:x>=0.01?6:8;
    return x.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:d})+' $';
  }
  function fmtQty(x){
    if(x==null||!isFinite(x)) return '–';
    var d=x>=1000?2:x>=1?4:x>=0.01?6:8;
    return x.toLocaleString('fr-FR',{maximumFractionDigits:d});
  }
  function fmtPct(x){
    if(x==null||!isFinite(x)) return '–';
    return (x>=0?'+':'')+x.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' %';
  }
  function normActif(a){
    a=String(a||'').toUpperCase().replace(/\s+/g,'').replace(/^\$/,'');
    if(a==='WETH') return 'ETH';
    if(a==='WBTC') return 'BTC';
    return a;
  }
  function entryOf(p){
    var e=p&& (p.entree!=null?p.entree:p.prix);
    e=+e;
    return isFinite(e)?e:null;
  }
  function positionList(){
    var list=[], seen={};
    function add(arr){
      (arr||[]).forEach(function(p){
        if(!p||!p.actif||!(+p.qte>0)) return;
        var id=normActif(p.actif)+'|'+(p.mint||'');
        if(seen[id]) return;
        seen[id]=1;
        list.push(p);
      });
    }
    if(statusData) add(statusData.positions_ouvertes);
    if(!list.length&&tradesData) add(tradesData.positions_ouvertes);
    return list;
  }
  function pxOf(p){
    var id=normActif(p&&p.actif);
    if(prices[id]!=null&&isFinite(prices[id])) return prices[id];
    return null;
  }
  function usesBinance(p){
    var id=normActif(p&&p.actif);
    if(p&&p.source_prix==='jupiter') return false;
    if(p&&p.source_prix==='binance') return true;
    return !!BINANCE_SYM[id];
  }
  function mark(ok){
    return ok?'<span class="tm-yes">✓</span>':'<span class="tm-no">✗</span>';
  }
  function ema(values, period){
    if(!values||values.length<period) return null;
    var k=2/(period+1), e=0, i;
    for(i=0;i<period;i++) e+=values[i];
    e/=period;
    var out=new Array(values.length).fill(null);
    out[period-1]=e;
    for(i=period;i<values.length;i++){
      e=values[i]*k+e*(1-k);
      out[i]=e;
    }
    return out;
  }
  function last(arr){
    if(!arr) return null;
    for(var i=arr.length-1;i>=0;i--) if(arr[i]!=null&&isFinite(arr[i])) return arr[i];
    return null;
  }

  async function getJson(urls, opts){
    var lastErr;
    for(var i=0;i<urls.length;i++){
      try{
        var r=await fetch(urls[i], opts);
        if(!r.ok) throw new Error('HTTP '+r.status);
        return await r.json();
      }catch(e){ lastErr=e }
    }
    throw lastErr||new Error('réseau');
  }

  async function klines(sym, interval, limit){
    var q='/api/v3/klines?symbol='+encodeURIComponent(sym)+'&interval='+interval+'&limit='+limit;
    var rows=await getJson(BASES.map(function(b){return b+q}));
    var now=Date.now(), out=[];
    (rows||[]).forEach(function(k){
      var closeTime=+k[6];
      if(!isFinite(closeTime)||closeTime>now) return; // bougie encore ouverte : ignorée
      out.push({t:+k[0], o:+k[1], h:+k[2], l:+k[3], c:+k[4], closeTime:closeTime});
    });
    return out;
  }

  function evalAsset(rows1h, rows4h, lastSellAt){
    var r={ok:false, c4h:null, ema9:null, ema21:null, ema50:null, close1h:null, ph24:null};
    r.reg4h=false; r.croise=false; r.cassure=false; r.pause6h=true;
    if(lastSellAt){
      r.pause6h=(Date.now()-lastSellAt)>=6*3600*1000;
    }
    if(rows4h&&rows4h.length>=50){
      var c4=rows4h.map(function(x){return x.c});
      var e9=ema(c4,9), e21=ema(c4,21), e50=ema(c4,50);
      r.c4h=c4[c4.length-1];
      r.ema9=last(e9); r.ema21=last(e21); r.ema50=last(e50);
      r.reg4h=r.c4h!=null&&r.ema50!=null&&r.c4h>r.ema50;
      r.croise=r.ema9!=null&&r.ema21!=null&&r.ema9>r.ema21;
    }
    if(rows1h&&rows1h.length>=25){
      var lastC=rows1h[rows1h.length-1];
      r.close1h=lastC.c;
      var highs=[];
      for(var i=rows1h.length-25;i<rows1h.length-1;i++){
        if(i>=0) highs.push(rows1h[i].h);
      }
      r.ph24=highs.length?Math.max.apply(null,highs):null;
      r.cassure=r.close1h!=null&&r.ph24!=null&&r.close1h>r.ph24;
    }
    r.ok=r.reg4h&&r.croise&&r.cassure&&r.pause6h;
    return r;
  }

  async function rpc(method, params){
    var body=JSON.stringify({jsonrpc:'2.0',id:1,method:method,params:params});
    return getJson(RPCS, {method:'POST',headers:{'Content-Type':'application/json'},body:body}).then(function(d){
      if(d&&d.error) throw new Error(d.error.message||'rpc');
      return d.result;
    });
  }
  function addAccounts(res, hold){
    ((res&&res.value)||[]).forEach(function(acc){
      var info=acc.account&&acc.account.data&&acc.account.data.parsed&&acc.account.data.parsed.info;
      if(!info||!info.tokenAmount) return;
      var id=MINTS[info.mint], ui=+info.tokenAmount.uiAmount;
      if(!id||!isFinite(ui)||ui<=0) return;
      hold[id]=(hold[id]||0)+ui;
    });
  }
  async function loadWallet(){
    var parts=await Promise.all([
      rpc('getBalance',[WALLET]),
      rpc('getTokenAccountsByOwner',[WALLET,{programId:TOKEN_PROG},{encoding:'jsonParsed'}]),
      rpc('getTokenAccountsByOwner',[WALLET,{programId:TOKEN_2022},{encoding:'jsonParsed'}])
    ]);
    var h={};
    var sol=((parts[0]&&parts[0].value)||0)/1e9;
    if(sol>0) h.SOL=sol;
    addAccounts(parts[1],h);
    addAccounts(parts[2],h);
    if(h.USDC==null){
      try{
        var only=await rpc('getTokenAccountsByOwner',[WALLET,{mint:USDC_MINT},{encoding:'jsonParsed'}]);
        addAccounts(only,h);
      }catch(e){}
    }
    return h;
  }

  var tradesData=null, hold=null, holdErr=null, scan={}, lastOk=0, prices={};
  var statusData=null, statusErr=null, botTick=null;

  function lastSellMs(actif){
    if(!tradesData||!tradesData.trades) return null;
    var max=null;
    tradesData.trades.forEach(function(t){
      if(t.sens!=='vente'||t.actif!==actif||!t.date) return;
      var ms=Date.parse(t.date);
      if(isFinite(ms)&&(max==null||ms>max)) max=ms;
    });
    return max;
  }

  function setLive(on){
    var pill=document.getElementById('tmlive');
    if(!pill) return;
    pill.textContent=on?'EN DIRECT':'HORS LIGNE';
    pill.className='mk-live '+(on?'on':'off');
  }

  function pad2(n){ return (n<10?'0':'')+n }

  function passageMs(data){
    if(!data||!data.dernier_passage) return null;
    var ms=Date.parse(data.dernier_passage);
    return isFinite(ms)?ms:null;
  }

  function fmtAgo(ms){
    var sec=Math.max(0,Math.floor((Date.now()-ms)/1000));
    var min=Math.floor(sec/60);
    if(min<1) return "à l'instant";
    if(min===1) return 'il y a 1 min';
    if(min<60) return 'il y a '+min+' min';
    var h=Math.floor(min/60), r=min%60;
    if(r===0) return 'il y a '+h+' h';
    return 'il y a '+h+' h '+r+' min';
  }

  function fmtNext(ms, intervalMin){
    var iv=(intervalMin||10)*60*1000;
    var remain=ms+iv-Date.now();
    if(remain<=0) return 'prochain passage imminent';
    var min=Math.max(1, Math.round(remain/60000));
    if(min===1) return 'prochain passage dans ~1 min';
    return 'prochain passage dans ~'+min+' min';
  }

  function fmtTick(ms){
    var sec=Math.max(0,Math.floor((Date.now()-ms)/1000));
    var h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
    return (h>0?h+':':'')+pad2(m)+':'+pad2(s);
  }

  function botLevel(ms){
    if(ms==null) return 'off';
    var min=(Date.now()-ms)/60000;
    if(min>60) return 'stop';
    if(min>25) return 'late';
    return 'on';
  }

  function renderBot(){
    var el=document.getElementById('tmbot');
    if(!el) return;
    if(statusErr||!statusData){
      el.className='tm-bot off';
      el.innerHTML='<span class="tm-bot-dot" aria-hidden="true"></span><div class="tm-bot-label">ÉTAT INDISPONIBLE</div><div class="tm-bot-meta">Impossible de lire le dernier passage. Recharge la page.</div>';
      return;
    }
    var ms=passageMs(statusData);
    if(ms==null){
      el.className='tm-bot off';
      el.innerHTML='<span class="tm-bot-dot" aria-hidden="true"></span><div class="tm-bot-label">ÉTAT INDISPONIBLE</div><div class="tm-bot-meta">Pas encore d\'heure de passage.</div>';
      return;
    }
    var level=botLevel(ms);
    var label=level==='stop'?'ARRÊTÉ':level==='late'?'EN RETARD':'BOT EN MARCHE';
    var n=statusData.nb_positions;
    if(n==null) n=0;
    var posTxt=n===0?'aucune position':(n===1?'1 position':n+' positions');
    var mode=statusData.mode||'';
    var interval=statusData.intervalle_min||10;
    el.className='tm-bot '+(level==='on'?'':level);
    el.innerHTML=
      '<span class="tm-bot-dot" aria-hidden="true"></span>'+
      '<div class="tm-bot-label">'+esc(label)+'</div>'+
      '<div class="tm-bot-count" id="tmbotcount">'+fmtTick(ms)+'</div>'+
      '<div class="tm-bot-meta">'+
        '<div>dernier passage '+esc(fmtAgo(ms))+'</div>'+
        '<div>'+esc(fmtNext(ms, interval))+'</div>'+
        '<div class="tm-bot-sub">'+(mode?esc(mode)+' · ':'')+esc(posTxt)+'</div>'+
      '</div>';
  }

  async function loadStatus(){
    try{
      var data=await getJson(['status.json?t='+Date.now()]);
      statusData=data;
      statusErr=null;
    }catch(e){
      statusErr=e;
    }
    renderBot();
    renderPosition();
  }

  function renderBalance(){
    var el=document.getElementById('tmbal');
    if(!el) return;
    if(holdErr||!hold){
      el.innerHTML='<div class="ko">Solde indisponible pour le moment.</div>';
      return;
    }
    var ids=['USDC','SOL','ETH','BTC'];
    var labels={USDC:'USDC',SOL:'SOL',ETH:'wETH',BTC:'wBTC'};
    var tot=0, parts='';
    ids.forEach(function(id){
      var q=hold[id]||0;
      var px=id==='USDC'?1:prices[id];
      var usd=(px!=null&&isFinite(px))?q*px:null;
      if(usd!=null) tot+=usd;
      parts+='<div class="tm-kpi"><small>'+esc(labels[id])+'</small><b>'+fmtQty(q)+'</b><span class="sk">'+(usd==null?'–':fmtUsd(usd))+'</span></div>';
    });
    el.innerHTML='<div class="tm-kpi tm-total"><small>Solde total</small><b>'+fmtUsd(tot)+'</b><span class="sk">'+parisHeure()+' (heure de Paris)</span></div>'+parts;
  }

  function renderPosition(){
    var el=document.getElementById('tmpos');
    if(!el) return;
    var open=positionList();
    if(!open.length){
      el.innerHTML='<div class="sk">Aucune position ouverte. L\'argent est en USDC, en attente d\'un signal.</div>';
      return;
    }
    var body='', totVal=0, totCost=0, known=0, haveVal=0;
    open.forEach(function(p){
      var id=normActif(p.actif);
      var q=+p.qte;
      var ent=entryOf(p);
      var px=pxOf(p);
      var stop=(p.stop!=null&&isFinite(+p.stop))?+p.stop:null;
      var val=(px!=null&&isFinite(q))?px*q:null;
      var cost=(ent!=null&&isFinite(q))?ent*q:(p.usdc!=null?+p.usdc:null);
      var pnl=(val!=null&&cost!=null)?val-cost:null;
      var pct=(pnl!=null&&cost)?(pnl/cost*100):null;
      if(cost!=null&&isFinite(cost)){ totCost+=cost; known++; }
      if(val!=null){ totVal+=val; haveVal++; }
      var cls=pnl==null?'':(pnl>=0?'ok':'ko');
      var src=usesBinance(p)?'Binance':'Jupiter';
      body+='<tr>'+
        '<td><b>'+esc(id)+'</b> <span class="src">'+esc(src)+'</span></td>'+
        '<td class="num">'+fmtQty(q)+'</td>'+
        '<td class="num">'+fmtPx(ent)+'</td>'+
        '<td class="num">'+fmtPx(px)+'</td>'+
        '<td class="num">'+(val==null?'–':fmtUsd(val))+'</td>'+
        '<td class="num '+cls+'">'+(pnl==null?'–':((pnl>=0?'+':'')+fmtUsd(pnl).replace(' $','')+' $ · '+fmtPct(pct)))+'</td>'+
        '<td class="num">'+fmtPx(stop)+'</td>'+
      '</tr>';
    });
    var totPnl=(haveVal===open.length&&known===open.length)?totVal-totCost:null;
    var totPct=(totPnl!=null&&totCost)?(totPnl/totCost*100):null;
    var tcls=totPnl==null?'':(totPnl>=0?'ok':'ko');
    el.innerHTML='<table id="tmpos-table"><thead><tr>'+
      '<th>Actif</th><th class="num">Quantité</th><th class="num">Prix d\'entrée</th><th class="num">Prix actuel</th><th class="num">Valeur</th><th class="num">Gain / perte</th><th class="num">Stop</th>'+
      '</tr></thead><tbody>'+body+
      '<tr class="tm-total"><td>Total</td><td></td><td></td><td></td>'+
      '<td class="num">'+(haveVal===open.length?fmtUsd(totVal):'–')+'</td>'+
      '<td class="num '+tcls+'">'+(totPnl==null?'–':((totPnl>=0?'+':'')+fmtUsd(totPnl).replace(' $','')+' $ · '+fmtPct(totPct)))+'</td>'+
      '<td></td></tr></tbody></table>';
  }

  function renderSteps(){
    var el=document.getElementById('tmsteps');
    if(!el) return;
    var nOk=0, details='';
    ASSETS.forEach(function(a){
      var s=scan[a.id];
      if(s&&s.ok) nOk++;
      details+='<div class="tm-check"><span>'+esc(a.id)+'</span>'+mark(s&&s.ok)+'</div>';
    });
    var pauseOk=ASSETS.every(function(a){return !scan[a.id]||scan[a.id].pause6h});
    var motifs=(tradesData&&tradesData.trades||[]).slice().reverse().filter(function(t){return t.motif}).slice(0,3);
    var motifTxt=motifs.length?motifs.map(function(t){return esc(t.actif)+' : '+esc(t.motif)}).join('<br>'):'Pas encore de motif.';
    var etat;
    if(!hold&&holdErr) etat='Soldes indisponibles.';
    else if(nOk) etat='Signal d\'achat sur '+nOk+' actif'+(nOk>1?'s':'')+'.';
    else etat='En USDC, aucune condition d\'achat complète.';
    el.innerHTML=
      '<div class="tm-card c1"><h3>SCANNER</h3><div class="sk">SOL, ETH, BTC — tendance 4 h (EMA9 / EMA21 / EMA50) et cassure du plus haut 24 h.</div>'+details+'</div>'+
      '<div class="tm-card c2"><h3>CONTRÔLE</h3><div class="sk">Filtres de la variante C.</div>'+
        '<div class="tm-check"><span>Uniquement SOL, ETH, BTC</span>'+mark(true)+'</div>'+
        '<div class="tm-check"><span>Pas de rachat avant 6 h</span>'+mark(pauseOk)+'</div>'+
        '<div class="tm-check"><span>Disjoncteur −5 % / jour</span><span class="sk">règle active</span></div>'+
        '<div class="tm-check"><span>Minimum 8 $</span>'+mark(true)+'</div></div>'+
      '<div class="tm-card c3"><h3>TAILLE</h3><div class="sk">47 % de la valeur totale par position, au plus 2 positions, plafonné à l\'USDC disponible, minimum 8 $. Réserve 0,02 SOL.</div></div>'+
      '<div class="tm-card c4"><h3>EXÉCUTION</h3><div class="sk">Jupiter direct, glissement 1 %, sans frais de plateforme. Paiement en USDC.</div></div>'+
      '<div class="tm-card c5"><h3>JOURNAL</h3><div class="tm-mini">'+motifTxt+'</div></div>'+
      '<div class="tm-card c6"><h3>ÉTAT</h3><div class="sk">'+esc(etat)+'</div><div class="sk" style="margin-top:6px">Mode : cassure 24 h + régime 4 h.</div></div>';
  }

  function renderAssets(){
    var el=document.getElementById('tmassets');
    if(!el) return;
    el.innerHTML=ASSETS.map(function(a){
      var s=scan[a.id]||{};
      var head=s.ok?'<span class="mk-tag up">SIGNAL</span>':'<span class="mk-tag dn">PAS D\'ACHAT</span>';
      return '<div class="tm-card '+(s.ok?'tm-go':'')+'"><div class="mk-head"><span class="mk-name">'+esc(a.id)+' <span class="sk" style="font-weight:400;font-size:11px">'+esc(a.nom)+'</span></span>'+head+'</div>'+
        '<div class="mk-px">'+fmtPx(prices[a.id]!=null?prices[a.id]:s.close1h)+'</div>'+
        '<div class="tm-check"><span>Clôture 4 h &gt; EMA50 4 h</span>'+mark(!!s.reg4h)+'</div>'+
        '<div class="sk">clôture '+fmtPx(s.c4h)+' · EMA50 '+fmtPx(s.ema50)+'</div>'+
        '<div class="tm-check"><span>EMA9 4 h &gt; EMA21 4 h</span>'+mark(!!s.croise)+'</div>'+
        '<div class="sk">EMA9 '+fmtPx(s.ema9)+' · EMA21 '+fmtPx(s.ema21)+'</div>'+
        '<div class="tm-check"><span>Clôture 1 h &gt; plus haut 24 h</span>'+mark(!!s.cassure)+'</div>'+
        '<div class="sk">clôture 1 h '+fmtPx(s.close1h)+' · plus haut 24 h '+fmtPx(s.ph24)+'</div>'+
        '<div class="tm-check"><span>Pas de vente depuis 6 h</span>'+mark(!!s.pause6h)+'</div>'+
        '</div>';
    }).join('');
  }

  function renderTrades(){
    var box=document.getElementById('tmresume');
    var motifs=document.getElementById('tmmotifs');
    var table=document.getElementById('tmtrades');
    if(!tradesData||!tradesData.trades){
      if(box) box.textContent='Historique des trades indisponible.';
      return;
    }
    var r=tradesData.resume||{};
    var pnl=r.pnl_total_usd;
    var cls=pnl>0?'ok':pnl<0?'ko':'sk';
    if(box){
      box.innerHTML='<div class="tm-kpis">'+
        '<div class="tm-kpi"><small>Trades</small><b>'+esc(r.nb_trades||0)+'</b></div>'+
        '<div class="tm-kpi"><small>Gagnants</small><b class="ok">'+(r.gagnants||0)+'</b></div>'+
        '<div class="tm-kpi"><small>Perdants</small><b class="ko">'+(r.perdants||0)+'</b></div>'+
        '<div class="tm-kpi"><small>Résultat total</small><b class="'+cls+'">'+fmtUsd(pnl)+'</b></div>'+
        '</div>';
    }
    var last=(tradesData.trades||[]).slice().reverse().filter(function(t){return t.motif}).slice(0,8);
    if(motifs){
      motifs.innerHTML='<h3>Derniers motifs</h3><ul class="tm-ul">'+last.map(function(t){
        return '<li><span class="sk">'+esc(parisHeure(t.date?new Date(t.date):null))+'</span> <b>'+esc(t.sens)+' '+esc(t.actif)+'</b> — '+esc(t.motif)+'</li>';
      }).join('')+'</ul>';
    }
    if(table){
      var rows=(tradesData.trades||[]).slice().reverse();
      table.innerHTML='<thead><tr><th>Date</th><th>Sens</th><th>Actif</th><th>Quantité</th><th>USDC</th><th>Prix</th><th>Gain / perte</th><th>Lien</th></tr></thead><tbody>'+
        rows.map(function(t){
          var pcls=t.pnl_usd>0?'ok':t.pnl_usd<0?'ko':'sk';
          var pnlTxt=t.pnl_usd==null?'–':(fmtUsd(t.pnl_usd)+(t.pnl_pct!=null?' ('+fmtPct(t.pnl_pct)+')':''));
          var usdc=t.usdc!=null?fmtUsd(t.usdc):(t.paye?esc(t.paye):'–');
          var link=t.solscan?'<a href="'+esc(t.solscan)+'" target="_blank" rel="noopener">Solscan</a>':'–';
          return '<tr><td>'+esc(parisHeure(t.date?new Date(t.date):null))+'</td><td class="'+(t.sens==='achat'?'ok':'c5')+'">'+esc(t.sens)+'</td><td>'+esc(t.actif)+'</td><td>'+fmtQty(t.qte)+'</td><td>'+usdc+'</td><td>'+fmtPx(t.prix)+'</td><td class="'+pcls+'">'+pnlTxt+'</td><td>'+link+'</td></tr>';
        }).join('')+'</tbody>';
    }
  }

  function setStatus(txt){
    var st=document.getElementById('tmst');
    if(st) st.textContent=txt+' · '+parisHeure()+' (heure de Paris)';
  }

  function renderAll(){
    renderBot();
    renderBalance();
    renderPosition();
    renderSteps();
    renderAssets();
    renderTrades();
  }

  async function loadTrades(){
    tradesData=await getJson(['trades.json?v=42']);
  }

  async function loadScan(){
    var jobs=ASSETS.map(function(a){
      return Promise.all([klines(a.sym,'1h',120), klines(a.sym,'4h',100)]).then(function(rows){
        scan[a.id]=evalAsset(rows[0], rows[1], lastSellMs(a.id));
        var last1=rows[0]&&rows[0][rows[0].length-1];
        if(last1) prices[a.id]=last1.c;
      });
    });
    // prix USDC = 1 ; ticker pour un prix plus frais si possible
    try{
      var tick=await getJson(BASES.map(function(b){return b+'/api/v3/ticker/price?symbols='+encodeURIComponent(JSON.stringify(ASSETS.map(function(a){return a.sym})))}));
      if(Array.isArray(tick)){
        tick.forEach(function(t){
          var a=ASSETS.find(function(x){return x.sym===t.symbol});
          if(a&&isFinite(+t.price)) prices[a.id]=+t.price;
        });
      }
    }catch(e){}
    await Promise.all(jobs);
  }

  async function refresh(){
    var errors=[];
    try{ if(!tradesData) await loadTrades() }catch(e){ errors.push('journal') }
    try{ await loadScan() }catch(e){ errors.push('bougies') }
    try{ hold=await loadWallet(); holdErr=null }catch(e){ hold=null; holdErr=e; errors.push('portefeuille') }
    if(!errors.length||scan.SOL||scan.ETH||scan.BTC) lastOk=Date.now();
    setLive(Date.now()-lastOk<90000);
    renderAll();
    setStatus(errors.length?('Chargé avec manque : '+errors.join(', ')):'Conditions et soldes à jour');
  }

  function bindMenu(){
    function sync(){
      var hash=(location.hash||'').replace('#','')||'';
      var links=document.querySelectorAll('.menu a');
      for(var i=0;i<links.length;i++){
        var href=(links[i].getAttribute('href')||'').replace('#','');
        links[i].className=(href&&href===hash)?'on':'';
      }
    }
    sync();
    window.addEventListener('hashchange', sync);
    if(location.hash==='#terminal'){
      setTimeout(function(){ ROOT.scrollIntoView({behavior:'smooth',block:'start'}) }, 50);
    }
  }

  var ws=null, wsTimer=null, jupTimer=null, jupBusy=false;

  function startBinanceWs(){
    if(ws){ try{ ws.close(); }catch(e){} ws=null; }
    var streams=['solusdt','ethusdt','btcusdt','bonkusdt','jupusdt','wifusdt'].map(function(s){return s+'@ticker'}).join('/');
    var urls=[
      'wss://stream.binance.com:9443/stream?streams='+streams,
      'wss://data-stream.binance.vision/stream?streams='+streams
    ];
    var idx=0;
    function connect(){
      if(document.visibilityState==='hidden') return;
      var url=urls[idx%urls.length];
      var sock;
      try{ sock=new WebSocket(url); }catch(e){ idx++; wsTimer=setTimeout(connect, 2000); return; }
      ws=sock;
      sock.onopen=function(){ setLive(true); };
      sock.onmessage=function(ev){
        try{
          var msg=JSON.parse(ev.data);
          var d=msg.data||msg;
          var sym=String(d.s||'').toLowerCase();
          var px=+d.c;
          var id=null;
          Object.keys(BINANCE_SYM).forEach(function(k){ if(BINANCE_SYM[k]===sym) id=k; });
          if(id&&isFinite(px)&&px>0){
            prices[id]=px;
            lastOk=Date.now();
            setLive(true);
            renderPosition();
            renderBalance();
          }
        }catch(e){}
      };
      sock.onclose=function(){
        if(ws===sock) ws=null;
        setLive(Date.now()-lastOk<90000);
        wsTimer=setTimeout(function(){ idx++; connect(); }, 2000);
      };
      sock.onerror=function(){ try{ sock.close(); }catch(e){} };
    }
    connect();
  }

  async function loadJupPrices(){
    if(jupBusy) return;
    var ids=[], seen={};
    positionList().forEach(function(p){
      if(usesBinance(p)) return;
      var mint=p.mint;
      if(!mint){
        var id=normActif(p.actif);
        Object.keys(MINTS).forEach(function(m){ if(MINTS[m]===id) mint=m; });
      }
      if(mint&&!seen[mint]){ seen[mint]=1; ids.push(mint); }
    });
    if(!ids.length) return;
    jupBusy=true;
    try{
      var data=await getJson([JUP_PRICE+ids.map(encodeURIComponent).join(',')]);
      Object.keys(data||{}).forEach(function(mint){
        var px=data[mint]&&data[mint].usdPrice;
        var id=MINTS[mint];
        if(id&&isFinite(+px)&&+px>0) prices[id]=+px;
      });
      renderPosition();
      renderBalance();
    }catch(e){}
    jupBusy=false;
  }

  bindMenu();
  loadStatus();
  refresh();
  startBinanceWs();
  loadJupPrices();
  setInterval(refresh, 60000);
  setInterval(loadStatus, 60000);
  setInterval(loadJupPrices, 30000);
  if(botTick) clearInterval(botTick);
  botTick=setInterval(function(){ renderBot(); }, 1000);
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState==='visible'){
      loadStatus();
      refresh();
      loadJupPrices();
      startBinanceWs();
    }else if(ws){
      try{ ws.close(); }catch(e){}
    }
  });
})();
