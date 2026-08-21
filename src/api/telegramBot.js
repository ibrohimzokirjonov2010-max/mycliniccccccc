/**
 * Telegram Notification Service
 * Sends lead notifications to clinic-configured Telegram channels.
 */

export const fetchTelegramBotUsername = async (botToken) => {
  const token = String(botToken || '').trim();
  if (!token) return '';

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const result = await response.json();
    if (!result?.ok) return '';
    return String(result.result?.username || '').replace(/^@/, '').trim();
  } catch (error) {
    console.error('Telegram getMe error:', error);
    return '';
  }
};

export const sendTelegramMessage = async (botToken, chatId, message) => {
  if (!botToken || !chatId) return { success: false, error: 'Token or Chat ID missing' };
  
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    const result = await response.json();
    return { success: result.ok, data: result };
  } catch (error) {
    console.error('Telegram API Error:', error);
    return { success: false, error: error.message };
  }
};

export const formatLeadMessage = (clinicName, lead) => {
  const now = new Date();
  const dateStr = now.toLocaleString('uz-UZ', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Questions parsing if they exist in notes or separately
  // The user's screenshot has specific questions. 
  // We'll try to extract them from notes if they are in a certain format, 
  // or just provide a clean generic format if not.
  
  let userDetails = "";
  if (lead.questions && Array.isArray(lead.questions)) {
    lead.questions.forEach((q, i) => {
      userDetails += `${i + 1}. ${q.question}: ${q.answer}\n`;
    });
  } else {
    userDetails += `1. Ismi: ${lead.name || 'Nomalum'}\n`;
    userDetails += `2. Telefon: ${lead.phone || 'Korsatilmagan'}\n`;
  }

  return `
#telegram

🧾 <b>Nomi:</b> ${clinicName}
🥳 <b>Foydalanuvchi ma'lumotlari:</b>
${userDetails}
ℹ️ <b>Manba:</b> ${lead.source || 'Instagram'}
📅 <b>Sana:</b> ${dateStr}

✅ <b>Telegram uchun tayyor</b>
  `.trim();
};
