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

A source whose opaque region has one long straight edge was sliced through
the tooth. Those are rebuilt on the matching healthy silhouette: the intact
side keeps its treatment art, and the missing side is filled by mirroring
across the tooth centre. A very thin crop (``plomba/21``) is a mirror of the
repaired contralateral tooth. Healthy illustrations get a morphological
opening plus a pass that drops dark, low-saturation pixels on the silhouette.

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


def content_metrics(im: Image.Image, thresh: int = 40) -> dict | None:
    """Aspect and how much of each bbox edge is one straight opaque run."""
    arr = np.asarray(im)
    alpha = arr[:, :, 3]
    ys, xs = np.where(alpha > thresh)
    if xs.size < 20:
        return None
    x0, y0 = int(xs.min()), int(ys.min())
    x1, y1 = int(xs.max()) + 1, int(ys.max()) + 1
    sub = alpha[y0:y1, x0:x1] > thresh
    height, width = sub.shape

    def longest(line: np.ndarray) -> float:
        best = cur = 0
        for value in line:
            if value:
                cur += 1
                best = max(best, cur)
            else:
                cur = 0
        return best / max(1, len(line))

    return {
        "w": width,
        "h": height,
        "asp": width / max(1, height),
        "L": longest(sub[:, 0]),
        "R": longest(sub[:, -1]),
        "T": longest(sub[0]),
        "B": longest(sub[-1]),
    }


def crop_content(im: Image.Image, thresh: int = 12) -> Image.Image:
    arr = np.array(im)
    ys, xs = np.where(arr[:, :, 3] > thresh)
    if xs.size == 0:
        return im
    cropped = arr[int(ys.min()) : int(ys.max()) + 1, int(xs.min()) : int(xs.max()) + 1].copy()
    cropped[cropped[:, :, 3] == 0, :3] = 255
    return Image.fromarray(cropped)


def is_thin_sliver(im: Image.Image) -> bool:
    measured = content_metrics(im)
    return bool(measured and measured["asp"] < 0.20)


def contralateral(fdi: str) -> str:
    quadrant = {"1": "2", "2": "1", "3": "4", "4": "3"}
    return quadrant[fdi[0]] + fdi[1]


def opening_keep(alpha: np.ndarray, erode_px: int = 3, thresh: int = 24) -> np.ndarray:
    """Erode, keep the largest component, dilate back, and AND with the original."""
    opaque = alpha > thresh
    core = ndimage.binary_erosion(opaque, iterations=erode_px)
    labels, count = ndimage.label(core)
    if count == 0:
        return opaque
    sizes = np.bincount(labels.ravel())
    sizes[0] = 0
    main = int(sizes.argmax())
    dilated = ndimage.binary_dilation(labels == main, iterations=erode_px)
    return dilated & opaque


def drop_lateral_fragments(arr: np.ndarray) -> tuple[np.ndarray, int]:
    """Drop a side piece that is separated from the tooth by a gap.

    A second molar root is wide and stays. A neighbour chip is a narrow run
    beside the main body. A grey wisp is darker than the enamel on that row.
    """
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3].astype(np.float32)
    peak = rgb.max(axis=2)
    valley = rgb.min(axis=2)
    sat = np.where(peak > 1.0, (peak - valley) / np.maximum(peak, 1.0), 0.0)
    lum = rgb.mean(axis=2)
    opaque = alpha > 28
    kill = np.zeros(opaque.shape, dtype=bool)
    height, _width = opaque.shape
    for y in range(height):
        row = opaque[y]
        delta = np.diff(row.astype(np.int8), prepend=0, append=0)
        starts = np.flatnonzero(delta == 1)
        ends = np.flatnonzero(delta == -1)
        if starts.size <= 1:
            continue
        segs = sorted(zip(starts.tolist(), ends.tolist()), key=lambda seg: -(seg[1] - seg[0]))
        main_start, main_end = segs[0]
        main_w = main_end - main_start
        if main_w < 6:
            continue
        tone = float(np.median(lum[y, main_start:main_end]))
        for start, end in segs[1:]:
            seg_w = end - start
            if seg_w > max(22, int(0.16 * main_w)):
                continue
            if start >= main_start and end <= main_end:
                continue
            seg_lum = float(lum[y, start:end].mean())
            seg_sat = float(sat[y, start:end].mean())
            narrow = seg_w <= 12
            dark = seg_sat < 0.14 and seg_lum < tone - 22
            if narrow or dark:
                kill[y, start:end] = True
    removed = int(kill.sum())
    if removed:
        arr = arr.copy()
        arr[kill, 3] = 0
    return arr, removed


