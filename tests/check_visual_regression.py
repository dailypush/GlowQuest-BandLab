#!/usr/bin/env python3
"""Detect broad visual regressions against reviewed CI screenshot fingerprints."""
from pathlib import Path
from PIL import Image
import json, os, sys
ROOT = Path(__file__).resolve().parent.parent
BASELINES = ROOT / "tests/visual-baselines.json"
SHOTS = ROOT / "reports/screenshots"
OUT = ROOT / "reports/visual-diffs"
GRID = (8, 32)
MAX_MEAN_RGB444 = 1.4
MAX_CHANGED_FRACTION = 0.18
MAX_GEOMETRY_DRIFT = 0.025
def compare(name, ref):
    path = SHOTS / (name + ".png")
    if not path.is_file(): return False, f"{name}: missing screenshot"
    with Image.open(path) as image:
        width, height = image.size
        thumb = image.convert("RGB").resize(GRID, Image.Resampling.LANCZOS)
        live = "".join(f"{r>>4:x}{g>>4:x}{b>>4:x}" for r, g, b in thumb.getdata())
    baseline = ref["rgb444"]
    if len(live) != len(baseline): return False, f"{name}: reference grid length mismatch"
    delta = [abs(int(a,16)-int(b,16)) for a,b in zip(live,baseline)]
    mean = sum(delta)/len(delta)
    changed = sum(max(delta[i:i+3])>=4 for i in range(0,len(delta),3))/(len(delta)//3)
    geometry = max(abs(height/ref["height"]-1), abs(width/ref["width"]-1))
    ok = mean<=MAX_MEAN_RGB444 and changed<=MAX_CHANGED_FRACTION and geometry<=MAX_GEOMETRY_DRIFT
    if not ok:
        OUT.mkdir(parents=True,exist_ok=True)
        heat = Image.new("RGB",GRID)
        heat.putdata([(min(255,max(delta[i:i+3])*48),0,0) for i in range(0,len(delta),3)])
        heat.resize((320,1280),Image.Resampling.NEAREST).save(OUT/(name+"-heatmap.png"))
    return ok, f"{name}: {'PASS' if ok else 'FAIL'} (mean={mean:.2f}/15; changed={changed:.1%}; geometry={geometry:.1%})"
def main():
    refs=json.loads(BASELINES.read_text(encoding="utf-8"))
    results={name:compare(name,ref) for name,ref in refs.items()}
    for ok,detail in results.values(): print(detail)
    summary="## GlowQuest visual regression\n\n| Screen | Result | Details |\n|---|---|---|\n"
    for name,(ok,detail) in results.items(): summary+=f"| {name} | {'✅' if ok else '❌'} | {detail} |\n"
    summary+="\nThese compact baseline fingerprints were derived from reviewed CI screenshots. Actual full-size screenshots and visual-change heatmaps are attached as artifacts.\n"
    if os.getenv("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as out: out.write(summary)
    return 0 if all(ok for ok,_ in results.values()) else 1
if __name__=="__main__": sys.exit(main())
