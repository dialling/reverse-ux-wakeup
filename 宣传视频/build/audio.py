#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""原创配乐：96 BPM，A 小调，纯合成，无外部素材"""
import numpy as np, wave, struct, sys

SR = 44100
DUR = 50.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

BPM = 96.0
BEAT = 60.0 / BPM          # 0.625
BAR = 4 * BEAT             # 2.5

L = np.zeros(N + SR * 4)
R = np.zeros(N + SR * 4)

def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    if i0 >= N + SR * 4: return
    seg = sig[:max(0, len(L) - i0)]
    gl = gain * np.cos((pan + 1) * np.pi / 4)
    gr = gain * np.sin((pan + 1) * np.pi / 4)
    L[i0:i0 + len(seg)] += seg * gl
    R[i0:i0 + len(seg)] += seg * gr

def env_adsr(n, a, d, s, r, sr=SR):
    e = np.ones(n)
    ia, id_, ir = int(a * sr), int(d * sr), int(r * sr)
    ia = min(ia, n)
    if ia > 0: e[:ia] = np.linspace(0, 1, ia) ** 1.2
    if id_ > 0:
        id_ = min(id_, n - ia)
        e[ia:ia + id_] = np.linspace(1, s, id_)
        e[ia + id_:] = s
    if ir > 0:
        ir = min(ir, n)
        e[n - ir:] *= np.linspace(1, 0, ir) ** 1.5
    return e

def tone(f, dur, partials=((1, 1.0),), a=0.01, d=0.0, s=1.0, r=0.2, detune=0.0):
    n = int(dur * SR); t = np.arange(n) / SR
    sig = np.zeros(n)
    fs = [f]
    if detune: fs = [f * (1 - detune), f, f * (1 + detune)]
    for ff in fs:
        for mult, amp in partials:
            sig += amp * np.sin(2 * np.pi * ff * mult * t + rng.uniform(0, 6.28)) / len(fs)
    return sig * env_adsr(n, a, d, s, r)

def kick(dur=0.42, f0=128, f1=44, amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 26)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) * np.exp(-t * 7.0)
    sig[:int(0.004 * SR)] += rng.normal(0, 0.25, int(0.004 * SR))
    return sig * amp

def hat(dur=0.07, amp=1.0, tone_f=7800):
    n = int(dur * SR)
    x = rng.normal(0, 1, n)
    x = np.diff(np.concatenate([[0], x]))       # 简易高通
    x *= np.exp(-np.arange(n) / (0.012 * SR))
    x += 0.3 * np.sin(2 * np.pi * tone_f * np.arange(n) / SR) * np.exp(-np.arange(n) / (0.006 * SR))
    return x * amp

def snare(dur=0.22, amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.normal(0, 1, n) * np.exp(-t * 22)
    x += 0.5 * np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30)
    return x * amp

def tick(amp=1.0):
    n = int(0.03 * SR); t = np.arange(n) / SR
    x = rng.normal(0, 1, n) * np.exp(-t * 260)
    x += 0.7 * np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 300)
    return x * amp

def chime(f=1046.5, dur=1.6, amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * f * t) + 0.6 * np.sin(2 * np.pi * f * 1.5 * t)
           + 0.3 * np.sin(2 * np.pi * f * 2.01 * t))
    return sig * np.exp(-t * 2.6) * amp

