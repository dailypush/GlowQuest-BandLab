'use strict';
/* GlowQuest Effect Studio — mask, vibration, duration and fade controls. */
(() => {
  const ui = (id) => document.getElementById(id);
  // Remove data from the retired effect-feedback feature.
  try { localStorage.removeItem('glowquest-effect-notes-v1'); } catch (ignored) {}

  const readNum = id => Number(ui(id).value);
  const h = n => (n & 255).toString(16).toUpperCase().padStart(2,'0');
  const masks = {
    0: [0,1,2,3,4], // All five lights
    1: [2],         // Top right
    2: [4],         // Bottom right
    3: [3],         // Bottom left
    4: [1]          // Top left
  };
  const labels = {0:'All LEDs', 1:'Top right LED', 2:'Bottom right LED', 3:'Bottom left LED', 4:'Top left LED'};
  const outcomes = {worked:'Worked', different:'Looked different', none:'No response'};

  function rebuild() {
    const color = readNum('fxColor');
    const mask = readNum('fxMask');
    const vibe = readNum('fxVibration');
    const selectedTime = ui('fxTime').value;
    const extended = selectedTime.startsWith('extended-');
    const time = extended ? Number(selectedTime.slice(9)) : Number(selectedTime);
    const fade = readNum('fxFade');
    // Timing: bit 7 (persistent) ALWAYS 0. Bit 6 switches to extended scaler.
    // Bits 5-4: fade 0..3s; bits 3-0: time value 0..15.
    const timing = (extended ? 0x40 : 0) | (fade << 4) | time;
    const maskAndColor = (mask << 5) | (color & 31);
    const hex = 'E100E90500' + h(timing) + '0E' + h(maskAndColor) + h(0xB0 | vibe);
    const colorHex = PALETTE[color][1];
    const preview = Array(5).fill('#16142e');
    masks[mask].forEach(i => preview[i] = colorHex);
    const description = PALETTE[color][0] + ' • ' + labels[mask] +
      (vibe ? ' • ' + ui('fxVibration').selectedOptions[0].textContent : '');
    select({name:description,emoji:'🧪',hex,wake:true,kind:'studio',colors:preview});
    const approximate = (extended ? 5.5 + 3.1 * time : 6.5 + 1.5 * time).toFixed(1);
    ui('fxEstimate').textContent = 'Estimated band effect: ~' + approximate + ' seconds, plus ~' +
      fade + 's fade. Actual results may differ; short values may blink instead. ' +
      'Phone broadcasting remains limited to a short burst.';
  }

  // The existing filter calls renderShows(). A "studio" filter hides the preset
  // cards, and this panel takes their place without altering existing presets.
  const studioButton = document.querySelector('[data-show="studio"]');
  studioButton.addEventListener('click', () => {
    ui('fxStudio').hidden = false;
    ui('showGrid').hidden = true;
    rebuild();
  });
  document.querySelectorAll('[data-show]').forEach(btn => {
    if (btn === studioButton) return;
    btn.addEventListener('click', () => {
      ui('fxStudio').hidden = true;
      ui('showGrid').hidden = false;
    });
  });

  for (const idx of DISPLAY_PALETTE) {
    const option = document.createElement('option');
    option.value = String(idx);
    option.textContent = PALETTE[idx][0];
    ui('fxColor').appendChild(option);
  }
  ui('fxColor').value = '2';
  for (const id of ['fxColor','fxMask','fxVibration','fxTime','fxFade'])
    ui(id).addEventListener('change', rebuild);
  ui('fxReset').addEventListener('click', () => {
    ui('fxColor').value='2'; ui('fxMask').value='0'; ui('fxVibration').value='0';
    ui('fxTime').value='5'; ui('fxFade').value='1';
    rebuild();
    toast('Effect Studio reset to gentle defaults.');
  });
})();
