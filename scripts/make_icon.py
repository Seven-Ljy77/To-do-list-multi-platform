from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
SCALE = 4
W = SIZE * SCALE

img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

margin = 64 * SCALE
radius = 220 * SCALE
draw.rounded_rectangle(
    (margin, margin, W - margin, W - margin),
    radius=radius,
    fill=(15, 118, 110, 255),
)

# A slightly lighter top edge keeps the flat colour from looking dead.
draw.rounded_rectangle(
    (margin, margin, W - margin, W - margin),
    radius=radius,
    outline=(255, 255, 255, 18),
    width=3 * SCALE,
)

cream = (251, 247, 236, 255)
points = [(290 * SCALE, 520 * SCALE), (445 * SCALE, 675 * SCALE), (745 * SCALE, 360 * SCALE)]
width = 78 * SCALE
draw.line(points, fill=cream, width=width, joint="curve")
for x, y in points:
    draw.ellipse((x - width // 2, y - width // 2, x + width // 2, y + width // 2), fill=cream)

dot_x, dot_y, dot_r = 760 * SCALE, 285 * SCALE, 46 * SCALE
draw.ellipse(
    (dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r),
    fill=(242, 184, 75, 255),
)

img = img.resize((SIZE, SIZE), Image.LANCZOS)
out = Path(__file__).resolve().parent.parent / "frontend" / "app-icon.png"
img.save(out)
print(out)
