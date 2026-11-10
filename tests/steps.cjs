'use strict';
const assert = require('node:assert/strict');
const { readFile, mkdir } = require('node:fs/promises');
const { createServer } = require('node:http');
const { join, resolve } = require('node:path');
const { BeforeAll, AfterAll, Before, After, Given, When, Then, Status, setDefaultTimeout } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
setDefaultTimeout(30000);
const images = resolve('reports/screenshots');
const assets = resolve('app/src/main/assets');
let server, appUrl;

BeforeAll(async function () {
  server = createServer(async (req, res) => {
    const file = (req.url || '/').split('?')[0].slice(1) || 'index.html';
    const mime = {'index.html':'text/html','app.js':'application/javascript','fx.js':'application/javascript','scout.js':'application/javascript','fireworks.js':'application/javascript','app.css':'text/css'};
    if (!Object.prototype.hasOwnProperty.call(mime,file)) { res.writeHead(404).end(); return; }
    try {
      const body = await readFile(join(assets,file));
      res.writeHead(200,{'Content-Type':mime[file]+'; charset=utf-8'}); res.end(body);
    } catch(e) { res.writeHead(500).end('Missing bundled app asset'); }
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  appUrl = 'http://127.0.0.1:'+server.address().port+'/index.html';
});
AfterAll(async function () {
  if(server) await new Promise(done=>server.close(done));
});
Before(async function () {
  this.browser = await chromium.launch({headless:true});
  this.context = await this.browser.newContext({
    viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'reduce'
  });
  await this.context.addInitScript(() => {
    window.__glowMock={sent:[],stops:0,scans:0,shows:[],cancels:0,fireworks:{active:false,kind:"",step:0,remainingSeconds:0,total:0,status:"Ready for launch"}};
    window.BandNative={
      status:()=>JSON.stringify({permissions:true,bluetoothOn:true,supported:true,running:false,status:'Ready to play'}),
      transmit:(company,hex,ms,wake)=>window.__glowMock.sent.push({company,hex,ms,wake}),
      stop:()=>{
        window.__glowMock.stops++;
        window.__glowMock.fireworks.active=false;
      },
      startFireworks:(raw)=>{
        const data=JSON.parse(raw);
        window.__glowMock.shows.push({kind:"fireworks",cues:data.cues});
        window.__glowMock.fireworks={active:true,kind:"fireworks",step:1,
          remainingSeconds:60,total:12,status:"Fireworks started"};
        window.onFireworksStatus?.(JSON.stringify(window.__glowMock.fireworks));
      },
      startWalkBy:()=>{
        window.__glowMock.shows.push({kind:"walkby",colors:[16,19,27]});
        window.__glowMock.fireworks={active:true,kind:"walkby",step:1,
          remainingSeconds:15,total:3,status:"Approach: yellow"};
        window.onFireworksStatus?.(JSON.stringify(window.__glowMock.fireworks));
      },
      cancelFireworks:()=>{
        window.__glowMock.cancels++;
        window.__glowMock.fireworks={active:false,kind:"",step:0,
          remainingSeconds:0,total:0,status:"Cancelled — lights off requested"};
        window.onFireworksStatus?.(JSON.stringify(window.__glowMock.fireworks));
      },
      fireworksStatus:()=>JSON.stringify(window.__glowMock.fireworks),
      scanBands:()=>{
        window.__glowMock.scans++;
        window.onScoutStatus(JSON.stringify({scanning:false,status:'Mock scan finished',
          devices:[
            {id:'A',label:'MagicBand+ TEST-A',nameMatch:true,fe03:true,rssi:-43,addressHint:'AA:01',serial:null},
            {id:'B',label:'MagicBand+ TEST-B',nameMatch:true,fe03:true,rssi:-54,addressHint:'AA:02',serial:null}
          ]}));
      },
      stopScanBands:()=>{},
      off:()=>{},enable:()=>{}
    };
  });
  this.page = await this.context.newPage();
});
After(async function (scenario) {
  if(this.page && scenario.result?.status!==Status.PASSED) {
    try {
      await mkdir(images,{recursive:true});
      const name='failed-'+scenario.pickle.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png';
      const png=await this.page.screenshot({path:join(images,name),fullPage:true});
      await this.attach(png,'image/png');
    } catch(e) { console.error('Failure screenshot:',e.message); }
  }
  await this.context?.close();
  await this.browser?.close();
});
Given('GlowQuest is open on a simulated Android phone',async function () {
  await this.page.goto(appUrl,{waitUntil:'load'});
  await this.page.locator('#colorGrid .color-tile').first().waitFor();
  await this.page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}'});
  assert.equal(await this.page.locator('#statusLabel').innerText(),'BLE READY');
});
When('I open the {string} adventure',async function (name) {
  await this.page.locator('.tab[data-page="'+name.toLowerCase()+'"]').click();
});
When('I switch to tablet size',async function () {
  await this.page.setViewportSize({width:820,height:1180});
});
Then('I save a {string} screenshot',async function (name) {
  await mkdir(images,{recursive:true});
  const png=await this.page.screenshot({
    path:join(images,name+'.png'),fullPage:true,animations:'disabled'
  });
  await this.attach(png,'image/png');
});
Then('the screen fits without horizontal scrolling',async function () {
  const size=await this.page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,page:document.documentElement.scrollWidth
  }));
  assert.ok(size.page<=size.viewport+2,'Horizontal overflow: '+JSON.stringify(size));
});
When('I select the {string} color',async function (name) {
  await this.page.locator('.color-tile').filter({hasText:new RegExp('^'+name+'$','i')}).click();
});
Then('the band preview says {string}',async function (name) {
  assert.equal((await this.page.locator('#currentName').innerText()).trim(),name);
});
Then('the packet contains {string}',async function (hex) {
  const raw=(await this.page.locator('#packetHex').innerText()).replace(/\s/g,'');
  assert.ok(raw.endsWith(hex),'Unexpected packet '+raw);
});
When('I press Send Magic',async function () { await this.page.locator('#sendBtn').click(); });
Then('the mock radio gets {string} for company {int}',async function (hex,company) {
  const sent=await this.page.evaluate(()=>window.__glowMock.sent);
  assert.equal(sent.length,1);
  assert.equal(sent[0].company,company);assert.equal(sent[0].hex,hex);
  assert.ok(sent[0].ms>=350&&sent[0].ms<=3500);
});
When('I choose the five-light mixer',async function () {
  await this.page.locator('[data-mix="five"]').click();
});
When('I tap the rainbow-five button',async function () {
  await this.page.locator('#rainbowFive').click();
});
Then('the packet contains five color bytes',async function () {
  const raw=(await this.page.locator('#packetHex').innerText()).replace(/\s/g,'').slice(4);
  assert.match(raw,/^E100E909000E0F[0-9A-F]{10}B0$/);
});
When('I filter to fades',async function () {
  await this.page.locator('[data-show="fade"]').click();
  assert.ok(await this.page.locator('#showGrid .show-card').count()>=5);
});
When('I select the {string} show',async function (name) {
  await this.page.locator('#showGrid .show-card').filter({hasText:name}).click();
});
When('I answer Bluetooth radio',async function () {
  await this.page.locator('[data-quiz="ble"]').click();
});
Then('I see the quiz success message',async function () {
  assert.match(await this.page.locator('#quizAnswer').innerText(),/Correct!/);
});
When('I solve the color challenge',async function () {
  const target=(await this.page.locator('#questTarget').innerText()).trim();
  const names=await this.page.locator('.color-tile').allTextContents();
  const answer=names.find(n=>target.endsWith(n.trim()));
  assert.ok(answer,'No matching color for '+target);
  await this.page.locator('.tab[data-page="colors"]').click();
  await this.page.locator('.color-tile').filter({hasText:new RegExp('^'+answer.trim()+'$','i')}).click();
});
Then('my star score is {int}',async function (score) {
  assert.equal(Number(await this.page.locator('#score').innerText()),score);
});
When('I unlock the grown-up lab',async function () {
  await this.page.locator('#unlockLab').dispatchEvent('pointerdown');
  await this.page.waitForTimeout(1200);
  await this.page.locator('#unlockLab').dispatchEvent('pointerup');
  assert.ok(await this.page.locator('#advanced').isVisible());
});
When('I enter {string} as hex',async function (hex) { await this.page.locator('#hexInput').fill(hex); });
When('I press Send test packet',async function () { await this.page.locator('#sendRaw').click(); });
Then('I see a hex validation warning',async function () {
  assert.match(await this.page.locator('#toast').innerText(),/1–24 complete HEX bytes/);
});
Then('the mock radio has sent nothing',async function () {
  assert.equal(await this.page.evaluate(()=>window.__glowMock.sent.length),0);
});
When('I press Stop signal',async function () { await this.page.locator('#stopBtn').click(); });
Then('the native stop command is requested',async function () {
  assert.equal(await this.page.evaluate(()=>window.__glowMock.stops),1);
});


