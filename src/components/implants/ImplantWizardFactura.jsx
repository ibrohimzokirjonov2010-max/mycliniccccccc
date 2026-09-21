import { Printer } from 'lucide-react';
import {
  IMPLANT_WIZARD_FACTURA_MARKER,
  UPPER_FDI,
  LOWER_FDI,
  formatSom,
  resolveClinicTitle,
  toDMY,
} from './implantFactura';
import './implantWizard.css';

function FacturaMoney({ value, onChange, ariaLabel }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={formatSom(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        onChange(digits === '' ? 0 : Number(digits));
      }}
      className="implant-factura-input implant-factura-input-money"
    />
  );
}

function FacturaQty({ value, onChange, ariaLabel }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={ariaLabel}
      value={value === 0 || value ? String(value) : ''}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        onChange(digits === '' ? 0 : Number(digits));
      }}
      className="implant-factura-input implant-factura-input-qty"
    />
  );
}

function FormulaRow({ teeth, selectedSet }) {
  return (
    <div className="implant-factura-fdi-row">
      {teeth.map((n) => {
        const on = selectedSet.has(String(n));
        return (
          <span key={n} className={on ? 'implant-factura-fdi is-on' : 'implant-factura-fdi'}>
            {n}
          </span>
        );
      })}
    </div>
  );
}

function LineRow({ line, onQty, onPrice, tw }) {
  return (
    <div className={line.source === 'placeholder' && !(Number(line.qty) > 0) ? 'implant-factura-line is-muted' : 'implant-factura-line'}>
      <span className="implant-factura-line-label">{line.label}</span>
      <div className="implant-factura-line-math">
        <FacturaMoney
          value={line.unitPrice}
          onChange={onPrice}
          ariaLabel={`${line.label} ${tw('price', 'narx')}`}
        />
        <span className="implant-factura-times">×</span>
        <FacturaQty
          value={line.qty}
          onChange={onQty}
          ariaLabel={`${line.label} ${tw('qty', 'soni')}`}
        />
        <span className="implant-factura-ta">{tw('qtyShort', 'ta')}</span>
        <span className="implant-factura-eq">=</span>
        <span className="implant-factura-line-total">
          {formatSom(line.total)} <span className="implant-factura-som">so&apos;m</span>
        </span>
      </div>
    </div>
  );
}

