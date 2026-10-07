"""work/<name>.aligned.json + work/<name>.music.json → films/<name>/timing.json (what the film page reads).

usage: python tools/build_timing.py <name>
Manual corrections (checked by ear against the ASR word list) live in FIX below.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
name = sys.argv[1]
# line index → overrides. "unsung": the sheet has the line but the singers skip it (shown as a written caption).
FIX = {
    "02-february-line": {
        15: {"end": 112.0},                       # 說辭 — the last note is held, then the interlude
        27: {"unsung": True, "start": 212.5, "end": 226.5},   # 把最深的依戀 藏進最輕的對白: guitar solo instead
        32: {"end": 269.7},
    },
    "01-october-rain": {},
}[name]
al = json.loads((ROOT / "work" / f"{name}.aligned.json").read_text(encoding="utf-8"))
mu = json.loads((ROOT / "work" / f"{name}.music.json").read_text(encoding="utf-8"))
lines = []
for i, ln in enumerate(al):
    fx = FIX.get(i, {})
    text = ln["text"]
    if fx.get("unsung"):
        n = len(text)
        ct = [fx["start"] + (fx["end"] - fx["start"] - 4.0) * k / n for k in range(n)]
        lines.append({"i": i, "sec": ln["sec"], "who": ln["who"], "text": text, "t0": fx["start"], "t1": fx["end"], "unsung": True,
                      "ct": [round(c, 2) for c in ct]})
        continue
    # one time per display character: CJK characters carry their aligned time, the rest inherit the next one's
    m = dict(zip(ln["ci"], ln["ct"]))
    ct, nxt = [None] * len(text), None
    for k in range(len(text) - 1, -1, -1):
        if k in m:
            nxt = m[k]
        ct[k] = nxt
    last = max(m.values())
    for k in range(len(text)):
        if ct[k] is None:
            ct[k] = last + 0.25
    # keep times monotone (alignment noise)
    for k in range(1, len(ct)):
        ct[k] = max(ct[k], ct[k - 1])
    end = fx.get("end", min(ln["end"], last + 4.0))
    lines.append({"i": i, "sec": ln["sec"], "who": ln["who"], "text": text, "t0": round(ct[0], 2), "t1": round(end, 2),
                  "ct": [round(c, 2) for c in ct]})
for a, b in zip(lines, lines[1:]):
    if not b.get("unsung") and not a.get("unsung"):
        a["t1"] = round(min(a["t1"], max(a["ct"][-1] + 0.4, b["t0"])), 2)
out = {"name": name, "duration": mu["duration"], "tempo": mu["tempo"], "beats": mu["beats"], "onsets": mu["onsets"],
       "env_dt": mu["env_dt"], "env": mu["env"], "lines": lines}
(ROOT / "films" / name / "timing.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
for l in lines:
    print(f"{l['i']:2d} {l['t0']:7.2f} {l['t1']:7.2f} {l['who']} {l['text']}{'  (unsung)' if l.get('unsung') else ''}")