def impact(dur=1.8, amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 38 + 60 * np.exp(-t * 5)
    sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    nz = rng.normal(0, 1, n) * np.exp(-t * 6) * 0.35
    return (sig + nz) * amp

def sweep(dur=0.8, amp=1.0, up=True):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = rng.normal(0, 1, n)
    # 简易扫频带通：用变化的梳状滤波近似
    mod = np.sin(2 * np.pi * (300 + (2200 if up else -2200) * t / dur) * t) * 0.5 + 0.5
    sig = nz * mod
    e = np.linspace(0, 1, n) ** 2 if up else np.linspace(1, 0, n) ** 2
    return sig * e * amp

# ---------------- 编排 ----------------
NOTE = dict(A1=55.0, A2=110.0, C2=65.41, C3=130.81, D3=146.83, E3=164.81, F2=87.31,
            F3=174.61, G2=98.0, G3=196.0, B3=246.94, C4=261.63, E4=329.63, A3=220.0, A4=440.0)

CHORDS = [
    ("Am", ["A2", "C3", "E3"]),
    ("F",  ["F2", "A3", "C4"]),
    ("C",  ["C3", "E3", "G3"]),
    ("G",  ["G2", "B3", "D3"]),
]

PAD_PART = ((1, 1.0), (2, 0.28), (3, 0.12))
BASS_PART = ((1, 1.0), (2, 0.35), (3, 0.1))

def pad_chord(notes, dur, amp, a=0.7, r=1.4):
    sig = None
    for nm in notes:
        s = tone(NOTE[nm], dur + 0.9, PAD_PART, a=a, s=0.85, r=r, detune=0.004)
        sig = s if sig is None else sig + s
    return sig * amp / len(notes)

# 1) 低音持续音（0 - 10s）
drone = tone(NOTE["A1"], 11.0, ((1, 1.0), (2, 0.5), (3, 0.18)), a=2.2, s=0.9, r=1.2)
add(drone, 0.0, 0.062)

# 2) 开场：滴答钟声（0 - 9.6）
t = 0.0; k = 0
while t < 9.4:
    add(tick(0.55 if k % 2 == 0 else 0.32), t, 0.075, pan=0.25 if k % 2 else -0.25)
    t += BEAT / 2; k += 1

# 3) 开场铺底和声（每小节）
for b in range(4):
    nm, ns = CHORDS[0]
    add(pad_chord(ns, BAR * 0.9, 0.048, a=0.9, r=1.6), b * BAR, 1.0, pan=-0.1)

# 4) 起势（7.5 - 9.6）
add(sweep(1.9, 0.16, up=True), 7.6, 0.5, pan=0.15)
for i in range(4):
    add(hat(0.06, 0.6), 7.5 + i * BEAT / 2, 0.05)

# 5) 主歌 drop（10 - 38）
def groove(b0, b1, energy=1.0, arp=False, snare_on=False):
    for b in range(b0, b1):
        t0 = b * BAR
        nm, ns = CHORDS[(b - b0) % 4]
        add(pad_chord(ns, BAR * 0.92, 0.105 * energy, a=0.12, r=0.9), t0, 1.0, pan=-0.12)
        # 贝斯：8 分音符
        root = ns[0]
        for e8 in range(8):
            if e8 % 2 == 1 and energy < 1.05:
                continue
            add(tone(NOTE[root] / 2 if NOTE[root] > 90 else NOTE[root], BEAT / 2 * 0.85,
                     BASS_PART, a=0.004, s=0.7, r=0.05), t0 + e8 * BEAT / 2, 0.17 * energy, pan=0.0)
        # 鼓
        for bt in range(4):
            add(kick(0.4, 128, 44), t0 + bt * BEAT, 0.42 * energy)
            add(hat(0.07, 1.0), t0 + bt * BEAT + BEAT / 2, 0.055 * energy, pan=0.22)
            if arp:
                add(hat(0.05, 1.0), t0 + bt * BEAT + BEAT / 4, 0.028 * energy, pan=-0.2)
                add(hat(0.05, 1.0), t0 + bt * BEAT + BEAT * 3 / 4, 0.028 * energy, pan=-0.2)
            if snare_on and bt % 2 == 1:
                add(snare(0.2, 1.0), t0 + bt * BEAT, 0.11 * energy, pan=0.1)
        if arp:
            seq = ns + [ns[0]]
            for s16 in range(16):
                f = NOTE[seq[s16 % len(seq)]] * 4
                add(tone(f, BEAT / 4 * 0.8, ((1, 1.0), (2, 0.2)), a=0.003, s=0.5, r=0.03),
                    t0 + s16 * BEAT / 4, 0.032 * energy, pan=0.35 * np.sin(s16))

groove(4, 9, energy=0.95)            # 10 - 22.5
groove(9, 12, energy=1.05, arp=True, snare_on=True)   # 22.5 - 30
groove(12, 15, energy=1.0, arp=True, snare_on=True)   # 30 - 37.5

# 6) 段落转场音效
for tt, g in [(5.5, 0.13), (9.5, 0.20), (14.9, 0.12), (21.9, 0.14), (31.9, 0.14), (37.9, 0.13), (43.5, 0.15)]:
    add(sweep(0.7, g, up=True), tt - 0.7, 1.0, pan=0.0)

add(impact(1.9, 1.0), 9.6, 0.30)     # 片名重击
add(impact(1.6, 1.0), 43.6, 0.26)    # 收尾重击

# 7) 结算段（38 - 43.6）：半速、留白
for i, tt in enumerate([38.0, 40.0, 42.0]):
    nm, ns = CHORDS[i % 4]
    add(pad_chord(ns, 2.2, 0.135, a=0.5, r=1.2), tt, 1.0, pan=0.1)
add(chime(1046.5, 2.2, 1.0), 38.15, 0.10, pan=0.3)
add(chime(1568.0, 1.8, 1.0), 38.45, 0.06, pan=-0.25)
for bt in range(3):
    add(kick(0.5, 110, 40), 38.0 + bt * BEAT * 2, 0.30)

# 8) 收尾（43.6 - 50）
fin = None
for nm in ["A2", "C3", "E3", "A3", "E4"]:
    s = tone(NOTE[nm], 6.5, PAD_PART, a=0.25, s=0.75, r=3.0, detune=0.005)
    fin = s if fin is None else fin + s
add(fin * 0.085, 43.6, 1.0, pan=0.0)
add(chime(1046.5, 3.0, 1.0), 43.7, 0.07, pan=0.2)

# ---------------- 混响 ----------------
def reverb(x, dur=1.7, mix=0.30, sr=SR):
    n = int(dur * sr)
    ir = rng.normal(0, 1, n) * np.exp(-np.arange(n) / (0.42 * sr))
    ir[:int(0.012 * sr)] = 0
    size = 1 << int(np.ceil(np.log2(len(x) + n)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:len(x)]
    wet /= (np.max(np.abs(wet)) + 1e-9)
    wet *= np.max(np.abs(x)) + 1e-9
    return x * (1 - mix) + wet * mix

L = reverb(L, mix=0.26)
R = reverb(R, mix=0.28)

# ---------------- 母带 ----------------
def highpass(x, f=28, sr=SR):
    size = 1 << int(np.ceil(np.log2(len(x))))
    X = np.fft.rfft(x, size)
    freqs = np.fft.rfftfreq(size, 1 / sr)
    X *= 1 / (1 + (f / np.maximum(freqs, 1e-6)) ** 2)
    return np.fft.irfft(X, size)[:len(x)]

L = highpass(L); R = highpass(R)
mix = np.stack([L, R], axis=1)[:N]
peak = np.max(np.abs(mix))
mix = mix / peak * 0.90
mix = np.tanh(mix * 1.12) * 0.94          # 轻饱和
mix *= 0.98 / (np.max(np.abs(mix)) + 1e-9)

# 结尾淡出
fade = int(1.4 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.2

data = (mix * 32767).astype(np.int16)
with wave.open("/Users/a27/Projects/x 黑客松/宣传视频/build/music.wav", "w") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(data.tobytes())
print("wav ok", data.shape, "peak", np.max(np.abs(mix)))
