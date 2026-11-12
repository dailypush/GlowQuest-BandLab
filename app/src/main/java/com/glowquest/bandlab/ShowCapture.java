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
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Explicitly activated, foreground-only BLE show observation and replay.
 *
 * Captures only manufacturer 0x0183 advertisements. Stores raw bytes ONLY for
 * packets matching the known GlowQuest E1/E2 00 E9 length framing; unknown data
 * is counted, not persisted. Never reads or retains names/Bluetooth addresses.
 * Default exports contain decoded cues and salted per-session fingerprints,
 * never raw packet data. Playback requires a second explicit user action.
 */
final class ShowCapture {
    private static final int COMPANY = 0x0183;
    private static final long MAX_CAPTURE_MS = 30 * 60_000L;
    private static final long MAX_PLAY_MS = 30 * 60_000L;
    private static final long REPLAY_MIN_GAP_MS = 3000L;
    private static final int MAX_FRAMES = 450;
    private static final int MAX_SAVED = 10;
    private static final byte[] LIGHTS_OFF = hex("E100E90500090E1DB0");
    private static final String PREFIX = "glowshow_";
    private final Activity activity;
    private final BleEngine engine;
    private final Runnable changed;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Frame> frames = new ArrayList<>();
    private final Map<String,Frame> recent = new HashMap<>();
    private final List<Runnable> pending = new ArrayList<>();
    private BluetoothLeScanner scanner;
    private ScanCallback callback;
    private Runnable timeout;
    private boolean capturing, replaying;
    private int generation, received, vendorPackets, validPackets, unknownVendorPackets,
        overflow, playIndex, playbackCues, scanError;
    private long startUptime, startUtc, endUptime, replayStarted, lastUpdate;
    private String label = "", status = "Ready to capture a show.", lastSavedId = "";
    private byte[] salt = new byte[16];

    private static final class Frame {
        final int offsetMs, rssiBucket;
        final String dataHex, fingerprint;
        int lastSeenMs, repetitions=1;
        Frame(int offsetMs,int rssiBucket,String dataHex,String fingerprint) {
            this.offsetMs=offsetMs;this.rssiBucket=rssiBucket;
            this.dataHex=dataHex;this.fingerprint=fingerprint;
            this.lastSeenMs=offsetMs;
        }
        JSONObject toJson() throws Exception {
            byte[] packet=hex(dataHex);
            JSONObject out=new JSONObject()
                .put("offsetMs",offsetMs).put("lastSeenMs",lastSeenMs)
                .put("repetitions",repetitions).put("rssiBucketDbm",rssiBucket)
                .put("fingerprint",fingerprint)
                .put("frameType",packet[0]==(byte)0xE2?"E2-E9":"E1-E9")
                .put("payloadBytes",packet.length).put("payloadHex",dataHex);
            if(packet.length==9 && packet[3]==5 && packet[6]==14) {
                out.put("effectClass","single-color")
                    .put("colorIndex",packet[7]&31)
                    .put("ledMask",(packet[7]&255)>>5)
                    .put("vibrationCode",packet[8]&15)
                    .put("timingByte",packet[5]&255);
            } else out.put("effectClass","other-E9-animation");
            return out;
        }
    }

    ShowCapture(Activity activity,BleEngine engine,Runnable changed) {
        this.activity=activity;this.engine=engine;this.changed=changed;
    }

    boolean isCapturing(){return capturing;}
    boolean isReplaying(){return replaying;}

    String snapshot() {
        try {
            long elapsed=capturing ? SystemClock.uptimeMillis()-startUptime :
                Math.max(0,endUptime-startUptime);
            return new JSONObject()
                .put("capturing",capturing).put("replaying",replaying)
                .put("status",status).put("elapsedSeconds",elapsed/1000)
                .put("receivedPackets",received).put("manufacturerPackets",vendorPackets)
                .put("supportedPackets",validPackets).put("unsupportedPackets",unknownVendorPackets)
                .put("savedCues",frames.size()).put("droppedCues",overflow)
                .put("playIndex",playIndex).put("playTotal",playbackCues)
                .put("scanError",scanError).put("lastSavedId",lastSavedId)
                .put("maxCaptureMinutes",30).toString();
        }catch(Exception e){return "{\"capturing\":false,\"replaying\":false}";}
    }

    void message(String value){status=value;changed.run();}

