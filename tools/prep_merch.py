"""Cut the shirt thumbnails out of the Roblox group screenshot and prep partner / event images.
Usage: python tools/prep_merch.py <catalog_screenshot.png> <hamsterhub_logo> <event_photo> media/img"""
import sys, os
import numpy as np
from PIL import Image, ImageFilter
shot, logo, photo, out = sys.argv[1:5]
os.makedirs(os.path.join(out, "shirts"), exist_ok=True)

im = Image.open(shot).convert("RGB"); a = np.asarray(im).astype(np.int32)
# tiles are lighter than the page background: find their columns / rows from the first image row band
bgpage = a[2, 2]; tile = a[90, 60]
print("page", bgpage, "tile", tile, im.size)
notPage = np.abs(a - bgpage).sum(-1) > 36
cols = notPage[20:160].mean(0) > .9; rows = notPage[:, 40:190].mean(1) > .9
def runs(m, minlen):
    out, s = [], None
    for i, v in enumerate(list(m) + [False]):
        if v and s is None: s = i
        if not v and s is not None:
            if i - s >= minlen: out.append((s, i))
            s = None
    return out
xs = runs(cols, 120); ys = runs(rows, 120)
print("detected cols", xs, "rows", ys)
# the Roblox catalog grid is regular; use its measured geometry (1340px-wide capture, 7 columns of 175px tiles)
xs = [(x + 3, x + 172) for x in (31, 220, 410, 599, 789, 978)] + [(1171, 1337)]; ys = [(y + 4, y + 172) for y in (5, 268, 531)]
n = 0
for r, (y0, y1) in enumerate(ys):
    for c, (x0, x1) in enumerate(xs):
        crop = im.crop((x0, y0, x1, y1)); arr = np.asarray(crop).astype(np.int32)
        if (np.abs(arr - bgpage).sum(-1) < 36).mean() > .5: continue             # empty slot
        edge = np.concatenate([arr[:, 2:5], arr[:, -5:-2]], 1).mean(1, keepdims=True)   # tile colour per row (it is a soft gradient)
        d = np.abs(arr - edge).sum(-1).astype(np.float32)
        alpha = np.clip((d - 16) / 30, 0, 1)
        al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.6))
        t = crop.convert("RGBA"); t.putalpha(al)
        t = t.resize((crop.width * 2, crop.height * 2), Image.LANCZOS)
        t.save(os.path.join(out, "shirts", f"s{n:02d}.webp"), "WEBP", quality=90, method=6); n += 1
print("shirts", n)

lg = Image.open(logo).convert("RGBA"); la = np.asarray(lg)
print("logo", lg.size, "transparent%", round((la[..., 3] < 10).mean() * 100, 1), "corner", la[5, 5])
if (la[..., 3] < 10).mean() < .05:                                             # white background -> transparent
    d = (255 - la[..., :3].astype(np.int32)).sum(-1); la = la.copy(); la[..., 3] = np.clip(d * 6, 0, 255).astype(np.uint8); lg = Image.fromarray(la, "RGBA")
bb = lg.getbbox(); lg = lg.crop(bb); lg.thumbnail((520, 520), Image.LANCZOS); lg.save(os.path.join(out, "hamsterhub.webp"), "WEBP", quality=90, method=6); print("hamsterhub", lg.size)

ph = Image.open(photo).convert("RGB"); ph.thumbnail((1280, 1280), Image.LANCZOS); ph.save(os.path.join(out, "event-rcs.webp"), "WEBP", quality=82, method=6)
print("event", ph.size, os.path.getsize(os.path.join(out, "event-rcs.webp")) // 1024, "KB")
