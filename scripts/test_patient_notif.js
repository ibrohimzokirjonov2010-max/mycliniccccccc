
import { createClient } from '@supabase/supabase-js';

const URL = 'https://hkkhhnrqzjvhubkqhrhm.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhra2hobnJxemp2aHVia3FocmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzUyMzAsImV4cCI6MjA5MDcxMTIzMH0._8btS4wMQvGplJA2yaRib9hqy33WvPkJWtexxVj9lvU';
const supabase = createClient(URL, KEY);

async function testConnectivity() {
  console.log('Searching for patient: Zokirjonova Nigora...');
  
  // 1. Find patient
  const { data: patients } = await supabase.from('notes').select('*').limit(1000);
  
  const patientNote = patients.find(n => n.notes?.includes('Zokirjonova Nigora'));
  
  if (!patientNote) {
    console.log('Patient not found in DB.');
    return;
  }
  
  console.log('Found Patient Note:', patientNote.id);
  
  // 2. Check for ScheduledNotifications
  const notifications = patients.filter(n => n.notes?.includes('ScheduledNotification') && n.notes?.includes(patientNote.id));
  console.log(`Found ${notifications.length} scheduled notifications.`);
  
  notifications.forEach(n => {
    console.log('Notification Content:', n.notes);
  });

  // 3. Try to get chat_id from the patient record if the user started the bot
  // In our system, the bot should update the patient record or we find it in bot logs
  // Since we don't have the bot webhook logs here, we check if the patient record was updated
  
  if (patientNote.notes?.includes('chat_id') || patientNote.notes?.includes('telegram_id')) {
    console.log('Chat ID found! Connectivity confirmed.');
  } else {
    console.log('Chat ID not found in patient record yet. Bot might not have saved it or patient didn\'t share contact.');
  }
}

testConnectivity();
