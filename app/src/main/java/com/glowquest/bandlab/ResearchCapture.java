package com.glowquest.bandlab;

import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.os.Build;
import android.os.SystemClock;
import android.util.SparseArray;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Bounded full-fidelity research samples, kept only in app-private storage.
 * No scanning or BLE transmission originates in this class.
 * A short-window duplicate aggregation preserves packet timing/radio metadata.
 *
 * Android's ScanRecord.getBytes() is the parsed, merged advertising/scan-response
 * record provided by the OS; it is not a sniffer's over-the-air HCI capture.
 */
final class ResearchCapture {
    static final int MAX_DISNEY = 5500;
    static final int MAX_OTHER = 1200;
    static final int MAX_SOURCES = 500;
    static final long DUP_WINDOW_MS = 650L;
    static final long OTHERS_WINDOW_MS = 15_000L;

    private final LinkedHashMap<String,Source> sources=new LinkedHashMap<>();
    private final ArrayList<Sample> samples=new ArrayList<>();
    private final HashMap<String,Sample> recent=new HashMap<>();
    private long referenceNanos,referenceUtc;
    private int droppedDisney,droppedOther,capturedDisney,capturedOther,unknownSourcePackets;

    static final class Source {
        final String id,address;
        String name="";
        int packets,disneyPackets,knownEffectPackets,unknownDisneyPackets,
            minRssi=127,maxRssi=-127,latestRssi=-127,advertisedTx=Integer.MIN_VALUE;
        long firstMs=Long.MAX_VALUE,lastMs;
        long rssiTotal;
        Source(String id,String address){this.id=id;this.address=address;}
        JSONObject json(boolean includeSensitive) throws Exception {
            JSONObject j=new JSONObject()
                .put("id",id).put("packets",packets)
                .put("disneyPackets",disneyPackets)
                .put("knownEffectPackets",knownEffectPackets)
                .put("unknownDisneyPackets",unknownDisneyPackets)
                .put("firstMs",firstMs==Long.MAX_VALUE?0:firstMs).put("lastMs",lastMs)
                .put("rssiMinDbm",minRssi==127?JSONObject.NULL:minRssi)
                .put("rssiMaxDbm",maxRssi==-127?JSONObject.NULL:maxRssi)
                .put("rssiLatestDbm",latestRssi==-127?JSONObject.NULL:latestRssi)
                .put("rssiAverageDbm",packets==0?JSONObject.NULL:
                    Math.round((double)rssiTotal/packets))
                .put("advertisedTxPowerDbm",advertisedTx==Integer.MIN_VALUE?
                    JSONObject.NULL:advertisedTx);
            if(includeSensitive){
                j.put("address",address).put("deviceName",name);
            }
            return j;
        }
    }

    static final class Sample {
        final String sourceId,address,deviceName,rawHex,companyDataHex,manufacturerIds;
        final boolean disney,knownEffect;
        final int rssi,txPower;
        final long firstMs;
        long lastMs;
        int repeats=1,minRssi,maxRssi;
        Sample(Source src,String rawHex,String companyDataHex,String manufacturerIds,
               boolean disney,boolean knownEffect,long timeMs,int rssi,int tx){
            sourceId=src.id;address=src.address;deviceName=src.name;
            this.rawHex=rawHex;this.companyDataHex=companyDataHex;
            this.manufacturerIds=manufacturerIds;
            this.disney=disney;this.knownEffect=knownEffect;
            this.rssi=rssi;this.txPower=tx;
            firstMs=lastMs=timeMs;minRssi=maxRssi=rssi;
        }
        JSONObject json(boolean raw) throws Exception {
            JSONObject j=new JSONObject()
                .put("sourceId",sourceId).put("firstMs",firstMs)
                .put("lastMs",lastMs).put("repetitions",repeats)
                .put("rssiDbm",rssi).put("rssiMinDbm",minRssi)
                .put("rssiMaxDbm",maxRssi)
                .put("advertisedTxPowerDbm",txPower==Integer.MIN_VALUE?
                    JSONObject.NULL:txPower)
                .put("disneyManufacturer",disney)
                .put("knownEffectPacket",knownEffect)
                .put("manufacturerIds",manufacturerIds)
                .put("advertisementBytes",rawHex.length()/2);
            if(raw){
                j.put("address",address).put("deviceName",deviceName)
                    .put("fullScanRecordHex",rawHex)
                    .put("disneyManufacturerDataHex",companyDataHex);
            }
            return j;
        }
    }

