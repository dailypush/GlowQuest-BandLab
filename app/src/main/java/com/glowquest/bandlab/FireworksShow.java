package com.glowquest.bandlab;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Foreground-only manufacturer advertisement sequencer. No pairing or BLE GATT.
 * Cues have individually configured dwell/spacing; these are not a guarantee
 * of exact animation length on each band. The actual radio burst is brief.
 */
final class FireworksShow {
    private static final int CID = 0x0183;
    private static final int FIREWORK_COUNT = 12;
    private static final int MIN_HOLD_S = 4;
    private static final int MAX_HOLD_S = 20;
    private static final int AIR_MS = 1800;
    private static final byte[] LIGHTS_OFF = hex("E100E90500090E1DB0");
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final BleEngine engine;
    private final Runnable changed;
    private final List<Runnable> tasks = new ArrayList<>();
    private volatile boolean active;
    private volatile int step, total, durationSeconds, cuesAttempted;
    private volatile String kind = "", status = "Ready for launch";
    private volatile long startTime;
    private int generation;

    FireworksShow(BleEngine engine, Runnable changed) {
        this.engine = engine;
        this.changed = changed;
    }

    boolean isActive() { return active; }

    String snapshot() {
        try {
            long elapsedMs = active ? SystemClock.uptimeMillis() - startTime : 0;
            int remaining = active ?
                (int)Math.max(0L, (durationSeconds * 1000L - elapsedMs + 999) / 1000L) : 0;
            return new JSONObject()
                .put("active",active).put("step",step).put("total",total)
                .put("kind",kind).put("durationSeconds",durationSeconds)
                .put("remainingSeconds",remaining).put("cuesAttempted",cuesAttempted)
                .put("radioStatus",engine.getStatus())
                .put("status",status).toString();
        } catch(Exception e) {
            return "{\"active\":false,\"status\":\"Show status unavailable\"}";
        }
    }

    void message(String value) { status=value; changed.run(); }

    private static class Cue {
        final byte[] payload;
        final int seconds;
        Cue(byte[] payload,int seconds) {this.payload=payload;this.seconds=seconds;}
    }

    void startFireworks(String data) {
        final List<Cue> cues = new ArrayList<>();
        final boolean wakeEach;
        try {
            JSONObject root=new JSONObject(data);
            JSONArray entries=root.getJSONArray("cues");
            wakeEach=root.optBoolean("wakeEach",true);
            if(entries.length()!=FIREWORK_COUNT)
                throw new IllegalArgumentException("Exactly 12 show cues required");
            int totalSeconds=0;
            for(int i=0;i<entries.length();i++){
                JSONObject cue=entries.getJSONObject(i);
                final int seconds=cue.getInt("holdSeconds");
                if(seconds<MIN_HOLD_S || seconds>MAX_HOLD_S)
                    throw new IllegalArgumentException("Cue "+(i+1)+" must last 4–20 seconds");
                totalSeconds+=seconds;
                String effect=cue.getString("effect");
                byte[] payload;
                if("color".equals(effect)){
                    int color=cue.getInt("color"), mask=cue.getInt("mask"),
                        vibration=cue.getInt("vibration");
                    if(color<0||color>31||color==29||mask<0||mask>4||
                       !(vibration==0||vibration==1||vibration==2||
                         vibration==3||vibration==7||vibration==8))
                        throw new IllegalArgumentException("Invalid color or vibration at cue "+(i+1));
                    // Documented single-color time scale. Shortest ~6.5 seconds.
                    // Cue duration is when the NEXT command is attempted, not the
                    // exact time the band will glow. Always clear the persistent bit.
                    int timing=Math.max(0, Math.min(15,
                        Math.round((seconds - 6.5f)/1.5f)));
                    payload=new byte[]{(byte)0xE1,0,(byte)0xE9,5,0,(byte)timing,14,
                        (byte)((mask<<5)|color),(byte)(0xB0|vibration)};
                } else {
                    String raw;
                    switch(effect){
                        case "sparkle": raw="E100E91000134897D00EA0D146060F30D04E07B0";break;
                        case "rainbow": raw="E100E90C000F0F5D465BF005323748B0";break;
                        case "purple-flash": raw="E100E90E00010FBDA0A0BDA059070048AEB5";break;
                        case "circle": raw="E200E91200030FA2A2A4A4A230D037F4D2460064FCB8";break;
                        case "pulse": raw="E100E9130002D037F0D23D0505000EFA8983510EE7A0B0";break;
                        default: throw new IllegalArgumentException("Unknown animation at cue "+(i+1));
                    }
                    payload=hex(raw);
                }
                if(payload.length>24)throw new IllegalArgumentException("Packet too large at cue "+(i+1));
                cues.add(new Cue(payload,seconds));
            }
            if(totalSeconds>240)throw new IllegalArgumentException("Maximum show length is 4 minutes");
        } catch(Exception ex){
            message("Show not started: "+ex.getMessage());
            return;
        }
        run(cues,"fireworks",wakeEach);
    }

