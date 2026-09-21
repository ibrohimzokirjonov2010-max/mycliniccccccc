import ImplantForm from '@/components/implants/ImplantForm';

/** DEV-only preview: YANGI IMPLANT wizard without auth. */
export default function ImplantWizardPreview() {
  return (
    <div className="min-h-[100dvh] bg-slate-300">
      <ImplantForm
        open
        onClose={() => {}}
        patients={[{ id: 'preview-1', full_name: 'Ali Valiyev', phone: '+998901112233' }]}
        services={[]}
        onSaved={() => {}}
      />
    </div>
  );
}
