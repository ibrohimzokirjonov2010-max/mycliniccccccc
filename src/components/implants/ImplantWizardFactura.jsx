import { Printer } from 'lucide-react';
import {
  IMPLANT_WIZARD_FACTURA_MARKER,
  UPPER_FDI,
  LOWER_FDI,
  formatSom,
  resolveClinicTitle,
  toDMY,
  printImplantFactura,
} from './implantFactura';
import './implantWizard.css';

const CATALOG_BRANDS = [
  { key: 'st', label: 'ST' },
  { key: 'anyone', label: 'AnyOne' },
  { key: 'anyridge', label: 'AnyRidge' },
  { key: 'bluediamond', label: 'BLUEDIAMOND' },
  { key: 'ari', label: 'ARi' },
];

const PAPER = {
  date: 'Sana',
  patient: 'Bemor',
  noPatient: 'Bemor tanlanmagan',
  formula: 'Tish qatori formulasi',
  overall: 'Umumiy',
  stage1: '1. Bosqich',
  stage2: '2. Bosqich',
  stage2When: "2–3 oydan so'ng",
  type: 'turi',
  price: 'narxi',
  qty: 'soni',
  total: 'jami',
  each: 'ta',
  gram: 'gr',
  bone: 'Suyak material',
  boneUnit: '0.1 gr',
  multi: 'Multi unit',
  pmma: 'Vaqtinchalik koronka PMMA',
  extract: 'Tish olish',
  treat: 'Davolash',
  operation: 'Operatsion harajatlar',
  operationHint: 'Bir martalik materiallar uchun',
  titan: 'Titan karkas',
  veneer: 'Vinir',
  metal: 'Metallokeramika',
  zircon: 'Sirkoniy koronka',
  zirconStd: 'Standard',
  zirconEst: 'High',
  zirconPre: 'Premium',
  notice: 'Eslatma!',
  notice1: "1- bosqichda hisoblab berilgan harajatlar miqdori 3 oy amal qiladi,",
  notice2: "2- bosqich narxi implantatsiyadan so'ng 2–3 oydan so'ng ish boshlanayotgan vaqtda siz bilan maslahatlashgan holda aniq hisoblab beriladi.",
  som: "so'm",
  print: 'Chop etish',
};

const RIGHT_SLOTS = [
  { id: 'multi_unit', label: PAPER.multi, icon: 'unit' },
  { id: 'temp_crown', label: PAPER.pmma, icon: 'crown' },
  { id: 'extraction', label: PAPER.extract, icon: 'tooth' },
];

const ZIRCON_IDS = new Set(['zirkon_crown', 'zircon_crown', 'zircon_std', 'zircon_est', 'zircon_pre']);
const STAGE2_LEFT_IDS = new Set(['titan_frame', 'veneer']);
const GRAFT_EXTRA_IDS = ['membrane', 'nkr', 'prf', 'sst'];

function normBrand(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function brandOf(snapshot, line) {
  const fromSnapshot = String(snapshot?.brand || '').trim();
  if (fromSnapshot) return fromSnapshot;
  return String(line?.label || '').split('·')[0].trim();
}

function paperServiceLabel(line) {
  const id = line?.id;
  if (id === 'bone_graft') return PAPER.bone;
  if (id === 'temp_crown') return PAPER.pmma;
  if (id === 'multi_unit') return PAPER.multi;
  if (id === 'extraction') return PAPER.extract;
  if (id === 'operation_fee') return PAPER.operation;
  if (id === 'titan_frame') return PAPER.titan;
  if (id === 'veneer') return PAPER.veneer;
  if (id === 'metal_crown') return PAPER.metal;
  if (id === 'zirkon_crown' || id === 'zircon_crown') return PAPER.zircon;
  if (id === 'zircon_std') return PAPER.zirconStd;
  if (id === 'zircon_est') return PAPER.zirconEst;
  if (id === 'zircon_pre') return PAPER.zirconPre;
  if (id === 'emax_crown') return 'E-Max koronka';
  return line?.label || 'Xizmat';
}

function sizeHint(snapshot) {
  const sizes = [...new Set((snapshot?.toothLines || []).map((row) => row.size).filter(Boolean))];
  return sizes.length === 1 ? sizes[0] : '';
}

function FacturaMoney({ value, onChange, ariaLabel, readOnly = false }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      readOnly={readOnly}
      value={Number(value) ? formatSom(value) : ''}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        onChange(digits === '' ? 0 : Number(digits));
      }}
      className="implant-factura-input implant-factura-input-money"
    />
  );
}

