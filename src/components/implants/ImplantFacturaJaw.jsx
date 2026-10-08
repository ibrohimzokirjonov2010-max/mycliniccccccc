/**
 * "Tish qatori formulasi" jaw diagram in the style of the clinic's printed sheet:
 * a flat grey maxilla (alveolar arch with the palatal process) over a wide U-shaped
 * mandible with rami, condyles and coronoid notches. Teeth are not drawn; each FDI
 * position is a faint tick on the ridge, every implant is a pen-drawn threaded
 * fixture pointing into the bone, and an extracted tooth gets a small blue ×.
 * Tooth order follows the app chart (UPPER_FDI / LOWER_FDI).
 */
import { UPPER_FDI, LOWER_FDI } from './implantFactura';

const W = 600;
const H = 262;
const MID = W / 2;

// Mesiodistal weights by FDI digit (average adult widths, mm) to space the positions.
const UPPER_WEIGHT = { 1: 8.5, 2: 6.6, 3: 7.6, 4: 7, 5: 6.7, 6: 10.2, 7: 9.2, 8: 8.6 };
const LOWER_WEIGHT = { 1: 5.4, 2: 5.9, 3: 7, 4: 7, 5: 7.1, 6: 11.2, 7: 10.5, 8: 10 };

// Ridge curves (where implants enter the bone): y = base - k * (x - MID)^2.
const UPPER_RIDGE = { base: 141, k: 0.00112, from: 170, to: 430 };
const LOWER_RIDGE = { base: 197, k: 0.00092, from: 186, to: 414 };

const FIXTURE_LEN = 34;

function ridgeY(ridge, x) {
  return ridge.base - ridge.k * (x - MID) * (x - MID);
}

