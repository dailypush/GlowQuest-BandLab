'use strict';
/* 60-second fireworks and 15-second walk-by demonstration.
 * Android owns the schedule on its main looper, never JS timers.
 * Walk-by is a scripted color sweep, not proximity detection.
 */
(()=>{
  const el=id=>document.getElementById(id);
  const memoryKey='glowquest-fireworks-v2';
  const previousMemoryKey='glowquest-fireworks-v1';
  const EFFECTS=[['color','🎨 Color burst'],['sparkle','✨ Sparkle'],['rainbow','🌈 Rainbow'],
    ['purple-flash','💜 Purple flash'],['circle','🌀 Circle'],['pulse','🔮 Pulse']];
  const VIBES=[['0','None'],['1','Single tap'],['2','Double tap'],['3','Triple tap'],
    ['8','Quick flutter'],['7','Long buzz']];
  const MASKS=[['0','All five'],['1','Top right'],['2','Bottom right'],['3','Bottom left'],['4','Top left']];
  const DURATIONS=Array.from({length:17},(_,i)=>i+4);
  const PRESETS=[48,60,96,120,180,240];
  const DEFAULT=[
    ['color',3,0,0],['color',19,0,1],['color',15,0,3],['sparkle',2,0,0],
    ['color',21,0,8],['color',2,1,2],['color',25,0,3],['rainbow',16,0,0],
    ['color',8,4,8],['color',16,0,7],['purple-flash',1,0,0],['color',27,0,3]
  ].map(([effect,color,mask,vibration])=>({effect,color,mask,vibration,holdSeconds:5}));
  const COLOR_TEST=[3,19,15,21,2,25,8,16,27,2,19,27]
    .map((color,i)=>({effect:'color',color,mask:0,
      vibration:[0,1,2,3,0,8,2,3,1,7,8,3][i],holdSeconds:5}));
  let cues=DEFAULT.map(c=>({...c}));
  let state={active:false,kind:'',step:0,remainingSeconds:0,total:0,
    durationSeconds:60,cuesAttempted:0,radioStatus:'Idle',status:'Ready for launch'};
  const totalSeconds=()=>cues.reduce((sum,c)=>sum+c.holdSeconds,0);
  const formatTime=t=>Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
  const rows=[];
  const valid=c=>c&&EFFECTS.some(([name])=>name===c.effect) &&
    Number.isInteger(c.color)&&c.color>=0&&c.color<=31&&c.color!==29&&
    Number.isInteger(c.mask)&&c.mask>=0&&c.mask<=4&&
    [0,1,2,3,7,8].includes(c.vibration)&&Number.isInteger(c.holdSeconds)&&
    c.holdSeconds>=4&&c.holdSeconds<=20;
  const selectControl=(label,pairs,value,apply)=>{
    const s=document.createElement('select');
    s.setAttribute('aria-label',label);
    pairs.forEach(([v,title])=>{
      const o=document.createElement('option');o.value=String(v);o.textContent=title;s.append(o);
    });
    s.value=String(value);
    s.addEventListener('change',()=>{apply(s.value);update();});
    return s;
  };
  function update(){
    let timeOffset=0;
    rows.forEach((row,i)=>{
      const c=cues[i], customizable=c.effect==='color';
      row.effect.value=c.effect;
      row.color.value=String(c.color);row.mask.value=String(c.mask);
      row.vibration.value=String(c.vibration);
      row.hold.value=String(c.holdSeconds);
      row.label.textContent=formatTime(timeOffset);
      timeOffset+=c.holdSeconds;
      row.hold.disabled=state.active;
      row.color.disabled=state.active||!customizable;
      row.mask.disabled=state.active||!customizable;
      row.vibration.disabled=state.active||!customizable;
      row.effect.disabled=state.active;
      const colors={sparkle:'#50b3ff',rainbow:'#efbdfa',
        'purple-flash':'#ae5cff',circle:'#459dff',pulse:'#a361ee'};
      row.swatch.style.background=customizable?PALETTE[c.color][1]:colors[c.effect];
    });
    const vib=cues.filter(c=>c.effect==='color'&&c.vibration!==0).length;
    const animations=cues.filter(c=>c.effect!=='color').length;
    const length=totalSeconds();
    el('fireworkSummary').textContent='12 cues · '+formatTime(length)+' total · '+vib+
      ' vibration cues · '+animations+' built-in animations';
    el('fireworkLength').value=PRESETS.includes(length)?String(length):'custom';
    el('fireworkLength').disabled=state.active;
    el('fireworkWakeEach').disabled=state.active;
    el('fireworkPlanned').textContent=formatTime(length);
    if(!state.active){
      el('fireworkCountdown').textContent=formatTime(length)+' total';
      el('fireworkProgress').max=length;
    }
  }
  function draw(){
    const container=el('fireworkCues');container.replaceChildren();rows.length=0;
    cues.forEach((c,i)=>{
      const root=document.createElement('div');root.className='firework-cue';
      const head=document.createElement('div');head.className='firework-cue-head';
      const label=document.createElement('strong');
      label.textContent='0:'+String(i*5).padStart(2,'0');
      const swatch=document.createElement('span');swatch.className='firework-swatch';
      head.append(label,swatch);
      const controls=document.createElement('div');controls.className='firework-cue-controls';
      const effect=selectControl('Cue '+(i+1)+' effect',EFFECTS,c.effect,v=>c.effect=v);
      const color=selectControl('Cue '+(i+1)+' color',DISPLAY_PALETTE.map(n=>[n,PALETTE[n][0]]),
        c.color,v=>c.color=Number(v));
      const mask=selectControl('Cue '+(i+1)+' LED positions',MASKS,c.mask,v=>c.mask=Number(v));
      const vibration=selectControl('Cue '+(i+1)+' vibration',VIBES,c.vibration,v=>c.vibration=Number(v));
      const hold=selectControl('Cue '+(i+1)+' duration',
        DURATIONS.map(n=>[n,n+' seconds']),c.holdSeconds,
        v=>c.holdSeconds=Number(v));
      controls.append(effect,color,mask,vibration,hold);
      root.append(head,controls);container.append(root);
      rows.push({root,label,swatch,effect,color,mask,vibration,hold});
    });
    update();
  }
  function sync(input){
    let next;
    try{next=typeof input==='string'?JSON.parse(input):input;}catch(ignore){return;}
    if(!next||typeof next.active!=='boolean')return;
    state=next;
    const fire=state.active&&state.kind==='fireworks';
    const walking=state.active&&state.kind==='walkby';
    el('fireworkStart').disabled=state.active;
    el('fireworkCancel').disabled=!fire;
    el('fireworkSave').disabled=state.active;
    el('fireworkLoad').disabled=state.active;
    el('fireworkReset').disabled=state.active;
    el('fireworkReliable').disabled=state.active;
    el('walkbyStart').disabled=state.active;
    el('walkbyCancel').disabled=!walking;
    const length=fire?state.durationSeconds:totalSeconds();
    el('fireworkProgress').max=length;
    el('fireworkProgress').value=fire?Math.max(0,length-state.remainingSeconds):0;
    el('fireworkCountdown').textContent=fire?formatTime(state.remainingSeconds)+' left':formatTime(totalSeconds())+' total';
    el('fireworkStatus').textContent=fire?state.status:state.active?'Walk-by demo running':state.status;
    el('fireworkRadio').textContent=fire?
      state.cuesAttempted+' / 12 cues attempted · Phone BLE: '+state.radioStatus:
      'Phone broadcasts each cue briefly; there is no band acknowledgment.';
    el('walkbyProgress').value=walking?Math.max(0,15-state.remainingSeconds):0;
    el('walkbyStatus').textContent=walking?state.status:state.active?'Fireworks running':'Ready for the sweep';
    rows.forEach((r,i)=>r.root.classList.toggle('firework-now',fire&&i===state.step-1));
    update();
  }
  function poll(){
    if(window.BandNative&&window.BandNative.fireworksStatus) {
      try{sync(window.BandNative.fireworksStatus());}catch(ignore){}
    }
  }
  function launch(method,confirmation) {
    if(!window.BandNative||!window.BandNative[method]){
      toast('Install this Android build to play a show on your bands.');return;
    }
    try {
      if(method==='startFireworks') {
        if(!cues.every(valid))throw Error('Invalid cue timing or effect');
        window.BandNative[method](JSON.stringify({
          cues,wakeEach:el('fireworkWakeEach').checked
        }));
      }
      else window.BandNative[method]();
      toast(confirmation);
      setTimeout(poll,220);
    } catch(err){toast('Could not start: '+err.message);}
  }
  window.onFireworksStatus=sync;
  const filter=document.querySelector('[data-show="fireworks"]');
  document.querySelectorAll('[data-show]').forEach(btn=>btn.addEventListener('click',()=>{
    const chosen=btn===filter;
    el('fireworksCreator').hidden=!chosen;
    el('showGrid').hidden=chosen||btn.dataset.show==='studio';
    el('fxStudio').hidden=btn.dataset.show!=='studio';
  }));
  el('fireworkLength').addEventListener('change',()=>{
    const length=Number(el('fireworkLength').value);
    if(!PRESETS.includes(length))return;
    cues.forEach(c=>c.holdSeconds=length/12);
    draw();
  });
  el('fireworkStart').addEventListener('click',
    ()=>launch('startFireworks','Launching '+formatTime(totalSeconds())+' fireworks show 🎆'));
  el('walkbyStart').addEventListener('click',()=>launch('startWalkBy','Yellow → Orange → White sweep!'));
  for(const id of ['fireworkCancel','walkbyCancel'])
    el(id).addEventListener('click',()=>{
      if(window.BandNative?.cancelFireworks)window.BandNative.cancelFireworks();
      toast('Show cancelled. Lights-off requested.');
      setTimeout(poll,220);
    });
  el('fireworkReset').addEventListener('click',()=>{
    cues=DEFAULT.map(c=>({...c}));draw();toast('Dramatic finale restored.');
  });
  el('fireworkReliable').addEventListener('click',()=>{
    cues=COLOR_TEST.map(c=>({...c}));draw();
    toast('Color-only test loaded to diagnose missed cues.');
  });
  el('fireworkSave').addEventListener('click',()=>{
    try{
      localStorage.setItem(memoryKey,JSON.stringify({
        cues,wakeEach:el('fireworkWakeEach').checked
      }));
      toast('Show and timing saved locally.');
    }
    catch(ignore){toast('Could not save this show.');}
  });
  el('fireworkLoad').addEventListener('click',()=>{
    try{
      let saved=JSON.parse(localStorage.getItem(memoryKey)||'null');
      if(!saved){
        const previous=JSON.parse(localStorage.getItem(previousMemoryKey)||'null');
        if(Array.isArray(previous))
          saved={cues:previous.map(c=>({...c,holdSeconds:5})),wakeEach:true};
      }
      if(!saved||!Array.isArray(saved.cues)||saved.cues.length!==12||
         !saved.cues.every(valid))throw Error('No valid saved 12-cue show');
      cues=saved.cues.map(c=>({...c}));
      el('fireworkWakeEach').checked=saved.wakeEach!==false;
      draw();toast('Saved show and timing restored.');
    }catch(err){toast(err.message);}
  });
  draw();poll();setInterval(poll,700);
})();