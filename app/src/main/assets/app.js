'use strict';
// GlowQuest: offline, one-tap BLE experiment dashboard for your own wristband.
// Protocol reference: Adafruit 2026 MIT-licensed magicband_protocol.py and command_library.py
const $ = id => document.getElementById(id);
const PALETTE = [
  ['Cyan','#50ffff','🧊'],['Purple','#b400ff','💜'],['Blue','#005aff','💙'],
  ['Midnight blue','#001478','🌙'],['Ocean blue','#2878ff','🌊'],['Bright purple','#c850ff','🔮'],
  ['Lavender','#c8b4ff','🪻'],['Deep purple','#7800ff','🍇'],['Pink','#ff3cb4','🩷'],
  ['Pink 2','#ff46aa','🌺'],['Bubblegum','#ff50a0','🍬'],['Rose','#ff5a96','🌹'],
  ['Blush','#ff6e96','🌸'],['Peach pink','#ff82a0','🍑'],['Soft pink','#ffa0aa','🦩'],
  ['Golden yellow','#ffb400','🌟'],['Sunny yellow','#ffdc00','☀️'],['Amber','#ff8c14','🍯'],
  ['Lime','#b4ff00','🍋'],['Orange','#ff5a00','🍊'],['Red orange','#ff2800','🔥'],
  ['Red','#ff0000','❤️'],['Ice blue','#3cffff','❄️'],['Sky cyan','#28f0ff','☁️'],
  ['Sea cyan','#14c8ff','🐬'],['Green','#00ff00','💚'],['Leaf green','#50ff28','🍃'],
  ['White','#ffe8e0','🤍'],['Soft white','#ffe8e0','✨'],['Off','#11121f','🌌'],
  ['Mystery','#ff8c3c','❔'],['Magenta','#ff00ff','💗']
];
const DISPLAY_PALETTE = PALETTE.map((p,i)=>i).filter(i => ![9,12,23,24,28,29,30].includes(i));
const FIXED = [
  ['Taste the Rainbow','🌈','show','E100E90C000F0F5D465BF005323748B0',false,'Rainbow colors'],
  ['Blink White','⚡','show','E100E90C000F0F5D465BF00532374895',false,'Vibrates'],
  ['Five-color party','🎉','show','E100E90C000F0FB1B9B5B1A2307B7DB0',false,'Changing colors'],
  ['Ocean parade','🚢','show','E100E90C000F0FA3AFB5A3AF307B7DB7',false,'Color cycle + buzz'],
  ['Cyan → Pink','🩵','fade','E100E911006F0F564858F44882D1460208D06500B0',true,'Slow color change'],
  ['Blue → Yellow','🌞','fade','E200E911004F0F444F58F44882D1460607D06543B0',true,'Color fade'],
  ['Pink → Green','🌷','fade','E100E911000F0F485958F44882D146020DD06505B0',false,'Color fade'],
  ['Orange → Red','🍁','fade','E200E911004F0F4F5558F44882D146022AD06501B0',true,'Color fade'],
  ['Lime → Purple','🍇','fade','E100E91100010F5A475BF03134374894D13D0507B0',false,'Color fade'],
  ['Red → Off','🌒','fade','E100E91100070F555D58F44882D1460508D06500B0',true,'Fades to dark'],
  ['Orange → Blue','🌅','fade','E100E91100440F514258F44882D146050FD06500B0',true,'Color fade'],
  ['Blue Circle','🌀','animation','E200E91200030FA2A2A4A4A230D037F4D2460064FCB8',true,'Buzzing circle'],
  ['Purple Flash','💜','animation','E100E90E00010FBDA0A0BDA059070048AEB5',true,'Vibrates'],
  ['Blue & Orange','🐠','animation','E100E90F00110F4F425807488DD2462A0717B8',true,'Buzz + two colors'],
  ['Blue Sparkle','✨','animation','E100E91000134897D00EA0D146060F30D04E07B0',true,'Sparkly effect'],
  ['Purple Pulse','🔮','animation','E100E9130002D037F0D23D0505000EFA8983510EE7A0B0',true,'Pulsing glow'],
  ['Holiday Flash','🎄','animation','E200E91400420F555B58F44882D0651BD1462A02307B5DB0',false,'Festive lights']
];
const toHex = x => (x&255).toString(16).toUpperCase().padStart(2,'0');
const single = (idx,mask=0,vib=0) => 'E100E90500090E'+toHex((mask<<5)|(idx&31))+toHex(0xB0|(vib&15));
const dual = (a,b) => 'E200E90600220F'+toHex(0x40|(a&31))+toHex(0x40|(b&31))+'B0';
const five = ([c,tl,tr,bl,br]) => 'E100E909000E0F'+[tl,bl,br,tr,c].map(x=>toHex(0xA0|(x&31))).join('')+'B0';
const sixbit = (r,g,b) => 'E100E908000ED255'+[r,g,b].map(x=>toHex((x&63)*2)).join('')+'B0';
const paletteColor = idx => PALETTE[idx][1];
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const TX_LABELS=['Ultra Low','Low','Medium','High'];
let chosenTxPower=2;
try{
  const storedText=localStorage.getItem('glowquest-default-tx-power-v1');
  if(storedText!==null){
    const stored=Number(storedText);
    if(Number.isInteger(stored)&&stored>=0&&stored<=3)chosenTxPower=stored;
  }
}catch(ignored){}