When('I open the Effect Studio', async function () {
  await this.page.locator('[data-show="studio"]').click();
  assert.ok(await this.page.locator('#fxStudio').isVisible(), 'Studio panel not visible');
});
When('I configure a red top-right double-tap effect with a two-second fade', async function () {
  await this.page.locator('#fxColor').selectOption('21');
  await this.page.locator('#fxMask').selectOption('1');
  await this.page.locator('#fxVibration').selectOption('2');
  await this.page.locator('#fxTime').selectOption('5');
  await this.page.locator('#fxFade').selectOption('2');
});
Then('the effect packet never enables persistent lighting', async function () {
  const raw=(await this.page.locator('#packetHex').innerText()).replace(/\s/g,'').slice(4);
  const timing=parseInt(raw.slice(10,12),16);
  assert.equal(timing & 0x80,0,'Persistent LED flag was unexpectedly set');
});
Then('the feedback prompt appears', async function () {
  assert.ok(await this.page.locator('#fxFeedback').isVisible());
});
When('I mark the effect as working', async function () {
  await this.page.locator('[data-fx-outcome="worked"]').click();
});
Then('the result is saved locally', async function () {
  const entries=await this.page.evaluate(()=>JSON.parse(localStorage.getItem('glowquest-effect-notes-v1')||'[]'));
  assert.equal(entries.length,1);
  assert.equal(entries[0].result,'worked');
  assert.equal(entries[0].hex,'E100E90500090E02B0');
});
When('I turn vibration off',async function () {
  await this.page.locator('#fxVibration').selectOption('0');
});
Then('the FX Studio has no center-only spotlight option',async function () {
  assert.equal(await this.page.locator('#fxMask option').count(),5);
  assert.ok(!(await this.page.locator('#fxMask').innerText()).includes('Center'));
});


