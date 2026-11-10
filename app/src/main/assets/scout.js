'use strict';
/* Band Scout diagnostics: read-only BLE scan, no pairing, no individual writes.
   Generic BLE advertisements prove scan reception, not MagicBand identity.
   Addresses are transient and are never uploaded or persisted. */
(() => {
  const el=id=>document.getElementById(id);
  const drafts=new Map();
  const state={scanning:false,status:'Ready to scan.',devices:[],
    receivedPackets:0,uniqueDevices:0,candidateCount:0,showAll:false};
  const serialColor=serial=>{
    const digits=String(serial||'').replace(/\D/g,'');
    if(!digits)return null;
    return Number(digits.at(-1))%2?'red':'blue';
  };
  function redraw() {
    const list=el('scoutDevices');
    list.replaceChildren();
    el('scoutState').textContent=state.status;
    el('scoutCount').textContent=state.candidateCount+' candidate(s)';
    el('scoutTraffic').textContent=
      state.receivedPackets+' advertisements received · '+
      state.uniqueDevices+' distinct BLE device(s)';
    el('scoutStart').disabled=state.scanning;
    el('scoutStop').disabled=!state.scanning;
    el('scoutDiagnostic').disabled=state.scanning;
    const empty=el('scoutEmpty');
    empty.hidden=state.devices.length>0;
    if(state.receivedPackets>0 && state.candidateCount===0){
      empty.textContent='Bluetooth scanning is receiving nearby signals, but no MagicBand+ candidate was identifiable. Try Show all devices and scan with just one watch nearby. A band may respond to commands without advertising its identity.';
    } else if(!state.scanning && state.receivedPackets===0){
      empty.textContent='No BLE advertisements received yet. Try scanning near a known BLE device, and check Bluetooth and scan permissions. A responding band may not advertise.';
    } else {
      empty.textContent='Listening for BLE broadcasts. No devices are listed yet.';
    }
    for(const [i,dev] of state.devices.entries()){
      const card=document.createElement('div');
      card.className='scout-device';
      const title=document.createElement('strong');
      title.textContent=(dev.candidate?'Band candidate ':'BLE device ')+(i+1)+': '+dev.label;
      const detail=document.createElement('small');
      const signs=[dev.nameMatch?'MagicBand name':null,dev.fe03?'FE03':null,
        dev.disneyId?'Disney manufacturer ID 0x0183':null].filter(Boolean);
      detail.textContent='RSSI '+dev.rssi+' dBm · ID …'+dev.addressHint+
        ' · '+(signs.length?signs.join(' + '):'Unidentified BLE device')+
        ' · Serial not verified';
      card.append(title,detail);
      if(dev.candidate){
        const label=document.createElement('label');
        label.textContent='Optional known serial (not read by the scanner)';
        const input=document.createElement('input');
        input.type='text';input.autocomplete='off';input.maxLength=32;
        input.placeholder='Enter known serial for parity preview';
        input.setAttribute('aria-label','Known serial for watch candidate '+(i+1));
        input.value=drafts.get(dev.id)||'';
        const parity=document.createElement('span');parity.className='scout-parity';
        const update=()=>{
          drafts.set(dev.id,input.value);
          const color=serialColor(input.value);
          parity.textContent=color?
            (color==='red'?'Odd last digit → RED preview':'Even last digit → BLUE preview'):
            'No verified serial entered';
          parity.dataset.color=color||'unknown';
        };
        input.addEventListener('input',update);
        label.append(input);card.append(label,parity);update();
      }
      list.append(card);
    }
  }
  function onScoutStatus(data){
    try{data=typeof data==='string'?JSON.parse(data):data;}catch(ignored){return;}
    if(!data||!Array.isArray(data.devices))return;
    state.scanning=!!data.scanning;
    state.status=String(data.status||'');
    state.devices=data.devices.slice(0,36);
    state.receivedPackets=Number(data.receivedPackets)||0;
    state.uniqueDevices=Number(data.uniqueDevices)||0;
    state.candidateCount=Number.isFinite(Number(data.candidateCount))?
      Number(data.candidateCount):state.devices.filter(d=>d.candidate).length;
    state.showAll=!!data.showAll;
    redraw();
  }
  window.onScoutStatus=onScoutStatus;
  el('scoutStart').addEventListener('click',()=>{
    drafts.clear();
    if(!window.BandNative?.scanBands){
      onScoutStatus({scanning:false,status:'Preview only — install the APK to scan.',
        devices:[],receivedPackets:0,uniqueDevices:0,candidateCount:0});return;
    }
    window.BandNative.scanBands(el('scoutDiagnostic').checked);
  });
  el('scoutStop').addEventListener('click',()=>{
    if(window.BandNative?.stopScanBands)window.BandNative.stopScanBands();
  });
  el('scoutReset').addEventListener('click',()=>{
    drafts.clear();
    if(window.BandNative?.clearScanBands)window.BandNative.clearScanBands();
    else onScoutStatus({scanning:false,status:'Scan list cleared.',devices:[],
      receivedPackets:0,uniqueDevices:0,candidateCount:0});
  });
  redraw();
})();