def kill_edge_grey(arr: np.ndarray, edge_px: int = 5) -> np.ndarray:
    """Clear low-saturation silhouette pixels that are darker than the tooth tone."""
    rgb = arr[:, :, :3].astype(np.float32)
    alpha = arr[:, :, 3]
    peak = rgb.max(axis=2)
    valley = rgb.min(axis=2)
    sat = np.where(peak > 1.0, (peak - valley) / np.maximum(peak, 1.0), 0.0)
    lum = rgb.mean(axis=2)
    opaque = alpha > 16
    dist = ndimage.distance_transform_edt(opaque)
    kill = np.zeros(opaque.shape, dtype=bool)
    height, _width = opaque.shape
    for y in range(height):
        idx = np.flatnonzero(opaque[y])
        if idx.size < 8:
            continue
        interior = idx[(dist[y, idx] > edge_px) & ((lum[y, idx] >= 145) | (sat[y, idx] >= 0.10))]
        if interior.size < 4:
            interior = idx[dist[y, idx] > 2]
        if interior.size < 4:
            continue
        tone = float(np.median(lum[y, interior]))
        limit = min(tone - 30.0, 160.0)
        band = np.unique(np.concatenate([idx[:edge_px], idx[-edge_px:]]))
        for x in band.tolist():
            if sat[y, x] < 0.10 and lum[y, x] < limit and lum[y, x] < tone * 0.78:
                kill[y, x] = True
    return kill


def clean_healthy_image(im: Image.Image, upper: bool) -> tuple[Image.Image, list[str]]:
    notes: list[str] = []
    arr, removed = drop_lateral_fragments(np.array(im))
    if removed:
        notes.append(f"lateral-{removed}px")
    im, frag = remove_side_fragments(Image.fromarray(arr), upper)
    if frag:
        notes.append(f"fragment {frag}")
    arr = np.array(im)
    keep = opening_keep(arr[:, :, 3], erode_px=3, thresh=24)
    opened = int(((arr[:, :, 3] > 24) & ~keep).sum())
    arr[~keep, 3] = 0
    if opened:
        notes.append(f"opening-{opened}px")
    grey_n = 0
    for _ in range(2):
        kill = kill_edge_grey(arr, edge_px=5)
        count = int(kill.sum())
        if not count:
            break
        arr[kill, 3] = 0
        grey_n += count
    if grey_n:
        notes.append(f"edge-grey-{grey_n}px")
    return Image.fromarray(arr), notes


def _paint_missing(arr: np.ndarray, need: np.ndarray) -> None:
    if not need.any():
        return
    _height, width = need.shape
    cx = (width - 1) / 2.0
    ys, xs = np.where(need)
    mirrored_x = np.clip(np.rint(2 * cx - xs).astype(int), 0, width - 1)
    src_a = arr[ys, mirrored_x, 3]
    ok = src_a > 20
    arr[ys[ok], xs[ok]] = arr[ys[ok], mirrored_x[ok]]
    alpha = arr[:, :, 3]
    for y, x in zip(ys[~ok].tolist(), xs[~ok].tolist()):
        row = alpha[y] > 20
        if not row.any():
            continue
        direction = 1 if x < cx else -1
        found = None
        for step in range(1, width):
            xx = x + direction * step
            if xx < 0 or xx >= width:
                break
            if row[xx]:
                found = xx
                break
        if found is None:
            idxs = np.flatnonzero(row)
            found = int(idxs[np.argmin(np.abs(idxs - x))])
        arr[y, x] = arr[y, found]


