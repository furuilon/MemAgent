"""生成 MemAgent 应用图标: 墨黑圆角方块 + 白色 M + 琥珀记忆光点"""
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SIZE = 512
OUT_DIR = Path(__file__).resolve().parent.parent

INK_TOP = (31, 31, 35)
INK_BOTTOM = (13, 13, 16)
AMBER = (217, 119, 6)
AMBER_LIGHT = (245, 158, 11)
WHITE = (250, 250, 249)


def rounded_gradient(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)

    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGBA", (size, size))
    gd = ImageDraw.Draw(grad)
    for y in range(size):
        t = y / size
        r = int(INK_TOP[0] + (INK_BOTTOM[0] - INK_TOP[0]) * t)
        g = int(INK_TOP[1] + (INK_BOTTOM[1] - INK_TOP[1]) * t)
        b = int(INK_TOP[2] + (INK_BOTTOM[2] - INK_TOP[2]) * t)
        gd.line([(0, y), (size, y)], fill=(r, g, b, 255))
    img.paste(grad, (0, 0), mask)
    return img


def main() -> None:
    img = rounded_gradient(SIZE, 116)

    d = ImageDraw.Draw(img)

    font_path = Path(r"C:\Windows\Fonts\arialbd.ttf")
    font = (
        ImageFont.truetype(str(font_path), 300)
        if font_path.exists()
        else ImageFont.load_default()
    )
    bbox = d.textbbox((0, 0), "M", font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (SIZE - w) // 2 - bbox[0]
    y = (SIZE - h) // 2 - bbox[1] - 6
    d.text((x, y), "M", font=font, fill=(*WHITE, 255))

    cx, cy, r = SIZE - 118, 118, 46
    for step in range(3):
        rr = r + step * 14
        alpha = 90 - step * 28
        d.ellipse(
            [cx - rr, cy - rr, cx + rr, cy + rr],
            outline=(*AMBER_LIGHT, alpha),
            width=6,
        )
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*AMBER_LIGHT, 255))

    ring_r = r + 26
    d.arc(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        start=200,
        end=340,
        fill=(*AMBER, 160),
        width=10,
    )

    icon_256 = img.resize((256, 256), Image.LANCZOS)

    ico_path = OUT_DIR / "icon.ico"
    icon_256.save(
        str(ico_path),
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

    png_dir = OUT_DIR.parent / "frontend" / "public"
    png_dir.mkdir(parents=True, exist_ok=True)
    icon_256.save(str(png_dir / "favicon.png"), format="PNG")

    print(f"icon.ico + favicon.png generated ({ico_path}, {png_dir / 'favicon.png'})")


if __name__ == "__main__":
    main()
