# Professional Tish Rasmlari (1-8 tartibida, chapdan o'ngga)

Bu papkada barcha tishlar uchun professional rasmlar joylashgan. Tishlar 1 dan 8 gacha raqamlangan, **chapdan o'ngga** tartibda.

## Fayllar

### Yuqori jag' (Upper Jaw) - u1 dan u8 gacha, chapdan o'ngga
- `u1.png` - Tish 1 (eng chapdagi)
- `u2.png` - Tish 2
- `u3.png` - Tish 3
- `u4.png` - Tish 4
- `u5.png` - Tish 5
- `u6.png` - Tish 6
- `u7.png` - Tish 7
- `u8.png` - Tish 8 (eng o'ngdagi)

### Pastki jag' (Lower Jaw) - l1 dan l8 gacha, chapdan o'ngga
- `l1.png` - Tish 1 (eng chapdagi)
- `l2.png` - Tish 2
- `l3.png` - Tish 3
- `l4.png` - Tish 4
- `l5.png` - Tish 5
- `l6.png` - Tish 6
- `l7.png` - Tish 7
- `l8.png` - Tish 8 (eng o'ngdagi)

**Eslatma:** 
- "u" harfi = upper/yuqori jag'ni bildiradi
- "l" harfi = lower/pastki jag'ni bildiradi
- Tartib: **chapdan o'ngga** (1 dan 8 gacha)

## Features

✅ **Professional Design**: Clean, anatomically accurate tooth shapes
✅ **No Background**: Transparent background with subtle shadows
✅ **Scalable**: SVG format ensures crisp rendering at any size
✅ **Realistic**: Gradient enamel effect and proper root structure
✅ **Mirrored Support**: Left-side teeth (21-25) automatically mirror right-side images

## Customization

If you want to use your own reference images from the "tishlarni rasmi" folder:

### Option 1: Convert Your Images to SVG

1. Use an image editor (Photoshop, GIMP, or online tools like remove.bg) to:
   - Remove backgrounds from your JPG images
   - Clean up edges
   - Save as PNG with transparency

2. Convert PNG to SVG using:
   - Adobe Illustrator
   - Inkscape (free)
   - Online converters (vectorizer.ai, autotracer.org)

3. Replace the corresponding SVG files in this directory

### Option 2: Use Existing Reference Images Directly

If you prefer to use the JPG images directly:

1. Process images to remove backgrounds using:
   ```bash
   # Using ImageMagick (install first)
   magick "tepa 1.jpg" -fuzz 20% -trim +repage -background none 11.png
   ```

2. Or use online tools like:
   - remove.bg
   - Photopea.com
   - Canva background remover

3. Place processed images in `/public/teeth/` directory

4. Update `CUSTOM_TOOTH_SRC` in `RealisticTooth.jsx` to point to new files

## Technical Details

Barcha 32 ta tish uchun professional SVG rasmlar yaratildi:
- **Yuqori o'ng** (11-18): 8 ta tish
- **Yuqori chap** (21-28): 8 ta tish (o'ng tomondan aks ettirilgan)
- **Pastki o'ng** (41-48): 8 ta tish
- **Pastki chap** (31-38): 8 ta tish (o'ng tomondan aks ettirilgan)

FDI chart atlas endi ishlatilmaydi - barcha tishlar custom SVG rasmlardan foydalanadi.

## Color Scheme

- Enamel: White to light gray gradient (#ffffff → #f8f9fa)
- Outline: Medium gray (#9ca3af)
- Roots: Light gray (#f5f5f5)
- Shadow: Subtle drop shadow for depth

## Keyingi qadamlar

Agar tishlarning rangini yoki dizaynini o'zgartirmoqchi bo'lsangiz:

1. SVG fayllarni matn muharririda oching (VS Code, Notepad++)
2. Rang kodlarini o'zgartiring:
   - `#ffffff` → Tish emali rangi
   - `#9ca3af` → Kontur rangi
   - `#f5f5f5` → Ildiz rangi
3. Faylni saqlang va brauzerni yangilang

Yoki "tishlarni rasmi" papkasidagi JPG rasmlaringizni ishlatishingiz mumkin (yuqoridagi ko'rsatmalarga qarang).
