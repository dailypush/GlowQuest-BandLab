# GlowQuest — Band Lab (Android)

A playful, **fully offline**, self-contained Android BLE manufacturer-advertisement app for experimenting with **your own MagicBand+**. Unofficial; not connected with or endorsed by Disney.

## App features

- **🎨 Colors:** 25 easy kid-facing palette colors (the source palette includes 32 slots, but several are duplicates, invisible or "Off").
- **🪄 Mix:** two independent colors, paint five individual LEDs, or create a 6-bit RGB color (64 steps per channel).
- **🎆 Shows:** 17 documented show, fade and animation commands, including vibration-capable patterns. These are community-discovered—not guaranteed to work on every band or firmware.
- **🏆 Color detective:** simple find-the-color challenge and locally saved stars.
- **🔎 Learn:** illustrated explanations, live HEX packet magnifier, and a quiz.
- **🧑‍🔬 Grown-up lab:** press-and-hold to unlock custom company IDs, raw HEX, short-duration choices and optional wake-up ping. This is only an accidental-touch guard, not a secure parental lock.
- **🌙 Lights off:** transmits the documented OFF command; **⏹ Stop signal** ends phone broadcasting without necessarily stopping a show already running in the band.
- **Offline & private:** no internet or location permissions, no account, no server, no data collection. The whole UI is bundled in the APK; no Chrome, bridge service or other app is necessary.
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