/** Cubic segments for the left half of a symmetric outline, ending on the midline. */
function mirrorPath(start, segments) {
  const pt = ([x, y]) => `${x} ${y}`;
  const mx = ([x, y]) => [2 * MID - x, y];
  const parts = [`M ${pt(start)}`];
  segments.forEach(([c1, c2, end]) => parts.push(`C ${pt(c1)} ${pt(c2)} ${pt(end)}`));
  const points = [start, ...segments.map((seg) => seg[2])];
  for (let k = segments.length - 1; k >= 0; k -= 1) {
    const [c1, c2] = segments[k];
    parts.push(`C ${pt(mx(c2))} ${pt(mx(c1))} ${pt(mx(points[k]))}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

// Mandible: from the chin, along the lower border, up the flared posterior ramus to the
// condyle, down the sigmoid notch, up the coronoid, then down the inner U to the midline.
const MANDIBLE = mirrorPath([MID, 258], [
  [[230, 258], [150, 248], [96, 226]],
  [[84, 220], [76, 204], [72, 188]],
  [[62, 156], [38, 116], [27, 88]],
  [[22, 72], [34, 61], [52, 61]],
  [[66, 61], [80, 63], [84, 71]],
  [[90, 84], [96, 106], [106, 107]],
  [[118, 108], [130, 92], [142, 80]],
  [[146, 120], [152, 168], [190, 184]],
  [[226, 198], [266, 198], [MID, 198]],
]);

// Soft gap between the arches (inside the mandible's U, under the maxilla).
const GAP = mirrorPath([MID, 198], [
  [[266, 198], [226, 198], [190, 184]],
  [[152, 168], [146, 120], [144, 70]],
  [[200, 70], [260, 70], [MID, 70]],
]);

// Maxilla: alveolar arch with tuberosity prongs and the central palatal/nasal process.
const MAXILLA = mirrorPath([MID, 141], [
  [[248, 141], [194, 138], [167, 127]],
  [[150, 119], [142, 102], [141, 80]],
  [[141, 60], [141, 44], [141, 34]],
  [[141, 22], [150, 15], [159, 15]],
  [[169, 15], [177, 22], [178, 34]],
  [[180, 58], [190, 72], [216, 76]],
  [[240, 79], [258, 76], [268, 70]],
  [[271, 44], [284, 21], [MID, 21]],
]);

function layoutRow(fdis, weights, ridge) {
  const widths = fdis.map((fdi) => weights[fdi % 10] || 7);
  const total = widths.reduce((sum, w) => sum + w, 0);
  const span = ridge.to - ridge.from;
  let cursor = ridge.from;
  return fdis.map((fdi, index) => {
    const w = (widths[index] / total) * span;
    const x = cursor + w / 2;
    cursor += w;
    const y = ridgeY(ridge, x);
    // Slight tilt with the arch (the paper's pen-drawn fixtures are nearly upright).
    const slope = -2 * ridge.k * (x - MID);
    const angle = ((Math.atan(slope) * 180) / Math.PI) * 0.35;
    return { fdi: String(fdi), x, y, angle };
  });
}

/**
 * Pen-style implant fixture: platform on the ridge, tapered threaded body into the bone.
 * dir = -1 points up (maxilla), +1 points down (mandible).
 */
function Fixture({ dir }) {
  const L = FIXTURE_LEN;
  const top = 5.6;
  const tip = 1.9;
  const end = dir * L;
  const body = `M ${-top} ${dir * 1.5} L ${top} ${dir * 1.5} L ${tip} ${end - dir * 2} Q 0 ${end + dir * 1.5} ${-tip} ${end - dir * 2} Z`;
  const threads = [];
  for (let i = 0; i < 6; i += 1) {
    const t0 = 4.5 + i * 4.6;
    const w0 = top - ((top - tip) * t0) / L;
    const w1 = top - ((top - tip) * (t0 + 2.6)) / L;
    threads.push(`M ${-w0} ${dir * t0} L ${w1} ${dir * (t0 + 2.6)}`);
  }
  return (
    <g className="ifc-jaw-fixture">
      <rect className="ifc-jaw-collar" x={-4} y={dir < 0 ? 0 : -5.5} width={8} height={5.5} rx={1.2} />
      <path className="ifc-jaw-fixture-body" d={body} />
      <path className="ifc-jaw-fixture-threads" d={threads.join(' ')} />
      <path className="ifc-jaw-fixture-axis" d={`M 0 ${dir * 3} L 0 ${end - dir * 3}`} />
    </g>
  );
}

function ExtractionMark({ x, y }) {
  return (
    <path
      className="ifc-jaw-extract"
      d={`M ${x - 3.4} ${y - 3.4} L ${x + 3.4} ${y + 3.4} M ${x + 3.4} ${y - 3.4} L ${x - 3.4} ${y + 3.4}`}
      data-factura-extraction="true"
    />
  );
}

function Position({ tooth, upper, implanted, extracted }) {
  const dir = upper ? -1 : 1;
  // Implant numbers sit in the white gap, just off the ridge (past the collar).
  const labelY = upper ? tooth.y + 18 : tooth.y - 10;
  const extractX = implanted ? tooth.x + 13 : tooth.x;
  const extractY = implanted ? labelY - 4 : (upper ? tooth.y + 9 : tooth.y - 8);
  return (
    <g data-factura-tooth={tooth.fdi} data-implanted={implanted ? 'true' : 'false'}>
      <path
        className="ifc-jaw-tick"
        d={`M 0 0 L 0 ${dir * 3.2}`}
        transform={`translate(${tooth.x.toFixed(1)} ${tooth.y.toFixed(1)}) rotate(${tooth.angle.toFixed(1)})`}
      />
      {implanted ? (
        <g transform={`translate(${tooth.x.toFixed(1)} ${tooth.y.toFixed(1)}) rotate(${tooth.angle.toFixed(1)})`}>
          <Fixture dir={dir} />
        </g>
      ) : null}
      {extracted ? <ExtractionMark x={extractX} y={extractY} /> : null}
      {implanted ? (
        <text className="ifc-jaw-num is-implant" x={tooth.x.toFixed(1)} y={labelY.toFixed(1)} textAnchor="middle">
          {tooth.fdi}
        </text>
      ) : (
        <title>{tooth.fdi}</title>
      )}
    </g>
  );
}

export default function ImplantFacturaJaw({ implantedFdis = [], extractionFdis = [] }) {
  const implanted = new Set((implantedFdis || []).map(String));
  const extracted = new Set((extractionFdis || []).map(String));
  const upper = layoutRow(UPPER_FDI, UPPER_WEIGHT, UPPER_RIDGE);
  const lower = layoutRow(LOWER_FDI, LOWER_WEIGHT, LOWER_RIDGE);
  return (
    <svg
      className="ifc-jaw"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Maxilla va mandibula: implant joylari"
      data-testid="implant-factura-jaw"
    >
      <path className="ifc-jaw-bone" d={MANDIBLE} />
      <path className="ifc-jaw-gap" d={GAP} />
      <path className="ifc-jaw-bone ifc-jaw-maxilla" d={MAXILLA} />
      <path className="ifc-jaw-process" d="M 270 72 C 278 78 322 78 330 72" />
      <g data-testid="implant-factura-arch-upper">
        {upper.map((tooth) => (
          <Position key={tooth.fdi} tooth={tooth} upper implanted={implanted.has(tooth.fdi)} extracted={extracted.has(tooth.fdi)} />
        ))}
      </g>
      <g data-testid="implant-factura-arch-lower">
        {lower.map((tooth) => (
          <Position key={tooth.fdi} tooth={tooth} upper={false} implanted={implanted.has(tooth.fdi)} extracted={extracted.has(tooth.fdi)} />
        ))}
      </g>
    </svg>
  );
}
