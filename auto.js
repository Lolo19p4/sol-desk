// v22 : tout démarre seul à l'ouverture. Ne change ni la logique ni les réglages ; la signature reste dans Phantom.
(function(){var $=function(i){return document.getElementById(i)};
['go','realbtn'].forEach(function(i){$(i).style.display='none'});
if(window.REAL&&!REAL.on)$('realbtn').click();            // RÉEL par défaut (écrit soldesk_real_on=1)
if($('go').textContent.indexOf('Pause')<0)$('go').click(); // démarre les bots (contrôle toutes les 5 s en RÉEL)
$('conn').style.display='none';
function c(){var p=window.phantom&&phantom.solana||window.solana;if(REAL.pk){$('conn').style.display='none';return}
 if(p&&p.connect)p.connect({onlyIfTrusted:true}).then(function(r){REAL.pk=r.publicKey.toString();$('conn').style.display='none'}).catch(function(){$('conn').style.display=''});else $('conn').style.display=''}
setTimeout(c,1500);setInterval(function(){$('conn').style.display=REAL.pk?'none':''},3000);
setTimeout(function(){var b=$('btgo');if(b){b.click()}},4000);
})();