const broadcast = (company,raw,ms,wake) => {
  if(!window.BandNative){ toast('Preview mode — install Android app to broadcast 📱');return; }
  try {
    window.BandNative.transmit(company,raw,ms,wake,chosenTxPower);
    toast('Sending at '+TX_LABELS[chosenTxPower]+' power (requested) 📡');
  }
  catch(e){toast('Could not start: '+e.message);}
};
let selected={name:'Blue',emoji:'💙',hex:single(2),wake:false, colors:Array(5).fill(paletteColor(2)),kind:'single',idx:2};
let currentPage='colors', currentMix='two', mixSide=0, inner=21, outer=2;
let ledColorIdx=[21,2,25,8,15],ledTarget=0, rgb=[35,0,63];
let questIndex=pick(DISPLAY_PALETTE), questScore=0;
try { questScore=Number(localStorage.getItem('glowquest-stars')||0) || 0; } catch(ignore) { /* Preview browsers can block storage. */ }
let lastSend=0,toastTimer=null;
function toast(message){const t=$('toast'); t.textContent=message;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3200);}
function setPreview(colors){
  const ids=['ledC','ledTL','ledTR','ledBL','ledBR'];
  ids.forEach((id,i)=>$(id).style.setProperty('--lit',colors[i]||'#eeeeff'));
  $('watchGlow').style.setProperty('--glow',colors[0]||'#a885ff');
}
function select(command){
  selected=command;
  $('currentName').textContent=command.name;
  $('selectedEmoji').textContent=command.emoji;
  $('sendText').textContent='SEND '+(command.kind==='show'?'THE SHOW!':'MAGIC!');
  $('sendIcon').textContent=command.kind==='show'?'🎇':'✨';
  setPreview(command.colors||Array(5).fill('#e8a7ff'));
  $('packetHex').textContent='83 01  '+command.hex.match(/.{1,2}/g).join(' ');
  $('packetParts').innerHTML='<span>83 01 · company</span><span>'+command.hex.slice(0,8)+' · command</span><span>'+command.hex.slice(8)+' · parameters</span>';
  $('packetHelp').textContent=command.name+' • '+(command.wake?'Includes a short wake-up ping':'Single light command');
  document.querySelectorAll('.color-tile').forEach(el=>el.classList.toggle('selected',command.kind==='single'&&Number(el.dataset.idx)===command.idx));
  document.querySelectorAll('.show-card').forEach(el=>el.classList.toggle('selected',command.kind==='show'&&Number(el.dataset.showidx)===command.index));
}
function selectColor(idx, checkQuest=true){
  const p=PALETTE[idx];
  const c={name:p[0],emoji:p[2],hex:single(idx),wake:![2,5].includes(idx),colors:Array(5).fill(p[1]),kind:'single',idx};
  select(c);
  if(checkQuest && idx===questIndex){
    questScore++;
    try { localStorage.setItem('glowquest-stars',String(questScore)); } catch(ignore) { }
    $('score').textContent=questScore;
    $('questResult').textContent='You found it! ⭐ +1 star!';
    toast('You earned a detective star! 🌟');
    // Advance challenge after a correct pick, but not on every tap.
    const prev=questIndex;
    do{questIndex=pick(DISPLAY_PALETTE);}while(questIndex===prev);
    setTimeout(updateQuest,1200);
  }
}
function setPage(page){
  currentPage=page;
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===page));
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderColors(){
  const grid=$('colorGrid'); grid.textContent='';
  DISPLAY_PALETTE.forEach(idx=>{
    const el=document.createElement('button');el.className='color-tile';el.type='button';el.dataset.idx=idx;
    el.style.setProperty('--color',paletteColor(idx));
    el.innerHTML='<span class="color-orb"></span><span></span>';
    el.lastElementChild.textContent=PALETTE[idx][0];
    el.addEventListener('click',()=>selectColor(idx));grid.appendChild(el);
  });
}
function renderMixSwatches(target){
  const container=$(target);container.textContent='';
  DISPLAY_PALETTE.forEach(idx=>{
    if(idx===29) return;
    const btn=document.createElement('button');btn.className='mix-swatch';btn.type='button';btn.style.setProperty('--color',paletteColor(idx));
    btn.setAttribute('aria-label',PALETTE[idx][0]);
    btn.classList.toggle('selected',target==='mixSwatches'?idx===(mixSide?outer:inner):idx===ledColorIdx[ledTarget]);
    btn.addEventListener('click',()=>{
      if(target==='mixSwatches') { if(mixSide)outer=idx;else inner=idx;renderMixSwatches('mixSwatches');updateMix(); }
      else {ledColorIdx[ledTarget]=idx;renderMixSwatches('ledColors');updateMix(); }
    });container.appendChild(btn);
  });
}
function setMixMode(mode){
  currentMix=mode;
  document.querySelectorAll('[data-mix]').forEach(b=>b.classList.toggle('active',b.dataset.mix===mode));
  document.querySelectorAll('.mix-panel').forEach(p=>p.classList.toggle('active',p.id==='mix-'+mode));
  updateMix();
}
function updateMix(){
  if(currentMix==='two'){
    $('innerName').textContent=PALETTE[inner][0];$('outerName').textContent=PALETTE[outer][0];
    select({name:PALETTE[inner][0]+' + '+PALETTE[outer][0],emoji:'👯',hex:dual(inner,outer),wake:true,colors:[paletteColor(inner),paletteColor(outer),paletteColor(outer),paletteColor(outer),paletteColor(outer)],kind:'mix'});
    document.querySelectorAll('.mix-labels>div').forEach((e,i)=>{e.style.borderColor=i===mixSide?'#f3b9ff':'#6a568a';e.style.background=i===mixSide?'#59418b':'transparent'});
  } else if(currentMix==='five'){
    select({name:'Five-light masterpiece',emoji:'⭐',hex:five(ledColorIdx),wake:true,colors:ledColorIdx.map(paletteColor),kind:'mix'});
    document.querySelectorAll('.led-picks button').forEach((b,i)=>b.classList.toggle('active',i===ledTarget));
  } else {
    const [r,g,b]=rgb;
    const rgbCol=`rgb(${Math.round(r*255/63)},${Math.round(g*255/63)},${Math.round(b*255/63)})`;
    $('rgbSample').style.background=rgbCol;
    ['r','g','b'].forEach((c,i)=>$(c+'Value').textContent=rgb[i]);
    select({name:'My secret RGB color',emoji:'🧪',hex:sixbit(r,g,b),wake:true,colors:Array(5).fill(rgbCol),kind:'mix'});
  }
}
function buildMix(){
  renderMixSwatches('mixSwatches');renderMixSwatches('ledColors');
  const target=$('ledTargetButtons');target.textContent='';
  ['Center','Top left','Top right','Bottom left','Bottom right'].forEach((name,i)=>{
    const b=document.createElement('button');b.type='button';b.textContent=(i===0?'🌟 ':'💡 ')+name;
    b.addEventListener('click',()=>{ledTarget=i;renderMixSwatches('ledColors');updateMix();});target.appendChild(b);
  });
  const pairs=[['❤️💙',21,2],['🍊🧊',19,22],['🩷🍋',8,18],['💜🌟',1,15],['💚❤️',25,21],['🤍💙',27,2]];
  pairs.forEach(([emoji,i,o])=>{
    const b=document.createElement('button');b.type='button';b.textContent=emoji+' '+PALETTE[i][0]+' & '+PALETTE[o][0];
    b.addEventListener('click',()=>{inner=i;outer=o;renderMixSwatches('mixSwatches');setMixMode('two');});
    $('pairPicks').appendChild(b);
  });
  document.querySelectorAll('.mix-labels>div').forEach((e,i)=>e.addEventListener('click',()=>{mixSide=i;renderMixSwatches('mixSwatches');updateMix();}));
  ['r','g','b'].forEach((c,i)=>$(c+'Slider').addEventListener('input',e=>{rgb[i]=Number(e.target.value);updateMix();}));
  document.querySelectorAll('[data-mix]').forEach(b=>b.addEventListener('click',()=>setMixMode(b.dataset.mix)));
  $('rainbowFive').addEventListener('click',()=>{ledColorIdx=[21,19,15,25,2];renderMixSwatches('ledColors');updateMix();});
  $('surpriseBtn').addEventListener('click',()=>{
    if(currentMix==='two'){inner=pick(DISPLAY_PALETTE);outer=pick(DISPLAY_PALETTE);renderMixSwatches('mixSwatches');}
    if(currentMix==='five'){ledColorIdx=Array.from({length:5},()=>pick(DISPLAY_PALETTE));renderMixSwatches('ledColors');}
    if(currentMix==='rgb'){rgb=Array.from({length:3},()=>Math.floor(Math.random()*64));['r','g','b'].forEach((c,i)=>$(c+'Slider').value=rgb[i]);}
    updateMix();toast('What an awesome surprise! 🎲');
  });
}
function renderShows(filter='all'){
  const grid=$('showGrid');grid.textContent='';
  FIXED.forEach((item,i)=>{
    if(filter!=='all'&&item[2]!==filter)return;
    const b=document.createElement('button');b.type='button';b.className='show-card';b.dataset.showidx=i;
    const em=document.createElement('span');em.className='show-emoji';em.textContent=item[1];
    const name=document.createElement('strong');name.textContent=item[0];
    const desc=document.createElement('small');desc.textContent=item[5];
    b.append(em,name,desc);
    b.addEventListener('click',()=>{
      select({name:item[0],emoji:item[1],hex:item[3],wake:item[4],kind:'show',index:i,
        colors:[PALETTE[[21,1,2,25,15][i%5]][1],PALETTE[(i*3)%26][1],'#ffc05c','#b5a3ff','#9cf6f7']});
    });
    grid.appendChild(b);
  });
}
function updateQuest(){
  $('score').textContent=questScore;
  $('questTarget').textContent=PALETTE[questIndex][2]+' '+PALETTE[questIndex][0];
}
function checkStatus(){
  if(!window.BandNative){$('statusLabel').textContent='PREVIEW';$('connectionMessage').textContent='Preview mode. Install the APK to broadcast with an Android radio.';return;}
  try {handleStatus(BandNative.status());}catch(e){$('connectionMessage').textContent='Device status unavailable: '+e.message;}
}
function handleStatus(json){
  let data;try{data=typeof json==='string'?JSON.parse(json):json;}catch(e){return;}
  const pill=$('statusPill'); pill.classList.remove('ready');
  const box=$('connection'); box.classList.remove('ready');
  if(data.supported){pill.classList.add('ready');box.classList.add('ready');$('statusLabel').textContent=data.running?'SENDING':'BLE READY';$('connectionMessage').textContent=data.running?'📡 '+data.status:'✨ This phone can send magic BLE signals!';$('enableBtn').hidden=true;}
  else {$('statusLabel').textContent='SETUP';$('connectionMessage').textContent=!data.permissions?'Please allow Nearby devices.':!data.bluetoothOn?'Bluetooth is off.':'This device may not support BLE advertising.';$('enableBtn').hidden=false;}
  if(data.status&&!/^(Ready to play|Signal sent! Watch your band ✨)$/.test(data.status) && (/failed|error|couldn|too large|permission|unsupported|busy/i).test(data.status)){
    const prev=$('connection').dataset.lastError;
    if(prev!==data.status)toast(data.status);
    $('connection').dataset.lastError=data.status;
  }
}
function sendSelected(){
  const now=Date.now();if(now-lastSend<900){toast('One sparkle at a time! ✨');return;}lastSend=now;
  document.getElementById('watchFace').classList.remove('burst');void $('watchFace').offsetWidth;$('watchFace').classList.add('burst');
  broadcast(0x0183,selected.hex,1800,selected.wake);
  setTimeout(checkStatus,550);
}
function installEvents(){
  $('globalTxPower').value=String(chosenTxPower);
  $('globalTxPower').addEventListener('change',()=>{
    const next=Number($('globalTxPower').value);
    chosenTxPower=Number.isInteger(next)&&next>=0&&next<=3?next:2;
    try{localStorage.setItem('glowquest-default-tx-power-v1',String(chosenTxPower));}catch(ignored){}
    toast('Color and animation power: '+TX_LABELS[chosenTxPower]+' (requested)');
  });
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>setPage(t.dataset.page)));
  $('sendBtn').addEventListener('click',sendSelected);
  $('offBtn').addEventListener('click',()=>{
    if(window.BandNative){BandNative.off();toast('Sent lights-off command 🌙');}else toast('Preview: lights off 🌙');
    setPreview(Array(5).fill('#151127'));setTimeout(checkStatus,400);
  });
  $('stopBtn').addEventListener('click',()=>{
    if(window.BandNative)BandNative.stop();toast('Stopped broadcasting. An effect already received may keep playing.');setTimeout(checkStatus,250);
  });
  $('enableBtn').addEventListener('click',()=>window.BandNative&&BandNative.enable());
  $('statusPill').addEventListener('click',()=>{checkStatus(); if(window.BandNative && $('statusLabel').textContent!=='BLE READY' && $('statusLabel').textContent!=='SENDING')BandNative.enable();});
  $('newQuest').addEventListener('click',()=>{questIndex=pick(DISPLAY_PALETTE);updateQuest();$('questResult').textContent='Find it in the Colors adventure!';});
  document.querySelectorAll('[data-show]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-show]').forEach(x=>x.classList.toggle('active',x===b));renderShows(b.dataset.show);}));
  document.querySelectorAll('[data-quiz]').forEach(b=>b.addEventListener('click',()=>{$('quizAnswer').textContent=b.dataset.quiz==='ble'?'⭐ Correct! Bluetooth Low Energy sends our light-show broadcasts.':'Not quite! Try Bluetooth radio 📡';}));
  let holdTimer=null;
  const lab=$('unlockLab');
  const unlock=()=>{lab.textContent='🔓 Lab unlocked';lab.setAttribute('aria-expanded','true');$('advanced').hidden=false;toast('Grown-up lab unlocked! 🔬');};
  ['pointerdown','touchstart'].forEach(ev=>lab.addEventListener(ev,()=>{clearTimeout(holdTimer);holdTimer=setTimeout(unlock,1100);},{passive:true}));
  ['pointerup','pointercancel','pointerleave','touchend'].forEach(ev=>lab.addEventListener(ev,()=>clearTimeout(holdTimer),{passive:true}));
  $('lockLab').addEventListener('click',()=>{$('advanced').hidden=true;lab.textContent='🔒 Press and hold to unlock';lab.setAttribute('aria-expanded','false');});
  $('sendRaw').addEventListener('click',()=>{
    const company=$('company').value.trim(), data=$('hexInput').value.replace(/[\s:-]/g,'').toUpperCase();
    if(!/^[0-9A-Fa-f]{4}$/.test(company)){toast('Company ID needs exactly 4 HEX digits');return;}
    if(!/^(?:[0-9A-F]{2}){1,24}$/.test(data)){toast('Please enter 1–24 complete HEX bytes');return;}
    const ms=Number($('duration').value), wake=$('wake').checked;
    broadcast(parseInt(company,16),data,ms,wake);setTimeout(checkStatus,450);
  });
}
window.onBandStatus = handleStatus;
renderColors();buildMix();renderShows();updateQuest();installEvents();selectColor(2,false);checkStatus();
setInterval(checkStatus,2200);