export default function ImplantWizardFactura({
  snapshot,
  clinicName,
  onEdit,
  onPrint,
  tw,
}) {
  if (!snapshot) return null;
  const selectedSet = new Set((snapshot.teeth || []).map(String));
  const title = resolveClinicTitle(clinicName || snapshot.clinic);
  const stage1Left = [];
  const stage1Right = [];
  (snapshot.stage1 || []).forEach((line, idx) => {
    if (idx === 0 || stage1Left.length <= stage1Right.length) stage1Left.push(line);
    else stage1Right.push(line);
  });
  const stage2Left = [];
  const stage2Right = [];
  (snapshot.stage2 || []).forEach((line) => {
    if (line.id === 'titan_frame' || line.id === 'veneer') stage2Left.push(line);
    else stage2Right.push(line);
  });

  return (
    <article
      className="implant-factura"
      data-testid="implant-wizard-factura"
      data-implant-factura={IMPLANT_WIZARD_FACTURA_MARKER}
      data-implant-factura-card
    >
      <header className="implant-factura-head">
        <div className="implant-factura-meta">
          <p>
            <span>{tw('date', 'Sana')}:</span>
            <strong>{toDMY(snapshot.date) || '—'}</strong>
          </p>
          <p>
            <span>{tw('patient', 'Bemor F.I.Sh')}:</span>
            <strong>{snapshot.patient_name || tw('noPatient', 'Bemor tanlanmagan')}</strong>
          </p>
        </div>
        <div className="implant-factura-brand">
          <span className="implant-factura-logo" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <path d="M16 3c2.2 3.4 3.2 6.6 3.2 9.2 0 2.2-.8 4-3.2 6.2-2.4-2.2-3.2-4-3.2-6.2C12.8 9.6 13.8 6.4 16 3Z" fill="#0d9488"/>
              <path d="M8 14.5c2.4 0 4.3.7 5.8 2.2 1.2 1.2 2 2.6 2.2 4.3H16c-2.6 0-4.8-1-6.5-2.8C7.8 16.4 7.2 15.4 8 14.5Z" fill="#0f766e"/>
              <path d="M24 14.5c-.8.9-1.4 1.9-3.1 3.7-1.7 1.8-3.9 2.8-6.5 2.8h-.1c.3-1.7 1-3.1 2.2-4.3 1.5-1.5 3.4-2.2 5.8-2.2H24Z" fill="#0f766e"/>
              <path d="M11.2 22.2c1.4 2.4 2.8 4.2 4.8 6.3 2-2.1 3.4-3.9 4.8-6.3H11.2Z" fill="#115e59"/>
            </svg>
          </span>
          <div>
            <p className="implant-factura-clinic">{title}</p>
            <p className="implant-factura-subtitle">{tw('title', 'Faktura / davolash rejasi')}</p>
          </div>
          <button
            type="button"
            className="implant-factura-print"
            onClick={() => {
              if (typeof onPrint === 'function') {
                onPrint();
                return;
              }
              const root = document.documentElement;
              const done = () => {
                root.classList.remove('printing-implant-factura');
                window.removeEventListener('afterprint', done);
              };
              root.classList.add('printing-implant-factura');
              window.addEventListener('afterprint', done);
              window.print();
            }}
            aria-label={tw('print', 'Chop etish')}
          >
            <Printer className="w-3.5 h-3.5" />
            {tw('print', 'Chop etish')}
          </button>
        </div>
      </header>

      <section className="implant-factura-formula">
        <div>
          <h4>{tw('formula', 'Tish qatori formulasi')}</h4>
          <FormulaRow teeth={UPPER_FDI} selectedSet={selectedSet} />
          <FormulaRow teeth={LOWER_FDI} selectedSet={selectedSet} />
          <p className="implant-factura-teeth-list">
            {tw('selectedTeeth', 'Tanlangan tishlar')}:{' '}
            <strong>
              {snapshot.teeth?.length
                ? snapshot.teeth.map((n) => `#${n}`).join(' · ')
                : '—'}
            </strong>
          </p>
        </div>
        <div className="implant-factura-umumiy">
          <span>{tw('overall', 'Umumiy')}</span>
          <strong>{formatSom(snapshot.stage1Total)} so&apos;m</strong>
          <em>{tw('stage1Now', '1-bosqich / hozir')}</em>
        </div>
      </section>

      <section className="implant-factura-stage">
        <div className="implant-factura-stage-bar">
          <h4>{tw('stage1', '1. Bosqich')} <small>{tw('stage1Hint', "Jarrohlik / hozir")}</small></h4>
          <span>
            {tw('subtotal', 'Umumiy')}: <strong>{formatSom(snapshot.stage1Total)} so&apos;m</strong>
          </span>
        </div>
        <div className="implant-factura-cols">
          <div>
            {stage1Left.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                tw={tw}
                onQty={(qty) => onEdit(line.id, 'qty', qty)}
                onPrice={(unitPrice) => onEdit(line.id, 'unitPrice', unitPrice)}
              />
            ))}
          </div>
          <div>
            {stage1Right.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                tw={tw}
                onQty={(qty) => onEdit(line.id, 'qty', qty)}
                onPrice={(unitPrice) => onEdit(line.id, 'unitPrice', unitPrice)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="implant-factura-stage">
        <div className="implant-factura-stage-bar is-later">
          <h4>{tw('stage2', '2. Bosqich')} <small>{tw('stage2Hint', "2–3 oydan so'ng")}</small></h4>
          <span>
            {tw('subtotal', 'Umumiy')}: <strong>{formatSom(snapshot.stage2Total)} so&apos;m</strong>
          </span>
        </div>
        <div className="implant-factura-cols">
          <div>
            {stage2Left.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                tw={tw}
                onQty={(qty) => onEdit(line.id, 'qty', qty)}
                onPrice={(unitPrice) => onEdit(line.id, 'unitPrice', unitPrice)}
              />
            ))}
          </div>
          <div>
            {stage2Right.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                tw={tw}
                onQty={(qty) => onEdit(line.id, 'qty', qty)}
                onPrice={(unitPrice) => onEdit(line.id, 'unitPrice', unitPrice)}
              />
            ))}
          </div>
        </div>
        <p className="implant-factura-later-note">{tw('stage2Note', "2-bosqich narxi keyinroq, ish boshlanayotganda aniqlashtiriladi.")}</p>
      </section>

      <footer className="implant-factura-eslatma">
        <strong>{tw('notice', 'Eslatma!')}</strong>
        <p>{tw('notice1', "1-bosqichda hisoblab berilgan harajatlar miqdori 3 oy amal qiladi.")}</p>
        <p>{tw('notice2', "2-bosqich narxi implantatsiyadan so'ng 2–3 oy o'tib ish boshlanayotganda siz bilan maslahatlashgan holda aniq hisoblab beriladi.")}</p>
      </footer>
    </article>
  );
}
