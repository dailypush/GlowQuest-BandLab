package com.glowquest.bandlab;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Foreground-only, capped BLE show sequencer. Commands remain ordinary
 * non-connectable 0x0183 advertisements. There is no paired targeting.
 */
final class FireworksShow {
    private static final int CID = 0x0183;
    private static final int FIREWORK_COUNT = 12;
    private static final long CUE_INTERVAL_MS = 5000L;
    private static final byte[] LIGHTS_OFF = hex("E100E90500090E1DB0");
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final BleEngine engine;
    private final Runnable changed;
    private final List<Runnable> tasks = new ArrayList<>();
    private volatile boolean active = false;
    private volatile int step = 0, total = 0;
    private volatile String kind = "", status = "Ready for launch";
    private volatile long startTime;
    private int generation;

    FireworksShow(BleEngine engine, Runnable changed) {
        this.engine = engine; this.changed = changed;
    }

    boolean isActive() { return active; }

    String snapshot() {
        try {
            long duration = total*CUE_INTERVAL_MS;
            int remaining = active ? (int)(Math.max(0L,
                duration - (SystemClock.uptimeMillis()-startTime) + 999L)/1000L) : 0;
            return new JSONObject().put("active",active).put("step",step)
                .put("total",total).put("kind",kind)
                .put("remainingSeconds",remaining).put("status",status).toString();
        } catch (Exception e) { return "{\"active\":false,\"step\":0}"; }
    }

    void message(String value) { status=value; changed.run(); }

    void startFireworks(String data) {
        byte[][] packets = new byte[FIREWORK_COUNT][];
        try {
            JSONArray cues = new JSONObject(data).getJSONArray("cues");
            if (cues.length()!=FIREWORK_COUNT)
                throw new IllegalArgumentException("A show needs exactly 12 cues");
            for(int i=0;i<FIREWORK_COUNT;i++) {
                JSONObject cue=cues.getJSONObject(i);
                String effect=cue.getString("effect");
                if ("color".equals(effect)) {
                    int color=cue.getInt("color"), mask=cue.getInt("mask"),
                        vibration=cue.getInt("vibration");
                    if(color<0 || color>31 || color==29 || mask<0 || mask>4 ||
                       !(vibration==0 || vibration==1 || vibration==2 ||
                         vibration==3 || vibration==7 || vibration==8))
                        throw new IllegalArgumentException("Invalid light or vibration setting");
                    // Six-and-a-half-second band effect, overridden every 5 seconds.
                    // Bit 7 (persistent mode) is always clear.
                    packets[i]=new byte[]{(byte)0xE1,0,(byte)0xE9,5,0,0,14,
                        (byte)((mask<<5)|color),(byte)(0xB0|vibration)};
                } else {
                    String payload;
                    switch(effect) {
                        case "sparkle": payload="E100E91000134897D00EA0D146060F30D04E07B0";break;
                        case "rainbow": payload="E100E90C000F0F5D465BF005323748B0";break;
                        case "purple-flash": payload="E100E90E00010FBDA0A0BDA059070048AEB5";break;
                        case "circle": payload="E200E91200030FA2A2A4A4A230D037F4D2460064FCB8";break;
                        case "pulse": payload="E100E9130002D037F0D23D0505000EFA8983510EE7A0B0";break;
                        default:throw new IllegalArgumentException("Unsupported animation");
                    }
                    packets[i]=hex(payload);
                }
                if (packets[i].length>24) throw new IllegalArgumentException("BLE packet too long");
            }
        } catch (Exception e) {
            message("Show not started: "+e.getMessage());
            return;
        }
        run(packets,"fireworks");
    }

    void startWalkBy() {
        // A fixed demonstration sweep, NOT RSSI-triggered, NOT per-watch.
        run(new byte[][] {
            color(16,0,0), // yellow on approach
            color(19,0,1), // orange passing + single buzz
            color(27,0,2)  // white receding + double buzz
        },"walkby");
    }

    private static byte[] color(int index,int mask,int vibration) {
        return new byte[]{(byte)0xE1,0,(byte)0xE9,5,0,0,14,
            (byte)((mask<<5)|index),(byte)(0xB0|vibration)};
    }

    private void run(byte[][] packets,String mode) {
        cancel(false,"Replacing show");
        engine.stop("Preparing timed light show");
        active=true; kind=mode; step=0; total=packets.length;
        startTime=SystemClock.uptimeMillis();
        status=mode.equals("walkby") ? "Walk-by color sweep started" : "Fireworks started";
        final int id=++generation;
        changed.run();
        for(int i=0;i<packets.length;i++) {
            final int index=i;
            Runnable task=()->{
                if(!active || generation!=id)return;
                step=index+1;
                status=kind.equals("walkby") ?
                    (step==1?"Approach: yellow":step==2?"Passing: orange":"Moving away: white") :
                    "Firework "+step+" of "+total;
                // Use a short radio burst, not constant 60-second BLE advertising.
                engine.send(CID,packets[index],1000,index==0);
                changed.run();
            };
            tasks.add(task);
            handler.postAtTime(task,startTime+i*CUE_INTERVAL_MS);
        }
        Runnable finish=()->{
            if(active && generation==id) cancel(true,"Sequence finished — lights off requested");
        };
        tasks.add(finish);
        handler.postAtTime(finish,startTime+packets.length*CUE_INTERVAL_MS);
    }

    void cancel(boolean sendOff,String reason) {
        if(!active)return;
        active=false; ++generation;
        for(Runnable task:tasks)handler.removeCallbacks(task);
        tasks.clear(); step=0;
        engine.stop(reason);
        status=reason;
        if(sendOff) engine.send(CID,LIGHTS_OFF,1200,false);
        changed.run();
    }

    private static byte[] hex(String value) {
        byte[] out=new byte[value.length()/2];
        for(int i=0;i<out.length;i++)
            out[i]=(byte)Integer.parseInt(value.substring(i*2,i*2+2),16);
        return out;
    }
}
