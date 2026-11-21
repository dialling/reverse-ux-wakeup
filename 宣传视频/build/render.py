#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""《醒醒！分钱了》宣传片渲染器 —— 逐帧合成，管道送入 ffmpeg"""
import os, sys, math, subprocess, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT = "/Users/a27/Projects/x 黑客松"
SHOTS = f"{ROOT}/验证证据与截图"
OUT = f"{ROOT}/宣传视频"
ASSETS = f"{OUT}/assets"
os.makedirs(ASSETS, exist_ok=True)

W, H, FPS = 1920, 1080, 30
DUR = 50.0

INK    = (9, 13, 24)
INK2   = (16, 24, 40)
CREAM  = (246, 241, 227)
YELLOW = (250, 204, 21)
RED    = (239, 68, 68)
GREEN  = (34, 197, 94)
MUT    = (150, 161, 182)
DIM    = (98, 109, 130)

CNF = "/System/Library/Fonts/Hiragino Sans GB.ttc"
AVF = "/System/Library/Fonts/Avenir Next.ttc"
BLF = "/System/Library/Fonts/Supplemental/Arial Black.ttf"

@functools.lru_cache(maxsize=256)
def F_CN(size, w=6):
    return ImageFont.truetype(CNF, size, index=(2 if w == 6 else 0))

@functools.lru_cache(maxsize=256)
def F_AV(size, wt=2):
    idx = {8: 8, 0: 0, 2: 2, 5: 5, 7: 7}[wt]
    return ImageFont.truetype(AVF, size, index=idx)

@functools.lru_cache(maxsize=64)
def F_BL(size):
    return ImageFont.truetype(BLF, size)

def cl(x, a=0.0, b=1.0):
    return a if x < a else (b if x > b else x)

def p(t, start, dur):
    if dur <= 0: return 1.0 if t >= start else 0.0
    return cl((t - start) / dur)

def eo(x):  return 1 - (1 - cl(x)) ** 3
def ei(x):  return cl(x) ** 3
def eio(x):
    x = cl(x); return 3 * x * x - 2 * x * x * x
def eob(x):
    x = cl(x); c1 = 1.70158; c3 = c1 + 1
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2

def mix(c1, c2, t):
    t = cl(t)
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

def text_w(font, s, tr=0):
    return sum(font.getlength(c) for c in s) + tr * max(0, len(s) - 1)

def dt(d, xy, s, font, fill, tr=0, anchor="l"):
    total = text_w(font, s, tr)
    x = xy[0]
    if anchor == "c": x -= total / 2
    elif anchor == "r": x -= total
    for c in s:
        d.text((x, xy[1]), c, font=font, fill=fill)
        x += font.getlength(c) + tr
    return total

# ---------------- 背景 ----------------
def make_bg():
    yy, xx = np.mgrid[0:H, 0:W]
    y = np.linspace(0, 1, H)[:, None]
    top = np.array([8, 11, 21], float); bot = np.array([23, 32, 54], float)
    grad = top[None, None, :] + (bot - top)[None, None, :] * (y[:, :, None] ** 0.85)
    arr = np.repeat(grad, W, axis=1).astype(float)
    dist = np.sqrt(((xx - 330) / 1000.0) ** 2 + ((yy - 60) / 780.0) ** 2)
    glow = np.clip(1 - dist, 0, 1) ** 2 * 34
    arr[..., 0] += glow * 0.95; arr[..., 1] += glow * 0.60; arr[..., 2] += glow * 0.18
    dot = ((xx % 44 < 3) & (yy % 44 < 3)).astype(float) * 16
    arr += dot[..., None]
    hb = 330
    tb = np.linspace(0, 1, hb)[:, None, None]
    ynorm = np.linspace(0, 1, H)[:, None, None]
    scrim = (1 - 0.58 * ynorm ** 2.4)
    ttop = np.clip(1 - ynorm * H / 320.0, 0, 1) ** 2
    scrim = scrim * (1 - 0.48 * ttop)
    arr *= scrim
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    return Image.fromarray(arr).convert("RGBA")

BG = make_bg()
GRAINS = [np.random.default_rng(i).normal(0, 2.6, (H, W)).astype(np.int16) for i in range(4)]

