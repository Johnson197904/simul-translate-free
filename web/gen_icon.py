"""生成同声传译 APP 图标"""
from PIL import Image, ImageDraw
import os

def create_icon(size, filename):
    # 渐变背景
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 紫色渐变背景
    for y in range(size):
        ratio = y / size
        r = int(102 + (118 - 102) * ratio)   # 102 -> 118
        g = int(126 + (75 - 126) * ratio)     # 126 -> 75
        b = int(234 + (162 - 234) * ratio)    # 234 -> 162
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    # 圆角矩形
    margin = int(size * 0.1)
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=int(size * 0.18),
        fill=(255, 255, 255, 40)
    )

    cx, cy = size // 2, size // 2
    unit = size // 10

    # 麦克风头（圆角矩形）
    mic_w, mic_h = unit * 2, unit * 3
    draw.rounded_rectangle(
        [cx - mic_w // 2, cy - mic_h // 2 - unit,
         cx + mic_w // 2, cy + mic_h // 2 - unit // 2],
        radius=unit // 2,
        fill=(255, 255, 255, 255)
    )

    # 麦克风支架（弧线）
    draw.arc(
        [cx - unit * 1.5, cy - unit * 0.5, cx + unit * 1.5, cy + unit * 2.5],
        start=0, end=180,
        fill=(255, 255, 255, 255)
    )
    # 支架横线
    draw.line(
        [cx - unit * 1.5, cy + unit * 2, cx + unit * 1.5, cy + unit * 2],
        fill=(255, 255, 255, 255),
        width=max(2, unit // 4)
    )

    # 声波（用扁椭圆线条代替）
    for i in range(1, 4):
        ew = unit * (0.5 + i * 0.6)
        eh = unit * (1.2 + i * 1.0)
        draw.arc(
            [cx - unit * 2.5 - ew, cy - eh,
             cx - unit * 2.5 + ew, cy + eh],
            start=200, end=340,
            fill=(255, 255, 255, 200)
        )
        draw.arc(
            [cx + unit * 2.5 - ew, cy - eh,
             cx + unit * 2.5 + ew, cy + eh],
            start=200, end=340,
            fill=(255, 255, 255, 200)
        )

    img.save(filename, 'PNG')
    print(f"OK: {filename}")


base = os.path.dirname(os.path.abspath(__file__))
for sz, fn in [(192, 'icon-192.png'), (512, 'icon-512.png')]:
    create_icon(sz, os.path.join(base, fn))
