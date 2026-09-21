import { Check, Pencil, Search, Droplets } from 'lucide-react';
import { Tooth, CrownIcon, FormerIcon, AbutmentIcon, BoneGraftIcon, SinusLiftIcon } from '@/components/ui/Icons';
import { cn } from '@/lib/utils';
import { getServiceLabel, IMPLANT_WIZARD_STEP2_MARKER } from './implantWizardLabels';
import './implantWizard.css';

function formatSom(n) {
  const v = Math.round(Number(n) || 0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const SERVICE_TABS = [
  { id: 'all', labelKey: 'catAll', fallback: 'Barchasi' },
  { id: 'crowns', labelKey: 'catCrowns', fallback: 'Tojlar' },
  { id: 'abutment', labelKey: 'catAbutment', fallback: 'Abutment' },
  { id: 'sinus', labelKey: 'catSinus', fallback: 'Sinus' },
  { id: 'bone', labelKey: 'catBone', fallback: 'Suyak/PRF' },
];

function ServiceGlyph({ service }) {
  const id = String(service.id || '').toLowerCase();
  const cat = String(service.category || '').toLowerCase();
  const cls = 'w-3.5 h-3.5 text-[#0d9488] shrink-0';
  if (/prf/.test(id)) return <Droplets className={cls} />;
  if (/healing|formik/.test(id)) return <FormerIcon className={cls} />;
  if (/crown|karonka|veneer/.test(id) || /orto/.test(cat)) return <CrownIcon className={cls} />;
  if (/abutment|abatment|cover/.test(id)) return <AbutmentIcon className={cls} />;
  if (/sinus/.test(id)) return <SinusLiftIcon className={cls} />;
  if (/bone|graft|nkr|membrane/.test(id)) return <BoneGraftIcon className={cls} />;
  return <Tooth className={cls} />;
}

export default function ImplantWizardStep2({
  selectedFdis,
  brandLabel,
  extraServicesList,
  extraSearch,
  setExtraSearch,
  extraTab,
  setExtraTab,
  selectedServiceIds,
  extraServicePrices,
  editingPriceId,
  setEditingPriceId,
  onToggleService,
  onSetPrice,
  onBackToStep1,
  tw,
  t,
}) {
  return (
    <div
      className="implant-wizard-step2"
      data-implant-wizard={IMPLANT_WIZARD_STEP2_MARKER}
      data-testid="implant-wizard-step2"
    >
      <aside className="implant-wizard-teeth" style={{ width: 240, minWidth: 240 }}>
        <div className="implant-wizard-teeth-head mb-3">
          <h3 className="text-[15px] font-bold text-[#111827]">{tw('selectedTeeth', 'Tanlangan tishlar')}</h3>
          <div className="implant-wizard-teeth-sub mt-1 h-[3px] w-10 rounded-full" style={{ background: '#0d9488' }} />
        </div>
        <div className="implant-wizard-teeth-list flex-1 space-y-1 overflow-y-auto min-h-0 pr-0.5">
          {selectedFdis.map((fdi, idx) => (
            <div key={fdi} className="implant-wizard-tooth-chip flex items-center gap-2.5 px-1 py-1.5">
              <span
                className="chip-index w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                style={{ border: '1px solid #0d9488', color: '#0d9488' }}
              >
                {idx + 1}
              </span>
              <Tooth className="chip-tooth w-4 h-4 text-[#9ca3af] shrink-0" />
              <span className="chip-fdi text-sm font-semibold text-[#111827] tabular-nums">#{fdi}</span>
              <span className="ml-auto text-xs text-[#9ca3af] chip-brand">{brandLabel}</span>
            </div>
          ))}
        </div>
        {selectedFdis.length > 4 && (
          <p className="implant-wizard-scroll-hint">{tw('scrollHint', '← Yon tomonga suring →')}</p>
        )}
        <button
          type="button"
          onClick={onBackToStep1}
          className="implant-wizard-teeth-back mt-3 text-left text-xs text-[#9ca3af] hover:text-[#0d9488] bg-transparent border-0 p-0 cursor-pointer flex items-center gap-1"
        >
          <span className="w-4 h-4 rounded-full border border-[#e5e7eb] text-[9px] flex items-center justify-center">i</span>
          {tw('fromStep1', '1-qadamdan')}
        </button>
        <div className="implant-wizard-teeth-foot mt-3 pt-3 border-t border-[#e5e7eb] flex items-end justify-between">
          <div>
            <p className="text-xs text-[#6b7280]">{tw('totalImplants', 'Jami implantlar')}</p>
            <p className="text-lg font-bold" style={{ color: '#0d9488' }}>
              {selectedFdis.length} {tw('implantUnit', 'implant')}
            </p>
          </div>
          <Tooth className="w-8 h-8 text-[#d1d5db]" />
        </div>
      </aside>

      <section className="implant-wizard-services">
        <h3 className="text-[15px] font-bold text-[#111827] mb-3">{tw('extraServices', "Qo'shimcha xizmatlar")}</h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af]" />
          <input
            value={extraSearch}
            onChange={(e) => setExtraSearch(e.target.value)}
            placeholder={tw('searchService', 'Xizmat nomini qidirish...')}
            className="w-full h-10 pl-9 pr-3 rounded-[10px] border border-[#e5e7eb] bg-white text-sm outline-none"
            style={{ outlineColor: '#0d9488' }}
          />
        </div>
        <div className="implant-wizard-tabs flex items-center gap-0 border-b border-[#e5e7eb] mb-3 overflow-x-auto">
          {SERVICE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setExtraTab(tab.id)}
              className={cn(
                'px-3 pb-2 text-sm font-medium whitespace-nowrap bg-transparent border-0 border-b-2 cursor-pointer',
                extraTab === tab.id ? 'border-[#0d9488]' : 'border-transparent text-[#6b7280] hover:text-[#111827]'
              )}
              style={extraTab === tab.id ? { color: '#0d9488', borderBottomColor: '#0d9488' } : undefined}
            >
              {tw(tab.labelKey, tab.fallback)}
            </button>
          ))}
        </div>
        <div className="implant-wizard-service-list">
          {extraServicesList.map((service) => {
            const isSelected = (selectedServiceIds || []).includes(service.id);
            const currentPrice = extraServicePrices[service.id] !== undefined
              ? extraServicePrices[service.id]
              : service.defaultPrice;
            const isEditing = editingPriceId === service.id;
            const label = getServiceLabel(service, t);
            return (
              <div
                key={service.id}
                className="flex items-center gap-2 px-3 py-2 rounded-[10px] border min-h-[44px] bg-white"
                style={isSelected ? { borderColor: '#0d9488' } : { borderColor: '#e5e7eb' }}
              >
                <button
                  type="button"
                  onClick={() => onToggleService(service.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 bg-transparent border-0 p-0 cursor-pointer text-left"
                >
                  <ServiceGlyph service={service} />
                  <span className="text-sm font-medium truncate text-[#111827]">{label}</span>
                  {isSelected && (
                    <span
                      className="w-4 h-4 rounded-full text-white flex items-center justify-center shrink-0"
                      style={{ background: '#0d9488' }}
                    >
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      inputMode="numeric"
                      value={formatSom(currentPrice)}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        onSetPrice(service.id, digits === '' ? 0 : Number(digits));
                      }}
                      onBlur={() => setEditingPriceId(null)}
                      className="w-[92px] h-7 text-right text-xs font-semibold rounded-md px-1.5 outline-none"
                      style={{ border: '1px solid #0d9488' }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (!isSelected) onToggleService(service.id);
                        setEditingPriceId(service.id);
                      }}
                      className="flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
                    >
                      <span className={cn('text-xs font-semibold whitespace-nowrap', isSelected ? 'text-[#111827]' : 'text-[#6b7280]')}>
                        {formatSom(currentPrice)} so&apos;m
                      </span>
                      <Pencil className="w-3 h-3 text-[#9ca3af]" />
                    </button>
                  )}
                  {isSelected && (
                    <span
                      className="w-4 h-4 rounded-full text-white flex items-center justify-center"
                      style={{ background: '#0d9488' }}
                    >
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