    void start(String title,int minutes) {
        if(capturing || replaying){message("Stop the current recording or replay first.");return;}
        if(minutes<1||minutes>30){message("Choose a capture duration of 1–30 minutes.");return;}
        frames.clear();recent.clear();
        received=vendorPackets=validPackets=unknownVendorPackets=overflow=scanError=0;
        startUtc=System.currentTimeMillis();
        startUptime=SystemClock.uptimeMillis();
        endUptime=startUptime;
        label=(title==null?"":title.trim().replaceAll("[\\p{Cntrl}]"," "));
        if(label.length()>48)label=label.substring(0,48);
        new SecureRandom().nextBytes(salt);
        final int token=++generation;
        try {
            BluetoothManager manager=(BluetoothManager)activity.getSystemService(Activity.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter=manager==null?null:manager.getAdapter();
            if(adapter==null||!adapter.isEnabled()){
                message("Turn on Bluetooth to capture advertisements.");return;
            }
            scanner=adapter.getBluetoothLeScanner();
            if(scanner==null){message("This phone has no BLE scanner.");return;}
            callback=new ScanCallback(){
                @Override public void onScanResult(int type,ScanResult result){
                    handler.post(()->{if(capturing&&token==generation)observe(result);});
                }
                @Override public void onBatchScanResults(java.util.List<ScanResult> batch){
                    handler.post(()->{
                        if(capturing&&token==generation)
                            for(ScanResult result:batch)observe(result);
                    });
                }
                @Override public void onScanFailed(int error){
                    handler.post(()->{
                        if(token==generation && capturing){
                            scanError=error;
                            stopCapture("Android scan failed (code "+error+"). Partial capture saved.");
                        }
                    });
                }
            };
            scanner.startScan(null,new ScanSettings.Builder()
                .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
                .setReportDelay(0).build(),callback);
            capturing=true;
            status="Passive recording started. No BLE commands are being sent.";
            timeout=()->{
                if(capturing&&token==generation)
                    stopCapture("Capture time completed. Saved locally.");
            };
            handler.postDelayed(timeout,minutes*60_000L);
            changed.run();
        }catch(SecurityException e){
            stopScanner();message("BLE Scan permission is required.");
        }catch(Exception e){
            stopScanner();message("Could not start recording: "+e.getClass().getSimpleName());
        }
    }

    private void observe(ScanResult result) {
        if(result==null)return;
        received++;
        ScanRecord record=result.getScanRecord();
        if(record==null){signalUpdate();return;}
        byte[] data=record.getManufacturerSpecificData(COMPANY);
        if(data==null){signalUpdate();return;}
        vendorPackets++;
        if(!isKnownEffect(data)){
            unknownVendorPackets++;
            signalUpdate();return;
        }
        validPackets++;
        long t=Math.max(0,SystemClock.uptimeMillis()-startUptime);
        int offset=(int)Math.min(t,MAX_CAPTURE_MS);
        String value=toHex(data);
        Frame previous=recent.get(value);
        if(previous!=null && offset-previous.lastSeenMs<=1250) {
            previous.lastSeenMs=offset;
            previous.repetitions++;
        } else if(frames.size()<MAX_FRAMES) {
            int rssi=result.getRssi();
            int bucket=(int)Math.round(rssi/10.0)*10;
            Frame f=new Frame(offset,bucket,value,digest(value));
            frames.add(f);
            recent.put(value,f);
        }else overflow++;
        signalUpdate();
    }

    private void signalUpdate(){
        long now=SystemClock.uptimeMillis();
        if(now-lastUpdate>=800){
            lastUpdate=now;
            changed.run();
        }
    }

    void stopCapture(String reason) {
        if(!capturing)return;
        endUptime=SystemClock.uptimeMillis();
        stopScanner();
        capturing=false;
        lastSavedId=save();
        status=reason+" "+frames.size()+" supported cues; "+
            unknownVendorPackets+" other 0x0183 packets (not saved).";
        changed.run();
    }

    private void stopScanner(){
        generation++;
        if(timeout!=null)handler.removeCallbacks(timeout);
        timeout=null;
        if(scanner!=null && callback!=null)
            try{scanner.stopScan(callback);}catch(Exception ignored){}
        scanner=null;callback=null;
    }

    private String save(){
        try{
            String id=PREFIX+startUtc+"_"+Integer.toHexString(new SecureRandom().nextInt());
            JSONObject clip=new JSONObject()
                .put("schema","glowquest.show-capture.v1")
                .put("id",id).put("title",label.isEmpty()?"Show recording":label)
                .put("capturedAtUtc",startUtc)
                .put("durationMs",Math.max(0,endUptime-startUptime))
                .put("receivedPackets",received)
                .put("manufacturerPackets",vendorPackets)
                .put("supportedPackets",validPackets)
                .put("unsupportedPackets",unknownVendorPackets)
                .put("droppedCues",overflow)
                .put("scanError",scanError);
            JSONArray data=new JSONArray();
            for(Frame frame:frames)data.put(frame.toJson());
            clip.put("events",data);
            byte[] bytes=clip.toString().getBytes(StandardCharsets.UTF_8);
            try(FileOutputStream output=activity.openFileOutput(id+".json",Activity.MODE_PRIVATE)){
                output.write(bytes);
            }
            prune();
            return id;
        }catch(Exception ex){
            status="Capture file could not be saved: "+ex.getClass().getSimpleName();
            return "";
        }
    }

    private void prune(){
        File[] files=activity.getFilesDir().listFiles((dir,name)->
            name.startsWith(PREFIX)&&name.endsWith(".json"));
        if(files==null||files.length<=MAX_SAVED)return;
        java.util.Arrays.sort(files,(a,b)->Long.compare(a.lastModified(),b.lastModified()));
        for(int i=0;i<files.length-MAX_SAVED;i++)files[i].delete();
    }

    private JSONObject load(String id)throws Exception{
        if(id==null||!id.matches("glowshow_[0-9]{10,15}_[0-9a-f]{1,8}"))
            throw new IllegalArgumentException("Invalid recording identifier");
        File file=new File(activity.getFilesDir(),id+".json");
        if(!file.isFile()||file.length()>256_000)throw new IllegalArgumentException("Recording not found or too large");
        byte[] bytes=new byte[(int)file.length()];
        try(FileInputStream input=new FileInputStream(file)){
            int offset=0,n;
            while(offset<bytes.length && (n=input.read(bytes,offset,bytes.length-offset))>0)
                offset+=n;
            if(offset!=bytes.length)throw new IllegalArgumentException("Incomplete recording");
        }
        JSONObject root=new JSONObject(new String(bytes,StandardCharsets.UTF_8));
        if(!"glowquest.show-capture.v1".equals(root.optString("schema")))
            throw new IllegalArgumentException("Unknown recording format");
        return root;
    }

    String list(){
        JSONArray clips=new JSONArray();
        File[] files=activity.getFilesDir().listFiles((dir,name)->
            name.startsWith(PREFIX)&&name.endsWith(".json"));
        if(files==null)return "[]";
        java.util.Arrays.sort(files,(a,b)->Long.compare(b.lastModified(),a.lastModified()));
        for(File file:files){
            try{
                String id=file.getName().substring(0,file.getName().length()-5);
                JSONObject root=load(id);
                clips.put(new JSONObject().put("id",id)
                    .put("title",root.optString("title"))
                    .put("capturedAtUtc",root.optLong("capturedAtUtc"))
                    .put("durationMs",root.optLong("durationMs"))
                    .put("supportedCues",root.getJSONArray("events").length())
                    .put("manufacturerPackets",root.optInt("manufacturerPackets"))
                    .put("unsupportedPackets",root.optInt("unsupportedPackets")));
            }catch(Exception ignored){}
        }
        return clips.toString();
    }

    String analysis(String id,boolean includeRaw) {
        try{
            JSONObject clip=load(id);
            JSONObject report=new JSONObject()
                .put("schema","glowquest.analysis.v1")
                .put("recordingTitle",clip.optString("title"))
                .put("capturedAtUtc",clip.optLong("capturedAtUtc"))
                .put("durationMs",clip.optLong("durationMs"))
                .put("receivedPackets",clip.optInt("receivedPackets"))
                .put("manufacturerPackets",clip.optInt("manufacturerPackets"))
                .put("supportedPackets",clip.optInt("supportedPackets"))
                .put("unsupportedPackets",clip.optInt("unsupportedPackets"))
                .put("droppedCues",clip.optInt("droppedCues"))
                .put("scanError",clip.optInt("scanError"))
                .put("containsRawPayloads",includeRaw)
                .put("note","0x0183 traffic is not proven to originate from the Disney show. " +
                    "Only supported E1/E2-00-E9 frames are replayable. " +
                    "BLE device addresses and names were never recorded.");
            JSONArray events=new JSONArray();
            JSONArray originals=clip.getJSONArray("events");
            for(int i=0;i<originals.length();i++){
                JSONObject item=originals.getJSONObject(i);
                JSONObject clean=new JSONObject()
                    .put("offsetMs",item.optInt("offsetMs"))
                    .put("lastSeenMs",item.optInt("lastSeenMs"))
                    .put("repetitions",item.optInt("repetitions"))
                    .put("rssiBucketDbm",item.optInt("rssiBucketDbm"))
                    .put("fingerprint",item.optString("fingerprint"))
                    .put("frameType",item.optString("frameType"))
                    .put("effectClass",item.optString("effectClass"))
                    .put("payloadBytes",item.optInt("payloadBytes"));
                for(String key:new String[]{"colorIndex","ledMask","vibrationCode","timingByte"})
                    if(item.has(key))clean.put(key,item.getInt(key));
                if(includeRaw)clean.put("payloadHex",item.optString("payloadHex"));
                events.put(clean);
            }
            report.put("events",events);
            return report.toString(2);
        }catch(Exception ex){
            // Keep the JavaScript bridge non-throwing even if JSON formatting fails.
            return "{\"error\":\"Could not generate show report\"}";
        }
    }

    boolean delete(String id){
        try{
            load(id);
            boolean done=new File(activity.getFilesDir(),id+".json").delete();
            message(done?"Recording deleted.":"Could not delete recording.");
            return done;
        }catch(Exception e){message("Recording not found.");return false;}
    }

    void replay(String id,int power) {
        if(capturing || replaying){message("Stop the current recording/replay first.");return;}
        if(power<0||power>3){message("Invalid replay transmission power.");return;}
        try{
            JSONObject clip=load(id);
            JSONArray items=clip.getJSONArray("events");
            if(items.length()==0){message("This recording has no supported effects to replay.");return;}
            engine.stop("Preparing replay");
            long when=0,prev=-REPLAY_MIN_GAP_MS;
            ArrayList<Frame> replayList=new ArrayList<>();
            ArrayList<Long> offsets=new ArrayList<>();
            int skipped=0;
            for(int i=0;i<items.length() && replayList.size()<MAX_FRAMES;i++){
                JSONObject event=items.getJSONObject(i);
                String payload=event.getString("payloadHex");
                byte[] bytes=hex(payload);
                if(!isKnownEffect(bytes)){skipped++;continue;}
                when=Math.max(event.getLong("offsetMs"),prev+REPLAY_MIN_GAP_MS);
                if(when>MAX_PLAY_MS-5000){skipped+=items.length()-i;break;}
                prev=when;
                replayList.add(new Frame((int)when,0,payload,""));
                offsets.add(when);
            }
            if(replayList.isEmpty()){message("No valid replayable commands in this recording.");return;}
            replaying=true;playIndex=0;playbackCues=replayList.size();
            replayStarted=SystemClock.uptimeMillis();
            status="Replaying "+playbackCues+" supported cues. "+skipped+" skipped.";
            final int token=++generation;
            for(int i=0;i<replayList.size();i++){
                final byte[] payload=hex(replayList.get(i).dataHex);
                final int sequence=i+1;
                final long due=replayStarted+offsets.get(i);
                Runnable task=()->{
                    if(!replaying||generation!=token)return;
                    playIndex=sequence;
                    status="Replaying "+playIndex+" / "+playbackCues+
                        " (band response is not acknowledged)";
                    engine.send(COMPANY,payload,1200,true,power);
                    changed.run();
                };
                pending.add(task);
                handler.postAtTime(task,due);
            }
            Runnable finish=()->{
                if(replaying&&generation==token)
                    stopReplay(true,"Replay finished — lights off requested.");
            };
            pending.add(finish);
            handler.postAtTime(finish,replayStarted+offsets.get(offsets.size()-1)+3000);
            changed.run();
        }catch(Exception ex){message("Cannot replay recording: "+ex.getMessage());}
    }

    void stopReplay(boolean lightsOff,String reason){
        if(!replaying)return;
        replaying=false;++generation;
        for(Runnable task:pending)handler.removeCallbacks(task);
        pending.clear();
        engine.stop(reason);
        if(lightsOff)engine.send(COMPANY,LIGHTS_OFF,1200,false);
        status=reason;
        changed.run();
    }

    private static boolean isKnownEffect(byte[] bytes){
        return bytes!=null&&bytes.length>=8&&bytes.length<=24&&
            (bytes[0]==(byte)0xE1||bytes[0]==(byte)0xE2)&&
            bytes[1]==0&&bytes[2]==(byte)0xE9&&
            (bytes[3]&255)==bytes.length-4;
    }

    private String digest(String packetHex){
        try{
            MessageDigest md=MessageDigest.getInstance("SHA-256");
            md.update(salt);
            md.update(packetHex.getBytes(StandardCharsets.US_ASCII));
            byte[] value=md.digest();
            return toHex(java.util.Arrays.copyOf(value,8));
        }catch(Exception e){return "unavailable";}
    }

    private static String toHex(byte[] bytes){
        StringBuilder builder=new StringBuilder(bytes.length*2);
        for(byte b:bytes)builder.append(String.format(Locale.ROOT,"%02X",b&255));
        return builder.toString();
    }
    private static byte[] hex(String raw){
        if(raw==null||!raw.matches("[0-9A-Fa-f]{16,48}")||(raw.length()&1)!=0)
            throw new IllegalArgumentException("Invalid effect packet");
        byte[] out=new byte[raw.length()/2];
        for(int i=0;i<out.length;i++)
            out[i]=(byte)Integer.parseInt(raw.substring(i*2,i*2+2),16);
        return out;
    }
}
