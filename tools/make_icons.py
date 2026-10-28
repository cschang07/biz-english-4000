#!/usr/bin/env python3
"""產生 dist/icon-{180,192,512}.png（與 dist/icon.svg 同圖案，滿版背景以符合 maskable / iOS 規格）。

需要 Pillow：pip install pillow
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
SS = 4  # 超取樣倍率，縮小後邊緣較平滑
BASE = 512


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def draw_master() -> Image.Image:
    n = BASE * SS
    s = SS
    c1, c2 = (0x3D, 0x5A, 0xFE), (0x8B, 0x5C, 0xF6)
    grad = Image.new("RGB", (n, n))
    px = grad.load()
    for y in range(n):
        for x in range(n):
            px[x, y] = lerp(c1, c2, (x + y) / (2 * (n - 1)))
    d = ImageDraw.Draw(grad)

    def rr(x, y, w, h, r, fill):
        d.rounded_rectangle([x * s, y * s, (x + w) * s, (y + h) * s], radius=r * s, fill=fill)

    white = (255, 255, 255)
    rr(120, 212, 220, 168, 30, white)
    rr(152, 258, 120, 22, 11, c1)
    rr(152, 302, 156, 16, 8, (0xB9, 0xC1, 0xFF))
    rr(152, 334, 96, 16, 8, (0xB9, 0xC1, 0xFF))

    cx, cy = 360, 192
    d.ellipse([(cx - 16) * s, (cy - 16) * s, (cx + 16) * s, (cy + 16) * s], fill=white)
    stroke = 22
    for r in (46, 80):
        d.arc([(cx - r - stroke / 2) * s, (cy - r - stroke / 2) * s,
               (cx + r + stroke / 2) * s, (cy + r + stroke / 2) * s],
              start=-90, end=0, fill=white, width=stroke * s)
        for ex, ey in ((cx, cy - r), (cx + r, cy)):  # 圓頭端點
            d.ellipse([(ex - stroke / 2) * s, (ey - stroke / 2) * s,
                       (ex + stroke / 2) * s, (ey + stroke / 2) * s], fill=white)
    return grad


if __name__ == "__main__":
    master = draw_master()
    for size in (180, 192, 512):
        out = DIST / f"icon-{size}.png"
        master.resize((size, size), Image.LANCZOS).save(out, optimize=True)
        print(f"wrote {out.relative_to(ROOT)}")
