# GlowQuest — Band Lab (Android)

A playful, **fully offline**, self-contained Android BLE manufacturer-advertisement app for experimenting with **your own MagicBand+**. Unofficial; not connected with or endorsed by Disney.


## GlowQuest 2.4.0 — Bluetooth Range Lab

**New:** Open **Shows → Show Creator → Walk-by Glow → Range Lab**. Select different Android BLE advertising transmit-power hints for each color: Ultra Low (0), Low (1), Medium (2), High (3). The default scripted sweep sends yellow at High, orange at Low and white at Ultra Low. You can change each setting, run a separate 1.8-second color test (with a short wake ping), then play the 15-second sweep. Both wake and effect commands use the selected power; other GlowQuest effects still default to Medium.

The settings are saved only on your phone and can be reset. Existing Stop, cancellation, and foreground-only limits remain.

**Limitations:** Transmit-power levels are *requests to Android's radio*, not measured distances or guaranteed boundaries. Walls, reflections, phone hardware and watch orientation affect reception. All nearby watches can receive any broadcast, including an Ultra Low one, and a nearby watch can miss a High one. This is a **scheduled power sweep**, not an RSSI-driven proximity sensor or an individually addressed watch command. No Disney pairing or MagicBand+ scanning is necessary. Test with your own watches away from guests.

## GlowQuest 2.3.2 — Scanner fixes and adjustable firework timings

### Scanner

