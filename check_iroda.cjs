const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zvyggjldzkxwufpnaatr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2eWdnamxkemt4d3VmcG5hYXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTg3NTAsImV4cCI6MjEwMjk5NDc1MH0.v4IyrtyJR8a9bQ7tAapDQxe2VHZHiH_IVuHfeC6MeN4';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixAllPatients() {
  console.log("Starting full database financial synchronization...");
  const { data: patients, error: pErr } = await supabase.from('patients').select('*');
  if (pErr) {
    console.error("Failed to fetch patients:", pErr);
    return;
  }

  const { data: payments } = await supabase.from('payments').select('*');
  const { data: plans } = await supabase.from('treatment_plans').select('*');

  console.log(`Loaded ${patients.length} patients, ${payments?.length || 0} payments, ${plans?.length || 0} plans.`);

  for (const patient of patients) {
    const patPays = (payments || []).filter(p => p.patient_id === patient.id);
    const patPlans = (plans || []).filter(p => p.patient_id === patient.id);

    const totalIncomes = patPays.filter(p => p.type?.toLowerCase() === 'income').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalDebts = patPays.filter(p => p.type?.toLowerCase() === 'debt').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalRefunds = patPays.filter(p => p.type?.toLowerCase() === 'refund').reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const totalDiscounts = patPays.filter(p => p.type?.toLowerCase() === 'discount').reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
    const totalPlansPrice = patPlans.reduce((sum, pl) => sum + (Number(pl.total_price) || 0), 0);

    let calculatedDebt = 0;
    if (totalDebts > 0) {
      const net = totalIncomes + totalDiscounts - totalDebts - totalRefunds;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
    } else if (totalPlansPrice > 0) {
      const net = totalIncomes + totalDiscounts - totalPlansPrice;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
    } else {
      const net = totalIncomes - totalRefunds;
      calculatedDebt = net < 0 ? Math.abs(net) : 0;
    }

    const currentDebt = Number(patient.total_debt) || 0;
    const currentPaid = Number(patient.total_paid) || 0;

    if (currentDebt !== calculatedDebt || currentPaid !== totalIncomes) {
      console.log(`Syncing patient ${patient.full_name} (${patient.id}): Paid ${currentPaid} -> ${totalIncomes}, Debt ${currentDebt} -> ${calculatedDebt}`);
      
      let newNotes = patient.notes || '';
      if (newNotes.startsWith('[TECH_DATA]')) {
        try {
          const endIdx = newNotes.indexOf('[END_TECH]');
          if (endIdx !== -1) {
            const tech = JSON.parse(newNotes.substring(11, endIdx));
            tech.total_paid = totalIncomes;
            tech.total_debt = calculatedDebt;
            const userNotes = newNotes.substring(endIdx + 10).replace(/^\n/, '');
            newNotes = '[TECH_DATA]' + JSON.stringify(tech) + '[END_TECH]' + (userNotes ? '\n' + userNotes : '');
          }
        } catch (e) {}
      }

      await supabase.from('patients').update({
        total_paid: totalIncomes,
        total_debt: calculatedDebt,
        notes: newNotes,
        updated_date: new Date().toISOString()
      }).eq('id', patient.id);
    }
  }

  console.log("All patients synchronized successfully!");
}

fixAllPatients();
