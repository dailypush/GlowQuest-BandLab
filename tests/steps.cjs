'use strict';
const assert = require('node:assert/strict');
const { readFile, mkdir } = require('node:fs/promises');
const { createServer } = require('node:http');
const { join, resolve } = require('node:path');
const { BeforeAll, AfterAll, Before, After, Given, When, Then, Status, setDefaultTimeout } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
setDefaultTimeout(30000);
const images = resolve('reports/screenshots');
const readmePreviews = resolve('reports/readme-previews');
const assets = resolve('app/src/main/assets');
let server, appUrl;

BeforeAll(async function () {
  server = createServer(async (req, res) => {
    const file = (req.url || '/').split('?')[0].slice(1) || 'index.html';
    const mime = {'index.html':'text/html','app.js':'application/javascript','fx.js':'application/javascript','scout.js':'application/javascript','show-capture.js':'application/javascript','fireworks.js':'application/javascript','app.css':'text/css'};
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
    window.__glowMock={captureStarts:[],captureStops:0,capturePlays:[],capturePlayStops:0,captureExports:[],captureDeletes:[],captureList:[],captureState:{capturing:false,replaying:false,status:'Ready to capture a show.',elapsedSeconds:0,receivedPackets:0,manufacturerPackets:0,supportedPackets:0,unsupportedPackets:0,savedCues:0,droppedCues:0,playIndex:0,playTotal:0,lastSavedId:'',researchSources:0,researchSamples:0,droppedResearchSamples:0,liveSources:[]},sent:[],stops:0,scans:0,scanModes:[],clears:0,copiedReport:null,shows:[],rangeTests:[],cancels:0,fireworks:{active:false,kind:"",step:0,remainingSeconds:0,total:0,status:"Ready for launch"}};
    window.BandNative={
      status:()=>JSON.stringify({permissions:true,bluetoothOn:true,supported:true,running:false,status:'Ready to play'}),
      transmit:(company,hex,ms,wake,txPower)=>window.__glowMock.sent.push({company,hex,ms,wake,txPower}),
      stop:()=>{
        window.__glowMock.stops++;
        window.__glowMock.fireworks.active=false;
      },
      startFireworks:(raw)=>{
        const data=JSON.parse(raw);
        window.__glowMock.shows.push({kind:"fireworks",cues:data.cues,wakeEach:data.wakeEach});
        window.__glowMock.fireworks={active:true,kind:"fireworks",step:1,
          remainingSeconds:60,total:12,status:"Fireworks started"};
        window.onFireworksStatus?.(JSON.stringify(window.__glowMock.fireworks));
      },
      startWalkBy:(raw)=>{
        const requested=JSON.parse(raw);
        window.__glowMock.shows.push({kind:"walkby",colors:[16,19,27],powers:requested.powers});
        window.__glowMock.fireworks={active:true,kind:"walkby",step:1,
          remainingSeconds:15,total:3,status:"Approach: yellow"};
        window.onFireworksStatus?.(JSON.stringify(window.__glowMock.fireworks));
      },
      testRange:(stage,power)=>{window.__glowMock.rangeTests.push({stage,power});},
      cancelFireworks:()=>{
        window.__glowMock.cancels++;
        window.__glowMock.fireworks={active:false,kind:"",step:0,
          remainingSeconds:0,total:0,status:"Cancelled — lights off requested"};
        window.onFireworksStatus?.(JSON.stringify(window.__glowMock.fireworks));
      },
      fireworksStatus:()=>JSON.stringify(window.__glowMock.fireworks),
      scoutEnvironment:()=>JSON.stringify({api:35,phone:'Mock Android',
        available:true,bluetoothOn:true,scanPermission:true,scannerReady:true,
        legacyLocationRequired:false,legacyLocationOn:true,
        foreground:true,scanning:false}),
      copyScoutReport:(report)=>{window.__glowMock.copiedReport=report;},
      scanBands:(all)=>{
        window.__glowMock.scans++;
        window.__glowMock.scanModes.push(all);
        const candidates=[
          {id:'A',label:'MagicBand+ TEST-A',nameMatch:true,fe03:true,disneyId:false,candidate:true,rssi:-43,addressHint:'AA:01',serial:null},
          {id:'B',label:'Possible BLE band',nameMatch:false,fe03:false,disneyId:true,candidate:true,rssi:-54,addressHint:'AA:02',serial:null}
        ];
        const extra={id:'C',label:'Unnamed BLE device',nameMatch:false,fe03:false,
          disneyId:false,candidate:false,rssi:-61,addressHint:'AA:03',serial:null};
        window.onScoutStatus(JSON.stringify({scanning:false,status:'Mock scan finished',
          receivedPackets:25,uniqueDevices:3,candidateCount:2,showAll:all,
          devices:all?[...candidates,extra]:candidates}));
      },
      clearScanBands:()=>{
        window.__glowMock.clears++;
        window.onScoutStatus(JSON.stringify({scanning:false,status:'Scan list cleared',
          receivedPackets:0,uniqueDevices:0,candidateCount:0,devices:[]}));
      },
      stopScanBands:()=>{},
      showCaptureStatus:()=>JSON.stringify(window.__glowMock.captureState),
      showCaptureList:()=>JSON.stringify(window.__glowMock.captureList),
      showCaptureSources:(id)=>JSON.stringify([
        {id:'S001',address:'AA:BB:CC:DD:EE:01',deviceName:'Beacon Alpha',
         packets:27,disneyPackets:18,knownEffectPackets:3,unknownDisneyPackets:15,
         rssiAverageDbm:-52,rssiMinDbm:-60,rssiMaxDbm:-40,advertisedTxPowerDbm:4},
        {id:'S002',address:'AA:BB:CC:DD:EE:02',deviceName:'Beacon Beta',
         packets:15,disneyPackets:13,knownEffectPackets:0,unknownDisneyPackets:13,
         rssiAverageDbm:-72,rssiMinDbm:-83,rssiMaxDbm:-65,advertisedTxPowerDbm:null}
      ]),
      startShowCapture:(title,minutes)=>{
        window.__glowMock.captureStarts.push({title,minutes});
        Object.assign(window.__glowMock.captureState,{
          capturing:true,replaying:false,status:'Passive recording started.',
          receivedPackets:58,manufacturerPackets:31,supportedPackets:21,
          unsupportedPackets:10,savedCues:3,elapsedSeconds:14,
          researchSources:2,researchSamples:35,droppedResearchSamples:0,
          liveSources:[
            {id:'S001',address:'AA:BB:CC:DD:EE:01',packets:27,
              disneyPackets:18,rssiAverageDbm:-52,advertisedTxPowerDbm:4},
            {id:'S002',address:'AA:BB:CC:DD:EE:02',packets:15,
              disneyPackets:13,rssiAverageDbm:-72,advertisedTxPowerDbm:null}
          ]
        });
        window.onShowCaptureStatus?.(JSON.stringify(window.__glowMock.captureState));
      },
      stopShowCapture:()=>{
        window.__glowMock.captureStops++;
        window.__glowMock.captureList.push({
          id:'glowshow_1794400000000_abcd1234',title:'Evening show',
          capturedAtUtc:1794400000000,durationMs:15000,
          supportedCues:3,manufacturerPackets:31,unsupportedPackets:10,sources:2
        });
        Object.assign(window.__glowMock.captureState,{
          capturing:false,status:'Recording saved locally.',lastSavedId:'glowshow_1794400000000_abcd1234'
        });
        window.onShowCaptureStatus?.(JSON.stringify(window.__glowMock.captureState));
      },
      replayShowCapture:(id,power,sourceId)=>{
        window.__glowMock.capturePlays.push({id,power,sourceId});
        Object.assign(window.__glowMock.captureState,{
          replaying:true,playIndex:1,playTotal:3,status:'Replaying 1 / 3'
        });
        window.onShowCaptureStatus?.(JSON.stringify(window.__glowMock.captureState));
      },
      stopShowReplay:()=>{
        window.__glowMock.capturePlayStops++;
        Object.assign(window.__glowMock.captureState,{
          replaying:false,status:'Replay stopped — lights off requested.'
        });
        window.onShowCaptureStatus?.(JSON.stringify(window.__glowMock.captureState));
      },
      exportShowCapture:(id,raw)=>window.__glowMock.captureExports.push({id,raw}),
      deleteShowCapture:(id)=>{
        window.__glowMock.captureDeletes.push(id);
        window.__glowMock.captureList=window.__glowMock.captureList.filter(x=>x.id!==id);
      },
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
  assert.match(await this.page.locator('#fireworkSummary').innerText(),/1:00 total/);
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
  assert.ok(calls[0].cues.filter(c=>c.effect!=='color').length>=3);
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


Then('the effect feedback and history controls are absent',async function () {
  assert.equal(await this.page.locator('#fxFeedback,#fxHistoryItems,#fxClearNotes').count(),0);
});
When('I enable all BLE diagnostics',async function () {
  await this.page.locator('#scoutDiagnostic').check();
});
Then('the scanner shows received packets and a generic BLE device',async function () {
  assert.match(await this.page.locator('#scoutTraffic').innerText(),/25 advertisements received/);
  assert.equal(await this.page.locator('.scout-device').count(),3);
  assert.equal(await this.page.evaluate(()=>window.__glowMock.scanModes.at(-1)),true);
  assert.equal(await this.page.evaluate(()=>window.__glowMock.sent.length),0);
});
When('I clear the scan results',async function () {
  await this.page.locator('#scoutReset').click();
});
Then('the scan counts and device list are cleared',async function () {
  assert.equal(await this.page.locator('.scout-device').count(),0);
  assert.match(await this.page.locator('#scoutTraffic').innerText(),/^0 advertisements received/);
  assert.equal(await this.page.evaluate(()=>window.__glowMock.clears),1);
});


Then('the Scout scanner health panel displays Android permissions',async function () {
  assert.match(await this.page.locator('#scoutHealth').innerText(),/Scan permission GRANTED/);
  assert.match(await this.page.locator('#scoutHealth').innerText(),/Scanner READY/);
});
When('I copy the Scout diagnostic report',async function () {
  await this.page.locator('#scoutCopyReport').click();
});
Then('the report includes packet counts without Bluetooth identifiers',async function () {
  const report=await this.page.evaluate(()=>window.__glowMock.copiedReport);
  assert.match(report,/Received packets: 25/);
  assert.match(report,/Scan permission granted: true/);
  assert.doesNotMatch(report,/AA:01|AA:02|AA:03/);
});
When('I simulate a silent active BLE scan',async function () {
  await this.page.evaluate(()=>window.onScoutStatus(JSON.stringify({
    scanning:true,status:'Scanning all BLE advertisements for 20 seconds…',
    receivedPackets:0,uniqueDevices:0,candidateCount:0,devices:[],
    scanFailureCode:0
  })));
});
Then('the Scout screen clearly shows active scanning',async function () {
  assert.match(await this.page.locator('#scoutState').innerText(),/SCANNING/);
  assert.ok(await this.page.locator('#scoutStop').isEnabled());
});
When('I choose a two minute fireworks show',async function () {
  await this.page.locator('#fireworkLength').selectOption('120');
});
Then('each firework cue lasts ten seconds',async function () {
  assert.equal(await this.page.locator('.firework-cue').count(),12);
  assert.deepEqual(await this.page.locator('.firework-cue select[aria-label$="duration"]')
    .evaluateAll(els=>els.map(x=>x.value)),Array(12).fill('10'));
  assert.match(await this.page.locator('#fireworkSummary').innerText(),/2:00 total/);
});
When('I customize the first firework cue to seven seconds',async function () {
  await this.page.getByLabel('Cue 1 duration').selectOption('7');
});
Then('the cue timeline shows the updated custom duration',async function () {
  assert.match(await this.page.locator('#fireworkSummary').innerText(),/1:02 total/);
  assert.equal(await this.page.locator('#fireworkLength').inputValue(),'custom');
});
Then('the Android show request includes per cue timing and wake setting',async function () {
  const shows=await this.page.evaluate(()=>window.__glowMock.shows);
  assert.equal(shows.length,1);
  assert.equal(shows[0].cues.length,12);
  assert.ok(shows[0].cues.every(c=>c.holdSeconds===10));
  assert.equal(shows[0].wakeEach,true);
});


When('I open the Range Lab', async function () {
  assert.ok(await this.page.locator('#rangeLab').isVisible());
});
Then('I see yellow orange and white power controls with conservative defaults', async function () {
  assert.equal(await this.page.locator('.range-stage').count(),3);
  assert.deepEqual(await this.page.locator('.range-stage select')
    .evaluateAll(elements=>elements.map(e=>e.value)),['3','1','0']);
});
When('I set yellow to low power and test it', async function () {
  await this.page.getByLabel('Yellow transmission power').selectOption('1');
  await this.page.locator('#rangeTest0').click();
});
Then('the Android bridge receives the low-power yellow test', async function () {
  const calls=await this.page.evaluate(()=>window.__glowMock.rangeTests);
  assert.deepEqual(calls,[{stage:0,power:1}]);
  assert.match(await this.page.locator('#rangeLabStatus').innerText(),/Yellow at Low power/);
});
When('I choose ultra-low yellow medium orange and high white', async function () {
  await this.page.locator('#rangePower0').selectOption('0');
  await this.page.locator('#rangePower1').selectOption('2');
  await this.page.locator('#rangePower2').selectOption('3');
});
Then('the native sweep receives the independent radio power settings', async function () {
  const calls=await this.page.evaluate(()=>window.__glowMock.shows);
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0].powers,[0,2,3]);
  assert.deepEqual(calls[0].colors,[16,19,27]);
});
When('I restore the default Range Lab profile', async function () {
  await this.page.locator('#rangeReset').click();
});
Then('yellow high orange low and white ultra-low are restored', async function () {
  assert.deepEqual(await this.page.locator('.range-stage select')
    .evaluateAll(elements=>elements.map(e=>e.value)),['3','1','0']);
});
Then('the Range Lab explains the lack of distance sensing', async function () {
  assert.match(await this.page.locator('#rangeLab').innerText(),/not distance sensing/i);
  assert.match(await this.page.locator('#rangeLab').innerText(),/Every compatible watch within radio range may respond/);
});


/** Stable viewport screenshots of the real bundled UI, with BLE bridge mocked. */
Then('I capture the {string} README interface preview', async function (name) {
  const locations = {
    'colors': null,
    'mix': null,
    'scout': null,
    'show-capture':'#showCapturePanel',
    'effect-studio': '#fxStudio',
    'fireworks': '#fireworksCreator',
    'range-lab': '#rangeLab'
  };
  assert.ok(Object.prototype.hasOwnProperty.call(locations,name),'Unknown README preview: '+name);
  if (locations[name]) {
    const panel = this.page.locator(locations[name]);
    assert.ok(await panel.isVisible(),'Preview panel is not visible: '+name);
    await panel.evaluate(node => node.scrollIntoView({block:'start',inline:'nearest'}));
  } else {
    await this.page.evaluate(()=>window.scrollTo(0,0));
  }
  await mkdir(readmePreviews,{recursive:true});
  const shot=await this.page.screenshot({
    path:join(readmePreviews,name+'.png'),
    fullPage:false,
    animations:'disabled'
  });
  assert.ok(shot.length>10000,'Unexpectedly empty preview: '+name);
});


When('I open Show Capture', async function () {
  await this.page.locator('#showCapturePanel').scrollIntoViewIfNeeded();
});
When('I start a 25-minute passive show recording',async function () {
  await this.page.getByLabel('Capture duration').selectOption('25');
  await this.page.locator('#showCaptureLabel').fill('Evening show');
  await this.page.locator('#showCaptureStart').click();
});
Then('Show Capture listens without sending any commands',async function () {
  assert.equal(await this.page.evaluate(()=>window.__glowMock.captureStarts.length),1);
  assert.equal(await this.page.evaluate(()=>window.__glowMock.captureStarts[0].minutes),25);
  assert.equal(await this.page.evaluate(()=>window.__glowMock.sent.length),0);
  assert.match(await this.page.locator('#showCaptureStatus').innerText(),/Passive recording/);
  assert.match(await this.page.locator('#showCaptureStats').innerText(),/31 matching manufacturer 0x0183/);
});
When('I stop and save Show Capture',async function () {
  await this.page.locator('#showCaptureStop').click();
  await this.page.locator('[data-replay-id]').first().waitFor();
});
Then('a replayable recording is listed on my phone',async function () {
  assert.equal(await this.page.locator('[data-replay-id]').count(),1);
  assert.match(await this.page.locator('#showCaptureLibrary').innerText(),/3 replayable cues/);
});
Then('replay stays disabled until I confirm I am testing my own bands',async function () {
  assert.equal(await this.page.locator('[data-replay-id]').first().isDisabled(),true);
  assert.equal(await this.page.evaluate(()=>window.__glowMock.capturePlays.length),0);
});
When('I confirm owned-device replay and start at ultra low power',async function () {
  await this.page.locator('#showReplayAgree').check();
  await this.page.getByLabel('Replay radio power').selectOption('0');
  await this.page.locator('[data-replay-id]').first().click();
});
Then('the app requests replay only after my action',async function () {
  const values=await this.page.evaluate(()=>window.__glowMock.capturePlays);
  assert.equal(values.length,1);
  assert.equal(values[0].power,0);
  assert.match(await this.page.locator('#showCaptureStatus').innerText(),/Replaying/);
});
When('I stop the replay',async function () {
  await this.page.locator('#showReplayStop').click();
});
Then('the app requests cancellation and lights off',async function () {
  assert.equal(await this.page.evaluate(()=>window.__glowMock.capturePlayStops),1);
  assert.ok(await this.page.locator('#showReplayStop').isDisabled());
});
When('I export the default privacy-filtered analysis report',async function () {
  await this.page.getByRole('button',{name:'Share-filtered JSON'}).click();
});
Then('the export excludes raw packets by default',async function () {
  const exports=await this.page.evaluate(()=>window.__glowMock.captureExports);
  assert.equal(exports.length,1);
  assert.equal(exports[0].raw,false);
});
When('I explicitly enable raw replay-data export',async function () {
  await this.page.locator('#showIncludeRaw').check();
  await this.page.getByRole('button',{name:'Full research JSON (raw)'}).click();
});
Then('the optional raw export is requested only with my consent',async function () {
  const exports=await this.page.evaluate(()=>window.__glowMock.captureExports);
  assert.equal(exports.at(-1).raw,true);
});
When('I confirm deletion of the recording',async function () {
  await this.page.getByRole('button',{name:'Delete'}).click();
  await this.page.getByRole('button',{name:'Confirm delete'}).click();
});
Then('the recording disappears from the library',async function () {
  assert.equal(await this.page.locator('[data-replay-id]').count(),0);
  assert.equal(await this.page.evaluate(()=>window.__glowMock.captureDeletes.length),1);
});


When('I select {string} for standard signal power',async function (power){
  const levels={'Ultra Low':'0','Low':'1','Medium':'2','High':'3'};
  assert.ok(Object.prototype.hasOwnProperty.call(levels,power));
  await this.page.getByLabel('Color and animation transmit power').selectOption(levels[power]);
});
Then('the selected effect is transmitted with requested {string} power',async function (power){
  const levels={'Ultra Low':0,'Low':1,'Medium':2,'High':3};
  const sent=await this.page.evaluate(()=>window.__glowMock.sent);
  assert.ok(sent.length>0,'Expected BLE broadcast');
  assert.equal(sent.at(-1).txPower,levels[power]);
});
Then('the signal power control shows {string}',async function (power){
  const levels={'Ultra Low':'0','Low':'1','Medium':'2','High':'3'};
  assert.equal(await this.page.locator('#globalTxPower').inputValue(),levels[power]);
});
When('I reload GlowQuest',async function (){
  await this.page.reload({waitUntil:'load'});
  await this.page.locator('#colorGrid .color-tile').first().waitFor();
});


Then('the app reports the live transmitter and advertised TX output',async function (){
  const panel=await this.page.locator('#showCaptureLiveSources').innerText();
  assert.match(panel,/S001/);
  assert.match(panel,/AA:BB:CC:DD:EE:01/);
  assert.match(panel,/RSSI -52 dBm/);
  assert.match(panel,/advertised TX 4 dBm/);
  assert.match(panel,/S002/);
  assert.match(panel,/TX not advertised|advertised TX not advertised/);
});
Then('the recording offers source-specific replay',async function (){
  const select=this.page.getByLabel('Replay source for Evening show');
  assert.deepEqual(await select.locator('option').evaluateAll(o=>o.map(x=>x.value)),
    ['ALL','S001','S002']);
});
When('I choose transmitter S001 for replay',async function (){
  await this.page.getByLabel('Replay source for Evening show').selectOption('S001');
});
Then('only the selected source is requested for replay',async function (){
  const values=await this.page.evaluate(()=>window.__glowMock.capturePlays);
  assert.equal(values.length,1);
  assert.equal(values[0].sourceId,'S001');
});
Then('the standard animation power selector is visible',async function (){
  assert.equal(await this.page.getByLabel('Color and animation transmit power').isVisible(),true);
  assert.match(await this.page.locator('#globalTxHint').innerText(),/Requested, not measured/);
});
