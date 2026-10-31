import sys, glob, os
from PIL import Image, ImageDraw
d, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3])
fs = sorted(glob.glob(os.path.join(d, 'f_*.png')))
if len(sys.argv) > 4: fs = [f for f in fs if any(s in f for s in sys.argv[4:])]
ims = [Image.open(f).convert('RGB') for f in fs]
if not ims: sys.exit('none')
w, h = ims[0].size; sc = 0.6 if cols > 3 else 1.0
tw, th = int(w*sc), int(h*sc)
rows = (len(ims)+cols-1)//cols
sheet = Image.new('RGB', (tw*cols, th*rows))
for i, (f, im) in enumerate(zip(fs, ims)):
    im = im.resize((tw, th)); dr = ImageDraw.Draw(im); dr.text((8, 8), os.path.basename(f)[2:-4], fill=(255,255,0))
    sheet.paste(im, ((i%cols)*tw, (i//cols)*th))
sheet.save(out)