def rebuild_on_healthy(treat: Image.Image, healthy: Image.Image, cut: str) -> Image.Image:
    """Rebuild a clipped illustration on the healthy tooth's silhouette.

    ``cut`` is ``L``, ``R``, or ``BOTH``. The intact side keeps its art. The
    cropped side is filled by mirroring across the tooth centre, and a flat
    cut that hangs past the healthy contour is cleared.
    """
    source = crop_content(treat, 16)
    mask_im = crop_content(healthy, 16)
    if source.height < 8 or mask_im.height < 8:
        return treat
    scale = source.height / mask_im.height
    width = max(source.width, int(round(mask_im.width * scale)))
    mask = mask_im.resize((width, source.height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, source.height), (0, 0, 0, 0))
    if cut == "L":
        tx = width - source.width
    elif cut == "R":
        tx = 0
    else:
        tx = (width - source.width) // 2
    tx = int(max(0, min(tx, width - source.width)))
    canvas.paste(source, (tx, 0), source)
    arr = np.array(canvas)
    healthy_a = np.asarray(mask)[:, :, 3]
    _paint_missing(arr, (healthy_a > 36) & (arr[:, :, 3] < 20))
    outside = (arr[:, :, 3] > 20) & (healthy_a < 20)
    if cut == "L":
        outside[:, int(width * 0.45) :] = False
    elif cut == "R":
        outside[:, : int(width * 0.55)] = False
    arr[outside, 3] = 0
    arr[arr[:, :, 3] == 0, :3] = 255
    return Image.fromarray(arr)


def clip_cut(kind: str, im: Image.Image, healthy: Image.Image) -> str | None:
    """Which side of a non-healthy asset was sliced off, if any."""
    if kind in ("healthy", "missing"):
        return None
    measured = content_metrics(im)
    reference = content_metrics(healthy)
    if measured is None or reference is None or reference["asp"] <= 0:
        return None
    ratio = measured["asp"] / reference["asp"]
    one_l = measured["L"] >= 0.55 and measured["R"] <= 0.38
    one_r = measured["R"] >= 0.55 and measured["L"] <= 0.38
    both = measured["L"] >= 0.45 and measured["R"] >= 0.45
    severe_l = measured["L"] >= 0.75 and measured["R"] <= 0.35
    severe_r = measured["R"] >= 0.75 and measured["L"] <= 0.35
    if (one_l or one_r) and ratio < 0.93:
        return "L" if (one_l and not one_r) or measured["L"] >= measured["R"] else "R"
    if (severe_l or severe_r) and ratio < 1.08:
        return "L" if severe_l and not severe_r else "R" if severe_r and not severe_l else ("L" if measured["L"] >= measured["R"] else "R")
    if both and ratio < 0.60:
        return "BOTH"
    if kind.startswith("protez") and ratio < 0.78 and max(measured["L"], measured["R"]) >= 0.40:
        if measured["L"] > measured["R"] + 0.22:
            return "L"
        if measured["R"] > measured["L"] + 0.22:
            return "R"
        return "BOTH"
    return None


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


def prepare_one(kind: str, im: Image.Image) -> Image.Image:
    if kind != "healthy":
        # Specks only. Screws, brackets, and prosthesis wings stay.
        im = drop_specks(im)
    return trim(im)


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


