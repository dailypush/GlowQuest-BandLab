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
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Passive BLE diagnostics only. No connectGatt, bonding, GATT writes or internet. */
final class BandScout {
    private static final UUID FE03 =
        UUID.fromString("0000FE03-0000-1000-8000-00805F9B34FB");
    private static final long SCAN_MS = 20000L;
    private final Activity activity;
    private final Runnable changed;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Map<String, JSONObject> candidates = new LinkedHashMap<>();
    private final Map<String, JSONObject> otherDevices = new LinkedHashMap<>();
    private final Set<String> discovered = new HashSet<>();
    private BluetoothLeScanner scanner;
    private ScanCallback callback;
    private Runnable timeout;
    private boolean scanning, showAll;
    private int packets, scanId;
    private long lastUpdate;
    private String message = "Scan nearby BLE broadcasts without pairing.";

    BandScout(Activity activity, Runnable changed) {
        this.activity = activity;
        this.changed = changed;
    }

    String snapshot() {
        try {
            JSONArray matches = new JSONArray();
            for(JSONObject device : candidates.values()) matches.put(device);
            if(showAll) for(JSONObject device : otherDevices.values()) matches.put(device);
            return new JSONObject().put("scanning",scanning)
                .put("status",message).put("devices",matches)
                .put("receivedPackets",packets)
                .put("uniqueDevices",discovered.size())
                .put("candidateCount",candidates.size())
                .put("showAll",showAll).toString();
        } catch(Exception e) { return "{\"scanning\":false,\"devices\":[]}"; }
    }

    void message(String text) { message=text; changed.run(); }

    void start(boolean diagnostic) {
        stopInternal();
        candidates.clear(); otherDevices.clear(); discovered.clear(); packets=0;
        showAll=diagnostic;
        final int current=++scanId;
        try {
            BluetoothManager manager=(BluetoothManager) activity.getSystemService(Activity.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter=manager==null?null:manager.getAdapter();
            if(adapter==null||!adapter.isEnabled()){
                message("Bluetooth is off. Enable Bluetooth and retry.");
                return;
            }
            scanner=adapter.getBluetoothLeScanner();
            if(scanner==null){message("BLE scanning isn't supported by this phone.");return;}
            callback=new ScanCallback(){
                @Override public void onScanResult(int type,ScanResult result){
                    handler.post(()->{if(current==scanId)observe(result);});
                }
                @Override public void onBatchScanResults(java.util.List<ScanResult> results){
                    handler.post(()->{if(current==scanId)
                        for(ScanResult result:results)observe(result);});
                }
                @Override public void onScanFailed(int code){
                    handler.post(()->{if(current==scanId)
                        stop("Android rejected BLE scan ("+code+"). Check Nearby devices and retry.");});
                }
            };
            ScanSettings settings=new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .setReportDelay(0L).build();
            // No ScanFilter: MagicBand+ may not advertise its readable name/FE03.
            scanner.startScan(null,settings,callback);
            scanning=true;
            message="Scanning all BLE advertisements for 20 seconds…";
            timeout=()->{
                if(current!=scanId)return;
                stop("Scan finished: "+discovered.size()+" nearby BLE device(s); "+
                    candidates.size()+" candidate(s).");
            };
            handler.postDelayed(timeout,SCAN_MS);
        } catch(SecurityException e) {
            stopInternal();message("Permission denied for BLE scan. Check Nearby devices.");
        } catch(Exception e) {
            stopInternal();message("Could not scan: "+e.getClass().getSimpleName());
        }
    }

    private void observe(ScanResult result) {
        if(result==null||result.getDevice()==null)return;
        try {
            String address=result.getDevice().getAddress();
            if(address==null)return;
            packets++;
            discovered.add(address);
            ScanRecord record=result.getScanRecord();
            String name=record==null?null:record.getDeviceName();
            if(name==null) name=result.getDevice().getName();
            boolean named=name!=null &&
                (name.toLowerCase(java.util.Locale.ROOT).contains("magicband") ||
                 name.toLowerCase(java.util.Locale.ROOT).startsWith("mb+"));
            boolean fe03=false, disney=false;
            if(record!=null){
                if(record.getServiceUuids()!=null)
                    for(ParcelUuid service:record.getServiceUuids())
                        if(FE03.equals(service.getUuid())){fe03=true;break;}
                disney=record.getManufacturerSpecificData(0x0183)!=null;
            }
            boolean candidate=named||fe03||disney;
            boolean known=candidates.containsKey(address)||otherDevices.containsKey(address);
            if(candidate && !candidates.containsKey(address) && candidates.size()>=12)return;
            if(!candidate && !showAll && !known){
                announceProgress(); return;
            }
            if(!candidate && !known && otherDevices.size()>=24){
                announceProgress();return;
            }
            JSONObject entry=new JSONObject();
            entry.put("id",address)
                .put("label",name!=null&&!name.isEmpty()?name:(candidate?"Possible BLE band":"Unnamed BLE device"))
                .put("nameMatch",named).put("fe03",fe03).put("disneyId",disney)
                .put("candidate",candidate).put("rssi",result.getRssi())
                .put("addressHint",address.length()>5?address.substring(address.length()-5):"??")
                .put("serial",JSONObject.NULL);
            if(candidate){
                otherDevices.remove(address);
                candidates.put(address,entry);
            }else if(showAll){
                otherDevices.put(address,entry);
            }
            announceProgress();
        } catch(SecurityException e){
            stop("Scan access denied. Check Nearby devices permission.");
        } catch(Exception ignored){
            // A malformed advertisement must not terminate a whole scan.
        }
    }

    private void announceProgress() {
        long now=SystemClock.uptimeMillis();
        if(now-lastUpdate<450 && packets>1)return;
        lastUpdate=now;
        changed.run();
    }

    void stop(String reason) { stopInternal();message(reason); }

    void clear() {
        stopInternal();
        candidates.clear();otherDevices.clear();discovered.clear();packets=0;
        message("Scan list cleared. Start another scan when ready.");
    }

    private void stopInternal() {
        scanId++;
        if(timeout!=null)handler.removeCallbacks(timeout);
        timeout=null;
        if(scanner!=null&&callback!=null)
            try{scanner.stopScan(callback);}catch(Exception ignored){}
        scanner=null;callback=null;scanning=false;
    }
}
