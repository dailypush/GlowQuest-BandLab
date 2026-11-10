#!/usr/bin/env python3
"""Smoke-test installed APK and capture actual Android WebView screenshots with ADB."""
from pathlib import Path
import re, subprocess, sys, time, xml.etree.ElementTree as ET
APP="com.glowquest.bandlab"
OUT=Path("reports/android-emulator")
def adb(*args,timeout=90):
    result=subprocess.run(["adb",*args],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout)
    return result.stdout
def window_tree():
    try:
        adb("shell","uiautomator","dump","/sdcard/glowquest-window.xml",timeout=45)
        return ET.fromstring(adb("shell","cat","/sdcard/glowquest-window.xml").decode("utf-8","replace"))
    except Exception as exc:
        print("Accessibility hierarchy unavailable:",exc)
        return None
def tab_center(tree,label):
    if tree is None: return None
    for node in tree.iter("node"):
        value=(node.attrib.get("text","")+" "+node.attrib.get("content-desc","")).lower()
        if label not in value: continue
        if "button" not in node.attrib.get("class","").lower() and node.attrib.get("clickable")!="true": continue
        bounds=re.findall(r"\[(\d+),(\d+)\]",node.attrib.get("bounds",""))
        if len(bounds)==2:
            (x0,y0),(x1,y1)=[tuple(map(int,p)) for p in bounds]
            if x1>x0 and y1>y0: return ((x0+x1)//2,(y0+y1)//2)
    return None
def screenshot(name):
    png=adb("exec-out","screencap","-p")
    if not png.startswith(b"\x89PNG\r\n\x1a\n"): raise RuntimeError("Invalid screenshot: "+name)
    (OUT/(name+".png")).write_bytes(png)
    print("Captured Android WebView:",name,len(png),"bytes")
def main():
    if len(sys.argv)!=2: raise SystemExit("Usage: capture_android_emulator.py /path/app-debug.apk")
    apk=Path(sys.argv[1]); assert apk.is_file(), "APK missing: "+str(apk)
    OUT.mkdir(parents=True,exist_ok=True)
    adb("wait-for-device",timeout=180)
    adb("install","-r",str(apk),timeout=180)
    for perm in ("android.permission.BLUETOOTH_ADVERTISE","android.permission.BLUETOOTH_CONNECT"):
        subprocess.run(["adb","shell","pm","grant",APP,perm],check=False,capture_output=True)
    for animation in ("window_animation_scale","transition_animation_scale","animator_duration_scale"):
        adb("shell","settings","put","global",animation,"0")
    adb("shell","am","start","-n",APP+"/.MainActivity")
    time.sleep(9)
    activity=adb("shell","dumpsys","activity","activities").decode("utf-8","replace")
    if APP not in activity: raise RuntimeError("App missing from Android activities")
    screenshot("colors")
    hierarchy=window_tree()
    display=adb("shell","wm","size").decode("utf-8","replace")
    match=re.search(r"(\d+)x(\d+)",display)
    if not match: raise RuntimeError("Unknown emulator size: "+display)
    width=int(match.group(1))
    for i,name in enumerate(("mix","shows","quest","learn"),start=1):
        center=tab_center(hierarchy,name)
        if center is None:
            center=(int(width*(i+.5)/5),int(width*1.44))
            print("Fallback tab coordinates for",name,center)
        adb("shell","input","tap",str(center[0]),str(center[1]))
        time.sleep(1.6)
        screenshot(name)
        hierarchy=window_tree()
    print("Android emulator WebView smoke test complete. BLE transmission not tested.")
if __name__=="__main__": main()