The earlier Band Scout did not show a scan-in-progress indicator until an advertisement was actually received. This version reports scanning immediately, maps Android BLE scanner errors and adds an Android-only scanner health panel with radio/permission availability. A local **Copy diagnostic report** feature captures only the phone type, permission/radio state, packet counts and any error code—not other Bluetooth device identities. Android 12+ BLE scanning uses the Nearby devices permission with \`neverForLocation\`; Android 6–11 still needs Location enabled.

To test if a MagicBand+ *advertises* (which differs from its ability to receive broadcasts), turn on one band and hold the rear button approximately three seconds until it pulses blue, then scan without pairing or accepting any pairing request. A band that only receives BLE broadcasts cannot report its distance to the phone.

### Fireworks

The 12-cue fireworks editor now supports total show presets **48s, 60s, 96s, 120s, 180s, 240s**, and lets you set each cue's dwell time between **4–20 seconds**. Each cue transmits for about 1.8 seconds (plus an optional 0.5-second wake signal). **Wake before every cue** is enabled by default because subsequent effects may be missed by some firmware. A new **Color-only reliability test** uses simpler manufacturer packets to isolate whether missed cues are due to built-in animation incompatibility. The app shows cue attempt counts and native radio status, but no BLE advertisement acknowledgment proves a band actually displayed an effect.

The cue duration is the spacing between commands; a band's built-in animation may end earlier or persist past that spacing. The native foreground-only scheduler cancels pending cues on stop/exit, requests Lights Off when cancelled or after the sequence, and never enables persistent lighting.

**Distance-based Walk-by concept:** Android can observe RSSI (rough radio proximity) only from watches that actively advertise. Our current Walk-by demo remains time-based, and radio broadcasts change all listening nearby bands. Individual-watch proximity triggering is not implemented, and precise distance cannot be guaranteed.

## GlowQuest 2.3.1 — Cleaner effects and better Band Scout diagnostics

- Removed the “Did it work?” feedback prompt, feedback history and UI. The obsolete local feedback key is cleared when FX Studio loads.
- **Band Scout now listens to all BLE advertisements for 20 seconds**, whether or not they advertise a MagicBand+ name or FE03 service.
- Real-time diagnostics distinguish received radio advertisements and distinct nearby BLE devices from *possible* MagicBand+ candidates. Optional **Show all nearby BLE devices** displays up to 24 generic devices in addition to up to 12 candidates (read-only, no pairing or transmissions).
- Manufacturer data with ID `0x0183` is another candidate hint, **not proof** that a device is a MagicBand+. Addresses can rotate, and serials cannot be verified by a passive scan.
- Android permission requests resume scanning once granted. On Android 6–11 the app reports when system Location is off (required by Android BLE scanning APIs). No location data is read/stored/uploaded.
- **Important:** If nearby BLE devices are visible but no MagicBand+ is identified, scanning is working; your unpaired MagicBand+ may be a *receiver only* in its current operating mode. This app still cannot individually address watches.

## GlowQuest 2.3 — Fireworks Show Creator

**New:** Shows → 🎆 Show Creator provides a native-scheduled 60-second show of **12 editable effects spaced 5 seconds apart**, with vivid colors, built-in animation commands and several vibration patterns. Customize effect type, color, LED mask and vibration per cue; save/load a show in local storage. The Android main-thread scheduler holds each radio advertisement to **1 second per cue**, plus an optional **500 ms wake ping** on the first cue. It does not advertise continuously for 60 seconds.

**Safety:** Cancelling the show removes all scheduled cues, stops the current advertisement and requests the documented Lights Off command. The show automatically finishes at 60 seconds and sends Lights Off. Leaving the app foreground cancels the show. Sending a regular effect interrupts the show. Lights Off and the global Stop button both cancel any running show. Actual band feedback is not an authenticated acknowledgment; hardware timing/firmware can vary.

**Walk-by Glow (experimental demo):** Inside Show Creator, try a **15-second fixed sweep**: yellow → orange → white, with short vibration patterns. This is intentionally **not** RSSI-triggered walking detection. It does **not** individually target new unpaired bands. All compatible bands within broadcast range can see the same colors. Reliable individual device control remains under investigation.

Avoid testing intense flashing around people sensitive to flashing lights. This app is intended for experiments with your own watches away from guests and runs offline.

## GlowQuest 2.2 beta — Band Scout and extended timing

**New in 2.2:**
- **Shows → FX Studio → 45-second mode**: selects the documented E905 extended timing scaler bit (0x40) with time value 13, giving approximately **45.8 seconds** of band illumination (plus up to three seconds fade). A ~30 s and ~52 s option are also included. The Android BLE *broadcast itself* remains brief (1.8 seconds, plus optional short wake ping). The bit-7 always-on flag is never enabled.
- **Scout tab**: opt-in 12-second BLE scan looking for MagicBand+ names or advertisements with the FE03 service, displaying candidate devices, RSSI and a shortened transient Bluetooth address. **No Bluetooth pairing, bonding, GATT connections, or writes** occur. FE03 is shared by other Alexa gadgets, so matches are not definitive. Some bands may be invisible in their normal operating mode. Candidates are not stored.
- **Odd/even challenge preview**: optionally type a *known* serial number under a scan candidate; last numeric digit even previews blue, odd previews red. Advertised name suffixes and MAC addresses are **not verified serial numbers**. This preview **does not send individually addressed commands**; existing radio broadcasts still affect compatible nearby bands.

**Permissions and privacy:** Android 12+ requests Nearby devices / Bluetooth scan permission. Android 6–11 requires fine-location permission to perform BLE scans under Android OS rules; this app has no internet permission and does not collect, store, or transmit location data. We don't automatically pair watches or request Disney login.

Protocol background: [EMCOT MagicBand+ Bluetooth Codes](https://emcot.world/Disney_MagicBand%2B_Bluetooth_Codes) and [MagicBand+ FE03 research](https://emcot.world/Magicband%2B_Pairing_Details). A genuinely separate-watch mode requires verified per-band communication and is **not yet implemented**.

## GlowQuest 2.1 beta — Effect Studio

**New in 2.1:** Open **Shows → 🧪 FX Studio** to combine a chosen palette color with a documented outer-LED mask (all, top-right, bottom-right, bottom-left, top-left), a vibration pattern (off/single/double/triple/flutter/long buzz), estimated band duration and 0–3 second fade.

This builds an **E9 05 manufacturer advertisement** with its timing byte, mask+color byte and vibration nibble. It deliberately never enables the persistent/always-on flag. The phone itself still transmits only a short advertisement burst, **not** a continuous radio signal. Estimated LED effect duration is distinct from broadcast duration; some short settings can cause a double flash on certain firmware.

The previous “Did it work?” response prompt and effect-feedback history were removed in **v2.3.1**. The rest of FX Studio is unchanged.

Compatibility of individual LED masks, vibration patterns and fade timing **must be checked on a real MagicBand+**, since the protocol is community reverse-engineered. Center-only spotlights require a different command; **Mix → Five lights** remains the way to customize the center LED. See [EMCOT's timing, mask, vibration reference](https://emcot.world/Disney_MagicBand%2B_Bluetooth_Codes).

## App features

- **🎨 Colors:** 25 easy kid-facing palette colors (the source palette includes 32 slots, but several are duplicates, invisible or "Off").
- **🪄 Mix:** two independent colors, paint five individual LEDs, or create a 6-bit RGB color (64 steps per channel).
- **🎆 Shows:** 17 documented show, fade and animation commands, including vibration-capable patterns. These are community-discovered—not guaranteed to work on every band or firmware.
- **🏆 Color detective:** simple find-the-color challenge and locally saved stars.
- **🔎 Learn:** illustrated explanations, live HEX packet magnifier, and a quiz.
- **🧑‍🔬 Grown-up lab:** press-and-hold to unlock custom company IDs, raw HEX, short-duration choices and optional wake-up ping. This is only an accidental-touch guard, not a secure parental lock.
- **🌙 Lights off:** transmits the documented OFF command; **⏹ Stop signal** ends phone broadcasting without necessarily stopping a show already running in the band.
- **Offline & private:** no internet, no account, no server, no data collection. Scout scanning requires a runtime Nearby devices permission on newer Android, or a runtime location permission on Android 6–11. The whole UI is bundled in the APK; no Chrome, bridge service or other app is necessary.
- **Kid safety:** broadcasts are non-connectable and end automatically after at most 3.5 seconds (plus optional 0.5-second wake ping). The radio stops when the app is backgrounded. No looping or continuous spam modes. Effects in the band may last longer than the brief transmission, so use the Off button.

## Compatibility

- **Android 6.0+** device with a Bluetooth LE chipset that supports advertising (`BluetoothAdapter.isMultipleAdvertisementSupported`). The app checks capability at runtime and reports failures.
- Android 12+ prompts for **Nearby devices** (`BLUETOOTH_ADVERTISE` and `BLUETOOTH_CONNECT`). Older Android versions use `BLUETOOTH` and `BLUETOOTH_ADMIN` manifest permissions.
- A phone-only solution, no root, Flipper, Wi-Fi or cellular plan required.
- Android emulator / Chrome desktop can only run a visual preview; they do not send BLE manufacturer packets.
- This app uses **legacy 31-byte BLE advertising** and restricts manufacturer data to 1–24 bytes; the sender does not promise that every chipset can transmit the longest commands.

## How to build an APK (sideload)

### Option A — Android Studio

1. Install Android Studio (macOS, Windows, or Linux) with SDK Platform **35** and JDK 17.
2. Extract this ZIP; open the **GlowQuest-Android** folder as a Gradle project.
3. Let Android Studio sync project dependencies, then choose **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
4. Locate `app/build/outputs/apk/debug/app-debug.apk`.
5. Copy the APK to the Android phone, open it in Files, and approve **Install unknown apps** for the app used to open it. The exact Settings labels vary by Android version.
6. Open **GlowQuest • Band Lab**, approve Nearby devices access, and enable Bluetooth. First test the app with your own band away from other guests.

Alternative for a phone connected to Android Studio: press **Run** for automatic debug installation. Or use `adb install -r app-debug.apk`.

### Option B — GitHub Actions (no local Android Studio)

1. Create a new GitHub repository and upload the **contents** of this project folder, including `.github/workflows/build-apk.yml`.
2. Go to **Actions → Build GlowQuest Android APK → Run workflow**.
3. After the build completes, download the artifact **GlowQuest-debug-APK** from the workflow run, unzip it, and install `app-debug.apk` on Android.
4. This is a **debug-signed** APK for experimentation. For wider distribution, generate a release signing key and properly sign the release build.

**Note, as of November 2026:** Google has begun rolling out Android developer verification in select markets, with broader requirements planned in 2027. Unregistered APKs may require Android's advanced installation flow or ADB in affected circumstances. See https://developer.android.com/developer-verification for current requirements. Don't disable unrelated security controls.

## Automated Gherkin acceptance tests and screenshots

Every push touching the app, CI configuration or tests (and every pull request touching them) runs a **Gherkin/Cucumber + Playwright** job before building the APK. The suite runs the **same bundled HTML/CSS/JavaScript as the Android WebView**, at phone and tablet viewport sizes, while mocking the native BLE bridge. That makes it safe to validate UI interactions without radio hardware.

It tests the five adventure screens, phone/tablet horizontal overflow, color-packet construction, five-LED mixing, show filtering, color detective, the science quiz, invalid hex rejection, the stop button, and the calls made to the Android bridge. It also records mobile and tablet screenshots, plus failure screenshots automatically.

**To review a build:** open GitHub **Actions → Build GlowQuest Android APK → latest run → Artifacts**. Download:
- **GlowQuest-UI-screenshots** — full-page PNG screenshots for the five adventures and tablet layout, plus failing scenarios if any.
- **GlowQuest-Gherkin-reports** — interactive HTML report plus JSON for automation and debugging.
- **GlowQuest-debug-APK** — sideloadable debug APK, created *only after the acceptance job passes*.

Run locally (requires Node.js and Chromium/Playwright):

```sh
npm install
npx playwright install chromium
npm run test:ui
```

Results are written to `reports/` (ignored locally). These automated tests **do not prove that the phone's Bluetooth controller can transmit**, that the real MagicBand+ receives commands, or that the app behaves identically in every Android WebView. Those require physical-device testing. The browser uses a mocked native Bluetooth bridge. Android SDK compilation is separately verified in the APK build job.

### Visual regression + Android emulator screenshots

The same workflow now also checks **six visual snapshots**: the Colors, Mix, Shows, Quest, and Learn pages, plus the Colors page at tablet size. `tests/visual-baselines.json` stores compact color fingerprints and reference dimensions derived from reviewed CI screenshots. `tests/check_visual_regression.py` compares the new captures, fails the UI job for unexpected broad layout changes, and writes diagnostic heatmaps to `reports/visual-diffs/`. This is a **coarse visual regression check**, not pixel-perfect screenshot testing; small typography shifts may not be detected.

After Gherkin and visual tests pass, CI builds the Android debug APK. An additional Android emulator job installs that APK on an Android 15 emulator and captures images from the **real Android WebView**; these are published as the `GlowQuest-Android-emulator-screenshots` artifact. Emulator screenshots are distinct from browser screenshots, and neither test verifies real BLE transmission, a physical MagicBand+ response, or production devices.

To view the screenshots: **GitHub → Actions → Build GlowQuest Android APK → latest run → Artifacts**. Look for `GlowQuest-UI-screenshots`, `GlowQuest-Android-emulator-screenshots`, `GlowQuest-Gherkin-reports`, and (when a visual change is detected) `GlowQuest-visual-diffs`. The APK artifact is `GlowQuest-debug-APK`. Reference fingerprints should be updated only after visually reviewing and approving intended design changes.

## Download and install the latest beta on Android

**Start with the [GitHub Releases page](https://github.com/dailypush/GlowQuest-BandLab/releases).** The beta release provides a direct downloadable `GlowQuest-BandLab-*.apk` file under **Assets**. This is easier than downloading a short-lived GitHub Actions artifact ZIP.

To sideload: download the APK on your Android device, open it from Files/Downloads, approve installation from that source if Android asks, and then launch GlowQuest. Grant Nearby devices permission and enable Bluetooth. Only test on your own MagicBand+ in an uncrowded area: these BLE signals are broadcasts.

**Beta warning:** these APKs are debug-signed for testing. A later APK may use a different signing key, requiring you to uninstall the previous debug app before installing the new one. Uninstalling can erase locally stored stars and settings. A production release with a persistent signing key is a future improvement.

The [APK build workflow](https://github.com/dailypush/GlowQuest-BandLab/actions/workflows/build-apk.yml) runs Gherkin scenarios, visual checks, compiles the app, and captures Android emulator screenshots. The [release workflow](https://github.com/dailypush/GlowQuest-BandLab/actions/workflows/publish-beta-release.yml) publishes a beta APK only after that full workflow passes on `main`. It creates version `v2.0.0-beta.1` once, rather than silently replacing an existing downloadable package.

## How to use

1. Charge your MagicBand+ and make sure it is powered on.
2. Open GlowQuest and confirm the green **BLE READY** indication.
3. Go to **Colors**, choose **Blue**, and press **SEND MAGIC!**. Watch the actual band, not just the animation preview. Try **Bright purple** or **Red** if needed.
4. If needed, use the other presets, which can preface a command with a 0.5-second `CC03000000` wake ping.
5. For a color combination, select **Mix → Two colors**, or **Five lights** and color each zone, then tap **SEND MAGIC!**.
6. To end effects, tap **Lights off**. The **Stop signal** button only stops the Android radio.

### Important limitations

- BLE packets are **broadcast**, not addressed to just one MagicBand+. Do not test in a crowd or inside Disney parks near other guests.
- A successfully started BLE broadcast doesn't guarantee the band received it. This app does **not** pair with or discover the band; it won't show a "connected" status.
- Manufacturer data uses Bluetooth SIG company identifier `0x0183`. Android's `addManufacturerData()` automatically puts the ID into the packet; the editable hex field must **exclude** those two ID bytes.
- Some show effects include vibration and may continue after broadcast stops. The continuously blinking "Orange Blink" experimental packet is intentionally left out of the children's show presets.
- The UI's on-screen colors are approximations; a palette entry does not map directly to arbitrary RGB on MagicBand+ hardware.

## Implementation

- No server: Android `WebView` loads only bundled `file:///android_asset` files. It blocks external navigation and web resource requests; JavaScript-to-Java bridge is limited to this fixed local content.
- `MainActivity` owns permission requests and an in-app browser UI.
- `BleEngine` uses `BluetoothLeAdvertiser.startAdvertising()` with manufacturer data, non-connectable, a fixed short timeout, optional wake packet, automatic cleanup, and proper Android error reporting.
- No native dependencies beyond Android SDK 35 and AGP 8.7.3.

