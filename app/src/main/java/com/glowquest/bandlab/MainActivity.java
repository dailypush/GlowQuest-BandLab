package com.glowquest.bandlab;

import android.Manifest;
import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.content.Intent;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.location.LocationManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.View;
import android.widget.FrameLayout;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;

public class MainActivity extends Activity {
    private static final int NEARBY_REQUEST = 240;
    private static final int ENABLE_REQUEST = 241;
    private static final int SCOUT_REQUEST = 242;
    private static final String HOME = "file:///android_asset/index.html";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WebView web;
    private BleEngine engine;
    private BandScout scout;
    private FireworksShow fireworks;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(14, 11, 37));
        getWindow().setNavigationBarColor(Color.rgb(14, 11, 37));
        getWindow().getDecorView().setSystemUiVisibility(0);
        engine = new BleEngine(this, this::notifyUi);
        scout = new BandScout(this, this::notifyScout);
        fireworks = new FireworksShow(engine, this::notifyFireworks);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(14, 11, 37));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true); // only bundled android_asset files are loaded
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.addJavascriptInterface(new Bridge(), "BandNative");
        web.setWebViewClient(new WebViewClient() {
            private boolean allowed(String url) {
                return HOME.equals(url) ||
                    "file:///android_asset/app.css".equals(url) ||
                    "file:///android_asset/app.js".equals(url) ||
                    "file:///android_asset/fx.js".equals(url) ||
                    "file:///android_asset/scout.js".equals(url) ||
                    "file:///android_asset/fireworks.js".equals(url);
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !allowed(request.getUrl().toString());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!allowed(request.getUrl().toString())) {
                    return new WebResourceResponse("text/plain", "UTF-8",
                        new ByteArrayInputStream(new byte[0]));
                }
                return super.shouldInterceptRequest(view, request);
            }
        });
        setContentView(web, new FrameLayout.LayoutParams(-1, -1));
        web.loadUrl(HOME);
    }

    private BluetoothAdapter adapter() {
        BluetoothManager mgr = (BluetoothManager) getSystemService(BLUETOOTH_SERVICE);
        return mgr == null ? null : mgr.getAdapter();
    }

    private boolean hasPermission() {
        return Build.VERSION.SDK_INT < 31 ||
            (checkSelfPermission(Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED &&
             checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED);
    }

    private void setupBluetooth() {
        if (!hasPermission()) {
            if (Build.VERSION.SDK_INT >= 31) {
                requestPermissions(new String[]{Manifest.permission.BLUETOOTH_ADVERTISE,
                    Manifest.permission.BLUETOOTH_CONNECT}, NEARBY_REQUEST);
            }
            return;
        }
        BluetoothAdapter bt = adapter();
        if (bt != null && !bt.isEnabled()) {
            try { startActivityForResult(new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), ENABLE_REQUEST); }
            catch (Exception ignored) { }
        }
        notifyUi();
    }

    private String statusJson() {
        try {
            boolean granted = hasPermission();
            BluetoothAdapter bt = adapter();
            boolean on = false, supported = false;
            if (granted && bt != null) {
                try {
                    on = bt.isEnabled();
                    supported = on && bt.isMultipleAdvertisementSupported() && bt.getBluetoothLeAdvertiser() != null;
                } catch (SecurityException ignored) { }
            }
            return new JSONObject()
                .put("permissions", granted).put("bluetoothOn", on)
                .put("supported", supported).put("running", engine.isRunning())
                .put("status", engine.getStatus()).put("device", Build.MANUFACTURER + " " + Build.MODEL)
                .put("android", Build.VERSION.RELEASE).toString();
        } catch (Exception e) { return "{\"supported\":false}"; }
    }

    private void notifyUi() {
        mainHandler.post(() -> {
            if (web != null) {
                web.evaluateJavascript("window.onBandStatus && window.onBandStatus(" +
                    JSONObject.quote(statusJson()) + ")", null);
            }
        });
    }

    private void notifyFireworks() {
        mainHandler.post(() -> {
            if (web != null) web.evaluateJavascript(
                "window.onFireworksStatus && window.onFireworksStatus(" +
                JSONObject.quote(fireworks.snapshot()) + ")", null);
        });
    }

    private void startFireworks(String cues, boolean walkby) {
        if (!hasPermission()) {
            fireworks.message("Allow Nearby devices before starting a show");
            setupBluetooth();
            return;
        }
        BluetoothAdapter bt = adapter();
        if (bt == null || !bt.isEnabled() || !bt.isMultipleAdvertisementSupported()) {
            fireworks.message("Enable a BLE advertising-capable Bluetooth radio first");
            setupBluetooth();
            return;
        }
        scout.stop("Scan stopped for foreground light show.");
        if (walkby) fireworks.startWalkBy(cues);
        else fireworks.startFireworks(cues);
    }

    private void notifyScout() {
        mainHandler.post(() -> {
            if (web != null) {
                web.evaluateJavascript("window.onScoutStatus && window.onScoutStatus(" +
                    JSONObject.quote(scout.snapshot()) + ")", null);
            }
        });
    }

    private boolean hasScanPermission() {
        if (Build.VERSION.SDK_INT >= 31)
            return checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED &&
                checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private String scoutEnvironmentJson() {
        try{
            BluetoothAdapter bt=adapter();
            boolean allowed=hasScanPermission(),enabled=false,scannerReady=false;
            if(bt!=null && (Build.VERSION.SDK_INT<31 ||
                checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)==PackageManager.PERMISSION_GRANTED)){
                try{
                    enabled=bt.isEnabled();
                    scannerReady=enabled && allowed && bt.getBluetoothLeScanner()!=null;
                }catch(SecurityException ignored){}
            }
            return new JSONObject()
                .put("api",Build.VERSION.SDK_INT)
                .put("phone",Build.MANUFACTURER+" "+Build.MODEL)
                .put("available",bt!=null).put("bluetoothOn",enabled)
                .put("scanPermission",allowed).put("scannerReady",scannerReady)
                .put("legacyLocationRequired",Build.VERSION.SDK_INT<=30)
                .put("legacyLocationOn",legacyLocationEnabled())
                .put("foreground",isForeground).put("scanning",scout.isScanning()).toString();
        }catch(Exception ignored){return "{}";}
    }

    private boolean scoutShowAll;
    private boolean scoutWaitingPermission;
    private boolean isForeground;

    private boolean legacyLocationEnabled() {
        if (Build.VERSION.SDK_INT >= 31) return true;
        try {
            if (Build.VERSION.SDK_INT >= 28) {
                LocationManager lm=(LocationManager)getSystemService(LOCATION_SERVICE);
                return lm!=null && lm.isLocationEnabled();
            }
            return Settings.Secure.getInt(getContentResolver(),
                Settings.Secure.LOCATION_MODE,
                Settings.Secure.LOCATION_MODE_OFF)!=Settings.Secure.LOCATION_MODE_OFF;
        } catch(Exception ignored){return false;}
    }

    private void startScout(boolean showAll) {
        scoutShowAll=showAll;
        if(fireworks.isActive()){
            scout.message("Stop the light show before scanning.");return;
        }
        if(!hasScanPermission()){
            scoutWaitingPermission=true;
            if(Build.VERSION.SDK_INT>=31)
                requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,
                    Manifest.permission.BLUETOOTH_CONNECT}, SCOUT_REQUEST);
            else
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, SCOUT_REQUEST);
            scout.message("Awaiting BLE scan permission. Scan will resume when the app is ready.");
            return;
        }
        if(!isForeground){
            scoutWaitingPermission=true;
            scout.message("Scanner queued until GlowQuest returns to the foreground.");
            return;
        }
        scoutWaitingPermission=false;
        if(!legacyLocationEnabled()){
            scout.message("Android 6–11 requires device Location to be ON for BLE scanning. GlowQuest never records location.");
            return;
        }
        scout.start(showAll);
    }

    private static byte[] parseHex(String raw) {
        if (raw == null) throw new IllegalArgumentException("Missing HEX payload");
        String hex = raw.replaceAll("[\\s:-]", "").toUpperCase(java.util.Locale.ROOT);
        if (!hex.matches("[0-9A-F]+") || (hex.length() & 1) != 0 ||
            hex.length() < 2 || hex.length() > 48) {
            throw new IllegalArgumentException("Use 1–24 complete HEX bytes (no company ID prefix)");
        }
        byte[] bytes = new byte[hex.length() / 2];
        for (int i = 0; i < bytes.length; i++) {
            bytes[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return bytes;
    }

    public final class Bridge {
        @JavascriptInterface public String status() { return statusJson(); }
        @JavascriptInterface public void enable() { mainHandler.post(MainActivity.this::setupBluetooth); }
        @JavascriptInterface public void transmit(int companyId, String raw, int ms, boolean wake) {
            mainHandler.post(() -> {
                try {
                    if (companyId < 0 || companyId > 65535) throw new IllegalArgumentException("Company ID must fit in 16 bits");
                    byte[] bytes = parseHex(raw);
                    if (ms < 350 || ms > 3500) throw new IllegalArgumentException("Broadcast must be 0.35–3.5 seconds");
                    if (!hasPermission()) { engine.message("Allow Nearby devices to send a signal"); setupBluetooth(); return; }
                    fireworks.cancel(false, "Manual color replaced show");
                    engine.send(companyId, bytes, ms, wake);
                } catch (Exception e) { engine.message(e.getMessage()); }
                notifyUi();
            });
        }
        @JavascriptInterface public void off() {
            mainHandler.post(() -> {
                if (!hasPermission()) { setupBluetooth(); return; }
                fireworks.cancel(false, "Lights off");
                engine.send(0x0183, parseHex("E100E90500090E1DB0"), 1200, false);
            });
        }
        @JavascriptInterface public void stop() {
            mainHandler.post(() -> {
                if (fireworks.isActive()) fireworks.cancel(true,"Cancelled — lights off requested");
                else engine.stop("Transmission stopped");
            });
        }
        @JavascriptInterface public void startFireworks(String json) {
            mainHandler.post(() -> MainActivity.this.startFireworks(json,false));
        }
        @JavascriptInterface public void startWalkBy(String config) {
            mainHandler.post(() -> MainActivity.this.startFireworks(config,true));
        }
        @JavascriptInterface public void testRange(int stage,int power) {
            mainHandler.post(() -> {
                if(!hasPermission()){
                    engine.message("Allow Nearby devices to send range tests");
                    setupBluetooth();return;
                }
                BluetoothAdapter bt=adapter();
                if(bt==null||!bt.isEnabled()||!bt.isMultipleAdvertisementSupported()){
                    engine.message("Bluetooth advertising unavailable for Range Lab");
                    setupBluetooth();return;
                }
                scout.stop("Scanner stopped for Range Lab transmission.");
                fireworks.testRange(stage,power);
            });
        }
        @JavascriptInterface public void cancelFireworks() {
            mainHandler.post(() -> fireworks.cancel(true,"Cancelled — lights off requested"));
        }
        @JavascriptInterface public String fireworksStatus() {
            return fireworks.snapshot();
        }
        @JavascriptInterface public String scoutEnvironment() {
            return scoutEnvironmentJson();
        }
        @JavascriptInterface public void copyScoutReport(String report) {
            mainHandler.post(() -> {
                try{
                    ClipboardManager clipboard=(ClipboardManager)getSystemService(CLIPBOARD_SERVICE);
                    if(clipboard!=null)clipboard.setPrimaryClip(ClipData.newPlainText(
                        "GlowQuest Scout diagnostics",report==null?"":
                        report.substring(0,Math.min(2000,report.length()))));
                }catch(Exception ignored){}
            });
        }
        @JavascriptInterface public void scanBands(boolean allDevices) {
            mainHandler.post(() -> MainActivity.this.startScout(allDevices));
        }
        @JavascriptInterface public void clearScanBands() {
            mainHandler.post(scout::clear);
        }
        @JavascriptInterface public void stopScanBands() {
            mainHandler.post(() -> scout.stop("Scanning stopped. No pairing was performed."));
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] perms, int[] result) {
        super.onRequestPermissionsResult(code, perms, result);
        if (code == NEARBY_REQUEST) notifyUi();
        if (code == SCOUT_REQUEST) {
            if(hasScanPermission()){
                scoutWaitingPermission=true;
                if(isForeground) mainHandler.post(() -> {
                    if(scoutWaitingPermission && isForeground) startScout(scoutShowAll);
                });
                else scout.message("Permission granted. Scan resumes when the app returns.");
            }else{
                scoutWaitingPermission=false;
                scout.message("Permission denied. Enable Nearby devices for GlowQuest in Android Settings.");
            }
            notifyScout();
        }
    }

    @Override public void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == ENABLE_REQUEST) notifyUi();
    }

    @Override protected void onPause() {
        super.onPause();
        // Never leave the phone broadcasting if the child leaves the app.
        fireworks.cancel(false,"Sequence stopped because app left foreground");
        engine.stop("Ready to play");
        isForeground=false;
        if(scout.isScanning())
            scout.stop("Scanner stopped when app left foreground.");
    }

    @Override protected void onResume() {
        super.onResume();
        isForeground=true;
        if(scoutWaitingPermission && hasScanPermission())
            mainHandler.post(() -> {
                if(scoutWaitingPermission && isForeground) startScout(scoutShowAll);
            });
        notifyUi();notifyScout();notifyFireworks();
    }

    @Override protected void onDestroy() {
        fireworks.cancel(false,"Sequence stopped");
        engine.stop("Stopped");
        scout.stop("Stopped");
        if (web != null) {
            web.removeJavascriptInterface("BandNative");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
