#!/usr/bin/env python3
"""Normalize FDI tooth PNGs onto one 512×512 canvas.

For every ``public/teeth/{kind}/{fdi}.png`` (healthy, endo, caries, implant,
plomba, shtift, breket, metal-keramika, sirkon, protez-*, missing):

* trim to the opaque bounding box
* healthy set: knock out low-saturation grey/dark pixels that sit outside the
  tooth body (photo-background smudges), drop a neighbouring-tooth sliver, and
  keep only the largest connected opaque component
* other kinds: keep substantial extra parts (implant screw, braces, prosthesis
  wings) and only drop a few-pixel speck
* redraw on a 512×512 transparent canvas with the same tooth height for a given
  FDI across every kind, centered horizontally, crown on the occlusal edge
  (upper 11–28 anchored to the bottom, lower 31–48 anchored to the top)

``plomba/21.png`` is a hard crop through the crown (only the left portion of
the tooth is in the file, and the right edge is solid enamel). Before
normalization it is replaced with a horizontal mirror of ``plomba/11.png``,
the contralateral central incisor, so the full tooth is visible.

Requires Pillow, numpy, and scipy.

    python scripts/normalize-tooth-illustrations.py
    python scripts/normalize-tooth-illustrations.py --sheets-only /tmp/sheets
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

CANVAS = 512
# Tooth height as a fraction of the canvas. Same value for every FDI unless a
# very wide variant would overflow, in which case that FDI's height drops so
# every kind of that tooth still matches and still fits.
FILL = 0.90
MAX_WIDTH_FRAC = 0.92
OCCLUSAL_PAD = 8
ALPHA_TRIM = 10
# Visible tooth body. Faint resize fringes are not the crown edge.
SOLID_ALPHA = 32

KINDS = [
    "healthy",
    "endo",
    "caries",
    "implant",
    "plomba",
    "shtift",
    "breket",
    "metal-keramika",
    "sirkon",
    "protez-syomniy",
    "protez-implant",
    "protez-babochka",
    "missing",
]

UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
FDIS = [f"{q}{n}" for q in (1, 2, 3, 4) for n in range(1, 9)]


def is_upper(fdi: str) -> bool:
    n = int(fdi)
    return 11 <= n <= 28


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def is_hard_sliver(im: Image.Image) -> bool:
    """True when the bitmap is a narrow slice cut through the tooth body."""
    arr = np.asarray(im)
    height, width = arr.shape[:2]
    if height < 8 or width / height >= 0.20:
        return False
    alpha = arr[:, :, 3]
    right = float((alpha[:, -1] > 200).mean())
    left = float((alpha[:, 0] > 200).mean())
    return right > 0.85 or left > 0.85


def remove_grey_halo(im: Image.Image) -> tuple[Image.Image, int]:
    """Clear low-saturation grey/dark pixels that sit beside the tooth body.

    Enamel is bright even when it is nearly grey. Root dentine is chromatic.
    Photo-background smudges are dark, unsaturated, and outside the core span
    of the row. The tooth's own neck shading stays, because it lies inside
    that span.
    """
    arr = np.array(im)
    rgb = arr[:, :, :3].astype(np.float32)
    alpha = arr[:, :, 3]
    peak = rgb.max(axis=2)
    valley = rgb.min(axis=2)
    sat = np.where(peak > 1.0, (peak - valley) / np.maximum(peak, 1.0), 0.0)
    lum = rgb.mean(axis=2)
    core = (alpha > 20) & ((lum >= 165.0) | (sat >= 0.10))
    height, width = alpha.shape
    columns = np.arange(width)
    kill = np.zeros((height, width), dtype=bool)
    pad = 3
    for y in range(height):
        xs = np.flatnonzero(core[y])
        if xs.size == 0:
            continue
        left = int(xs[0]) - pad
        right = int(xs[-1]) + pad
        outside = (columns < left) | (columns > right)
        kill[y] = outside & (alpha[y] > 8) & (sat[y] < 0.09) & (lum[y] < 155.0)
    removed = int(kill.sum())
    if removed:
        arr[kill, 3] = 0
    return Image.fromarray(arr), removed


def keep_largest_component(im: Image.Image, thresh: int = 16) -> tuple[Image.Image, int]:
    arr = np.array(im)
    opaque = arr[:, :, 3] > thresh
    labels, count = ndimage.label(opaque)
    if count <= 1:
        return im if count == 1 else Image.fromarray(arr), 0
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    main = int(sizes.argmax())
    drop = labels != main
    # Only drop pixels that were opaque so we don't touch already-clear cells.
    drop &= opaque
    removed = int(drop.sum())
    arr[drop, 3] = 0
    return Image.fromarray(arr), removed


def remove_side_fragments(im: Image.Image, upper: bool) -> tuple[Image.Image, str]:
    """Drop a neighbouring-tooth sliver fused to the crown.

    Molar roots stay: they are wide and still connected in the root half.
    A neighbour fragment is a thin component parked outside the main body.
    """
    arr = np.array(im)
    alpha = arr[:, :, 3]
    opaque = alpha > 24
    ys, xs = np.where(opaque)
    if xs.size < 50:
        return im, ""
    y0 = int(ys.min())
    y1 = int(ys.max())
    span = y1 - y0 + 1
    band = np.zeros(opaque.shape, dtype=bool)
    if upper:
        cut = y0 + int(span * 0.58)
        band[:cut] = opaque[:cut]
    else:
        cut = y1 - int(span * 0.58) + 1
        band[cut:] = opaque[cut:]
    labels, count = ndimage.label(band)
    if count <= 1:
        return im, ""
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    main = int(sizes.argmax())
    main_xs = np.where(labels == main)[1]
    main_x0 = int(main_xs.min())
    main_x1 = int(main_xs.max())
    main_w = main_x1 - main_x0 + 1
    main_area = int(sizes[main])
    kill_x = np.zeros(arr.shape[1], dtype=bool)
    notes = []
    for idx in range(1, count + 1):
        if idx == main or sizes[idx] < 80:
            continue
        comp_xs = np.where(labels == idx)[1]
        x0 = int(comp_xs.min())
        x1 = int(comp_xs.max())
        width = x1 - x0 + 1
        if x1 >= main_x0 and x0 <= main_x1:
            continue
        if width > max(28, int(0.18 * main_w)):
            continue
        if int(sizes[idx]) > 0.12 * main_area:
            continue
        kill_x[x0 : x1 + 1] = True
        notes.append(f"x={x0}-{x1} n={int(sizes[idx])}")
    if not kill_x.any():
        return im, ""
    arr[:, kill_x, 3] = 0
    return Image.fromarray(arr), ", ".join(notes)


def trim(im: Image.Image) -> Image.Image:
    arr = np.array(im)
    ys, xs = np.where(arr[:, :, 3] > ALPHA_TRIM)
    if xs.size == 0:
        return Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    x0, x1 = int(xs.min()), int(xs.max()) + 1
    y0, y1 = int(ys.min()), int(ys.max()) + 1
    cropped = arr[y0:y1, x0:x1].copy()
    # White under fully transparent pixels so LANCZOS does not fringe black.
    cropped[cropped[:, :, 3] == 0, :3] = 255
    return Image.fromarray(cropped)


def bounds(im: Image.Image, thresh: int) -> tuple[int, int, int, int] | None:
    arr = np.asarray(im)
    ys, xs = np.where(arr[:, :, 3] > thresh)
    if xs.size == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def solid_bounds(im: Image.Image) -> tuple[int, int, int, int] | None:
    return bounds(im, SOLID_ALPHA) or bounds(im, ALPHA_TRIM)


def place(im: Image.Image, shared_h: int, upper: bool) -> Image.Image:
    """Scale the visible body to ``shared_h`` and pin its crown to the occlusal edge.

    LANCZOS softens the crown tip, so the scale is nudged until the solid
    body lands on the target height, then the crown edge is shifted onto the pad.
    """
    solid = solid_bounds(im)
    if solid is None or shared_h < 1:
        return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    sx0, _sy0, sx1, sy1 = solid
    solid_w = max(1, sx1 - sx0)
    solid_h = max(1, sy1 - solid[1])
    max_w = int(round(CANVAS * MAX_WIDTH_FRAC))
    scale = shared_h / solid_h
    if solid_w * scale > max_w:
        scale = max_w / solid_w
    target_h = max(1, int(round(solid_h * scale)))
    resized = im
    placed = solid
    for _ in range(6):
        new_w = max(1, int(round(im.width * scale)))
        new_h = max(1, int(round(im.height * scale)))
        resized = im.resize((new_w, new_h), Image.Resampling.LANCZOS)
        placed = solid_bounds(resized)
        if placed is None:
            return Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        got_h = placed[3] - placed[1]
        got_w = placed[2] - placed[0]
        if got_w > max_w + 1 and scale > 0:
            scale *= max_w / got_w
            continue
        if abs(got_h - target_h) <= 1 or got_h < 1:
            break
        scale *= target_h / got_h
    px0, py0, px1, py1 = placed
    if upper:
        y = (CANVAS - OCCLUSAL_PAD) - py1
    else:
        y = OCCLUSAL_PAD - py0
    solid_cx = (px0 + px1) / 2.0
    x = int(round((CANVAS / 2.0) - solid_cx))
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(resized, (x, y), resized)
    # A one-pixel filter fringe can leave the crown 1px off the pad. Nudge it.
    landed = solid_bounds(canvas)
    if landed is not None:
        if upper:
            err = (CANVAS - landed[3]) - OCCLUSAL_PAD
        else:
            err = landed[1] - OCCLUSAL_PAD
        if err and abs(err) <= 6:
            nudged = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
            shift = err if upper else -err
            nudged.paste(resized, (x, y + shift), resized)
            canvas = nudged
    return canvas


def prepare_one(kind: str, fdi: str, im: Image.Image) -> tuple[Image.Image, list[str]]:
    notes: list[str] = []
    if kind == "healthy":
        im, removed = remove_grey_halo(im)
        if removed:
            notes.append(f"halo-{removed}px")
        im, frag = remove_side_fragments(im, is_upper(fdi))
        if frag:
            notes.append(f"fragment {frag}")
        im, dropped = keep_largest_component(im)
        if dropped:
            notes.append(f"stray-{dropped}px")
    else:
        # Specks only. Screws, brackets, and prosthesis wings stay.
        im = drop_specks(im)
    im = trim(im)
    return im, notes


def drop_specks(im: Image.Image) -> Image.Image:
    """Remove a few-pixel dust speck without touching a real second part."""
    arr = np.array(im)
    opaque = arr[:, :, 3] > 16
    labels, count = ndimage.label(opaque)
    if count <= 1:
        return im
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    main = int(sizes.max())
    for idx in range(1, count + 1):
        area = int(sizes[idx])
        if area <= 12 and area < main * 0.005:
            arr[labels == idx, 3] = 0
    return Image.fromarray(arr)


def shared_heights(prepared: dict[tuple[str, str], Image.Image]) -> dict[str, int]:
    target = int(round(CANVAS * FILL))
    max_w = int(round(CANVAS * MAX_WIDTH_FRAC))
    heights: dict[str, int] = {}
    for fdi in FDIS:
        shared = target
        for kind in KINDS:
            im = prepared.get((kind, fdi))
            if im is None:
                continue
            box = solid_bounds(im)
            if box is None:
                continue
            width = box[2] - box[0]
            height = box[3] - box[1]
            if width < 1 or height < 1:
                continue
            cap = int(math.floor(height * max_w / width))
            shared = min(shared, max(1, cap))
        heights[fdi] = max(1, shared)
    return heights


def normalize_tree(src: Path, dest: Path | None) -> None:
    prepared: dict[tuple[str, str], Image.Image] = {}
    notes_all: list[str] = []
    mirror_src = src / "plomba" / "11.png"
    mirror_im = load_rgba(mirror_src) if mirror_src.exists() else None

    for kind in KINDS:
        folder = src / kind
        if not folder.is_dir():
            print(f"skip missing folder {folder}", file=sys.stderr)
            continue
        for fdi in FDIS:
            path = folder / f"{fdi}.png"
            if not path.exists():
                print(f"MISSING {kind}/{fdi}.png", file=sys.stderr)
                continue
            im = load_rgba(path)
            if kind == "plomba" and fdi == "21" and is_hard_sliver(im):
                if mirror_im is None:
                    print("plomba/21 is a cropped sliver and plomba/11 is missing", file=sys.stderr)
                else:
                    im = mirror_im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                    notes_all.append("plomba/21 replaced with a mirror of plomba/11 (cropped source)")
            elif is_hard_sliver(im):
                notes_all.append(f"WARNING still a hard sliver: {kind}/{fdi}.png {im.size}")
            trimmed, notes = prepare_one(kind, fdi, im)
            prepared[(kind, fdi)] = trimmed
            if notes:
                notes_all.append(f"{kind}/{fdi}: {', '.join(notes)}")

    heights = shared_heights(prepared)
    short = {fdi: h for fdi, h in heights.items() if h < int(round(CANVAS * FILL)) - 1}
    if short:
        print("width-limited FDI heights:", short)
    else:
        print(f"every FDI uses tooth height {int(round(CANVAS * FILL))}px on {CANVAS}")

    height_by_fdi: dict[str, set[int]] = {fdi: set() for fdi in FDIS}
    for (kind, fdi), im in prepared.items():
        upper = is_upper(fdi)
        canvas = place(im, heights[fdi], upper)
        box = solid_bounds(canvas)
        if box is None:
            print(f"EMPTY {kind}/{fdi}", file=sys.stderr)
            continue
        content_h = box[3] - box[1]
        height_by_fdi[fdi].add(content_h)
        if upper:
            crown_gap = CANVAS - box[3]
        else:
            crown_gap = box[1]
        if crown_gap != OCCLUSAL_PAD:
            print(f"crown gap {kind}/{fdi} = {crown_gap}px (expected {OCCLUSAL_PAD})")
        out_dir = (dest or src) / kind
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{fdi}.png"
        tmp = out_path.with_suffix(".png.tmp")
        canvas.save(tmp, format="PNG", optimize=True)
        tmp.replace(out_path)

    # Soft root tips lose a few pixels to resampling. Crowns share the occlusal
    # pad; a few pixels of body-height difference is not a scale mismatch.
    drifted = {}
    for fdi, vals in height_by_fdi.items():
        if not vals:
            continue
        if max(vals) - min(vals) > 12:
            drifted[fdi] = vals
    print(f"normalized {len(prepared)} PNGs")
    for line in notes_all:
        print(line)
    if drifted:
        print("HEIGHT MISMATCH", drifted, file=sys.stderr)
        raise SystemExit(1)


def _font(size: int) -> ImageFont.ImageFont:
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ):
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def _blit_contain(cell: Image.Image, src: Image.Image, upper: bool) -> None:
    width, height = cell.size
    sw, sh = src.size
    if sw < 1 or sh < 1:
        return
    scale = min(width / sw, height / sh)
    nw = max(1, int(round(sw * scale)))
    nh = max(1, int(round(sh * scale)))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    x = (width - nw) // 2
    y = (height - nh) if upper else 0
    cell.alpha_composite(resized, (x, y))


def _arch_sheet(
    root: Path,
    fdis_upper: list[int],
    fdis_lower: list[int],
    kind_of,
    title: str,
    cell_w: int = 86,
    cell_h: int = 148,
) -> Image.Image:
    label_h = 16
    gap = 8
    margin = 16
    cols = max(len(fdis_upper), len(fdis_lower))
    width = margin * 2 + cols * cell_w
    row_h = label_h + cell_h
    height = margin * 2 + 28 + row_h * 2 + gap
    sheet = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    draw = ImageDraw.Draw(sheet)
    font = _font(11)
    title_font = _font(14)
    draw.text((margin, 6), title, fill=(30, 41, 59, 255), font=title_font)

    def row(fdis: list[int], top: int, upper: bool) -> None:
        for i, fdi in enumerate(fdis):
            kind = kind_of(fdi)
            x = margin + i * cell_w
            if upper:
                draw.text((x + 4, top), str(fdi), fill=(71, 85, 105, 255), font=font)
                box_top = top + label_h
            else:
                box_top = top
            cell = Image.new("RGBA", (cell_w - 4, cell_h), (248, 250, 252, 255))
            path = root / kind / f"{fdi}.png"
            if path.exists():
                _blit_contain(cell, load_rgba(path), upper)
            sheet.alpha_composite(cell, (x + 2, box_top))
            if not upper:
                draw.text((x + 4, box_top + cell_h - 2), str(fdi), fill=(71, 85, 105, 255), font=font)

    origin = margin + 18
    row(fdis_upper, origin, True)
    # Occlusal line between the jaws.
    line_y = origin + label_h + cell_h + gap // 2
    draw.line((margin, line_y, width - margin, line_y), fill=(148, 163, 184, 255), width=1)
    row(fdis_lower, origin + label_h + cell_h + gap, False)
    return sheet


def write_sheets(root: Path, out_dir: Path, tag: str) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    def kind_healthy(_fdi: int) -> str:
        return "healthy"

    def kind_qa(fdi: int) -> str:
        return {
            16: "endo",
            11: "sirkon",
            21: "plomba",
            46: "caries",
            36: "implant",
        }.get(fdi, "healthy")

    sheets = {
        f"healthy-rows-{tag}.png": _arch_sheet(root, UPPER, LOWER, kind_healthy, f"Healthy {tag}"),
        f"qa-rows-{tag}.png": _arch_sheet(
            root,
            UPPER,
            LOWER,
            kind_qa,
            f"QA mix {tag}: 16 endo, 11 sirkon, 21 plomba, 46 caries, 36 implant",
        ),
    }
    for name, image in sheets.items():
        path = out_dir / name
        image.convert("RGB").save(path, quality=95)
        written.append(path)

    # Grey background close-up so neck smudges and the tooth-26 fragment show.
    focus = [31, 32, 33, 34, 44, 26]
    cell = 180
    pad = 12
    sheet = Image.new("RGBA", (pad + len(focus) * (cell + pad), pad + 22 + cell + pad), (226, 232, 240, 255))
    draw = ImageDraw.Draw(sheet)
    font = _font(13)
    draw.text((pad, 4), f"Healthy close-up {tag}", fill=(15, 23, 42, 255), font=font)
    for i, fdi in enumerate(focus):
        tile = Image.new("RGBA", (cell, cell), (203, 213, 225, 255))
        path = root / "healthy" / f"{fdi}.png"
        if path.exists():
            _blit_contain(tile, load_rgba(path), is_upper(str(fdi)))
        sheet.alpha_composite(tile, (pad + i * (cell + pad), 26))
        draw.text((pad + i * (cell + pad) + 6, 30), str(fdi), fill=(15, 23, 42, 255), font=font)
    path = out_dir / f"healthy-halo-{tag}.png"
    sheet.convert("RGB").save(path, quality=95)
    written.append(path)

    # One FDI across every kind, to show the shared height.
    probe = [11, 16, 21, 36, 46]
    cell_w, cell_h = 72, 120
    label_w = 36
    width = 16 + label_w + len(KINDS) * cell_w
    height = 16 + 20 + len(probe) * (cell_h + 8)
    board = Image.new("RGBA", (width, height), (255, 255, 255, 255))
    draw = ImageDraw.Draw(board)
    font = _font(11)
    draw.text((12, 2), f"Same FDI across kinds ({tag})", fill=(15, 23, 42, 255), font=font)
    for r, fdi in enumerate(probe):
        y = 22 + r * (cell_h + 8)
        draw.text((8, y + cell_h // 2), str(fdi), fill=(51, 65, 85, 255), font=font)
        upper = is_upper(str(fdi))
        for c, kind in enumerate(KINDS):
            x = 16 + label_w + c * cell_w
            tile = Image.new("RGBA", (cell_w - 4, cell_h), (241, 245, 249, 255))
            src = root / kind / f"{fdi}.png"
            if src.exists():
                _blit_contain(tile, load_rgba(src), upper)
            board.alpha_composite(tile, (x, y))
            if r == 0:
                draw.text((x, y - 0), kind[:7], fill=(100, 116, 139, 255), font=_font(8))
    path = out_dir / f"scale-by-kind-{tag}.png"
    board.convert("RGB").save(path, quality=95)
    written.append(path)
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--teeth", type=Path, default=Path("public/teeth"))
    parser.add_argument("--dest", type=Path, default=None, help="Write copies instead of replacing in place")
    parser.add_argument("--sheets", type=Path, default=None, help="Also write contact sheets to this directory")
    parser.add_argument("--sheets-only", type=Path, default=None, help="Write contact sheets and do not modify PNGs")
    parser.add_argument("--tag", default="current", help="Filename tag for contact sheets")
    args = parser.parse_args()
    root = args.teeth
    if args.sheets_only:
        paths = write_sheets(root, args.sheets_only, args.tag)
        for path in paths:
            print(path)
        return
    normalize_tree(root, args.dest)
    if args.sheets:
        sheet_root = args.dest or root
        paths = write_sheets(sheet_root, args.sheets, args.tag)
        for path in paths:
            print(path)


if __name__ == "__main__":
    main()
