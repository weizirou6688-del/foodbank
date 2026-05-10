"""
Stitch 4 journey screenshots into a 2x2 grid.
Each frame gets a white circle with black letter in the top-left corner.
Output: docs/final_report/image/implementation/journey-public-application.png
"""
import math
import os
from PIL import Image, ImageDraw, ImageFont

IMPL_DIR = os.path.join(
    os.path.dirname(__file__), "..",
    "docs", "final_report", "image", "implementation"
)
FRAMES = [
    ("a", "journey-public-01-search.png"),
    ("b", "journey-public-02-results.png"),
    ("c", "journey-public-03-select.png"),
    ("d", "journey-public-04-redeemed.png"),
]
OUT = os.path.join(IMPL_DIR, "journey-public-application.png")

# ── layout params ────────────────────────────────────────────────────────────
GAP   = 12          # px gap between frames
PAD   = 0           # outer padding
# Each input frame is 1440×900; scale down to fit in a reasonable output size
TARGET_FRAME_W = 960   # scaled frame width
TARGET_FRAME_H = 600   # scaled frame height (maintaining 1440:900 = 8:5)

# 12 mm circle: at 150 DPI → 12*150/25.4 ≈ 71px; use 72px at scale
# Scale factor: TARGET_FRAME_W/1440 ≈ 0.667; original 12mm at 96dpi ≈ 45px → scaled ≈ 30px
# Use 64px circle on the scaled frame for good visibility
CIRCLE_R = 34          # radius in px
CIRCLE_MARGIN = 18     # offset from top-left corner to circle centre
FONT_SIZE = 36         # font size for letter inside circle

def make_grid():
    frames = []
    for label, filename in FRAMES:
        img = Image.open(os.path.join(IMPL_DIR, filename)).convert("RGBA")
        # Scale to target size
        img = img.resize((TARGET_FRAME_W, TARGET_FRAME_H), Image.LANCZOS)
        frames.append((label, img))

    # Grid: 2 cols, 2 rows
    cols, rows = 2, 2
    total_w = PAD * 2 + cols * TARGET_FRAME_W + (cols - 1) * GAP
    total_h = PAD * 2 + rows * TARGET_FRAME_H + (rows - 1) * GAP

    canvas = Image.new("RGBA", (total_w, total_h), (255, 255, 255, 255))

    for i, (label, img) in enumerate(frames):
        col = i % cols
        row = i // cols
        x = PAD + col * (TARGET_FRAME_W + GAP)
        y = PAD + row * (TARGET_FRAME_H + GAP)

        # Draw circle label on the frame
        frame_with_label = img.copy()
        draw = ImageDraw.Draw(frame_with_label)

        cx = CIRCLE_MARGIN + CIRCLE_R
        cy = CIRCLE_MARGIN + CIRCLE_R

        # White filled circle
        draw.ellipse(
            [cx - CIRCLE_R, cy - CIRCLE_R, cx + CIRCLE_R, cy + CIRCLE_R],
            fill=(255, 255, 255, 240),
            outline=(0, 0, 0, 255),
            width=2,
        )

        # Try to load a font; fall back to default
        font = None
        for font_path in [
            "C:/Windows/Fonts/arialbd.ttf",
            "C:/Windows/Fonts/arial.ttf",
            "C:/Windows/Fonts/calibrib.ttf",
            "C:/Windows/Fonts/calibri.ttf",
        ]:
            if os.path.exists(font_path):
                try:
                    font = ImageFont.truetype(font_path, FONT_SIZE)
                    break
                except Exception:
                    pass

        # Draw letter
        text = f"({label})"
        if font:
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
        else:
            tw, th = FONT_SIZE * len(text) * 0.6, FONT_SIZE
        tx = cx - tw / 2
        ty = cy - th / 2
        draw.text((tx, ty), text, fill=(0, 0, 0, 255), font=font)

        canvas.paste(frame_with_label, (x, y))

    # Convert to RGB for PNG output
    out_img = canvas.convert("RGB")
    out_img.save(OUT, "PNG", optimize=True)
    print(f"Grid saved: {OUT}")
    print(f"  Size: {out_img.size[0]}x{out_img.size[1]} px")

if __name__ == "__main__":
    make_grid()