# ---------------- 面板 ----------------
_SH = {}
def shadow_layer(w, h, r, blur=26, alpha=170):
    key = (w, h, r, blur, alpha)
    if key in _SH: return _SH[key]
    pad = blur * 2
    m = Image.new("L", (w + pad * 2, h + pad * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle([pad, pad, pad + w, pad + h], radius=r, fill=alpha)
    m = m.filter(ImageFilter.GaussianBlur(blur))
    sh = Image.new("RGBA", m.size, (0, 0, 0, 0)); sh.putalpha(m)
    _SH[key] = sh
    return sh

def paste_panel(base, src, box, radius=26, zoom=1.0, panx=0.0, pany=0.0,
                shadow=True, fade_bottom=0, border=True):
    x0, y0, x1, y1 = [int(v) for v in box]
    tw, th = x1 - x0, y1 - y0
    if shadow:
        sh = shadow_layer(tw, th, radius)
        base.alpha_composite(sh, (x0 - 52, y0 - 52 + 16))
    cw, ch = src.width / zoom, src.height / zoom
    cx = src.width / 2 + panx * (src.width - cw) / 2
    cy = src.height / 2 + pany * (src.height - ch) / 2
    crop = src.crop((int(cx - cw / 2), int(cy - ch / 2),
                     int(cx - cw / 2) + int(cw), int(cy - ch / 2) + int(ch)))
    crop = crop.resize((tw, th), Image.LANCZOS)
    mask = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, tw - 1, th - 1], radius=radius, fill=255)
    if fade_bottom > 0:
        g = Image.new("L", (1, th), 255)
        for yy in range(th - fade_bottom, th):
            g.putpixel((0, yy), int(255 * (1 - (yy - (th - fade_bottom)) / fade_bottom)))
        mask = ImageChops.multiply(mask, g.resize((tw, th)))
    base.paste(crop, (x0, y0), mask)
    if border:
        d = ImageDraw.Draw(base)
        d.rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=radius,
                            outline=(255, 255, 255, 30), width=2)
    return base

def draw_cover(base, src, zoom=1.0, panx=0.0, pany=0.0):
    sr, tr = src.width / src.height, W / H
    if sr > tr: ch = src.height; cw = ch * tr
    else:       cw = src.width;  ch = cw / tr
    cw /= zoom; ch /= zoom
    cx = src.width / 2 + panx * (src.width - cw) / 2
    cy = src.height / 2 + pany * (src.height - ch) / 2
    crop = src.crop((int(cx - cw / 2), int(cy - ch / 2),
                     int(cx - cw / 2) + int(cw), int(cy - ch / 2) + int(ch)))
    base.paste(crop.resize((W, H), Image.LANCZOS), (0, 0))

def hazard(im, box, phase=0.0, stripe=32, c1=YELLOW, c2=(11, 11, 15)):
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h = x1 - x0, y1 - y0
    bar = Image.new("RGB", (w, h), c2)
    bd = ImageDraw.Draw(bar)
    k = -(phase % (2 * stripe)) - h
    while k < w + h:
        bd.polygon([(k, 0), (k + stripe, 0), (k + stripe - h, h), (k - h, h)], fill=c1)
        k += 2 * stripe
    im.paste(bar, (x0, y0))

def stamp(text, font, fg, bg=None, angle=-7, pad=22, border=None):
    tw = int(text_w(font, text))
    th = int(font.size * 1.35)
    im = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg: d.rectangle([0, 0, im.width - 1, im.height - 1], fill=bg)
    if border: d.rectangle([3, 3, im.width - 4, im.height - 4], outline=border, width=3)
    d.text((pad, pad), text, font=font, fill=fg)
    return im.rotate(angle, expand=True, resample=Image.BICUBIC)

def paste_alpha(base, im, xy, alpha=1.0):
    if alpha >= 0.999:
        base.alpha_composite(im, (int(xy[0]), int(xy[1]))); return
    a = im.getchannel("A").point(lambda v: int(v * alpha))
    tmp = im.copy(); tmp.putalpha(a)
    base.alpha_composite(tmp, (int(xy[0]), int(xy[1])))