When('I choose the 45-second effect mode', async function () {
  await this.page.locator('#fxTime').selectOption('extended-13');
});
Then('the displayed duration is approximately 45 seconds', async function () {
  const val=await this.page.locator('#fxEstimate').innerText();
  assert.match(val,/45\.8 seconds/);
});
When('I scan for unpaired watches', async function () {
  await this.page.locator('#scoutStart').click();
});
Then('two candidate watches appear without pairing', async function () {
  assert.equal(await this.page.locator('.scout-device').count(),2);
  assert.equal(await this.page.evaluate(()=>window.__glowMock.scans),1);
  assert.equal(await this.page.evaluate(()=>window.__glowMock.sent.length),0);
  assert.match(await this.page.locator('.scout-device').first().innerText(),/Serial not verified/);
});
When('I enter serials with even and odd final digits', async function () {
  await this.page.locator('.scout-device input').nth(0).fill('ABC1234');
  await this.page.locator('.scout-device input').nth(1).fill('ABC1235');
});
Then('the first watch previews blue and the second previews red', async function () {
  assert.match(await this.page.locator('.scout-parity').nth(0).innerText(),/BLUE preview/);
  assert.match(await this.page.locator('.scout-parity').nth(1).innerText(),/RED preview/);
  assert.equal(await this.page.evaluate(()=>window.__glowMock.sent.length),0);
});


When('I open the Fireworks Show Creator',async function () {
  await this.page.locator('[data-show="fireworks"]').click();
  assert.ok(await this.page.locator('#fireworksCreator').isVisible());
});
Then('I see twelve timed firework cues',async function () {
  assert.equal(await this.page.locator('.firework-cue').count(),12);
  assert.match(await this.page.locator('#fireworkSummary').innerText(),/every 5 seconds/);
});
When('I launch the 60-second fireworks show',async function () {
  await this.page.locator('#fireworkStart').click();
});
Then('the mock native sequencer gets a 12-cue dramatic show with multiple vibrations',async function () {
  const calls=await this.page.evaluate(()=>window.__glowMock.shows);
  assert.equal(calls.length,1);
  assert.equal(calls[0].kind,'fireworks');
  assert.equal(calls[0].cues.length,12);
  assert.ok(calls[0].cues.filter(c=>c.vibration>0).length>=5);
  assert.ok(calls[0].cues.filter(c=>c.effect!=='color').length>=4);
  assert.equal(await this.page.locator('#fireworkStart').isDisabled(),true);
});
When('I cancel the running show',async function () {
  await this.page.locator('#fireworkCancel').click();
});
Then('the native cancellation is requested and the show becomes idle',async function () {
  assert.equal(await this.page.evaluate(()=>window.__glowMock.cancels),1);
  assert.equal(await this.page.locator('#fireworkStart').isDisabled(),false);
  assert.equal(await this.page.locator('#fireworkCancel').isDisabled(),true);
});
When('I edit the second cue to be a blue double vibration',async function () {
  await this.page.getByLabel('Cue 2 effect').selectOption('color');
  await this.page.getByLabel('Cue 2 color').selectOption('2');
  await this.page.getByLabel('Cue 2 vibration').selectOption('2');
});
When('I save then restore my firework timeline',async function () {
  await this.page.locator('#fireworkSave').click();
  await this.page.locator('#fireworkReset').click();
  await this.page.locator('#fireworkLoad').click();
});
Then('the second cue is restored as blue with double vibration',async function () {
  assert.equal(await this.page.getByLabel('Cue 2 color').inputValue(),'2');
  assert.equal(await this.page.getByLabel('Cue 2 vibration').inputValue(),'2');
});
When('I launch the walk-by demonstration',async function () {
  await this.page.locator('#walkbyStart').click();
});
Then('the native sequencer receives the yellow orange white sweep',async function () {
  const calls=await this.page.evaluate(()=>window.__glowMock.shows);
  assert.equal(calls.length,1);
  assert.equal(calls[0].kind,'walkby');
  assert.deepEqual(calls[0].colors,[16,19,27]);
  assert.match(await this.page.locator('#walkbyStatus').innerText(),/Approach: yellow/);
});
Then('the show explains that it does not target individual watches',async function () {
  assert.match(await this.page.locator('#fireworksCreator').innerText(),/not live proximity sensing/i);
  assert.match(await this.page.locator('#fireworksCreator').innerText(),/all nearby compatible watches/i);
});