    void startWalkBy() {
        List<Cue> cues=new ArrayList<>();
        cues.add(new Cue(color(16,5,0,0),5));
        cues.add(new Cue(color(19,5,0,1),5));
        cues.add(new Cue(color(27,5,0,2),5));
        run(cues,"walkby",true);
    }

    private static byte[] color(int index,int seconds,int mask,int vibration) {
        int timing=Math.max(0,Math.min(15,Math.round((seconds-6.5f)/1.5f)));
        return new byte[]{(byte)0xE1,0,(byte)0xE9,5,0,(byte)timing,14,
            (byte)((mask<<5)|index),(byte)(0xB0|vibration)};
    }

    private void run(List<Cue> cues,String mode,boolean wakeEach) {
        cancel(false,"Replacing show");
        engine.stop("Preparing light show");
        active=true;kind=mode;step=0;total=cues.size();
        cuesAttempted=0;durationSeconds=0;
        for(Cue cue:cues) durationSeconds+=cue.seconds;
        startTime=SystemClock.uptimeMillis();
        status=mode.equals("walkby")?"Walk-by demo started":"Fireworks started";
        final int id=++generation;
        changed.run();
        long offsetMs=0;
        for(int i=0;i<cues.size();i++){
            final int index=i;
            final Cue cue=cues.get(i);
            Runnable fire=()->{
                if(!active||id!=generation)return;
                step=index+1;
                cuesAttempted++;
                status=kind.equals("walkby") ?
                    (step==1?"Approaching: yellow":step==2?"Passing: orange":"Leaving: white") :
                    "Cue "+step+" of "+total+" • "+cue.seconds+"s to next cue";
                // Wake before EACH cue by default. Without repeat wakeups some
                // bands ignore later advertisements in a long sequence.
                // 0.5s wake + 1.8s command fits inside minimum 4s dwell.
                engine.send(CID,cue.payload,AIR_MS,wakeEach || index==0);
                changed.run();
            };
            tasks.add(fire);
            handler.postAtTime(fire,startTime+offsetMs);
            offsetMs+=cue.seconds*1000L;
        }
        Runnable finish=()->{
            if(active&&id==generation)
                cancel(true,"Sequence completed — lights off requested");
        };
        tasks.add(finish);
        handler.postAtTime(finish,startTime+offsetMs);
    }

    void cancel(boolean sendOff,String reason){
        if(!active)return;
        active=false;++generation;
        for(Runnable task:tasks)handler.removeCallbacks(task);
        tasks.clear();step=0;
        engine.stop(reason);
        status=reason;
        if(sendOff)engine.send(CID,LIGHTS_OFF,1200,false);
        changed.run();
    }

    private static byte[] hex(String raw){
        byte[] out=new byte[raw.length()/2];
        for(int i=0;i<out.length;i++)
            out[i]=(byte)Integer.parseInt(raw.substring(2*i,2*i+2),16);
        return out;
    }
}
