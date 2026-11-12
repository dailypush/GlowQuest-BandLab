'use strict';
/*
 * Show Capture: private, foreground-only BLE advertisement recording.
 * Replay is NEVER automatic. No Bluetooth addresses or device names are
 * collected; safe export omits all raw manufacturer payload bytes.
 */
(()=>{
  const $=id=>document.getElementById(id);
  const data={
    capturing:false,replaying:false,status:'Ready to record.',
    receivedPackets:0,manufacturerPackets:0,supportedPackets:0,
    unsupportedPackets:0,savedCues:0,droppedCues:0,
    playIndex:0,playTotal:0,elapsedSeconds:0,lastSavedId:''
  };
  let recordings=[],lastList='',lastSaved='';
  const api=window.BandNative||null;
  const ftime=s=>{
    s=Math.max(0,Math.floor(Number(s)||0));
    return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  };
  const native=(name,...args)=>{
    if(!api||typeof api[name]!=='function'){
      $('showCaptureStatus').textContent='Install the Android APK to use recording and replay.';
      return false;
    }
    api[name](...args);
    return true;
  };
  function renderStatus(){
    $('showCaptureStatus').textContent=data.status;
    $('showCaptureStats').textContent=[
      'Elapsed '+ftime(data.elapsedSeconds),
      data.receivedPackets+' BLE advertisements observed',
      data.manufacturerPackets+' matching manufacturer 0x0183',
      data.supportedPackets+' supported-format packets',
      data.savedCues+' recorded effect cues',
      data.unsupportedPackets+' unknown-format packets (not saved)',
      data.droppedCues+' cues beyond the memory limit'
    ].join(' · ');
    $('showCaptureStart').disabled=data.capturing||data.replaying;
    $('showCaptureStop').disabled=!data.capturing;
    $('showCaptureMinutes').disabled=data.capturing||data.replaying;
    $('showCaptureLabel').disabled=data.capturing||data.replaying;
    $('showReplayStop').disabled=!data.replaying;
    $('showReplayPower').disabled=data.capturing||data.replaying;
    $('showReplayAgree').disabled=data.capturing||data.replaying;
    $('showCaptureRunning').hidden=!data.capturing&&!data.replaying;
    $('showCaptureRunning').textContent=data.capturing?
      'Recording is passive. Keep GlowQuest open with the phone screen awake.':
      'Replay is transmitting only because you explicitly started it. Cue '+
        data.playIndex+' / '+data.playTotal+'.';
    for(const button of document.querySelectorAll('[data-replay-id]')){
      button.disabled=data.capturing||data.replaying||!$('showReplayAgree').checked;
    }
  }
  function button(label,action,kind){
    const b=document.createElement('button');
    b.type='button';b.className=kind||'soft-btn';b.textContent=label;
    b.addEventListener('click',action);
    return b;
  }
  function renderLibrary(){
    const list=$('showCaptureLibrary');list.replaceChildren();
    $('showCaptureLibraryCount').textContent=recordings.length+
      (recordings.length===1?' saved recording':' saved recordings');
    if(!recordings.length){
      const blank=document.createElement('p');
      blank.textContent='Nothing saved yet. Start a passive recording during a show.';
      list.append(blank);return;
    }
    for(const clip of recordings){
      const card=document.createElement('div');card.className='show-capture-item';
      const head=document.createElement('strong');
      head.textContent=String(clip.title||'Untitled recording');
      const detail=document.createElement('small');
      const when=Number(clip.capturedAtUtc)>0?
        new Date(clip.capturedAtUtc).toLocaleString():'Unknown date';
      detail.textContent=when+' · '+ftime((clip.durationMs||0)/1000)+
        ' captured · '+clip.supportedCues+' replayable cues · '+
        clip.manufacturerPackets+' vendor packets · '+
        clip.unsupportedPackets+' unknown packet(s)';
      const controls=document.createElement('div');
      controls.className='show-capture-actions';
      const play=button('▶ Replay on my bands',()=>{
        if(!$('showReplayAgree').checked){
          $('showCaptureStatus').textContent='Confirm you are testing on your own bands first.';return;
        }
        native('replayShowCapture',clip.id,Number($('showReplayPower').value));
        $('showCaptureStatus').textContent='Replay requested. Watch nearby bands for results.';
      });
      play.setAttribute('data-replay-id',clip.id);
      play.disabled=data.capturing||data.replaying||!$('showReplayAgree').checked;
      const report=button('Save analysis JSON',()=>{
        native('exportShowCapture',clip.id,false);
      });
      const raw=button('Export replay data (raw)',()=>{
        if(!$('showIncludeRaw').checked){
          $('showCaptureStatus').textContent='Check the raw-data consent box before exporting packet bytes.';
          return;
        }
        native('exportShowCapture',clip.id,true);
      });
      const del=button('Delete',()=>{
        if(del.dataset.confirm!=='yes'){
          del.dataset.confirm='yes';del.textContent='Confirm delete';
          return;
        }
        if(native('deleteShowCapture',clip.id)){
          recordings=recordings.filter(item=>item.id!==clip.id);
          renderLibrary();
        }
      },'text-button');
      controls.append(play,report,raw,del);
      card.append(head,detail,controls);list.append(card);
    }
  }
  function sync(s){
    try{s=typeof s==='string'?JSON.parse(s):s;}catch(ignore){return;}
    if(!s||typeof s.capturing!=='boolean')return;
    Object.assign(data,s);
    renderStatus();
    if(data.lastSavedId&&data.lastSavedId!==lastSaved){
      lastSaved=data.lastSavedId;
      refreshLibrary();
    }
  }
  window.onShowCaptureStatus=sync;
  function refreshLibrary(){
    if(!api?.showCaptureList)return;
    try{
      const response=api.showCaptureList();
      if(response===lastList)return;
      const parsed=JSON.parse(response);
      if(!Array.isArray(parsed))return;
      lastList=response;
      recordings=parsed.filter(x=>typeof x.id==='string').slice(0,10);
      renderLibrary();
    }catch(ignore){}
  }
  function poll(){
    try{
      if(api?.showCaptureStatus)sync(api.showCaptureStatus());
      refreshLibrary();
    }catch(ignore){}
  }
  $('showCaptureStart').addEventListener('click',()=>{
    if(native('startShowCapture',$('showCaptureLabel').value,
      Number($('showCaptureMinutes').value))){
      $('showCaptureStatus').textContent='Capture requested. This is receive-only.';
      setTimeout(poll,350);
    }
  });
  $('showCaptureStop').addEventListener('click',()=>{
    native('stopShowCapture');
    setTimeout(poll,400);
  });
  $('showReplayStop').addEventListener('click',()=>{
    native('stopShowReplay');
    setTimeout(poll,400);
  });
  $('showReplayAgree').addEventListener('change',renderStatus);
  $('showCaptureRefresh').addEventListener('click',()=>{
    lastList='';
    refreshLibrary();
    poll();
  });
  renderStatus();
  renderLibrary();
  poll();
  setInterval(poll,1000);
})();