    void reset(){
        sources.clear();samples.clear();recent.clear();
        droppedDisney=droppedOther=capturedDisney=capturedOther=unknownSourcePackets=0;
        referenceNanos=SystemClock.elapsedRealtimeNanos();
        referenceUtc=System.currentTimeMillis();
    }

    private static String hex(byte[] bytes){
        if(bytes==null)return "";
        StringBuilder sb=new StringBuilder(bytes.length*2);
        for(byte value:bytes)sb.append(String.format(Locale.ROOT,"%02X",value&255));
        return sb.toString();
    }

    static int advertisedTx(ScanResult result,ScanRecord record){
        if(Build.VERSION.SDK_INT>=26){
            int tx=result.getTxPower();
            if(tx!=ScanResult.TX_POWER_NOT_PRESENT && tx>=-127 && tx<=126)return tx;
        }
        if(record!=null){
            int tx=record.getTxPowerLevel();
            if(tx>=-127 && tx<=126)return tx;
        }
        return Integer.MIN_VALUE; // The transmitter did not advertise TX power.
    }

    private long stampMs(ScanResult result){
        // TimestampNanos is monotonic since boot. Clamp for vendor clock oddities.
        long delta=result.getTimestampNanos()-referenceNanos;
        if(delta<0||delta>30L*60_000_000_000L)
            delta=SystemClock.elapsedRealtimeNanos()-referenceNanos;
        return Math.max(0,Math.min(30*60_000L,delta/1_000_000));
    }

    /** Returns the stable per-recording source ID, or "" if Android hides identity. */
    String observe(ScanResult result, boolean knownEffect){
        if(result==null||result.getDevice()==null){unknownSourcePackets++;return "";}
        final String address;
        try{address=result.getDevice().getAddress();}
        catch(SecurityException ex){unknownSourcePackets++;return "";}
        if(address==null||address.isEmpty()){unknownSourcePackets++;return "";}
        Source src=sources.get(address);
        if(src==null){
            if(sources.size()>=MAX_SOURCES){unknownSourcePackets++;return "";}
            src=new Source(String.format(Locale.ROOT,"S%03d",sources.size()+1),address);
            sources.put(address,src);
        }
        long time=stampMs(result);
        final int rssi=result.getRssi();
        ScanRecord record=result.getScanRecord();
        int tx=advertisedTx(result,record);
        src.packets++;
        src.minRssi=Math.min(src.minRssi,rssi);src.maxRssi=Math.max(src.maxRssi,rssi);
        src.latestRssi=rssi;src.rssiTotal+=rssi;
        src.firstMs=Math.min(src.firstMs,time);src.lastMs=Math.max(src.lastMs,time);
        if(tx!=Integer.MIN_VALUE)src.advertisedTx=tx;
        try{
            String n=record==null?null:record.getDeviceName();
            if(n==null)n=result.getDevice().getName();
            if(n!=null&&!n.isEmpty() && src.name.isEmpty())
                src.name=n.substring(0,Math.min(64,n.length()));
        }catch(Exception ignored){}
        byte[] vendor=record==null?null:record.getManufacturerSpecificData(0x0183);
        boolean disney=vendor!=null;
        if(disney){src.disneyPackets++;if(knownEffect)src.knownEffectPackets++;
           else src.unknownDisneyPackets++;}
        if(record==null||record.getBytes()==null)return src.id;
        byte[] bytes=record.getBytes();
        if(bytes.length==0||bytes.length>512)return src.id;
        String recordHex=hex(bytes);
        String vendorHex=hex(vendor);
        StringBuilder ids=new StringBuilder();
        SparseArray<byte[]> entries=record.getManufacturerSpecificData();
        if(entries!=null)for(int i=0;i<entries.size();i++){
            if(i>0)ids.append(",");
            ids.append(String.format(Locale.ROOT,"0x%04X",entries.keyAt(i)));
        }
        String discriminator=src.id+"|"+recordHex;
        Sample prior=recent.get(discriminator);
        if(prior!=null&&time-prior.lastMs<=DUP_WINDOW_MS){
            prior.repeats++;prior.lastMs=time;
            prior.minRssi=Math.min(prior.minRssi,rssi);
            prior.maxRssi=Math.max(prior.maxRssi,rssi);
            return src.id;
        }
        // In a crowded park, prioritize complete 0x0183 payloads and
        // sparsely sample unrelated advertisers to bound disk/memory usage.
        if(disney){
            if(capturedDisney>=MAX_DISNEY){droppedDisney++;return src.id;}
        }else{
            if(capturedOther>=MAX_OTHER){droppedOther++;return src.id;}
            if(prior!=null && time-prior.lastMs<OTHERS_WINDOW_MS)
                return src.id;
        }
        Sample sample=new Sample(src,recordHex,vendorHex,ids.toString(),
            disney,knownEffect,time,rssi,tx);
        samples.add(sample);recent.put(discriminator,sample);
        if(disney)capturedDisney++;else capturedOther++;
        return src.id;
    }