def clip_to_healthy(treat: Image.Image, healthy: Image.Image) -> Image.Image:
    """Center a full illustration on the healthy silhouette and clip the overflow."""
    source = crop_content(treat, 16)
    mask_im = crop_content(healthy, 16)
    if source.height < 8 or mask_im.height < 8:
        return treat
    scale = source.height / mask_im.height
    width = max(1, int(round(mask_im.width * scale)))
    mask = mask_im.resize((width, source.height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (width, source.height), (0, 0, 0, 0))
    canvas.paste(source, ((width - source.width) // 2, 0), source)
    arr = np.array(canvas)
    healthy_a = np.asarray(mask)[:, :, 3]
    arr[:, :, 3] = np.minimum(arr[:, :, 3], np.where(healthy_a > 36, healthy_a, 0))
    _paint_missing(arr, (healthy_a > 36) & (arr[:, :, 3] < 20))
    arr[arr[:, :, 3] == 0, :3] = 255
    return Image.fromarray(arr)


def _fit_mirror(donor: Image.Image, healthy: Image.Image) -> Image.Image:
    flipped = donor.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    measured = content_metrics(flipped)
    reference = content_metrics(healthy)
    if not measured or not reference or reference["asp"] <= 0:
        return flipped
    if measured["asp"] < reference["asp"] * 0.95:
        return rebuild_on_healthy(flipped, healthy, "BOTH")
    if measured["asp"] > reference["asp"] * 1.08:
        return clip_to_healthy(flipped, healthy)
    return flipped


def normalize_tree(src: Path, dest: Path | None) -> None:
    loaded: dict[tuple[str, str], Image.Image] = {}
    notes_all: list[str] = []
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
            loaded[(kind, fdi)] = load_rgba(path)

    healthy: dict[str, Image.Image] = {}
    for fdi in FDIS:
        im = loaded.get(("healthy", fdi))
        if im is None:
            continue
        cleaned, notes = clean_healthy_image(im, is_upper(fdi))
        healthy[fdi] = cleaned
        loaded[("healthy", fdi)] = cleaned
        if notes:
            notes_all.append(f"healthy/{fdi}: {', '.join(notes)}")

    # Silhouette-fill (mirroring pixels across a clipped edge) smears the
    # crown into horizontal streaks. Leave the source art intact here.
    # ``apply_replacements`` swaps the bad results for a clean contralateral
    # mirror or a colour overlay on the healthy tooth.
    prepared: dict[tuple[str, str], Image.Image] = {}
    for (kind, fdi), im in loaded.items():
        prepared[(kind, fdi)] = prepare_one(kind, im)

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
    leftover = []
    narrow = []
    for kind in KINDS:
        if kind in ("healthy", "missing"):
            continue
        for fdi in FDIS:
            im = prepared.get((kind, fdi))
            ref = prepared.get(("healthy", fdi))
            if im is None or ref is None:
                continue
            measured = content_metrics(im)
            reference = content_metrics(ref)
            if not measured or not reference or reference["asp"] <= 0:
                continue
            ratio = measured["asp"] / reference["asp"]
            cut = clip_cut(kind, im, ref)
            if cut and ratio < 0.90:
                leftover.append(f"{kind}/{fdi}:{cut}:{ratio:.2f}")
            if (kind == "implant" or kind.startswith("protez")) and ratio < 0.75:
                narrow.append(f"{kind}/{fdi}:{ratio:.2f}")
    if leftover:
        print("STILL CLIPPED", ", ".join(leftover))
    if narrow:
        print("STILL NARROW", ", ".join(narrow))
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

    # 3× nearest-neighbour zoom on grey, so a leftover halo or flat cut is obvious.
    # Same teeth as the zoomed QA crop: 11 is zirconia, 21 is a filling, the rest healthy.
    groups = [
        ("11–13", [(11, "sirkon"), (12, "healthy"), (13, "healthy")]),
        ("21–25", [(21, "plomba"), (22, "healthy"), (23, "healthy"), (24, "healthy"), (25, "healthy")]),
        ("31–34", [(31, "healthy"), (32, "healthy"), (33, "healthy"), (34, "healthy")]),
        ("41–44", [(41, "healthy"), (42, "healthy"), (43, "healthy"), (44, "healthy")]),
    ]
    zoom = 3
    pad = 10
    label_h = 22
    row_gap = 16
    max_cols = max(len(group) for _, group in groups)
    crops: dict[tuple[int, str], Image.Image] = {}
    for _, group in groups:
        for fdi, kind in group:
            src_path = root / kind / f"{fdi}.png"
            if not src_path.exists():
                continue
            crops[(fdi, kind)] = crop_content(load_rgba(src_path), 8)
    if crops:
        cell_w = max(im.width for im in crops.values()) * zoom + pad * 2
        cell_h = max(im.height for im in crops.values()) * zoom + pad * 2
        sheet_w = pad + max_cols * cell_w
        sheet_h = pad + len(groups) * (label_h + cell_h + row_gap)
        zoom_sheet = Image.new("RGBA", (sheet_w, sheet_h), (186, 192, 200, 255))
        draw = ImageDraw.Draw(zoom_sheet)
        font = _font(16)
        for row_i, (title, group) in enumerate(groups):
            top = pad + row_i * (label_h + cell_h + row_gap)
            draw.text((pad, top), title, fill=(15, 23, 42, 255), font=font)
            for col, (fdi, kind) in enumerate(group):
                im = crops.get((fdi, kind))
                x = pad + col * cell_w
                y = top + label_h
                tile = Image.new("RGBA", (cell_w - 4, cell_h), (176, 182, 190, 255))
                if im is not None:
                    scaled = im.resize((im.width * zoom, im.height * zoom), Image.Resampling.NEAREST)
                    upper = is_upper(str(fdi))
                    px = (tile.width - scaled.width) // 2
                    py = (tile.height - scaled.height - 4) if upper else 4
                    tile.alpha_composite(scaled, (px, py))
                zoom_sheet.alpha_composite(tile, (x, y))
                draw.text((x + 6, y + 4), f"{fdi} {kind}", fill=(15, 23, 42, 255), font=font)
        path = out_dir / f"healthy-zoom-3x-{tag}.png"
        zoom_sheet.convert("RGB").save(path, quality=95)
        written.append(path)
    return written


# Clean contralateral already on the normalized canvas. Horizontal flip keeps
# the crown on the occlusal edge, so the scale and anchor stay put.
HEALTHY_MIRROR = {
    "22": "12",
    "23": "13",
    "24": "14",
    "25": "15",
    "31": "41",
    "32": "42",
    "33": "43",
    "34": "45",
}
HEALTHY_COPY = {"44": "45"}

# Assets whose silhouette-fill pass smeared pixels. A clean contralateral
# (not in this set) is mirrored. Everything else is rebuilt from the healthy
# tooth without stretching pixels.
OVERLAY_KINDS = {
    "plomba": list(FDIS),
    "sirkon": ["11", "18", "21", "28", "38", "48"],
    "metal-keramika": ["11", "18", "21", "28", "38", "48"],
    "breket": ["18", "28", "38", "48"],
}
# kind -> {fdi: donor fdi to flip}. Donor must not itself be smeared.
PROTEZ_MIRROR = {
    "protez-syomniy": {
        "16": "26",
        "21": "11",
        "22": "12",
        "24": "14",
        "33": "43",
        "34": "44",
        "35": "45",
        "46": "36",
        "47": "37",
    },
    "protez-implant": {
        "16": "26",
        "17": "27",
        "21": "11",
        "33": "43",
        "47": "37",
    },
    "protez-babochka": {
        "32": "42",
    },
}
PROTEZ_RESTORE = {
    "protez-syomniy": ["13", "23", "32", "42", "38", "48"],
    "protez-implant": ["36", "46"],
    "protez-babochka": ["16", "17", "26", "27", "36", "37", "46", "47"],
}


def _body_box(alpha: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.where(alpha > 32)
    if xs.size == 0:
        return None
    return int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())


def _blend_toward(arr: np.ndarray, mask: np.ndarray, target: tuple[int, int, int]) -> None:
    """Recolour opaque pixels. ``mask`` is 0..1 and is never used to copy pixels sideways."""
    rgb = arr[:, :, :3].astype(np.float32)
    strength = mask.astype(np.float32)[..., None]
    colour = np.array(target, np.float32)
    rgb = rgb * (1.0 - strength) + colour * strength
    arr[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)


def filling_overlay(im: Image.Image, upper: bool) -> Image.Image:
    """Cool white composite patch on the incisal and proximal crown. Alpha stays."""
    arr = np.array(im)
    alpha = arr[:, :, 3]
    box = _body_box(alpha)
    if box is None:
        return im
    y0, y1, x0, x1 = box
    height = y1 - y0 + 1
    width = x1 - x0 + 1
    yy = np.arange(arr.shape[0])[:, None]
    xx = np.arange(arr.shape[1])[None, :]
    if upper:
        crown0 = y0 + int(height * 0.62)
        incisal = np.clip((yy - crown0) / max(1, y1 - crown0), 0.0, 1.0)
    else:
        crown1 = y0 + int(height * 0.38)
        incisal = np.clip((crown1 - yy) / max(1, crown1 - y0), 0.0, 1.0)
    center = (x0 + x1) / 2.0
    half = max(1.0, width / 2.0)
    proximal = np.clip((np.abs(xx - center) - 0.22 * half) / (0.70 * half), 0.0, 1.0)
    mask = np.power(incisal, 1.35) * (0.55 + 0.45 * np.maximum(incisal, proximal * 0.85))
    mask = ndimage.gaussian_filter(mask, sigma=1.2)
    mask = np.clip(mask, 0.0, 1.0) * 0.70
    mask[alpha <= 32] = 0.0
    _blend_toward(arr, mask, (214, 230, 244))
    return Image.fromarray(arr)


def crown_overlay(im: Image.Image, upper: bool, target: tuple[int, int, int], margin: tuple[int, int, int] | None) -> Image.Image:
    """Opaque crown recolour with a short cervical fade. The root pixels stay."""
    arr = np.array(im)
    alpha = arr[:, :, 3]
    box = _body_box(alpha)
    if box is None:
        return im
    y0, y1, x0, _x1 = box
    height = y1 - y0 + 1
    yy = np.arange(arr.shape[0], dtype=np.float32)[:, None]
    if upper:
        cervix = y0 + height * 0.56
        span = max(1.0, (y1 - cervix) * 0.18)
        fade = np.clip((yy - cervix) / span, 0.0, 1.0)
    else:
        cervix = y0 + height * 0.44
        span = max(1.0, (cervix - y0) * 0.18)
        fade = np.clip((cervix - yy) / span, 0.0, 1.0)
    mask = fade * 0.90
    mask = mask * np.ones((1, arr.shape[1]), dtype=np.float32)
    mask = ndimage.gaussian_filter(mask, sigma=(1.4, 0.6))
    mask[alpha <= 32] = 0.0
    _blend_toward(arr, mask, target)
    if margin is not None:
        rows = np.arange(arr.shape[0])
        shade = np.zeros(alpha.shape, np.float32)
        shade[np.abs(rows - cervix) <= 1.6, :] = 0.45
        shade[alpha <= 32] = 0.0
        shade = ndimage.gaussian_filter(shade, sigma=0.6)
        _blend_toward(arr, shade, margin)
    return Image.fromarray(arr)


def bracket_overlay(im: Image.Image, upper: bool) -> Image.Image:
    """Paint a small metal bracket and wire onto the crown. No copied streaks."""
    arr = np.array(im)
    alpha = arr[:, :, 3]
    box = _body_box(alpha)
    if box is None:
        return im
    y0, y1, x0, x1 = box
    height = y1 - y0 + 1
    width = x1 - x0 + 1
    cx = (x0 + x1) // 2
    cy = (y1 - int(height * 0.20)) if upper else (y0 + int(height * 0.20))
    bw = max(8, int(width * 0.22))
    bh = max(10, int(height * 0.09))
    silver = np.array([206, 210, 216], np.uint8)
    slot = np.array([128, 134, 144], np.uint8)
    wire = np.array([150, 156, 166], np.uint8)

    def put(x: int, y: int, colour: np.ndarray) -> None:
        if 0 <= y < arr.shape[0] and 0 <= x < arr.shape[1] and alpha[y, x] > 48:
            arr[y, x, :3] = colour

    x_left = x0 + int(width * 0.18)
    x_right = x1 - int(width * 0.18)
    for x in range(x_left, x_right + 1):
        put(x, cy, wire)
    for y in range(cy - bh // 2, cy + bh // 2 + 1):
        for x in range(cx - bw // 2, cx + bw // 2 + 1):
            put(x, y, silver)
    for y in range(cy - 1, cy + 2):
        for x in range(cx - bw // 3, cx + bw // 3 + 1):
            put(x, y, slot)
    return Image.fromarray(arr)


def _flip(im: Image.Image) -> Image.Image:
    return im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)


def apply_replacements(root: Path, originals: Path) -> list[tuple[str, str]]:
    """Replace smeared or dirty teeth. Returns the (kind, fdi) pairs written."""
    written: list[tuple[str, str]] = []

    def load(kind: str, fdi: str, base: Path = root) -> Image.Image:
        return load_rgba(base / kind / f"{fdi}.png")

    def store(kind: str, fdi: str, im: Image.Image) -> None:
        out = root / kind / f"{fdi}.png"
        tmp = out.with_suffix(".png.tmp")
        im.save(tmp, format="PNG", optimize=True)
        tmp.replace(out)
        written.append((kind, fdi))

    healthy: dict[str, Image.Image] = {fdi: load("healthy", fdi) for fdi in FDIS}
    for fdi, donor in HEALTHY_MIRROR.items():
        healthy[fdi] = _flip(healthy[donor])
        store("healthy", fdi, healthy[fdi])
    for fdi, donor in HEALTHY_COPY.items():
        healthy[fdi] = healthy[donor].copy()
        store("healthy", fdi, healthy[fdi])

    for fdi in OVERLAY_KINDS["plomba"]:
        store("plomba", fdi, filling_overlay(healthy[fdi], is_upper(fdi)))
    for fdi in OVERLAY_KINDS["sirkon"]:
        store("sirkon", fdi, crown_overlay(healthy[fdi], is_upper(fdi), (246, 246, 248), None))
    for fdi in OVERLAY_KINDS["metal-keramika"]:
        store(
            "metal-keramika",
            fdi,
            crown_overlay(healthy[fdi], is_upper(fdi), (240, 230, 216), (150, 132, 112)),
        )
    for fdi in OVERLAY_KINDS["breket"]:
        store("breket", fdi, bracket_overlay(healthy[fdi], is_upper(fdi)))

    # Snapshot prosthesis donors before any of them are overwritten.
    donors: dict[tuple[str, str], Image.Image] = {}
    for kind, mapping in PROTEZ_MIRROR.items():
        for donor in mapping.values():
            donors[(kind, donor)] = load(kind, donor)
    for kind, mapping in PROTEZ_MIRROR.items():
        for fdi, donor in mapping.items():
            store(kind, fdi, _flip(donors[(kind, donor)]))
    for kind, fdis in PROTEZ_RESTORE.items():
        for fdi in fdis:
            raw = load(kind, fdi, originals)
            raw = prepare_one(kind, raw)
            store(kind, fdi, place(raw, int(round(CANVAS * FILL)), is_upper(fdi)))
    return written


def write_zoom_grid(root: Path, items: list[tuple[str, str, str]], out_path: Path, title: str, cols: int = 8) -> None:
    """3× nearest-neighbour contact sheet on grey. items are (label, kind, fdi)."""
    zoom = 3
    crops: list[tuple[str, Image.Image]] = []
    for label, kind, fdi in items:
        path = root / kind / f"{fdi}.png"
        if not path.exists():
            continue
        crops.append((label, crop_content(load_rgba(path), 8)))
    if not crops:
        return
    pad = 8
    label_h = 18
    cell_w = max(im.width for _, im in crops) * zoom + pad * 2
    cell_h = max(im.height for _, im in crops) * zoom + pad * 2
    rows = (len(crops) + cols - 1) // cols
    sheet = Image.new("RGB", (pad + cols * cell_w, 28 + rows * (cell_h + label_h)), (176, 182, 190))
    draw = ImageDraw.Draw(sheet)
    font = _font(14)
    draw.text((pad, 4), title, fill=(15, 23, 42), font=font)
    for i, (label, im) in enumerate(crops):
        r, c = divmod(i, cols)
        scaled = im.resize((im.width * zoom, im.height * zoom), Image.Resampling.NEAREST)
        x = pad + c * cell_w
        y = 26 + r * (cell_h + label_h)
        tile = Image.new("RGBA", (cell_w - 4, cell_h), (176, 182, 190, 255))
        tile.alpha_composite(scaled, ((tile.width - scaled.width) // 2, (tile.height - scaled.height) // 2))
        sheet.paste(tile.convert("RGB"), (x, y + label_h))
        draw.text((x + 4, y), label, fill=(15, 23, 42), font=font)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, quality=95)
    print(out_path, sheet.size)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--teeth", type=Path, default=Path("public/teeth"))
    parser.add_argument("--dest", type=Path, default=None, help="Write copies instead of replacing in place")
    parser.add_argument("--sheets", type=Path, default=None, help="Also write contact sheets to this directory")
    parser.add_argument("--sheets-only", type=Path, default=None, help="Write contact sheets and do not modify PNGs")
    parser.add_argument("--tag", default="current", help="Filename tag for contact sheets")
    parser.add_argument(
        "--repair",
        action="store_true",
        help="Replace dirty healthy teeth and smeared treatment art in --teeth",
    )
    parser.add_argument(
        "--originals",
        type=Path,
        default=Path("/tmp/teeth-src/teeth"),
        help="Un-normalized sources used when a prosthesis must be restored",
    )
    args = parser.parse_args()
    root = args.teeth
    if args.repair:
        replaced = apply_replacements(root, args.originals)
        print(f"replaced {len(replaced)}")
        for kind, fdi in replaced:
            print(f"  {kind}/{fdi}")
        if args.sheets:
            for path in write_sheets(root, args.sheets, args.tag):
                print(path)
            healthy_items = [(fdi, "healthy", fdi) for fdi in FDIS]
            write_zoom_grid(
                root,
                healthy_items,
                args.sheets / "healthy-zoom-3x-all.png",
                "All 32 healthy teeth, 3× on grey",
            )
            rebuilt_items = [(f"{kind}/{fdi}", kind, fdi) for kind, fdi in replaced]
            write_zoom_grid(
                root,
                rebuilt_items,
                args.sheets / "rebuilt-zoom-3x.png",
                "Assets rebuilt this pass, 3× on grey",
            )
        return
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
