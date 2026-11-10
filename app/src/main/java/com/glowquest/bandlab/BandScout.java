package com.glowquest.bandlab;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Scan-only, unbonded MagicBand+ discovery. NEVER calls connectGatt or createBond. */
final class BandScout {
    private static final UUID FE03 =
        UUID.fromString("0000FE03-0000-1000-8000-00805F9B34FB");
    private static final long SCAN_MS = 12000L;
    private final Activity activity;
    private final Runnable changed;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, JSONObject> devices = new LinkedHashMap<>();
    private BluetoothLeScanner scanner;
    private ScanCallback callback;
    private Runnable timeout;
    private boolean scanning;
    private String message = "Scan nearby watches without pairing.";
    private int scanId;

    BandScout(Activity activity, Runnable changed) {
        this.activity = activity;
        this.changed = changed;
    }

    String snapshot() {
        try {
            JSONArray matches = new JSONArray();
            for (JSONObject result : devices.values()) matches.put(result);
            return new JSONObject().put("scanning", scanning)
                .put("status", message).put("devices", matches).toString();
        } catch (Exception e) { return "{\"scanning\":false,\"devices\":[]}"; }
    }

    void message(String text) { message = text; changed.run(); }

    void start() {
        stopInternal();
        devices.clear();
        final int current = ++scanId;
        try {
            BluetoothManager manager = (BluetoothManager) activity.getSystemService(Activity.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                message("Enable Bluetooth before scanning.");
                return;
            }
            scanner = adapter.getBluetoothLeScanner();
            if (scanner == null) { message("BLE scanning is unavailable on this phone."); return; }
            callback = new ScanCallback() {
                @Override public void onScanResult(int type, ScanResult result) {
                    handler.post(() -> { if (current == scanId) observe(result); });
                }
                @Override public void onBatchScanResults(java.util.List<ScanResult> results) {
                    handler.post(() -> { if (current == scanId)
                        for (ScanResult r : results) observe(r); });
                }
                @Override public void onScanFailed(int code) {
                    handler.post(() -> { if (current == scanId)
                        stop("Scanning failed (" + code + "). Check Bluetooth permissions."); });
                }
            };
            ScanSettings settings = new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build();
            scanner.startScan(null, settings, callback);
            scanning = true;
            message = "Listening for MagicBand+ names and FE03 service advertisements…";
            changed.run();
            timeout = () -> { if (current == scanId) stop("Scan finished. Found " + devices.size() + " candidates."); };
            handler.postDelayed(timeout, SCAN_MS);
        } catch (SecurityException e) {
            stopInternal(); message("BLE scan permission required. Tap Scan to grant it.");
        } catch (Exception e) {
            stopInternal(); message("Scan unavailable: " + e.getClass().getSimpleName());
        }
    }

    private void observe(ScanResult result) {
        if (result == null || result.getDevice() == null || devices.size() >= 12) return;
        try {
            ScanRecord record = result.getScanRecord();
            String name = record != null ? record.getDeviceName() : null;
            if (name == null) name = result.getDevice().getName();
            boolean named = name != null && name.toLowerCase(java.util.Locale.ROOT).contains("magicband");
            boolean fe03 = false;
            if (record != null && record.getServiceUuids() != null) {
                for (ParcelUuid service : record.getServiceUuids()) {
                    if (FE03.equals(service.getUuid())) { fe03 = true; break; }
                }
            }
            // FE03 also occurs on Alexa gadgets; these are candidates, not confirmed bands.
            if (!named && !fe03) return;
            String address = result.getDevice().getAddress();
            if (address == null) return;
            JSONObject entry = new JSONObject();
            entry.put("id", address).put("label", named ? name : "Possible FE03 gadget")
                .put("nameMatch", named).put("fe03", fe03)
                .put("rssi", result.getRssi())
                .put("addressHint", address.length() >= 5 ?
                     address.substring(address.length() - 5) : "unknown")
                .put("serial", JSONObject.NULL);
            devices.put(address, entry);
            changed.run();
        } catch (SecurityException ignored) {
            message("Nearby devices permission is required to inspect scan results.");
        } catch (Exception ignored) { /* Skip malformed advertisement. */ }
    }

    void stop(String reason) {
        stopInternal();
        message(reason);
    }

    private void stopInternal() {
        scanId++;
        if (timeout != null) handler.removeCallbacks(timeout);
        timeout = null;
        if (scanner != null && callback != null) {
            try { scanner.stopScan(callback); } catch (Exception ignored) { }
        }
        scanner = null;
        callback = null;
        scanning = false;
    }
}
