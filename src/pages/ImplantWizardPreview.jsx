import ImplantForm from '@/components/implants/ImplantForm';

const PREVIEW_PATIENTS = [
  { id: 'preview-1', full_name: 'Ali Valiyev', phone: '+998901112233' },
  { id: 'preview-2', full_name: 'Dilnoza Karimova', phone: '+998907778899' },
];

const PREVIEW_IMPLANTS = [
  {
    id: 'preview-imp-1',
    patient_id: 'preview-1',
    patient_name: 'Ali Valiyev',
    tooth_numbers: ['16', '26'],
    firma: 'Osstem',
    placement_date: '2026-02-11',
    price: 1500000,
  },
  {
    id: 'preview-imp-2',
    patient_id: 'preview-1',
    patient_name: 'Ali Valiyev',
    tooth_numbers: ['36'],
    firma: 'Dentium',
    placement_date: '2025-11-02',
    price: 1800000,
  },
];

/** DEV-only preview: YANGI IMPLANT wizard without auth. */
export default function ImplantWizardPreview() {
  return (
    <div className="min-h-[100dvh] bg-slate-300">
      <ImplantForm
        open
        onClose={() => {}}
        patients={PREVIEW_PATIENTS}
        knownPatientImplants={PREVIEW_IMPLANTS}
        services={[]}
        onSaved={() => {}}
      />
    </div>
  );
}
