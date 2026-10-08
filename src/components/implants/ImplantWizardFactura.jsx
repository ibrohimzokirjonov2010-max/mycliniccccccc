import { Printer } from 'lucide-react';
import {
  IMPLANT_WIZARD_FACTURA_MARKER,
  formatSom,
  isImplantLine,
  resolveClinicTitle,
  toDMY,
  printImplantFactura,
} from './implantFactura';
import ImplantFacturaJaw from './ImplantFacturaJaw';
import './implantWizard.css';
import './implantFactura.css';

const CATALOG_BRANDS = [
  { key: 'osstem', label: 'Osstem' },
  { key: 'dentium', label: 'Dentium' },
  { key: 'straumann', label: 'Straumann' },
  { key: 'megagen', label: 'Megagen' },
  { key: 'nobel', label: 'Nobel Biocare' },
];

/** The paper sheet always shows at least this many implant brand rows (blank ones are for handwriting). */
const MIN_BRAND_ROWS = 5;

const PAPER = {
  date: 'Sana',
  patient: 'Bemor',
  noPatient: 'Bemor tanlanmagan',
  formula: 'Tish qatori formulasi',
  overall: 'Umumiy',
  implants: 'implant',
  stage1: '1. Bosqich',
  stage2: '2. Bosqich',
  stage2When: "2–3 oydan so'ng",
  type: 'turi',
  price: 'narxi',
  qty: 'soni',
  total: 'jami',
  each: 'ta',
  gram: 'gr',
  gramUnit: 'gr.',
  bone: 'Suyak material',
  boneUnit: '0.1 gr',
  multi: 'Multi unit',
  pmma: 'Vaqtinchalik koronka PMMA',
  extract: 'Tish olish',
  treat: 'Davolash',
  operation: 'Operatsion harajatlar',
  operationHint: '(Bir martalik materiallar uchun)',
  titan: 'Titan karkas',
  veneer: 'Vinir',
  metal: 'Metallokeramika',
  zircon: 'Sirkoniy koronka',
  zirconStd: 'Standard',
  zirconEst: 'High',
  zirconPre: 'Premium',
  notice: 'Eslatma!',
  notice1: '1- bosqichda hisoblab berilgan harajatlar miqdori 3 oy amal qiladi,',
  notice2: "2- bosqich narxi implantatsiyadan so'ng 2–3 oydan so'ng ish boshlanayotgan vaqtda siz bilan maslahatlashgan holda aniq hisoblab beriladi.",
  som: "so'm",
  print: 'Chop etish',
};

const RIGHT_SLOTS = [
  { id: 'multi_unit', label: PAPER.multi, icon: 'unit' },
  { id: 'temp_crown', label: PAPER.pmma, icon: null },
  { id: 'extraction', label: PAPER.extract, icon: null },
];

const ZIRCON_IDS = new Set(['zirkon_crown', 'zircon_crown', 'zircon_std', 'zircon_est', 'zircon_pre']);
const STAGE2_LEFT_IDS = new Set(['titan_frame', 'veneer']);
const GRAFT_EXTRA_IDS = ['membrane', 'nkr', 'prf', 'sst'];

