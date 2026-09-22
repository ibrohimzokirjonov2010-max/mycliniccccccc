import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatSom } from './implantFactura';
import { getServiceLabel } from './implantWizardLabels';
import { toothSizeIssue } from './implantSize';
import './implantWizard.css';

const fieldInput =
  'h-10 rounded-[10px] border border-[#e5e7eb] bg-white text-sm text-[#111827] font-medium shadow-none focus-visible:ring-[#0d9488]/20 focus-visible:border-[#0d9488]';

export default function ImplantWizardToothEntry({
  fdi,
  data,
  brands,
  onChange,
  onRemove,
  extraServices,
  selectedExtraIds,
  onToggleExtra,
  promptSizes = false,
  tw,
  t,
}) {
  const [query, setQuery] = useState('');
  const firma = data?.firma || 'Osstem';
  const brandOptions = (brands || []).includes(firma) ? brands : [firma, ...(brands || [])];
  const price = data?.price ?? 1500000;
  const notes = data?.notes || '';
  const selected = useMemo(() => new Set(selectedExtraIds || []), [selectedExtraIds]);

  const services = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (extraServices || []).filter((service) => {
      if (!q) return true;
      return getServiceLabel(service, t).toLowerCase().includes(q);
    });
    return [...list].sort((a, b) => {
      const ai = selected.has(a.id) ? 0 : 1;
      const bi = selected.has(b.id) ? 0 : 1;
      return ai - bi;
    });
  }, [extraServices, query, selected, t]);

  const title = tw('toothEntryTitle', "Tish #{n} — ma'lumot kiriting").replace('{n}', fdi);
  const liveIssue = toothSizeIssue(data, { strict: false });
  const strictIssue = promptSizes ? toothSizeIssue(data, { strict: true }) : '';
  const sizeIssue = liveIssue || strictIssue;
  const sizeMessage = {
    missing: tw('needSize', 'Diametr va uzunlikni kiriting (mm)'),
    'need-diameter': tw('needDiameter', 'Diametrni kiriting (Ø, mm)'),
    'need-length': tw('needLength', 'Uzunlikni kiriting (L, mm)'),
    'bad-diameter': tw('badDiameter', "Diametr 1.5–8 mm bo'lsin"),
    'bad-length': tw('badLength', "Uzunlik 4–30 mm bo'lsin"),
  }[sizeIssue] || '';
  const diameterInvalid = sizeIssue === 'missing' || sizeIssue === 'need-diameter' || sizeIssue === 'bad-diameter';
  const lengthInvalid = sizeIssue === 'missing' || sizeIssue === 'need-length' || sizeIssue === 'bad-length';

  return (
    <section
      className="implant-wizard-tooth-entry"
      data-testid="implant-wizard-tooth-entry"
      data-tooth={fdi}
      aria-live="polite"
    >
      <div className="implant-wizard-tooth-entry-head">
        <h4>{title}</h4>
        <button type="button" className="implant-wizard-tooth-entry-remove" onClick={onRemove}>
          {tw('removeTooth', 'Olib tashlash')}
        </button>
      </div>

      <div className="implant-wizard-tooth-entry-grid">
        <div>
          <span className="implant-wizard-field-label">{tw('brand', 'Brend')}</span>
          <Select
            value={firma}
            onValueChange={(value) => onChange({
              firma: value,
              firma_custom: value === 'Boshqa' ? (data?.firma_custom || '') : '',
              brend: value === 'Boshqa' ? (data?.firma_custom || '') : value,
            })}
          >
            <SelectTrigger className={fieldInput}>
              <SelectValue placeholder={tw('brand', 'Brend')} />
            </SelectTrigger>
            <SelectContent className="z-[220] rounded-xl">
              {brandOptions.map((brand) => (
                <SelectItem key={brand} value={brand}>{brand}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {firma === 'Boshqa' && (
            <Input
              placeholder={tw('brandName', 'Firma nomini yozing...')}
              value={data?.firma_custom || ''}
              onChange={(e) => onChange({
                firma: 'Boshqa',
                firma_custom: e.target.value,
                brend: e.target.value,
              })}
              className={`${fieldInput} mt-1.5`}
            />
          )}
        </div>
        <div>
          <span className="implant-wizard-field-label">{tw('priceLabel', 'Narx')}</span>
          <div className="relative">
            <input
              inputMode="numeric"
              value={formatSom(price)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                onChange({ price: digits === '' ? 0 : Number(digits) });
              }}
              className="h-10 w-full rounded-[10px] border border-[#e5e7eb] bg-white px-3 pr-12 text-sm text-[#111827] font-medium outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20"
              aria-label={tw('priceLabel', 'Narx')}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6b7280]">so&apos;m</span>
          </div>
        </div>
      </div>

      <div className="implant-wizard-size-grid">
        <div>
          <span className="implant-wizard-field-label">{tw('diameterLabel', 'Diametr (Ø)')}</span>
          <div className="relative">
            <input
              data-testid="implant-wizard-diameter"
              inputMode="decimal"
              value={data?.diameter ?? ''}
              onChange={(e) => onChange({ diameter: e.target.value })}
              placeholder="4.0"
              aria-invalid={diameterInvalid || undefined}
              aria-label={tw('diameterLabel', 'Diametr (Ø)')}
              className={`h-10 w-full rounded-[10px] border bg-white px-3 pr-10 text-sm text-[#111827] font-medium outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20 ${diameterInvalid ? 'border-rose-400' : 'border-[#e5e7eb]'}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6b7280]">mm</span>
          </div>
        </div>
        <div>
          <span className="implant-wizard-field-label">{tw('lengthLabel', 'Uzunlik (L)')}</span>
          <div className="relative">
            <input
              data-testid="implant-wizard-length"
              inputMode="decimal"
              value={data?.length ?? ''}
              onChange={(e) => onChange({ length: e.target.value })}
              placeholder="10"
              aria-invalid={lengthInvalid || undefined}
              aria-label={tw('lengthLabel', 'Uzunlik (L)')}
              className={`h-10 w-full rounded-[10px] border bg-white px-3 pr-10 text-sm text-[#111827] font-medium outline-none focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20 ${lengthInvalid ? 'border-rose-400' : 'border-[#e5e7eb]'}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6b7280]">mm</span>
          </div>
        </div>
      </div>
      {sizeMessage ? (
        <p className="implant-wizard-size-error" role="alert">{sizeMessage}</p>
      ) : null}

      <div className="mt-2">
        <span className="implant-wizard-field-label">{tw('notes', 'Izoh')}</span>
        <input
          value={notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={tw('notes', 'Izoh')}
          className="w-full h-10 rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#0d9488]"
        />
      </div>

      <div className="mt-3">
        <span className="implant-wizard-field-label">{tw('extraServices', "Qo'shimcha xizmatlar")}</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tw('searchService', 'Xizmat nomini qidirish...')}
          className="w-full h-9 rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-sm outline-none focus:border-[#0d9488]"
        />
        <div className="implant-wizard-tooth-extras">
          {services.length === 0 ? (
            <p className="implant-wizard-tooth-extra-empty">{tw('noServiceMatch', 'Xizmat topilmadi')}</p>
          ) : services.map((service) => {
            const on = selected.has(service.id);
            return (
              <button
                key={service.id}
                type="button"
                aria-pressed={on}
                onClick={() => onToggleExtra(service.id)}
                className={on ? 'implant-wizard-tooth-extra is-on' : 'implant-wizard-tooth-extra'}
              >
                {getServiceLabel(service, t)}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
