package com.glowquest.bandlab;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.os.Handler;
import android.os.Looper;

/** One-shot, non-connectable BLE manufacturer advertisements only. */
final class BleEngine {
    private final Activity context;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable changed;
    private BluetoothLeAdvertiser advertiser;
    private AdvertiseCallback active;
    private Runnable finishStep;
    private int generation = 0;
    private volatile boolean running = false;
    private volatile String status = "Ready to play";

    BleEngine(Activity context, Runnable changed) {
        this.context = context;
        this.changed = changed;
    }

    String getStatus() { return status; }
    boolean isRunning() { return running; }
    void message(String text) { status = text; changed.run(); }

    void stop(String reason) {
        generation++;
        stopCurrent();
        running = false;
        message(reason);
    }

    private void stopCurrent() {
        if (finishStep != null) handler.removeCallbacks(finishStep);
        finishStep = null;
        if (advertiser != null && active != null) {
            try { advertiser.stopAdvertising(active); } catch (Exception ignored) { }
        }
        active = null;
    }

    /** Default power preserves existing colors and fireworks behavior. */
    void send(int companyId, byte[] bytes, int durationMs, boolean withWake) {
        send(companyId,bytes,durationMs,withWake,AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM);
    }

    /** Android BLE advertising power hint: 0 ultra low, 1 low, 2 medium, 3 high. */
    void send(int companyId, byte[] bytes, int durationMs, boolean withWake, int txPower) {
        if(txPower<AdvertiseSettings.ADVERTISE_TX_POWER_ULTRA_LOW ||
           txPower>AdvertiseSettings.ADVERTISE_TX_POWER_HIGH) {
            message("Invalid Bluetooth power level"); return;
        }
        stopCurrent();
        final int id = ++generation;
        running = false;
        if (bytes.length > 24) { message("Packet too long for legacy BLE advertisements"); return; }
        try {
            BluetoothManager manager = (BluetoothManager) context.getSystemService(Activity.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
            if (adapter == null) { message("No Bluetooth radio found"); return; }
            if (!adapter.isEnabled()) { message("Turn on Bluetooth first"); return; }
            if (!adapter.isMultipleAdvertisementSupported()) { message("This phone cannot broadcast BLE advertisements"); return; }
            advertiser = adapter.getBluetoothLeAdvertiser();
            if (advertiser == null) { message("This Bluetooth chip has no advertiser"); return; }
            if (withWake && companyId == 0x0183) {
                advertise(id, companyId, new byte[]{(byte)0xCC,0x03,0,0,0}, 500,
                    () -> advertise(id, companyId, bytes, durationMs, null,
                        "Sending effect ("+powerName(txPower)+")",txPower),
                    "Waking band ("+powerName(txPower)+")",txPower);
            } else advertise(id, companyId, bytes, durationMs, null,
                "Sending effect ("+powerName(txPower)+")",txPower);
        } catch (SecurityException e) { message("Allow Nearby devices permission"); }
        catch (Exception e) { message("Bluetooth error: " + e.getMessage()); }
    }

    private static String powerName(int power) {
        switch(power) {
            case AdvertiseSettings.ADVERTISE_TX_POWER_ULTRA_LOW: return "Ultra Low";
            case AdvertiseSettings.ADVERTISE_TX_POWER_LOW: return "Low";
            case AdvertiseSettings.ADVERTISE_TX_POWER_HIGH: return "High";
            default: return "Medium";
        }
    }

    private void advertise(int id, int companyId, byte[] bytes, int durationMs,
                           Runnable then, String label,int txPower) {
        if (id != generation) return;
        try {
            stopCurrent();
            AdvertiseData data = new AdvertiseData.Builder()
                .addManufacturerData(companyId, bytes)
                .setIncludeTxPowerLevel(false).setIncludeDeviceName(false).build();
            AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(txPower)
                .setConnectable(false)
                .setTimeout(Math.min(durationMs + 1000, 4500)).build();
            message(label);
            AdvertiseCallback cb = new AdvertiseCallback() {
                @Override public void onStartSuccess(AdvertiseSettings actual) {
                    if (id != generation || active != this) {
                        try { advertiser.stopAdvertising(this); } catch (Exception ignored) { }
                        return;
                    }
                    running = true;
                    message(label);
                    finishStep = () -> {
                        if (id != generation || active != this) return;
                        stopCurrent();
                        running = false;
                        if (then != null) then.run();
                        else message("Signal sent! Watch your band ✨");
                    };
                    handler.postDelayed(finishStep, durationMs);
                }
                @Override public void onStartFailure(int code) {
                    if (id != generation || active != this) return;
                    stopCurrent();
                    running = false;
                    String error;
                    switch (code) {
                        case AdvertiseCallback.ADVERTISE_FAILED_DATA_TOO_LARGE: error="Packet too large for this phone"; break;
                        case AdvertiseCallback.ADVERTISE_FAILED_TOO_MANY_ADVERTISERS: error="Bluetooth is busy with other broadcasts"; break;
                        case AdvertiseCallback.ADVERTISE_FAILED_ALREADY_STARTED: error="Broadcast already running"; break;
                        case AdvertiseCallback.ADVERTISE_FAILED_FEATURE_UNSUPPORTED: error="BLE advertising unsupported"; break;
                        case AdvertiseCallback.ADVERTISE_FAILED_INTERNAL_ERROR: error="Bluetooth radio reported an internal error"; break;
                        default: error="Broadcast failed (code " + code + ")";
                    }
                    message(error);
                }
            };
            active = cb;
            advertiser.startAdvertising(settings, data, cb);
        } catch (Exception e) {
            stopCurrent();
            running = false;
            message("Couldn't send: " + e.getMessage());
        }
    }
}