    int sourceCount(){return sources.size();}
    int rawSampleCount(){return samples.size();}
    int droppedRaw(){return droppedDisney+droppedOther;}

    JSONArray sources(boolean sensitive,int max) throws Exception{
        JSONArray result=new JSONArray();
        java.util.List<Source> sorted=new ArrayList<>(sources.values());
        sorted.sort((a,b)->Integer.compare(b.disneyPackets,a.disneyPackets));
        for(int i=0;i<sorted.size()&&i<max;i++)result.put(sorted.get(i).json(sensitive));
        return result;
    }

    JSONObject toJson() throws Exception{
        JSONObject root=new JSONObject().put("schema","glowquest.research.v1")
            .put("referenceUtc",referenceUtc)
            .put("droppedDisneySamples",droppedDisney)
            .put("droppedOtherSamples",droppedOther)
            .put("unidentifiedPackets",unknownSourcePackets)
            .put("totalSources",sources.size());
        root.put("sources",sources(true,MAX_SOURCES));
        JSONArray packets=new JSONArray();
        for(Sample sample:samples)packets.put(sample.json(true));
        root.put("samples",packets);
        return root;
    }

    static JSONObject filter(JSONObject research,boolean includeRaw) throws Exception{
        JSONObject clean=new JSONObject()
            .put("schema","glowquest.research.v1")
            .put("droppedDisneySamples",research.optInt("droppedDisneySamples"))
            .put("droppedOtherSamples",research.optInt("droppedOtherSamples"))
            .put("unidentifiedPackets",research.optInt("unidentifiedPackets"))
            .put("totalSources",research.optInt("totalSources"));
        JSONArray sources=new JSONArray();
        JSONArray sourceData=research.optJSONArray("sources");
        if(sourceData!=null)for(int i=0;i<sourceData.length();i++){
            JSONObject item=sourceData.getJSONObject(i);
            JSONObject copy=new JSONObject(item.toString());
            if(!includeRaw){copy.remove("address");copy.remove("deviceName");}
            sources.put(copy);
        }
        clean.put("sources",sources);
        JSONArray samples=new JSONArray();
        JSONArray sampleData=research.optJSONArray("samples");
        if(sampleData!=null)for(int i=0;i<sampleData.length();i++){
            JSONObject item=sampleData.getJSONObject(i);
            JSONObject copy=new JSONObject(item.toString());
            if(!includeRaw){
                copy.remove("address");copy.remove("deviceName");
                copy.remove("fullScanRecordHex");copy.remove("disneyManufacturerDataHex");
            }
            samples.put(copy);
        }
        clean.put("samples",samples);
        return clean;
    }

    String recentSourceSummary(){
        try{return sources(true,20).toString();}
        catch(Exception e){return "[]";}
    }
}