## Protocol acknowledgments & references

Effects and builders were independently adapted from documented community research:

- [EMCOT Disney MagicBand+ Bluetooth Codes](https://emcot.world/Disney_MagicBand%2B_Bluetooth_Codes)
- [Adafruit BLE Beacon NeoPixels / MagicBand+ experiment](https://learn.adafruit.com/ble-beacon-neopixels) and [MIT-licensed MagicBand protocol helpers](https://github.com/adafruit/Adafruit_Learning_System_Guides/blob/main/BLE_Beacon_Ears/magicband_protocol.py) by Pedro Ruiz, 2026
- [Adafruit CLUE command library](https://github.com/adafruit/Adafruit_Learning_System_Guides/blob/main/CLUE_BLE_Beacon_Remote/command_library.py)
- [MagicBand Plus Lights (Flipper / Android experiment)](https://github.com/Haw8411/magic-band-plus-lights)
- [Android BluetoothLeAdvertiser](https://developer.android.com/reference/android/bluetooth/le/BluetoothLeAdvertiser)

## Validation status

- Tested HTML, JS syntax and page interactions in a desktop headless Chromium preview.
- Inspected preset payloads for legacy advertising size limits and validated Android manifest XML.
- **GitHub Actions compiles the Android debug APK after the browser-based acceptance tests pass.** No physical Android BLE hardware is attached to the automated CI runner, so real wristband responses still require on-device verification.