function FacturaQty({ value, onChange, ariaLabel, readOnly = false }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      readOnly={readOnly}
      value={Number(value) ? String(value) : ''}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        onChange(digits === '' ? 0 : Number(digits));
      }}
      className="implant-factura-input implant-factura-input-qty"
    />
  );
}

function ScrewIcon() {
  return (
    <svg className="implant-factura-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.2c.7 1.2 1.1 2.2 1.1 3.2 0 .7-.3 1.3-1.1 2-.8-.7-1.1-1.3-1.1-2 0-1 .4-2 1.1-3.2Z" fill="currentColor" />
      <path d="M6.2 6.2h3.6l-.4 1.1H6.6L6.2 6.2Zm.5 1.7h2.6L8.6 14.2c-.2.5-.9.5-1.1 0L6.7 7.9Z" fill="currentColor" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg className="implant-factura-icon" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.2 11.8 3.2 5.2l2.6 2.4L8 3.4l2.2 4.2 2.6-2.4 1 6.6H2.2Z" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M2.4 13.2h11.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function RowIcon({ name }) {
  if (name === 'crown') return <CrownIcon />;
  if (name === 'screw' || name === 'unit') return <ScrewIcon />;
  return <ScrewIcon />;
}

function BlankSlot() {
  return <i className="implant-factura-blank-slot" />;
}

function ColumnHead() {
  return (
    <div className="implant-factura-colhead">
      <span>{PAPER.type}</span>
      <span>{PAPER.price}</span>
      <span>{PAPER.qty}</span>
      <span>{PAPER.total}</span>
    </div>
  );
}

function LineTotal({ value }) {
  if (!Number(value)) return <span className="implant-factura-eq">=</span>;
  return (
    <span className="implant-factura-line-total">
      = {formatSom(value)} <span className="implant-factura-som">{PAPER.som}</span>
    </span>
  );
}

function MoneyRow({ item, onEdit }) {
  const line = item.line;
  const label = item.displayLabel || paperServiceLabel(line);
  const unit = item.gram ? PAPER.gram : PAPER.each;
  const filled = Number(line.qty) > 0 || Number(line.unitPrice) > 0;
  const flat = item.flat && Number(line.qty) <= 1;
  return (
    <div
      className={[
        'implant-factura-row',
        filled ? 'is-filled' : '',
        flat ? 'is-flat' : '',
        item.gram ? 'is-gram' : '',
      ].filter(Boolean).join(' ')}
      data-line-id={line.id}
    >
      <span className="implant-factura-row-label">
        <RowIcon name={item.icon} />
        <span>
          {label}
          {item.hint ? <small>{item.hint}</small> : null}
        </span>
      </span>
      {flat ? (
        <>
          <span className="implant-factura-row-leader" />
          <span className="implant-factura-row-total">
            <span className="implant-factura-eq">=</span>
            <FacturaMoney
              value={line.unitPrice}
              readOnly={!onEdit}
              onChange={(unitPrice) => onEdit?.(line.id, 'unitPrice', unitPrice)}
              ariaLabel={`${label} ${PAPER.price}`}
            />
            {Number(line.total) > 0 ? <span className="implant-factura-som">{PAPER.som}</span> : null}
          </span>
        </>
      ) : (
        <>
          <span className="implant-factura-row-price">
            <FacturaMoney
              value={line.unitPrice}
              readOnly={!onEdit}
              onChange={(unitPrice) => onEdit?.(line.id, 'unitPrice', unitPrice)}
              ariaLabel={`${label} ${PAPER.price}`}
            />
          </span>
          <span className="implant-factura-row-qty">
            <span className="implant-factura-times">×</span>
            <FacturaQty
              value={line.qty}
              readOnly={!onEdit}
              onChange={(qty) => onEdit?.(line.id, 'qty', qty)}
              ariaLabel={`${label} ${PAPER.qty}`}
            />
            <span className="implant-factura-ta">{unit}</span>
          </span>
          <span className="implant-factura-row-sum">
            <LineTotal value={line.total} />
          </span>
        </>
      )}
    </div>
  );
}

function BlankRow({ label, hint, unit = PAPER.each, icon, gram = false }) {
  return (
    <div className={`implant-factura-row is-blank${gram ? ' is-gram' : ''}`}>
      <span className="implant-factura-row-label">
        <RowIcon name={icon} />
        <span>
          {label}
          {hint ? <small>{hint}</small> : null}
        </span>
      </span>
      <span className="implant-factura-row-price"><BlankSlot /></span>
      <span className="implant-factura-row-qty">
        <span className="implant-factura-times">×</span>
        <BlankSlot />
        <span className="implant-factura-ta">{unit}</span>
      </span>
      <span className="implant-factura-row-sum"><span className="implant-factura-eq">=</span></span>
    </div>
  );
}

function RenderItem({ item, onEdit }) {
  if (item.type === 'blank') return <BlankRow {...item} />;
  if (item.type === 'family') {
    return (
      <div className="implant-factura-family">
        <p className="implant-factura-family-title">
          <CrownIcon />
          {item.label}
        </p>
        {item.rows.map((row) => (
          <MoneyRow key={row.line.id} item={row} onEdit={onEdit} />
        ))}
      </div>
    );
  }
  return <MoneyRow item={item} onEdit={onEdit} />;
}

function take(byId, used, id) {
  const line = byId.get(id);
  if (!line || used.has(id)) return null;
  used.add(id);
  return line;
}

function resolveBrandRows(catalogBrands) {
  if (!Array.isArray(catalogBrands) || catalogBrands.length === 0) {
    return CATALOG_BRANDS.map((row) => ({ ...row, aliases: [row.label] }));
  }
  return catalogBrands.map((brand) => {
    const label = String(brand.label || brand.name || '').trim();
    const modelBits = String(brand.model || '')
      .split(/[,/|]/)
      .map((part) => part.trim())
      .filter(Boolean);
    return { key: normBrand(label), label, aliases: [label, ...modelBits] };
  }).filter((row) => row.label);
}

function partitionStage1(lines, snapshot, catalogBrands) {
  const byId = new Map((lines || []).map((line) => [line.id, line]));
  const used = new Set();
  const implant = take(byId, used, 'implant');
  const brand = brandOf(snapshot, implant);
  const brandKey = normBrand(brand);
  const rows = resolveBrandRows(catalogBrands);
  const catalogHit = rows.find((row) => row.aliases.some((alias) => normBrand(alias) === brandKey));
  const hint = sizeHint(snapshot);
  const left = [];

  if (implant && !catalogHit) {
    left.push({
      type: 'line',
      line: implant,
      displayLabel: brand || paperServiceLabel(implant),
      hint,
      icon: 'screw',
    });
  }
  rows.forEach((row) => {
    if (catalogHit && row.key === catalogHit.key && implant) {
      const matched = row.aliases.find((alias) => normBrand(alias) === brandKey) || row.label;
      left.push({
        type: 'line',
        line: implant,
        displayLabel: matched,
        hint,
        icon: 'screw',
      });
      return;
    }
    left.push({ type: 'blank', label: row.label, icon: 'screw' });
  });

  const bone = take(byId, used, 'bone_graft');
  if (bone) {
    left.push({ type: 'line', line: bone, gram: true, hint: PAPER.boneUnit, icon: 'screw' });
  } else {
    left.push({ type: 'blank', label: PAPER.bone, hint: PAPER.boneUnit, gram: true, icon: 'screw', unit: PAPER.gram });
  }
  GRAFT_EXTRA_IDS.forEach((id) => {
    const line = take(byId, used, id);
    if (line) left.push({ type: 'line', line, icon: 'screw' });
  });

  const right = [];
  RIGHT_SLOTS.forEach((slot) => {
    const line = take(byId, used, slot.id);
    if (line) right.push({ type: 'line', line, icon: slot.icon });
    else right.push({ type: 'blank', label: slot.label, icon: slot.icon });
  });

  const davolash = (lines || []).find((line) => (
    !used.has(line.id)
    && line.id !== 'operation_fee'
    && (line.id === 'davolash' || /davolash/i.test(line.label || ''))
  ));
  if (davolash) {
    used.add(davolash.id);
    right.push({ type: 'line', line: davolash, icon: 'tooth' });
  } else {
    right.push({ type: 'blank', label: PAPER.treat, icon: 'tooth' });
  }

  (lines || []).forEach((line) => {
    if (used.has(line.id) || line.id === 'operation_fee') return;
    used.add(line.id);
    right.push({ type: 'line', line, icon: 'screw' });
  });

  const operation = take(byId, used, 'operation_fee');
  if (operation) {
    right.push({
      type: 'line',
      line: operation,
      flat: true,
      hint: PAPER.operationHint,
      icon: 'screw',
    });
  }

  return { left, right };
}

function partitionStage2(lines) {
  const byId = new Map((lines || []).map((line) => [line.id, line]));
  const used = new Set();
  const left = [];
  ['titan_frame', 'veneer'].forEach((id) => {
    const line = take(byId, used, id);
    if (line) left.push({ type: 'line', line, icon: id === 'veneer' ? 'crown' : 'screw' });
  });

  const right = [];
  const metal = take(byId, used, 'metal_crown');
  if (metal) right.push({ type: 'line', line: metal, icon: 'crown' });
  const emax = take(byId, used, 'emax_crown');
  if (emax) right.push({ type: 'line', line: emax, icon: 'crown' });

  const zircon = (lines || []).filter((line) => ZIRCON_IDS.has(line.id) && !used.has(line.id));
  zircon.forEach((line) => used.add(line.id));
  if (zircon.length === 1 && (zircon[0].id === 'zirkon_crown' || zircon[0].id === 'zircon_crown')) {
    right.push({ type: 'line', line: zircon[0], displayLabel: PAPER.zircon, icon: 'crown' });
  } else if (zircon.length) {
    right.push({
      type: 'family',
      label: PAPER.zircon,
      rows: zircon.map((line) => ({ type: 'line', line, icon: 'crown' })),
    });
  }

  (lines || []).forEach((line) => {
    if (used.has(line.id) || STAGE2_LEFT_IDS.has(line.id)) return;
    used.add(line.id);
    left.push({ type: 'line', line, icon: 'crown' });
  });

  return { left, right };
}

function quadPoint(t, p0, p1, p2) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function quadTangent(t, p0, p1, p2) {
  const u = 1 - t;
  return {
    x: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

function toothBox(t) {
  const d = Math.abs(t - 0.5);
  if (d > 0.36) return { w: 15, h: 12 };
  if (d > 0.24) return { w: 13, h: 11 };
  if (d > 0.14) return { w: 11, h: 13 };
  return { w: 10, h: 10 };
}

function placeArch(teeth, p0, p1, p2) {
  return teeth.map((fdi, index) => {
    const t = (index + 0.5) / teeth.length;
    const pos = quadPoint(t, p0, p1, p2);
    const tan = quadTangent(t, p0, p1, p2);
    const rot = (Math.atan2(tan.y, tan.x) * 180) / Math.PI;
    return { fdi: String(fdi), ...pos, rot, ...toothBox(t) };
  });
}

function JawTooth({ tooth, selected }) {
  return (
    <g data-factura-tooth={tooth.fdi} data-selected={selected ? 'true' : 'false'}>
      <g transform={`translate(${tooth.x} ${tooth.y}) rotate(${tooth.rot})`}>
        <rect
          x={-tooth.w / 2}
          y={-tooth.h / 2}
          width={tooth.w}
          height={tooth.h}
          rx="3.5"
          fill={selected ? '#e7efff' : '#f4f1ec'}
          stroke={selected ? '#1d4ed8' : '#b7b0a8'}
          strokeWidth={selected ? 1.7 : 0.8}
        />
      </g>
      {selected ? (
        <path
          d={`M ${tooth.x - 4.2} ${tooth.y + 0.4} l 2.8 3.1 l 5.6 -6.4`}
          fill="none"
          stroke="#1d4ed8"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </g>
  );
}

function JawSilhouette({ selectedSet }) {
  const upper = placeArch(
    UPPER_FDI,
    { x: 62, y: 74 },
    { x: 280, y: 128 },
    { x: 498, y: 74 },
  );
  const lower = placeArch(
    LOWER_FDI,
    { x: 86, y: 178 },
    { x: 280, y: 156 },
    { x: 474, y: 178 },
  );
  return (
    <svg
      className="implant-factura-jaw"
      viewBox="0 0 560 248"
      role="img"
      aria-label="Tish qatori formulasi"
      data-testid="implant-factura-jaw"
    >
      <path
        className="implant-factura-gum"
        d="M30 90 C52 34 150 10 280 10 C410 10 508 34 530 90 C498 122 408 146 280 150 C152 146 62 122 30 90 Z"
      />
      <path
        className="implant-factura-gum-inner"
        d="M92 92 C132 58 200 44 280 44 C360 44 428 58 468 92 C424 114 356 126 280 126 C204 126 136 114 92 92 Z"
      />
      <path
        className="implant-factura-gum implant-factura-gum-lower"
        d="M52 160 C82 214 164 238 280 240 C396 238 478 214 508 160 C468 196 386 214 280 216 C174 214 92 196 52 160 Z"
      />
      <g data-testid="implant-factura-arch-upper">
        {upper.map((tooth) => (
          <JawTooth key={tooth.fdi} tooth={tooth} selected={selectedSet.has(tooth.fdi)} />
        ))}
      </g>
      <g data-testid="implant-factura-arch-lower">
        {lower.map((tooth) => (
          <JawTooth key={`l-${tooth.fdi}`} tooth={tooth} selected={selectedSet.has(tooth.fdi)} />
        ))}
      </g>
    </svg>
  );
}

function TotalBox({ value }) {
  return (
    <span className="implant-factura-total-box">
      <span>{PAPER.overall}:</span>
      {Number(value) > 0 ? (
        <strong>{formatSom(value)} {PAPER.som}</strong>
      ) : (
        <i className="implant-factura-total-empty" />
      )}
    </span>
  );
}

export default function ImplantWizardFactura({
  snapshot,
  clinicName,
  onEdit,
  onPrint,
  showPrintButton = true,
  catalogBrands,
}) {
  if (!snapshot) return null;
  const selectedSet = new Set((snapshot.teeth || []).map(String));
  const title = resolveClinicTitle(clinicName || snapshot.clinic);
  const stage1 = partitionStage1(snapshot.stage1, snapshot, catalogBrands);
  const stage2 = partitionStage2(snapshot.stage2);
  const lines = snapshot.toothLines || [];

  return (
    <article
      className="implant-factura implant-factura-paper"
      data-testid="implant-wizard-factura"
      data-implant-factura={IMPLANT_WIZARD_FACTURA_MARKER}
      data-implant-factura-card
      data-factura-layout="implant-center-paper"
    >
      <header className="implant-factura-head">
        <div className="implant-factura-fields">
          <p className="implant-factura-field">
            <span>{PAPER.date}:</span>
            <strong className="implant-factura-ink">{toDMY(snapshot.date) || '—'}</strong>
          </p>
          <p className="implant-factura-field">
            <span>{PAPER.patient}:</span>
            <strong className="implant-factura-ink">{snapshot.patient_name || PAPER.noPatient}</strong>
          </p>
        </div>
        <div className="implant-factura-brand">
          <span className="implant-factura-logo" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none">
              <path d="M16 2.5c2.4 3.6 3.5 7 3.5 9.8 0 2.4-.9 4.4-3.5 6.8-2.6-2.4-3.5-4.4-3.5-6.8 0-2.8 1.1-6.2 3.5-9.8Z" fill="#6b7280" />
              <path d="M7.2 14.2c2.6 0 4.6.8 6.2 2.4 1.3 1.3 2.1 2.8 2.4 4.6h-.1c-2.8 0-5.2-1.1-7-3-1.6-1.7-2.3-2.8-1.5-4Z" fill="#4b5563" />
              <path d="M24.8 14.2c.8 1.2.1 2.3-1.5 4-1.8 1.9-4.2 3-7 3h-.1c.3-1.8 1.1-3.3 2.4-4.6 1.6-1.6 3.6-2.4 6.2-2.4Z" fill="#4b5563" />
              <path d="M10.6 22.4c1.5 2.6 3 4.6 5.4 6.8 2.4-2.2 3.9-4.2 5.4-6.8H10.6Z" fill="#374151" />
            </svg>
          </span>
          <div>
            <p className="implant-factura-clinic">IMPLANT CENTER</p>
            {title && title !== 'Implant Center' ? (
              <p className="implant-factura-subtitle">{title}</p>
            ) : null}
          </div>
          {showPrintButton ? (
            <button
              type="button"
              className="implant-factura-print"
              onClick={() => {
                if (typeof onPrint === 'function') {
                  onPrint();
                  return;
                }
                printImplantFactura();
              }}
              aria-label={PAPER.print}
            >
              <Printer className="w-3.5 h-3.5" />
              {PAPER.print}
            </button>
          ) : null}
        </div>
      </header>

      <section className="implant-factura-formula">
        <div className="implant-factura-formula-copy">
          <h4>{PAPER.formula}</h4>
          <div className="implant-factura-formula-note">
            <span>{PAPER.overall}:</span>
            <p className="implant-factura-ink">
              {snapshot.teeth?.length ? snapshot.teeth.join(', ') : ''}
            </p>
            {lines.length ? (
              <ul className="implant-factura-sizes">
                {lines.map((row) => (
                  <li key={row.fdi}>
                    <span>#{row.fdi}</span>
                    {row.brand ? <span>{row.brand}</span> : null}
                    {row.size ? <strong>{row.size}</strong> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="implant-factura-arches" data-testid="implant-factura-arch">
          <JawSilhouette selectedSet={selectedSet} />
        </div>
      </section>

      <section className="implant-factura-stage">
        <div className="implant-factura-stage-bar">
          <h4>{PAPER.stage1}</h4>
          <TotalBox value={snapshot.stage1Total} />
        </div>
        <div className="implant-factura-cols">
          <div>
            <ColumnHead />
            {stage1.left.map((item, index) => (
              <RenderItem key={item.line?.id || `l-${item.label}-${index}`} item={item} onEdit={onEdit} />
            ))}
          </div>
          <div>
            <ColumnHead />
            {stage1.right.map((item, index) => (
              <RenderItem key={item.line?.id || `r-${item.label}-${index}`} item={item} onEdit={onEdit} />
            ))}
          </div>
        </div>
      </section>

      <section className="implant-factura-stage">
        <div className="implant-factura-stage-bar">
          <h4>{PAPER.stage2}</h4>
          <span className="implant-factura-stage-mid">{PAPER.stage2When}</span>
          <TotalBox value={snapshot.stage2Total} />
        </div>
        <div className="implant-factura-cols">
          <div>
            <ColumnHead />
            {stage2.left.map((item, index) => (
              <RenderItem key={item.line?.id || `s2l-${index}`} item={item} onEdit={onEdit} />
            ))}
          </div>
          <div>
            <ColumnHead />
            {stage2.right.map((item, index) => (
              <RenderItem key={item.line?.id || item.label || `s2r-${index}`} item={item} onEdit={onEdit} />
            ))}
          </div>
        </div>
      </section>

      <footer className="implant-factura-eslatma">
        <strong>{PAPER.notice}</strong>
        <p>{PAPER.notice1}</p>
        <p>{PAPER.notice2}</p>
      </footer>
    </article>
  );
}