def check_mark(d, x, y, s=1.0, color=GREEN, width=5):
    d.line([x, y + 9 * s, x + 8 * s, y + 17 * s], fill=color, width=width)
    d.line([x + 8 * s, y + 17 * s, x + 21 * s, y], fill=color, width=width)

def subtitle(im, s, a=1.0, y=1004):
    if a <= 0: return
    d = ImageDraw.Draw(im)
    d.rectangle([W // 2 - 22, y - 20, W // 2 + 22, y - 17], fill=mix(INK, YELLOW, a))
    dt(d, (W / 2, y), s, F_AV(32, 2), mix(INK, (238, 242, 250), a), 3.6, anchor="c")

def eyebrow(d, xy, s, color=YELLOW, size=24, tr=7):
    dt(d, xy, s, F_AV(size, 8), color, tr)

# ---------------- 素材 ----------------
def load(name): return Image.open(f"{SHOTS}/{name}").convert("RGB")
IMG = {}
def img(key, name, box=None):
    if key not in IMG:
        im = load(name)
        IMG[key] = im.crop(box) if box else im
    return IMG[key]

PHONE = {
    1: ("quad",   (370, 72, 688, 858)),
    2: ("shame",  (30, 116, 444, 928)),
    3: ("math",   (40, 42, 402, 868)),
    4: ("lines",  (40, 42, 402, 868)),
    5: ("park",   (34, 42, 442, 936)),
}
def phone(i):
    key, box = PHONE[i]
    if key not in IMG:
        name = {"quad": "screen-quad-phones-lan.png", "shame": "screen-slider-and-shame.png",
                "math": "screen-parking-and-raid.png", "lines": "screen-flow-connect.png",
                "park": "screen-parking-jam.png"}[key]
        IMG[key] = load(name)
    return IMG[key].crop(box)

# ---------------- 场景 ----------------
S = dict(hook=0.0, comp=5.6, title=9.6, contract=15.0, levels=22.0,
         quad=32.0, settle=38.0, outro=43.6, end=50.0)

def s_hook(t):
    im = BG.copy(); d = ImageDraw.Draw(im)
    hh = int(250 * eo(p(t, 0.1, 0.7)))
    d.rectangle([96, 106, 100, 106 + hh], fill=RED)
    eyebrow(d, (132, 100), "REVERSE UX CHALLENGE")
    d.text((132, 140), "逆向 UX 挑战赛 · 404 寝室", font=F_CN(28, 0), fill=DIM)

    times = [("06:50", 0.15), ("06:53", 0.62), ("06:55", 1.09), ("06:58", 1.56), ("07:00", 2.03)]
    fb = F_BL(100)
    for i, (tm, st) in enumerate(times):
        a = p(t, st, 0.34)
        if a <= 0: continue
        y = 228 + i * 100
        x = 132 - (1 - eo(a)) * 70
        col = mix(INK, CREAM, a) if t < st + 0.5 else mix(CREAM, (84, 94, 114), p(t, st + 0.5, 0.35))
        d.text((x, y), tm, font=fb, fill=col)
        sp = p(t, st + 0.5, 0.26)
        if sp > 0:
            d.rectangle([x - 4, y + 64, x - 4 + fb.getlength(tm) * sp, y + 70], fill=mix(INK, RED, sp))

    cnt = max(1, sum(1 for _, st in times if t > st + 0.25))
    if t > 0.1:
        d.text((1330, 206), f"{cnt:02d}", font=F_BL(340),
               fill=(24, 32, 52), stroke_width=2, stroke_fill=(50, 62, 90))
        dt(d, (1352, 588), "ALARMS SET", F_AV(22, 8), DIM, 9)
        d.rectangle([1352, 620, 1352 + 150, 623], fill=(48, 60, 88))

    a = p(t, 2.8, 0.5)
    if a > 0:
        y = 806 - (1 - eo(a)) * 24
        d.text((132, y), "五个闹钟，一个都没叫醒你。", font=F_CN(64, 6), fill=mix(INK, CREAM, a))
    subtitle(im, "FIVE ALARMS. NONE OF THEM GOT YOU OUT OF BED.", p(t, 3.3, 0.4))
    return im

def s_comp(t):
    im = BG.copy(); d = ImageDraw.Draw(im)
    a0 = p(t, 0.0, 0.45)
    eyebrow(d, (132, 100), "COMPLIANT UX", mix(INK, RED, a0))
    d.text((132, 140), "顺从式 UX：按钮越大，你关得越快", font=F_CN(28, 0), fill=mix(INK, DIM, a0))

    sx0, sy0, sx1, sy1 = 180, 348, 1740, 488
    if a0 > 0.02:
        d.rounded_rectangle([sx0, sy0, sx1, sy1], radius=70, fill=mix(INK, (18, 26, 42), a0),
                            outline=mix(INK, (46, 58, 84), a0), width=2)
    prog = eio(p(t, 0.2, 1.0))
    fw = int((sx1 - sx0 - 16) * prog)
    if fw > 24:
        d.rounded_rectangle([sx0 + 8, sy0 + 8, sx0 + 8 + fw, sy1 - 8], radius=62, fill=YELLOW)
    if prog > 0.02:
        kx = sx0 + 8 + max(0, fw - 112)
        d.rounded_rectangle([kx, sy0 + 10, kx + 112, sy1 - 10], radius=52, fill=CREAM)
        if a0 > 0.3:
            d.text((sx0 + 46, sy0 + 58), "滑动关闭闹钟", font=F_CN(34, 6), fill=(28, 36, 54))

    a_ok = p(t, 1.0, 0.35)
    if a_ok > 0:
        dt(d, (180, 296), "0.8 SECONDS  ·  ONE SWIPE", F_AV(20, 8), mix(INK, (120, 132, 154), a_ok), 5)

    if t > 1.22:
        xx = eo(p(t, 1.22, 0.28))
        cx, cy = 960, 418
        ln = 290 * xx
        d.line([cx - ln, cy - ln * 0.55, cx + ln, cy + ln * 0.55], fill=RED, width=18)
        d.line([cx + ln, cy - ln * 0.55, cx - ln, cy + ln * 0.55], fill=RED, width=18)

    if t > 1.55:
        st = stamp("太顺手了", F_CN(58, 6), CREAM, bg=(190, 30, 40), angle=-6, border=CREAM)
        paste_alpha(im, st, (1408, 168), p(t, 1.55, 0.3))

    a = p(t, 1.72, 0.42)
    if a > 0:
        d.text((132, 612), "所有闹钟，都在帮你继续睡。", font=F_CN(64, 6), fill=mix(INK, CREAM, a))
    a2 = p(t, 2.05, 0.42)
    if a2 > 0:
        d.text((136, 716), "手比脑子先醒 —— 这就是「顺手」的代价。", font=F_CN(30, 0),
               fill=mix(INK, (168, 178, 196), a2))
    subtitle(im, "THE EASIER IT IS TO DISMISS, THE FASTER YOU SLEEP IN.", p(t, 2.0, 0.4))
    return im

def s_title(t):
    im = BG.copy(); d = ImageDraw.Draw(im)
    hazard(im, (0, 0, W, 52), phase=t * 26)
    hazard(im, (0, H - 52, W, H), phase=-t * 26)

    k = eob(p(t, 0.15, 0.8))
    sc = 0.92 + 0.08 * k
    a = p(t, 0.15, 0.45)

    f = F_CN(172, 6)
    w1 = text_w(f, "醒醒！")
    w2 = text_w(f, "分钱了")
    total = w1 + w2
    lay = Image.new("RGBA", (int(total) + 90, 300), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    ld.text((45, 18), "醒醒！", font=f, fill=mix((0, 0, 0, 0), CREAM + (255,), a))
    bx = 45 + w1
    ld.rectangle([bx - 8, 54, bx + w2 + 12, 262], fill=mix((0, 0, 0, 0), (204, 38, 46, 255), a))
    ld.text((bx, 18), "分钱了", font=f, fill=mix((0, 0, 0, 0), YELLOW + (255,), a))
    if sc != 1.0:
        lay = lay.resize((int(lay.width * sc), int(lay.height * sc)), Image.BICUBIC)
    paste_alpha(im, lay, ((W - lay.width) / 2, 168 - (lay.height - 300) / 2))

    a2 = p(t, 0.85, 0.45)
    if a2 > 0:
        dt(d, (W / 2, 470), "SNOOZE  &  LOSE", F_AV(40, 8), mix(INK, YELLOW, a2), 14, anchor="c")

    a3 = p(t, 1.25, 0.45)
    if a3 > 0:
        d.text((W / 2, 560 - (1 - eo(a3)) * 18), "你多睡的每一分钟，都在亲手给室友加鸡腿。",
               font=F_CN(56, 6), fill=mix(INK, CREAM, a3), anchor="ma")
        dt(d, (W / 2, 648), "EVERY MINUTE YOU SLEEP IN BUYS YOUR ROOMMATE BREAKFAST.",
           F_AV(27, 2), mix(INK, (154, 166, 188), a3), 3.4, anchor="c")

    chips = ["404 寝室", "4 人契约", "¥200 押金池", "07:00 生死局"]
    cw = [text_w(F_CN(28, 0), c) + 46 for c in chips]
    tot = sum(cw) + 18 * (len(chips) - 1)
    cx = (W - tot) / 2
    a4 = p(t, 1.7, 0.5)
    for c, w_ in zip(chips, cw):
        if a4 > 0:
            d.rounded_rectangle([cx, 736, cx + w_, 796], radius=30,
                                outline=mix(INK, (74, 88, 116), a4), width=2)
            d.text((cx + 23, 751), c, font=F_CN(28, 0), fill=mix(INK, (206, 214, 228), a4))
        cx += w_ + 18
    return im

def s_contract(t):
    im = BG.copy(); d = ImageDraw.Draw(im)
    eyebrow(d, (132, 100), "23:30  ·  MIDNIGHT CONTRACT")
    d.text((132, 140), "熄灯前，四个人把押金拍在桌上", font=F_CN(28, 0), fill=DIM)

    names = ["1 号床 · 卷王老张", "2 号床 · 早八阿强", "3 号床 · 回笼觉小李", "4 号床 · 死睡阿伟"]
    for i, nm in enumerate(names):
        a = p(t, 0.15 + i * 0.16, 0.4)
        if a <= 0: continue
        y = 250 + i * 96
        x = 132 - (1 - eo(a)) * 50
        d.text((x, y), nm, font=F_CN(36, 0), fill=mix(INK, (198, 207, 222), a))
        amt = 50.0 * eo(p(t, 0.45 + i * 0.16, 0.55))
        d.text((560, y - 4), f"¥{amt:05.2f}", font=F_BL(40), fill=mix(INK, CREAM, a))

    a = p(t, 1.4, 0.4)
    if a > 0:
        d.rectangle([132, 660, 780, 663], fill=mix(INK, (58, 72, 100), a))
        d.text((132, 690), "公共契约池", font=F_CN(30, 0), fill=mix(INK, DIM, a))
        amt = 200.0 * eo(p(t, 1.5, 0.8))
        d.text((126, 740), f"¥{amt:06.2f}", font=F_BL(112), fill=mix(INK, YELLOW, a))
        d.text((134, 880), "Σ 四人余额 + 奖池  ≡  ¥200.00", font=F_CN(26, 0),
               fill=mix(INK, (120, 132, 152), a))

    panel = img("console", "screen-director-console.png")
    a5 = p(t, 0.5, 0.7)
    if a5 > 0:
        off = (1 - eo(a5)) * 70
        paste_panel(im, panel, (852 + off, 200, 1830 + off, 918), radius=26,
                    zoom=1.02 + 0.04 * eio(p(t, 0.5, 6.0)), panx=-0.12)

    subtitle(im, "FOUR ROOMMATES × ¥50 = A ¥200 POT, LOCKED UNTIL 07:00.", p(t, 1.8, 0.5))
    return im

LEVELS = [
    ("躲避滑块", "ESCAPE THE SLIDER", "你越急着划，它躲得越快。"),
    ("社死认怂书", "TYPE YOUR CONFESSION", "禁粘贴，错一个字全部清零。"),
    ("晃动算术", "SHUFFLED MATH", "键盘每次作答都会重新洗牌。"),
    ("同色连线", "NO-CROSS LINES", "撞到异色线，双端一起短路。"),
    ("无碰撞挪车", "PARKING JAM", "擦碰即回退，10–14 步才出库。"),
]
SEG = 2.0

def s_levels(t):
    im = BG.copy(); d = ImageDraw.Draw(im)
    idx = min(4, int(t / SEG))
    tl = t - idx * SEG
    name, en, desc = LEVELS[idx]

    eyebrow(d, (132, 100), "FIVE ANTI-HUMAN CHALLENGES")
    d.text((132, 140), "五大逆向关卡 · 每一关都专治肌肉记忆", font=F_CN(28, 0), fill=DIM)

    a = eo(p(tl, 0.02, 0.35))
    n = f"{idx+1:02d}"
    d.text((126 - (1 - a) * 40, 210), n, font=F_BL(210), fill=mix(INK, YELLOW, a))
    d.text((126 + F_BL(210).getlength(n) + 10, 350), "/ 05", font=F_BL(44), fill=mix(INK, DIM, a))

    a2 = p(tl, 0.08, 0.35)
    if a2 > 0:
        d.text((132 - (1 - eo(a2)) * 30, 470), name, font=F_CN(88, 6), fill=mix(INK, CREAM, a2))
        dt(d, (136 - (1 - eo(a2)) * 30, 600), en, F_AV(30, 8), mix(INK, YELLOW, a2), 6)
        d.text((136, 668), desc, font=F_CN(34, 0), fill=mix(INK, MUT, p(tl, 0.2, 0.4)))

    # 进度
    for i in range(5):
        x = 132 + i * 126
        col = YELLOW if i == idx else (46, 58, 84)
        d.rounded_rectangle([x, 780, x + 106, 786], radius=3, fill=col)

    # 手机
    ph = phone(idx + 1)
    a3 = p(tl, 0.0, 0.42)
    if a3 > 0:
        off = (1 - eo(a3)) * 110
        box = (1150 + off, 78, 1560 + off, 1008)
        paste_panel(im, ph, box, radius=34, zoom=1.03 + 0.05 * eio(p(tl, 0, SEG)),
                    panx=0, pany=0.1, fade_bottom=(70 if idx == 4 else 0))

    subtitle(im, "STEP " + f"{idx+1} / 5  ·  CLEARABLE IN 30–60 SECONDS", 1.0)
    return im

def s_quad(t):
    im = BG.copy()
    draw_cover(im, img("quadfull", "screen-quad-phones-lan.png"), zoom=1.02 + 0.05 * eio(p(t, 0, 6.0)))
    ov_yy, ov_xx = np.mgrid[0:H, 0:W]
    alpha = np.full((H, W), 146.0)
    alpha += 104 * np.clip(1 - ov_xx / 1020.0, 0, 1) ** 1.1
    alpha += 92 * np.clip((ov_yy - (H - 320)) / 320.0, 0, 1) ** 1.4
    alpha = np.clip(alpha, 0, 240).astype(np.uint8)
    ov = np.zeros((H, W, 4), np.uint8)
    ov[..., 0] = 6; ov[..., 1] = 9; ov[..., 2] = 16; ov[..., 3] = alpha
    im = Image.alpha_composite(im, Image.fromarray(ov, "RGBA"))
    d = ImageDraw.Draw(im)

    eyebrow(d, (132, 150), "LIVE  LAN  SYNC")
    d.text((132, 210), "4 部手机，一本账。", font=F_CN(66, 6), fill=CREAM)
    d.text((132, 322), "四个室友同时在线，红包毫秒级互飞。", font=F_CN(32, 0), fill=(186, 196, 212))

    tags = ["WebSocket 局域网同步", "资金守恒 100% 校验", "免安装单文件 HTML"]
    for i, tg in enumerate(tags):
        y = 448 + i * 84
        d.rectangle([132, y + 12, 139, y + 46], fill=YELLOW)
        d.text((160, y), tg, font=F_CN(34, 0), fill=(220, 227, 240))

    dt(d, (132, 748), "DORM 404  ·  4 PHONES  ·  1 LEDGER", F_AV(24, 8), (150, 161, 182), 6)
    subtitle(im, "FOUR PHONES. ONE LEDGER. ZERO LAG.", 1.0)
    return im

def s_settle(t):
    im = BG.copy(); d = ImageDraw.Draw(im)
    eyebrow(d, (132, 108), "07:08  ·  SETTLEMENT")
    d.text((132, 164), "钱，一分不差。", font=F_CN(72, 6), fill=CREAM)
    d.text((132, 284), "赖床的押金，当场飞进早起室友的餐盘。", font=F_CN(30, 0), fill=MUT)

    d.rounded_rectangle([132, 372, 700, 512], radius=18, fill=(16, 24, 40), outline=(46, 58, 84), width=2)
    d.text((158, 392), "今日鸡腿收割王", font=F_CN(26, 0), fill=MUT)
    d.text((158, 432), "卷王老张  +¥17.50", font=F_CN(38, 6), fill=GREEN)

    d.rounded_rectangle([132, 536, 700, 676], radius=18, fill=(16, 24, 40), outline=(70, 36, 44), width=2)
    d.text((158, 556), "全寝平躺垫底王", font=F_CN(26, 0), fill=MUT)
    d.text((158, 596), "死睡阿伟  -¥15.00", font=F_CN(38, 6), fill=RED)

    paste_panel(im, img("bill", "screen-settlement-bill.png", (486, 142, 956, 804)),
                (1010, 118, 1522, 838), radius=20,
                zoom=1.0 + 0.06 * eio(p(t, 0, 5.4)), pany=0.04, shadow=True)

    a = p(t, 1.35, 0.45)
    if a > 0:
        y = 720 + (1 - eo(a)) * 24
        d.rounded_rectangle([132, y, 700, y + 104], radius=14, fill=(9, 32, 21),
                            outline=mix(INK, GREEN, a), width=3)
        check_mark(d, 162, y + 26, 1.0, mix(INK, GREEN, a), 4)
        d.text((196, y + 18), "资金守恒校验 100% 通过", font=F_CN(30, 6), fill=mix(INK, GREEN, a))
        d.text((162, y + 62), "Σ 余额 + 奖池 ≡ ¥200.00", font=F_CN(24, 0), fill=mix(INK, (140, 196, 164), a))

    subtitle(im, "EVERY FEN ACCOUNTED FOR. ALL OF IT GOES TO WHOEVER GOT UP.", p(t, 1.7, 0.5))
    return im

def s_outro(t):
    im = BG.copy(); d = ImageDraw.Draw(im)
    hazard(im, (0, 0, W, 48), phase=t * 24)
    hazard(im, (0, H - 48, W, H), phase=-t * 24)

    f1, f2 = F_CN(104, 6), F_CN(104, 6)
    w1, w2 = text_w(f1, "醒醒！"), text_w(f2, "分钱了")
    total = w1 + w2
    x0 = (W - total) / 2
    a = p(t, 0.15, 0.45)
    lay = Image.new("RGBA", (int(total) + 60, 260), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lay)
    ld.text((30, 20), "醒醒！", font=f1, fill=mix((0, 0, 0, 0), CREAM + (255,), a))
    ld.text((30 + w1, 20), "分钱了", font=f2, fill=mix((0, 0, 0, 0), YELLOW + (255,), a))
    paste_alpha(im, lay, ((W - lay.width) / 2, 150))

    a2 = p(t, 0.6, 0.5)
    dt(d, (W / 2, 322), "SNOOZE & LOSE  ·  DORM 404", F_AV(26, 8), mix(INK, (140, 152, 174), a2), 9, anchor="c")

    a3 = p(t, 0.9, 0.5)
    if a3 > 0:
        d.text((W / 2, 382), "祝各位老师，每天清晨都不给室友加鸡腿。",
               font=F_CN(42, 6), fill=mix(INK, CREAM, a3), anchor="ma")
        dt(d, (W / 2, 452), "MAY YOUR ROOMMATES NEVER GET FREE BREAKFAST.",
           F_AV(24, 2), mix(INK, (146, 158, 180), a3), 3.2, anchor="c")

    a4 = p(t, 1.35, 0.55)
    if a4 > 0:
        d.text((W / 2, 528 - (1 - eo(a4)) * 16), "WAKE  UP.  OR  PAY  UP.",
               font=F_AV(92, 8), fill=mix(INK, YELLOW, a4), anchor="ma")

    chips = ["5 关全解 · DFS/BFS 验证", "资金守恒 ¥200.00", "局域网 4 机同步", "Dify 工作流 · 视觉海报"]
    cw = [text_w(F_CN(26, 0), c) + 40 for c in chips]
    tot = sum(cw) + 16 * (len(chips) - 1)
    cx = (W - tot) / 2
    a5 = p(t, 1.75, 0.5)
    for c, w_ in zip(chips, cw):
        if a5 > 0:
            d.rounded_rectangle([cx, 700, cx + w_, 756], radius=28, outline=mix(INK, (70, 84, 112), a5), width=2)
            d.text((cx + 20, 713), c, font=F_CN(26, 0), fill=mix(INK, (190, 200, 216), a5))
        cx += w_ + 16

    a6 = p(t, 2.05, 0.5)
    dt(d, (W / 2, 812), "REVERSE UX CHALLENGE  ·  2026", F_AV(24, 8), mix(INK, (110, 122, 144), a6), 7, anchor="c")
    return im

SCENES = [(S["hook"], s_hook), (S["comp"], s_comp), (S["title"], s_title),
          (S["contract"], s_contract), (S["levels"], s_levels), (S["quad"], s_quad),
          (S["settle"], s_settle), (S["outro"], s_outro)]
FADES = {S["comp"]: 0.40, S["title"]: 0.55, S["contract"]: 0.45,
         S["levels"]: 0.0, S["quad"]: 0.45, S["settle"]: 0.40, S["outro"]: 0.50}

def scene_at(T):
    idx = 0
    for i, (st, _) in enumerate(SCENES):
        if T >= st: idx = i
    st, fn = SCENES[idx]
    # 淡入（与上一场交叉）
    if idx > 0 and FADES.get(st, 0) > 0:
        fd = FADES[st]
        if T < st + fd / 2:
            pst, pfn = SCENES[idx - 1]
            a = (T - (st - fd / 2)) / fd
            return Image.blend(pfn(T - pst).convert("RGB"), fn(T - st).convert("RGB"), cl(a))
    # 淡出（与下一场交叉）
    if idx + 1 < len(SCENES):
        nst, nfn = SCENES[idx + 1]
        fd = FADES.get(nst, 0)
        if fd > 0 and T > nst - fd / 2:
            a = (T - (nst - fd / 2)) / fd
            return Image.blend(fn(T - st).convert("RGB"), nfn(T - nst).convert("RGB"), cl(a))
    return fn(T - st).convert("RGB")

def render_frame(T, i):
    im = scene_at(T)
    arr = np.asarray(im).astype(np.int16)
    g = GRAINS[(i // 3) % len(GRAINS)]
    arr = np.clip(arr + g[..., None], 0, 255).astype(np.uint8)
    # 结尾淡出
    if T > 49.1:
        k = 1 - cl((T - 49.1) / 0.9)
        arr = (arr.astype(np.float32) * k).astype(np.uint8)
    return arr

def main():
    if "--stills" in sys.argv:
        ts = [2.6, 4.9, 7.6, 12.2, 18.4, 23.2, 27.4, 34.6, 40.6, 46.2]
        for k, T in enumerate(ts):
            im = Image.fromarray(render_frame(T, int(T * FPS)))
            im.save(f"{ASSETS}/still_{k:02d}_{T:.1f}s.png")
            print("still", T)
        return

    ff = "/Users/a27/.workbuddy-ai/binaries/python/versions/3.13.12/lib/python3.13/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v9.0"
    out = f"{OUT}/build/video_silent.mp4"
    cmd = [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium",
           "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL)
    N = int(DUR * FPS)
    for i in range(N):
        arr = render_frame(i / FPS, i)
        proc.stdin.write(arr.tobytes())
        if i % 150 == 0:
            print(f"frame {i}/{N}", flush=True)
    proc.stdin.close(); proc.wait()
    print("done", out)

if __name__ == "__main__":
    main()
