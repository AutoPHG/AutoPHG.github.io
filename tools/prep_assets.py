# -*- coding: utf-8 -*-
"""Resize / convert the channel art in E:/WebPort/Asset into web-ready files."""
import os, sys, glob
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = "E:/WebPort/Asset"
OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)


def find(sub):
    hits = [p for p in glob.glob(SRC + "/**/*", recursive=True) if sub in os.path.basename(p)]
    assert hits, sub
    return hits[0]


def trim(im, pad=0):
    a = np.array(im)[..., 3]
    ys, xs = np.where(a > 8)
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0), min(xs.max() + pad + 1, im.width), min(ys.max() + pad + 1, im.height))
    return im.crop(box)


def save(im, name, size=None, q=86, do_trim=False):
    im = im.convert("RGBA")
    if do_trim:
        im = trim(im)
    if size:
        im.thumbnail((size, size), Image.LANCZOS)
    p = os.path.join(OUT, name)
    im.save(p, "WEBP", quality=q, method=6)
    a = np.array(im)[..., 3]
    print(f"{name:22s} {im.size} transparent={round((a < 10).mean() * 100, 1)}% {os.path.getsize(p) // 1024}KB")
    return im


sword = save(Image.open(find("535_2025")), "art-sword.webp", 1200)
portrait = save(Image.open(find("Untitled design (4)")), "art-portrait.webp", 1000)
face = save(Image.open(find("(Logo) (3)")), "art-face.webp", 900)
save(Image.open(find("Tigger")), "tigger.webp", 720)
save(Image.open(find("cmon.png")), "cmonxn.webp", 720)
save(Image.open(find("TAC.png")), "tac.webp", 720, do_trim=True)
save(Image.open(find("red lightning")), "bolt-red.webp", 900, do_trim=True)
save(Image.open(find("lightning.png")) if "red" not in find("lightning.png") else Image.open(SRC + "/lightning.png"), "bolt-white.webp", 900, do_trim=True)
save(Image.open(find("red star")), "star-red.webp", 256, do_trim=True)
save(Image.open(find("orange star")), "star-orange.webp", 256, do_trim=True)
save(Image.open(find("purpblue")), "star-purple.webp", 256, do_trim=True)
save(Image.open(find("blue yellow")), "star-cyan.webp", 256, do_trim=True)
save(Image.open(find("8aec204b")), "star-long.webp", 700, do_trim=True)

# favicon + touch icon from the face art (it already sits on black)
f = Image.open(find("(Logo) (3)")).convert("RGBA")
bg = Image.new("RGBA", f.size, (0, 0, 0, 255)); bg.alpha_composite(f)
w, h = bg.size
crop = bg.crop((int(w * .12), int(h * .02), int(w * .92), int(h * .82)))
crop.resize((192, 192), Image.LANCZOS).convert("RGB").save(os.path.join(OUT, "icon-192.png"), optimize=True)
crop.resize((64, 64), Image.LANCZOS).convert("RGB").save(os.path.join(OUT, "favicon.png"), optimize=True)

# social card 1200x630
W, H = 1200, 630
og = Image.new("RGB", (W, H), (6, 6, 7))
d = ImageDraw.Draw(og, "RGBA")
for x in range(0, W, 60):
    d.line([(x, 0), (x, H)], fill=(255, 255, 255, 12))
for y in range(0, H, 60):
    d.line([(0, y), (W, y)], fill=(255, 255, 255, 12))
d.polygon([(W * .50, H), (W * .78, 0), (W, 0), (W, H)], fill=(255, 16, 40, 255))
glow = Image.new("RGB", (W, H), (0, 0, 0)); gd = ImageDraw.Draw(glow)
gd.ellipse([W * .35, H * .1, W * 1.05, H * 1.2], fill=(120, 0, 14))
og = Image.blend(og, Image.composite(glow.filter(ImageFilter.GaussianBlur(120)), og, Image.new("L", (W, H), 90)), .6)
d = ImageDraw.Draw(og, "RGBA")
d.polygon([(W * .56, H), (W * .80, 0), (W, 0), (W, H)], fill=(255, 16, 40, 255))
art = Image.open(find("535_2025")).convert("RGBA"); art.thumbnail((640, 640), Image.LANCZOS)
og.paste(art, (W - art.width + 10, H - art.height + 20), art)
try:
    big = ImageFont.truetype("C:/Windows/Fonts/impact.ttf", 230)
    small = ImageFont.truetype("C:/Windows/Fonts/consolab.ttf", 22)
    d = ImageDraw.Draw(og)
    d.text((56, 120), "AUTO", font=big, fill=(244, 241, 234))
    d.text((56, 320), "PHG.", font=big, fill=(255, 16, 40))
    d.text((60, 70), "ROBLOX CONTENT CREATOR  /  TAC PARTNER", font=small, fill=(200, 200, 200))
except Exception as e:
    print("font fallback", e)
og.save(os.path.join(OUT, "og.jpg"), quality=88, optimize=True)
print("og.jpg", os.path.getsize(os.path.join(OUT, "og.jpg")) // 1024, "KB")
