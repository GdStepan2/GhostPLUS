from PIL import Image, ImageDraw, ImageFont
import os

def create_ghost_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = size / 128.0

    # Rounded rectangle background with dark gradient / purple glow
    pad = int(4 * scale)
    corner = int(24 * scale)
    draw.rounded_rectangle(
        [(pad, pad), (size - pad - 1, size - pad - 1)],
        radius=corner,
        fill=(18, 14, 30, 255),
        outline=(168, 85, 247, 220),
        width=max(1, int(3 * scale))
    )

    # Ghost shape points (scaled from 128x128 reference)
    # Head & body
    gx = 64 * scale
    gy = 46 * scale
    r = 26 * scale

    # Ghost head
    draw.ellipse([(gx - r, gy - r), (gx + r, gy + r)], fill=(240, 240, 255, 255))
    # Ghost lower body
    body_top = gy
    body_bot = 84 * scale
    draw.rectangle([(gx - r, body_top), (gx + r, body_bot)], fill=(240, 240, 255, 255))

    # Ghost ripples / waves at bottom
    w = (2 * r) / 3
    for i in range(3):
        x0 = (gx - r) + i * w
        x1 = x0 + w
        draw.ellipse([(x0, body_bot - 6 * scale), (x1, body_bot + 8 * scale)], fill=(240, 240, 255, 255))

    # Eyes
    eye_r = max(1.5, 3.5 * scale)
    draw.ellipse([(55 * scale - eye_r, 48 * scale - eye_r), (55 * scale + eye_r, 48 * scale + eye_r)], fill=(20, 16, 36, 255))
    draw.ellipse([(73 * scale - eye_r, 48 * scale - eye_r), (73 * scale + eye_r, 48 * scale + eye_r)], fill=(20, 16, 36, 255))

    # PLUS badge at bottom-right
    plus_center_x = 94 * scale
    plus_center_y = 92 * scale
    plus_r = 18 * scale

    # Glowing plus circle
    draw.ellipse(
        [(plus_center_x - plus_r, plus_center_y - plus_r), (plus_center_x + plus_r, plus_center_y + plus_r)],
        fill=(147, 51, 234, 255),
        outline=(236, 72, 153, 255),
        width=max(1, int(2 * scale))
    )

    # Plus cross
    arm = 9 * scale
    thick = max(1.5, 3.5 * scale)
    # Horizontal arm
    draw.rectangle(
        [(plus_center_x - arm, plus_center_y - thick/2), (plus_center_x + arm, plus_center_y + thick/2)],
        fill=(255, 255, 255, 255)
    )
    # Vertical arm
    draw.rectangle(
        [(plus_center_x - thick/2, plus_center_y - arm), (plus_center_x + thick/2, plus_center_y + arm)],
        fill=(255, 255, 255, 255)
    )

    return img

os.makedirs('icons', exist_ok=True)
for s in [16, 32, 48, 128]:
    im = create_ghost_icon(s)
    im.save(f'icons/icon{s}.png')
print('Icons generated successfully.')