function normBrand(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sameBrand(a, b) {
  const x = normBrand(a);
  const y = normBrand(b);
  if (!x || !y) return false;
  return x === y || x.startsWith(y) || y.startsWith(x);
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

function digitsOf(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits === '' ? 0 : Number(digits);
}

function MoneyCell({ value, onChange, label }) {
  if (!onChange) {
    return <span className="ifc-num ifc-num-price">{Number(value) ? formatSom(value) : ''}</span>;
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={`${label} ${PAPER.price}`}
      value={Number(value) ? formatSom(value) : ''}
      onChange={(e) => onChange(digitsOf(e.target.value))}
      className="ifc-input ifc-input-money"
    />
  );
}

function QtyCell({ value, onChange, label }) {
  if (!onChange) {
    return <span className="ifc-num ifc-num-qty">{Number(value) ? String(value) : ''}</span>;
  }
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={`${label} ${PAPER.qty}`}
      value={Number(value) ? String(value) : ''}
      onChange={(e) => onChange(digitsOf(e.target.value))}
      className="ifc-input ifc-input-qty"
    />
  );
}

/** Dark-blue implant screw, as printed next to each brand on the paper sheet. */
function ScrewIcon() {
  return (
    <svg className="ifc-icon ifc-icon-screw" viewBox="0 0 12 22" aria-hidden="true">
      <rect x="2.6" y="0.8" width="6.8" height="3" rx="0.9" fill="#2b3a67" />
      <path d="M2 4.6h8l-1.2 13.2c-.1 1.6-1.2 3.2-2.8 3.2s-2.7-1.6-2.8-3.2L2 4.6Z" fill="#23315c" />
      <path d="M3.4 5.4h1.6l-.5 13.4c-.6-.4-.9-1-1-1.8L3.4 5.4Z" fill="#6f84c2" opacity="0.65" />
      <path d="M2.2 7.4l7.6 1.1M2.4 10.2l7.2 1.1M2.6 13l6.8 1.1M2.9 15.8l6.2 1" stroke="#0f1838" strokeWidth="0.6" />
    </svg>
  );
}

/** Gold multi-unit abutment. */
function AbutmentIcon() {
  return (
    <svg className="ifc-icon ifc-icon-unit" viewBox="0 0 18 22" aria-hidden="true">
      <path d="M4.2 2.6c1.4-1.2 3-1.6 4.8-1.6s3.4.4 4.8 1.6c1 .9 1.3 2.4.7 3.6l-1 2H4.5l-1-2c-.6-1.2-.3-2.7.7-3.6Z" fill="#d7b25a" stroke="#9c7a2c" strokeWidth="0.7" />
      <path d="M5 8.2h8l-1.1 3.3H6.1L5 8.2Z" fill="#c49a3c" stroke="#9c7a2c" strokeWidth="0.6" />
      <path d="M6.4 11.5h5.2l-.8 8.2c-.1.8-.8 1.3-1.8 1.3s-1.7-.5-1.8-1.3l-.8-8.2Z" fill="#8a8f99" />
      <path d="M6.6 13.6l4.8.7M6.8 16l4.4.7M7 18.3l4 .6" stroke="#4b5060" strokeWidth="0.6" />
    </svg>
  );
}

/** Small crown-on-implant mark used in the zirconia box. */
function ImplantCrownIcon() {
  return (
    <svg className="ifc-icon ifc-icon-mini" viewBox="0 0 14 18" aria-hidden="true">
      <path d="M2.4 2.4C3.6 1.3 5.2 1 7 1s3.4.3 4.6 1.4c.9.9 1 2.2.5 3.3L11.4 7H2.6l-.7-1.3c-.5-1.1-.4-2.4.5-3.3Z" fill="#f4f1ea" stroke="#3f3a34" strokeWidth="0.8" />
      <path d="M4.6 7h4.8l-.7 8.6c-.1.8-.8 1.4-1.7 1.4s-1.6-.6-1.7-1.4L4.6 7Z" fill="#3f3a34" />
      <path d="M4.8 9.3l4.4.6M5 11.7l4 .6M5.2 14l3.6.5" stroke="#f4f1ea" strokeWidth="0.55" />
    </svg>
  );
}

function RowIcon({ name }) {
  if (name === 'screw') return <ScrewIcon />;
  if (name === 'unit') return <AbutmentIcon />;
  if (name === 'mini') return <ImplantCrownIcon />;
  return null;
}

function ColumnHead() {
  return (
    <div className="ifc-row ifc-colhead" aria-hidden="true">
      <span>{PAPER.type}:</span>
      <span>{PAPER.price}:</span>
      <span />
      <span>{PAPER.qty}:</span>
      <span />
      <span>{PAPER.total}:</span>
    </div>
  );
}

function Label({ item, label }) {
  return (
    <span className={`ifc-label${item.icon ? ' has-icon' : ''}`}>
      <RowIcon name={item.icon} />
      <span className="ifc-label-text">
        <span className="ifc-label-main">{label}</span>
        {item.hint ? <small>{item.hint}</small> : null}
      </span>
      {item.gram ? <span className="ifc-per">{PAPER.boneUnit} =</span> : null}
    </span>
  );
}

function Cells({ line, item, onEdit, label }) {
  const editPrice = onEdit && line ? (v) => onEdit(line.id, 'unitPrice', v) : null;
  const editQty = onEdit && line && !item.fixedQty ? (v) => onEdit(line.id, 'qty', v) : null;
  const filled = line && Number(line.total) > 0;
  const unit = item.gram ? PAPER.gramUnit : PAPER.each;
  return (
    <>
      <span className="ifc-price">
        {line ? <MoneyCell value={line.unitPrice} onChange={editPrice} label={label} /> : <i className="ifc-dash" />}
      </span>
      <span className="ifc-op">×</span>
      <span className="ifc-box ifc-box-qty">
        {line ? <QtyCell value={line.qty} onChange={editQty} label={label} /> : null}
      </span>
      <span className="ifc-unit">{unit} =</span>
      <span className="ifc-box ifc-box-sum">
        {filled ? <span className="ifc-num ifc-num-total">{formatSom(line.total)}</span> : null}
      </span>
    </>
  );
}

function LineRow({ item, onEdit }) {
  const { line } = item;
  const label = item.displayLabel || paperServiceLabel(line);
  const filled = Number(line.total) > 0;
  if (item.flat) {
    const editPrice = onEdit ? (v) => onEdit(line.id, 'unitPrice', v) : null;
    return (
      <div className={`ifc-row is-flat${filled ? ' is-filled' : ''}`} data-line-id={line.id}>
        <Label item={item} label={label} />
        <span className="ifc-op">=</span>
        <span className="ifc-box ifc-box-sum ifc-box-flat">
          <MoneyCell value={line.unitPrice} onChange={editPrice} label={label} />
        </span>
      </div>
    );
  }
  return (
    <div className={`ifc-row${filled ? ' is-filled' : ''}`} data-line-id={line.id}>
      <Label item={item} label={label} />
      <Cells line={line} item={item} onEdit={onEdit} label={label} />
    </div>
  );
}

function BlankRow(item) {
  return (
    <div className="ifc-row is-blank">
      <Label item={item} label={item.label} />
      <Cells line={null} item={item} label={item.label} />
    </div>
  );
}

function FamilyBox({ item, onEdit }) {
  return (
    <div className="ifc-family" data-family={item.label}>
      <p className="ifc-family-title">{item.label}</p>
      <div className="ifc-family-box">
        {item.rows.length === 0 ? (
          <div className="ifc-subrow is-blank">
            <span className="ifc-sublabel"><ImplantCrownIcon /></span>
            <Cells line={null} item={{}} label={item.label} />
          </div>
        ) : null}
        {item.rows.map((row) => {
          const label = paperServiceLabel(row.line);
          // A single generic zirconia line needs no sub-label: the box title already says it.
          const subLabel = label === item.label ? '' : label;
          return (
            <div key={row.line.id} className={`ifc-subrow${Number(row.line.total) > 0 ? ' is-filled' : ''}`} data-line-id={row.line.id}>
              <span className="ifc-sublabel">
                <ImplantCrownIcon />
                {subLabel ? <small>{subLabel}</small> : null}
              </span>
              <Cells line={row.line} item={row} onEdit={onEdit} label={label} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlankFlatRow(item) {
  return (
    <div className="ifc-row is-flat is-blank">
      <Label item={item} label={item.label} />
      <span className="ifc-op">=</span>
      <span className="ifc-box ifc-box-sum ifc-box-flat" />
    </div>
  );
}

function RenderItem({ item, onEdit }) {
  if (item.type === 'blank') return <BlankRow {...item} />;
  if (item.type === 'blankFlat') return <BlankFlatRow {...item} />;
  if (item.type === 'family') return <FamilyBox item={item} onEdit={onEdit} />;
  return <LineRow item={item} onEdit={onEdit} />;
}

function take(byId, used, id) {
  const line = byId.get(id);
  if (!line || used.has(id)) return null;
  used.add(id);
  return line;
}

function resolveCatalogBrands(catalogBrands) {
  if (!Array.isArray(catalogBrands) || catalogBrands.length === 0) return CATALOG_BRANDS;
  return catalogBrands
    .map((brand) => {
      const label = String(brand.label || brand.name || '').trim();
      return { key: normBrand(label), label };
    })
    .filter((row) => row.label);
}

function implantHint(line) {
  const teeth = Array.isArray(line.teeth) && line.teeth.length
    ? line.teeth
    : (line.fdis || []).map((fdi) => ({ fdi, size: '' }));
  return teeth.map((tooth) => [`#${tooth.fdi}`, tooth.size].filter(Boolean).join(' ')).join(' · ');
}

export function partitionStage1(lines, catalogBrands) {
  const all = (lines || []).filter(Boolean);
  const byId = new Map(all.map((line) => [line.id, line]));
  const used = new Set();
  const left = [];

  const implants = all.filter((line) => isImplantLine(line));
  implants.forEach((line) => {
    used.add(line.id);
    left.push({
      type: 'line',
      line,
      displayLabel: line.brand || line.label || 'Implant',
      hint: implantHint(line),
      icon: 'screw',
      fixedQty: true,
    });
  });
  const spare = resolveCatalogBrands(catalogBrands)
    .filter((row) => !implants.some((line) => sameBrand(line.brand || line.label, row.label)));
  spare.slice(0, Math.max(0, MIN_BRAND_ROWS - implants.length)).forEach((row) => {
    left.push({ type: 'blank', label: row.label, icon: 'screw' });
  });

  const bone = take(byId, used, 'bone_graft');
  if (bone) {
    const sub = String(bone.label || '').trim();
    left.push({ type: 'line', line: bone, hint: sub && sub !== PAPER.bone ? sub : '', gram: true, icon: null });
  } else {
    left.push({ type: 'blank', label: PAPER.bone, gram: true, icon: null });
  }
  GRAFT_EXTRA_IDS.forEach((id) => {
    const line = take(byId, used, id);
    if (line) left.push({ type: 'line', line, icon: null });
  });

  const right = [];
  RIGHT_SLOTS.forEach((slot) => {
    const line = take(byId, used, slot.id);
    if (line) right.push({ type: 'line', line, icon: slot.icon });
    else right.push({ type: 'blank', label: slot.label, icon: slot.icon });
  });

  const davolash = all.find((line) => (
    !used.has(line.id)
    && line.id !== 'operation_fee'
    && (line.id === 'davolash' || /davolash/i.test(line.label || ''))
  ));
  if (davolash) {
    used.add(davolash.id);
    right.push({ type: 'line', line: davolash, icon: null });
  } else {
    right.push({ type: 'blank', label: PAPER.treat, icon: null });
  }

  all.forEach((line) => {
    if (used.has(line.id) || line.id === 'operation_fee') return;
    used.add(line.id);
    right.push({ type: 'line', line, icon: null });
  });

  const operation = take(byId, used, 'operation_fee');
  if (operation) {
    right.push({ type: 'line', line: operation, flat: true, hint: PAPER.operationHint, icon: null });
  } else {
    right.push({ type: 'blankFlat', label: PAPER.operation, hint: PAPER.operationHint, icon: null });
  }
  return { left, right };
}

export function partitionStage2(lines) {
  const all = (lines || []).filter(Boolean);
  const byId = new Map(all.map((line) => [line.id, line]));
  const used = new Set();
  const left = [];
  [['titan_frame', PAPER.titan], ['veneer', PAPER.veneer]].forEach(([id, label]) => {
    const line = take(byId, used, id);
    if (line) left.push({ type: 'line', line, icon: null });
    else left.push({ type: 'blank', label, icon: null });
  });

  const right = [];
  const metal = take(byId, used, 'metal_crown');
  if (metal) right.push({ type: 'line', line: metal, icon: null });
  else right.push({ type: 'blank', label: PAPER.metal, icon: null });
  const emax = take(byId, used, 'emax_crown');
  if (emax) right.push({ type: 'line', line: emax, icon: null });

  const zircon = all.filter((line) => ZIRCON_IDS.has(line.id) && !used.has(line.id));
  zircon.forEach((line) => used.add(line.id));
  // Paper: "Sirkoniy koronka" with its crown rows inside a rounded box.
  right.push({
    type: 'family',
    label: PAPER.zircon,
    rows: zircon.map((line) => ({ type: 'line', line, icon: 'mini' })),
  });

  all.forEach((line) => {
    if (used.has(line.id) || STAGE2_LEFT_IDS.has(line.id)) return;
    used.add(line.id);
    left.push({ type: 'line', line, icon: null });
  });
  return { left, right };
}

function TotalBox({ value }) {
  return (
    <span className="ifc-total-box">
      <span>{PAPER.overall}:</span>
      <strong>
        {Number(value) > 0 ? (
          <>
            {formatSom(value)} <small>{PAPER.som}</small>
          </>
        ) : null}
      </strong>
    </span>
  );
}

/** Paper rows are roughly equal height; balance the shorter column with ruled blank lines. */
function rowWeight(item) {
  if (item.type === 'family') return Math.max(1, item.rows.length) * 0.9 + 0.4;
  return 1;
}

function fillerCount(own, other) {
  const a = own.reduce((sum, item) => sum + rowWeight(item), 0);
  const b = other.reduce((sum, item) => sum + rowWeight(item), 0);
  return Math.max(0, Math.round(b - a));
}

function StageColumns({ parts, onEdit, keyPrefix }) {
  const columns = [
    [parts.left, parts.right, 'l'],
    [parts.right, parts.left, 'r'],
  ];
  return (
    <div className="ifc-cols">
      {columns.map(([items, other, side]) => (
        <div className="ifc-col" key={side}>
          <ColumnHead />
          {items.map((item, index) => (
            <RenderItem key={item.line?.id || `${keyPrefix}${side}-${item.label}-${index}`} item={item} onEdit={onEdit} />
          ))}
          {Array.from({ length: fillerCount(items, other) }, (_, index) => (
            <div key={`${keyPrefix}${side}-rule-${index}`} className="ifc-rule-line" aria-hidden="true" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Gold tooth-on-implant mark next to "IMPLANT CENTER". */
function ClinicLogo() {
  return (
    <svg className="ifc-logo" width="24" height="32" viewBox="0 0 24 32" fill="none" aria-hidden="true">
      <path
        d="M5.6 2.2c1.9 0 3.2.9 6.4.9s4.5-.9 6.4-.9c2.8 0 4.3 2.3 4 5.2-.3 2.6-1.4 4.2-2 6.6H3.6c-.6-2.4-1.7-4-2-6.6-.3-2.9 1.2-5.2 4-5.2Z"
        stroke="#c9a04a"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M7.4 16h9.2l-1.4 12c-.2 1.5-1.5 2.6-3.2 2.6s-3-1.1-3.2-2.6L7.4 16Z" fill="#c9a04a" />
      <path d="M7.8 19.2l8.4 1.2M8.2 22.4l7.6 1.1M8.6 25.6l6.8 1" stroke="#fffdf8" strokeWidth="1" />
    </svg>
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
  const title = resolveClinicTitle(clinicName || snapshot.clinic);
  const stage1 = partitionStage1(snapshot.stage1, catalogBrands);
  const stage2 = partitionStage2(snapshot.stage2);
  const toothLines = snapshot.toothLines || [];
  const teeth = (snapshot.teeth || []).map(String);
  const extractionFdis = (snapshot.extraction_fdis || []).map(String);
  const stage1Total = Number(snapshot.stage1Total) || 0;
  const stage2Total = Number(snapshot.stage2Total) || 0;
  const grandTotal = Number(snapshot.grandTotal) || stage1Total + stage2Total;

  return (
    <article
      className="implant-factura ifc-sheet"
      data-testid="implant-wizard-factura"
      data-implant-factura={IMPLANT_WIZARD_FACTURA_MARKER}
      data-implant-factura-card
      data-factura-layout="implant-center-paper"
      data-factura-total={grandTotal}
    >
      <div className="ifc-head">
        <div className="ifc-fields">
          <p className="ifc-field">
            <span>{PAPER.date}:</span>
            <strong className="ifc-ink">{toDMY(snapshot.date) || ''}</strong>
          </p>
          <p className="ifc-field">
            <span>{PAPER.patient}:</span>
            <strong className="ifc-ink">{snapshot.patient_name || PAPER.noPatient}</strong>
          </p>
        </div>
        <div className="ifc-brand">
          <div className="ifc-brand-mark">
            <ClinicLogo />
            <div>
              <p className="ifc-clinic">IMPLANT CENTER</p>
              {title && title !== 'Implant Center' ? <p className="ifc-subtitle">{title}</p> : null}
            </div>
          </div>
          {showPrintButton ? (
            <button
              type="button"
              className="ifc-print"
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
      </div>

      <section className="ifc-formula">
        <div className="ifc-formula-copy">
          <h4>Tish qatori formulasi</h4>
          <p className="ifc-overall-label">{PAPER.overall}:</p>
          <div className="ifc-overall" data-testid="implant-factura-grand-total">
            {toothLines.length ? (
              <ul className="ifc-teeth ifc-ink" data-testid="implant-factura-teeth">
                {toothLines.map((row) => (
                  <li key={row.fdi}>
                    <b>#{row.fdi}</b>
                    <span>{row.brand || 'Implant'}</span>
                    {row.size ? <em>{row.size}</em> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ifc-teeth-plain ifc-ink">{teeth.map((fdi) => `#${fdi}`).join(', ')}</p>
            )}
            <strong className="ifc-overall-sum ifc-ink">
              {grandTotal > 0 ? formatSom(grandTotal) : ''} <small>{PAPER.som}</small>
            </strong>
            <p className="ifc-overall-split">
              {teeth.length} ta {PAPER.implants} · 1-bosqich {formatSom(stage1Total)} + 2-bosqich {formatSom(stage2Total)}
            </p>
          </div>
        </div>
        <div className="ifc-jaw-wrap" data-testid="implant-factura-arch">
          <ImplantFacturaJaw implantedFdis={teeth} extractionFdis={extractionFdis} />
        </div>
      </section>

      <section className="ifc-stage" data-stage="1">
        <div className="ifc-bar">
          <h4>{PAPER.stage1}</h4>
          <TotalBox value={stage1Total} />
        </div>
        <StageColumns parts={stage1} onEdit={onEdit} keyPrefix="s1" />
      </section>

      <section className="ifc-stage" data-stage="2">
        <div className="ifc-bar">
          <h4>{PAPER.stage2}</h4>
          <span className="ifc-bar-mid">{PAPER.stage2When}</span>
          <TotalBox value={stage2Total} />
        </div>
        <StageColumns parts={stage2} onEdit={onEdit} keyPrefix="s2" />
      </section>

      <footer className="ifc-note">
        <strong>{PAPER.notice}</strong>
        <p>{PAPER.notice1}</p>
        <p>{PAPER.notice2}</p>
      </footer>
    </article>
  );
}
