import sys, glob
from PIL import Image, ImageDraw
src, out, per_row, rows = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
fs = sorted(glob.glob(src + "/s*.jpg")); n = per_row * rows
for k in range(0, len(fs), n):
    ims = [Image.open(f) for f in fs[k:k + n]]; w, h = ims[0].size
    sheet = Image.new("RGB", (w * per_row, h * rows), (40, 40, 40))
    for i, (f, im) in enumerate(zip(fs[k:k + n], ims)):
        d = ImageDraw.Draw(im); d.rectangle([0, 0, 44, 22], fill=(0, 0, 0)); d.text((4, 4), f.split("/")[-1][1:4], fill=(255, 255, 0))
        sheet.paste(im, ((i % per_row) * w, (i // per_row) * h))
    sheet.save(f"{out}_{k // n:02d}.jpg", quality=82)
print("sheets:", (len(fs) + n - 1) // n)
