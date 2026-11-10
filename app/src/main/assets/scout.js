'use strict';
/* Band Scout: passive discoveries only. No bonding or GATT writes.
   Names/FE03 advertisements are candidates, not authenticated serial identities.
   Serial-number parity is a LOCAL PREVIEW, never targeted transmission. */
(() => {
  const $s = id => document.getElementById(id);
  const drafts = new Map();
  const state = {scanning:false,status:'Scan nearby watches without pairing.',devices:[]};
  const serialColor = serial => {
    const digits = String(serial || '').replace(/\D/g,'');
    if (!digits) return null;
    return Number(digits[digits.length-1])%2 ? 'red' : 'blue';
  };
  function redraw() {
    const list = $s('scoutDevices');
    list.replaceChildren();
    $s('scoutState').textContent = state.status;
    $s('scoutCount').textContent = state.devices.length + ' candidate(s)';
    $s('scoutStart').disabled = state.scanning;
    $s('scoutStop').disabled = !state.scanning;
    $s('scoutEmpty').hidden = !!state.devices.length;
    for (const [i, dev] of state.devices.entries()) {
      const card = document.createElement('div');
      card.className = 'scout-device';
      const title = document.createElement('strong');
      title.textContent = 'Watch candidate ' + (i+1) + ': ' + dev.label;
      const detail = document.createElement('small');
      detail.textContent = 'RSSI ' + dev.rssi + ' dBm · ID …' + dev.addressHint +
        ' · ' + (dev.nameMatch ? 'MagicBand+ name' : 'FE03 gadget candidate') +
        (dev.fe03 ? ' · FE03 advertised' : '') + ' · Serial not verified';
      const label = document.createElement('label');
      label.textContent = 'Optional serial (from a trusted label or future verified read)';
      const input = document.createElement('input');
      input.type='text'; input.inputMode='text'; input.autocomplete='off';
      input.maxLength=32; input.placeholder='Enter a known serial to preview';
      input.setAttribute('aria-label','Known serial for watch candidate ' + (i+1));
      input.value=drafts.get(dev.id) || '';
      const outcome = document.createElement('span');
      outcome.className='scout-parity';
      function update() {
        drafts.set(dev.id,input.value);
        const color=serialColor(input.value);
        outcome.textContent = color ? (color==='red' ? 'Odd last digit → RED preview' : 'Even last digit → BLUE preview')
          : 'No numeric digit — color unknown';
        outcome.dataset.color = color || 'unknown';
      }
      input.addEventListener('input',update);
      label.appendChild(input);card.append(title,detail,label,outcome);
      update();list.appendChild(card);
    }
  }
  function onScoutStatus(value) {
    let next;
    try {next = typeof value === 'string' ? JSON.parse(value) : value;}
    catch(ignored){return;}
    if (!next || !Array.isArray(next.devices)) return;
    state.scanning = !!next.scanning;
    state.status = String(next.status || '');
    state.devices = next.devices.slice(0,12);
    redraw();
  }
  window.onScoutStatus = onScoutStatus;
  $s('scoutStart').addEventListener('click',() => {
    drafts.clear();
    if (!window.BandNative || !window.BandNative.scanBands) {
      onScoutStatus({scanning:false,status:'Preview only — install the APK to scan for nearby devices.',devices:[]});
      return;
    }
    window.BandNative.scanBands();
  });
  $s('scoutStop').addEventListener('click',() => {
    if (window.BandNative && window.BandNative.stopScanBands) window.BandNative.stopScanBands();
  });
  $s('scoutReset').addEventListener('click',() => {
    drafts.clear();
    onScoutStatus({scanning:false,status:'Candidates cleared on this screen. Scan again to discover nearby devices.',devices:[]});
    if(window.BandNative?.stopScanBands) window.BandNative.stopScanBands();
  });
  redraw();
})();