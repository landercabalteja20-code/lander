# Writes vignette.png: the film's edge darkening as a 1080x1920 overlay, applied in the final encode
import sys, numpy as np
from PIL import Image
W, H = 1080, 1920; cx, cy = 540, 0.45 * H; rx, ry = cx * 2 ** 0.5, (H - cy) * 2 ** 0.5
y, x = np.mgrid[0:H, 0:W]; s = np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
a = 0.6 * 0.75 * np.clip((s - 0.55) / 0.45, 0, 1)          # clear centre, up to 45% darker in the far corners
img = np.zeros((H, W, 4), np.uint8); img[..., 3] = (a * 255).round().astype(np.uint8)
Image.fromarray(img, "RGBA").save(sys.argv[1] if len(sys.argv) > 1 else "vignette.png")
