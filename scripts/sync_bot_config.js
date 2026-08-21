
import { createClient } from '@supabase/supabase-js';

const URL = 'https://hkkhhnrqzjvhubkqhrhm.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhra2hobnJxemp2aHVia3FocmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzUyMzAsImV4cCI6MjA5MDcxMTIzMH0._8btS4wMQvGplJA2yaRib9hqy33WvPkJWtexxVj9lvU';
const supabase = createClient(URL, KEY);

async function updateConfig() {
  const token = '8744772287:AAEwNkDvVDAScGqMGGiYgTrip_fANoWffak';
  const username = 'BemorEslat_bot';
  const clinicId = 'avadent';

  console.log('Updating BotConfig...');
  
  // Try to find existing
  const { data: existing } = await supabase.from('notes').select('*').eq('clinic_id', clinicId).limit(10);
  
  // Note: base44 saves BotConfig into 'notes' table using [TECH_DATA] encoding
  const techData = {
    botToken: token,
    botUsername: username,
    isActive: true,
    welcomeMessage: 'Assalomu alaykum! Bemorlar Eslatma botiga xush kelibsiz.',
  };
  
  const encodedNotes = '[TECH_DATA]' + JSON.stringify(techData) + '[END_TECH]\nBot Config Auto-Updated';
  
  // Check if we already have a BotConfig in notes
  const configNote = (existing || []).find(n => n.notes?.includes('BotConfig') || n.notes?.includes(username));

  if (configNote) {
    await supabase.from('notes').update({ notes: encodedNotes }).eq('id', configNote.id);
    console.log('Updated existing config.');
  } else {
    await supabase.from('notes').insert([{
      id: 'bot-config-' + Math.random().toString(36).substring(7),
      clinic_id: clinicId,
      notes: encodedNotes,
      created_date: new Date().toISOString()
    }]);
    console.log('Created new config.');
  }
}

updateConfig();
