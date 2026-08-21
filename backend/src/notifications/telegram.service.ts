import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Telegraf } from 'telegraf';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { Patient, PatientDocument } from '../patients/schemas/patient.schema';
import { Appointment, AppointmentDocument } from '../appointments/schemas/appointment.schema';
import { Clinic, ClinicDocument } from '../clinics/schemas/clinic.schema';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf<any>;

  constructor(
    private readonly configService: ConfigService,
    @Optional() @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument> | null,
    @Optional() @InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument> | null,
    @Optional() @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument> | null,
  ) {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.error('TELEGRAM_BOT_TOKEN not found in .env!');
      return;
    }
    this.bot = new Telegraf(token);
  }

  async onModuleInit() {
    if (!this.bot) return;

    // /start <patientId> - Deep link handler
    this.bot.start(async (ctx) => {
      const payload = ctx.startPayload; // This is the patientId passed via ?start=ID
      const chatId = String(ctx.chat.id);
      const userFirstName = ctx.from?.first_name || 'Bemor';

      if (payload) {
        if (payload.startsWith('admin_')) {
          const clinicId = payload.replace('admin_', '');
          
          // NEW: Automatic Sync with Supabase CRM
          this._syncWithSupabase(clinicId, chatId);

          await ctx.reply(
            `🚀 <b>Tabriklaymaz! CRM Avtomatik bog'landi.</b>\n\n` +
            `Siz <b>${clinicId}</b> klinikasi egasi sifatida muvaffaqiyatli tanildingiz.\n\n` +
            `<b>Chat ID:</b> <code>${chatId}</code>\n\n` +
            `CRM dagi "Chat ID" maydoni hozirgina avtomatik yangilandi. Endi botni ishlatishingiz mumkin! ✅`,
            { parse_mode: 'HTML' }
          );
          return;
        }

        try {
          const linked = await this._linkPatientInSupabase(payload, chatId);
          let patient: any = linked;

          if (!patient && this.patientModel) {
            patient = await this.patientModel.findByIdAndUpdate(
              payload,
              { telegram_chat_id: chatId },
              { new: true },
            );
          }

          if (patient) {
            const patientName = patient.full_name || linked?.full_name || userFirstName;
            await ctx.reply(
              `✅ Assalomu alaykum, ${patientName}!\n\n` +
              `Siz klinikaning Telegram botiga muvaffaqiyatli ulangingiz.\n` +
              `Endi qabul vaqtingizdan oldin siz avtomatik eslatmalar olasiz. 🦷\n\n` +
              `Sog'lig'ingiz mustahkam bo'lsin!`,
            );
            this.logger.log(`Patient '${patientName}' linked with chat_id: ${chatId}`);
          } else {
            await ctx.reply(
              `❌ Kechirasiz, ${userFirstName}. Siz haqingizda ma'lumot topilmadi.\n` +
              `Iltimos, klinikaga murojaat qiling.`,
            );
          }
        } catch (error) {
          this.logger.error('Error linking patient to telegram:', error);
          await ctx.reply('Xatolik yuz berdi. Iltimos, klinikaga murojaat qiling.');
        }
      } else {
        await ctx.reply(
          `👋 Assalomu alaykum, ${userFirstName}!\n\n` +
          `Bu bot ${this.configService.get('CLINIC_NAME') || 'Klinika'} tomonidan boshqariladi.\n` +
          `Bot orqali qabul eslatmalarini olish uchun klinikadan maxsus havolani oling.`,
        );
      }
    });

    // 1. Yangi qabul kunini tanlash (Boshqa vaqt tanlash bosilganda)
    this.bot.action(/^appt:reschedule:(.+)$/, async (ctx: any) => {
      const appointmentId = ctx.match?.[1];
      if (!appointmentId) return ctx.answerCbQuery('Xato.');

      try {
        await ctx.answerCbQuery();
        await this.clearInlineKeyboard(ctx);

        const now = dayjs().tz('Asia/Tashkent');
        const keyboard = [];

        // Keyingi 5 kunni ko'rsatamiz
        const monthsUz = [
          'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
          'yanvar', 'fevral', 'mart', 'aprel', 'may' // month() API 0-indexed, let's keep all 12:
        ];
        const correctMonths = [
          'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
          'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
        ];
        const weekdays = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
        for (let i = 0; i < 5; i++) {
          const date = now.add(i, 'day');
          const dateStr = date.format('YYYY-MM-DD');
          
          let dayLabel = '';
          if (i === 0) dayLabel = 'Bugun';
          else if (i === 1) dayLabel = 'Ertaga';
          else dayLabel = weekdays[date.day()];

          const dayNum = date.date();
          const monthIndex = date.month(); // 0-11
          const monthUz = correctMonths[monthIndex] || '';

          keyboard.push([
            {
              text: `📅 ${dayLabel} (${dayNum}-${monthUz})`,
              callback_data: `appt:resch_day:${appointmentId}:${dateStr}`,
            },
          ]);
        }

        keyboard.push([{ text: '❌ Bekor qilish', callback_data: `appt:resch_cancel:${appointmentId}` }]);

        await ctx.reply('🦷 <b>Iltimos, qabul kunini tanlang:</b>', {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard },
        });
      } catch (e) {
        this.logger.error('Error listing reschedule days:', e);
      }
    });

    // 2. Tanlangan kundagi bo'sh soatlarni hisoblab ko'rsatish
    this.bot.action(/^appt:resch_day:(.+):(.+)$/, async (ctx: any) => {
      const appointmentId = ctx.match?.[1];
      const selectedDate = ctx.match?.[2];

      if (!appointmentId || !selectedDate) return ctx.answerCbQuery('Xato.');

      try {
        await ctx.answerCbQuery('Bo\'sh vaqtlar hisoblanmoqda...');
        await this.clearInlineKeyboard(ctx);

        let doctorName = 'Dr. Shahobiddin';
        let clinicId = 'default_clinic';

        if (!appointmentId.startsWith('test-mock-appt-id')) {
          const appointment = await this.findAppointmentById(appointmentId);
          if (appointment) {
            doctorName = appointment.doctor_name || doctorName;
            clinicId = appointment.clinic_id || clinicId;
          }
        }

        // 📅 Shifokorning ish vaqtlarini yuklash
        let workingHours = null;
        if (clinicId && doctorName) {
          const doctorObj = await this.findDoctorByName(clinicId, doctorName);
          if (doctorObj && doctorObj.workingHours) {
            workingHours = doctorObj.workingHours;
          }
        }

        // Hafta kunini topamiz (0: Yakshanba, 1: Dushanba...)
        const dayOfWeek = dayjs(selectedDate).tz('Asia/Tashkent').day();
        
        let startHour = 9;
        let endHour = 18;
        let isActive = true;

        if (workingHours && workingHours[String(dayOfWeek)]) {
          const dayConfig = workingHours[String(dayOfWeek)];
          isActive = dayConfig.active;
          if (dayConfig.start) {
            startHour = parseInt(dayConfig.start.split(':')[0], 10);
          }
          if (dayConfig.end) {
            endHour = parseInt(dayConfig.end.split(':')[0], 10);
          }
        } else if (workingHours) {
          // Agar shifokor ish jadvali kiritilgan bo'lsa, lekin u kun kiritilmagan bo'lsa dam olish kuni deb hisoblaymiz
          isActive = false;
        }

        const dateUz = this.formatDateUz(selectedDate, true, true);

        if (!isActive) {
          await ctx.reply(
            `😔 Kechirasiz, <b>${dateUz}</b> kuni shifokor <b>${doctorName}</b> uchun dam olish kuni.\n\n` +
            `Iltimos, boshqa ish kunini tanlab ko'ring:`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📅 Boshqa kun tanlash', callback_data: `appt:reschedule:${appointmentId}` }],
                  [{ text: '❌ Bekor qilish', callback_data: `appt:resch_cancel:${appointmentId}` }],
                ],
              },
            }
          );
          return;
        }

        // Band bo'lgan qabullarni topish
        const takenAppts = await this.findAppointmentsForDoctorOnDate(clinicId, doctorName, selectedDate);
        const takenTimes = takenAppts.map(a => String(a.time).substring(0, 5));

        // 🕐 Shifokorning ish soatlari bo'yicha faqat butun soatlarni shakllantirish (30 minutliklarsiz)
        const allSlots = [];
        for (let h = startHour; h < endHour; h++) {
          allSlots.push(`${String(h).padStart(2, '0')}:00`);
        }

        // Hozirgi kunda o'tib ketgan soatlarni filtrlash (faqat bugun uchun)
        const now = dayjs().tz('Asia/Tashkent');
        const todayStr = now.format('YYYY-MM-DD');
        const currentHHMM = now.format('HH:mm');

        const freeSlots = allSlots.filter(slot => {
          if (selectedDate === todayStr && slot <= currentHHMM) return false;
          return !takenTimes.includes(slot);
        });

        if (freeSlots.length === 0) {
          await ctx.reply(
            `😔 Kechirasiz, <b>${dateUz}</b> kuni shifokor <b>${doctorName}</b> uchun bo'sh vaqt topilmadi.\n\n` +
            `Iltimos, boshqa kunni tanlab ko'ring:`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📅 Boshqa kun tanlash', callback_data: `appt:reschedule:${appointmentId}` }],
                  [{ text: '❌ Bekor qilish', callback_data: `appt:resch_cancel:${appointmentId}` }],
                ],
              },
            }
          );
          return;
        }

        // Vaqt tugmalari (har qatorda 4 tadan)
        const keyboard = [];
        let row = [];
        freeSlots.forEach((slot, index) => {
          row.push({
            text: `⏰ ${slot}`,
            callback_data: `appt:resch_time:${appointmentId}:${selectedDate}:${slot}`,
          });
          if (row.length === 4 || index === freeSlots.length - 1) {
            keyboard.push(row);
            row = [];
          }
        });

        keyboard.push([
          { text: '🔙 Kunni o\'zgartirish', callback_data: `appt:reschedule:${appointmentId}` },
        ]);

        await ctx.reply(
          `🕒 <b>Doktor ${doctorName}</b> uchun <b>${dateUz}</b> kunidagi bo'sh vaqtlar:\n\n` +
          `Kerakli vaqt ustiga bosing:`,
          {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard },
          }
        );
      } catch (e) {
        this.logger.error('Error listing reschedule times:', e);
      }
    });

    // 3. Tasdiqlash oynasini ko'rsatish
    this.bot.action(/^appt:resch_time:(.+):(.+):(.+)$/, async (ctx: any) => {
      const appointmentId = ctx.match?.[1];
      const selectedDate = ctx.match?.[2];
      const selectedTime = ctx.match?.[3];

      if (!appointmentId || !selectedDate || !selectedTime) return ctx.answerCbQuery('Xato.');

      try {
        await ctx.answerCbQuery();
        await this.clearInlineKeyboard(ctx);

        const dateUz = this.formatDateUz(selectedDate, true, true);

        const text = 
          `❓ <b>QABUL VAQTINI KO'CHIRISHNI TASDIQLAYSIZMI?</b>\n\n` +
          `📅 <b>Yangi sana:</b> ${dateUz}\n` +
          `⏰ <b>Yangi vaqt:</b> ${selectedTime}\n\n` +
          `Ushbu yangi vaqtni tasdiqlaysizmi?`;

        await ctx.reply(text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '✅ Ha, tasdiqlayman',
                  callback_data: `appt:resch_confirm:${appointmentId}:${selectedDate}:${selectedTime}`,
                },
              ],
              [
                {
                  text: '❌ Yo\'q, rad etish',
                  callback_data: `appt:resch_cancel:${appointmentId}`,
                },
              ],
            ],
          },
        });
      } catch (e) {
        this.logger.error('Error confirmation resch_time:', e);
      }
    });

    // 4. Bazani yangilash va yakunlash
    this.bot.action(/^appt:resch_confirm:(.+):(.+):(.+)$/, async (ctx: any) => {
      const appointmentId = ctx.match?.[1];
      const selectedDate = ctx.match?.[2];
      const selectedTime = ctx.match?.[3];

      if (!appointmentId || !selectedDate || !selectedTime) return ctx.answerCbQuery('Xato.');

      try {
        await ctx.answerCbQuery('Qabul yangilanmoqda...');
        await this.clearInlineKeyboard(ctx);

        const dateUz = this.formatDateUz(selectedDate, false, true);

        // Mock test rejimi
        if (appointmentId.startsWith('test-mock-appt-id')) {
          await ctx.reply(
            `🧪 <b>[TEST REJIM MUVAFFAQIYATLI]</b>\n\n` +
               `📅 <b>Yangi vaqt:</b> ${dateUz} soat <b>${selectedTime}</b> da.\n\n` +
            `Sizga yangi vaqt tasdiqlanganligi haqida xabar yuborildi. Rahmat! 😊`
          );
        } else {
          // Bazada qabul vaqtini yangilash
          const updated = await this.updateAppointmentDateTimeInSupabase(appointmentId, selectedDate, selectedTime);
          if (updated) {
            await ctx.reply(
              `✅ <b>QABUL VAQTI MUVAFFAQIYATLI O'ZGARTIRILDI!</b>\n\n` +
              `📅 <b>Yangi vaqt:</b> ${dateUz} soat <b>${selectedTime}</b> da.\n\n` +
              `Sizni yangi vaqtda kutamiz. Salomat bo'ling! 🦷`
            );
          } else {
            await ctx.reply('⚠️ Qabul vaqtini o\'zgartirishda xatolik yuz berdi. Iltimos, keyinroq urinib ko\'ring yoki klinika bilan bog\'laning.');
          }
        }
      } catch (e) {
        this.logger.error('Error confirming reschedule:', e);
      }
    });

    // 5. Bekor qilish (Cancel Reschedule)
    this.bot.action(/^appt:resch_cancel:(.+)$/, async (ctx: any) => {
      const appointmentId = ctx.match?.[1];
      try {
        await ctx.answerCbQuery('Bekor qilindi.');
        await this.clearInlineKeyboard(ctx);
        await ctx.reply('❌ Qabul vaqtini o\'zgartirish bekor qilindi. O\'zgarishlar kiritilmadi.');
      } catch (e) {
        this.logger.error('Error cancelling reschedule:', e);
      }
    });

    // Qabulni tasdiqlash yoki rad etish (Asosiy action handler)
    this.bot.action(/^appt:(confirm|decline|reschedule|admin):(.+)$/, async (ctx: any) => {
      const action = ctx.match?.[1];
      const appointmentId = ctx.match?.[2];

      if (!action || !appointmentId) {
        await ctx.answerCbQuery('Noto‘g‘ri so‘rov.');
        return;
      }

      // 🧪 TEST REJIMI UCHUN MOCK QABULNI QO'LDA BOSHQARISH
      if (appointmentId.startsWith('test-mock-appt-id')) {
        await this.clearInlineKeyboard(ctx);
        if (action === 'confirm') {
          await ctx.answerCbQuery('Tasdiq qabul qilindi.');
          await ctx.reply(
            `🧪 [TEST REJIM] Rahmat, Bemor! Qabulingiz tasdiqlandi ✅\n\nSizni belgilangan vaqtda kutamiz.`,
          );
        } else if (action === 'decline') {
          await ctx.answerCbQuery('Javob qabul qilindi.');
          await ctx.reply(
            `🧪 [TEST REJIM] Tushundik. Qabulingizni boshqa kunga ko‘chirishni xohlaysizmi?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📅 Boshqa vaqt tanlash', callback_data: `appt:reschedule:test-mock-appt-id` }],
                  [{ text: '📞 Administrator bog‘lansin', callback_data: `appt:admin:test-mock-appt-id` }],
                ],
              },
            } as any,
          );
        } else if (action === 'reschedule' || action === 'admin') {
          await ctx.answerCbQuery('Tanlovingiz qabul qilindi.');
          await ctx.reply(
            action === 'reschedule'
              ? `🧪 [TEST REJIM] Boshqa vaqt tanlash so'rovingiz qabul qilindi. Administrator tez orada siz bilan bog'lanadi!`
              : `🧪 [TEST REJIM] Administrator tez orada siz bilan bog'lanadi!`,
          );
        }
        return;
      }

      try {
        const appointment = await this.findAppointmentById(appointmentId);
        if (!appointment) {
          await ctx.answerCbQuery('Qabul topilmadi.');
          return;
        }
        const resolvedAppointmentId = String((appointment as any)?._id || (appointment as any)?.id || appointmentId);

        if (appointment.confirmation_status === 'confirmed' && action !== 'confirm') {
          await ctx.answerCbQuery('Bu qabul allaqachon tasdiqlangan.');
          return;
        }

        if (
          appointment.confirmation_status === 'declined' &&
          (action === 'confirm' || action === 'decline')
        ) {
          await ctx.answerCbQuery('Bu qabul bo‘yicha javob allaqachon qabul qilingan.');
          return;
        }

        const nowIso = new Date().toISOString();
        const patientName = appointment.patient_name || 'Bemor';

        if (action === 'confirm') {
          Object.assign(appointment, {
            confirmation_status: 'confirmed',
            confirmation_response_at: nowIso,
            confirmation_response_channel: 'telegram',
            confirmation_follow_up_choice: '',
          });

          if (typeof (appointment as any).save === 'function') {
            await (appointment as any).save();
          }

          await this.syncAppointmentConfirmationToSupabase(appointment, {
            confirmation_status: 'confirmed',
            confirmation_response_at: nowIso,
            confirmation_response_channel: 'telegram',
            confirmation_follow_up_choice: '',
          });

          await this.clearInlineKeyboard(ctx);
          await ctx.answerCbQuery('Tasdiq qabul qilindi.');
          await ctx.reply(
            `Rahmat, ${patientName}. Qabulingiz tasdiqlandi ✅\n\nSizni belgilangan vaqtda kutamiz.`,
          );
          return;
        }

        if (action === 'decline') {
          Object.assign(appointment, {
            confirmation_status: 'declined',
            confirmation_response_at: nowIso,
            confirmation_response_channel: 'telegram',
          });

          if (typeof (appointment as any).save === 'function') {
            await (appointment as any).save();
          }

          await this.syncAppointmentConfirmationToSupabase(appointment, {
            confirmation_status: 'declined',
            confirmation_response_at: nowIso,
            confirmation_response_channel: 'telegram',
          });

          await this.clearInlineKeyboard(ctx);
          await ctx.answerCbQuery('Javob qabul qilindi.');
          await ctx.reply(
            `Tushundik. Qabulingizni boshqa kunga ko‘chirishni xohlaysizmi?`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📅 Boshqa vaqt tanlash', callback_data: `appt:reschedule:${resolvedAppointmentId}` }],
                  [{ text: '📞 Administrator bog‘lansin', callback_data: `appt:admin:${resolvedAppointmentId}` }],
                ],
              },
            } as any,
          );
          return;
        }

        if (action === 'reschedule' || action === 'admin') {
          const followUpChoice = action === 'reschedule' ? 'reschedule_requested' : 'admin_contact_requested';
          Object.assign(appointment, {
            confirmation_follow_up_choice: followUpChoice,
            confirmation_response_channel: 'telegram',
          });

          if (typeof (appointment as any).save === 'function') {
            await (appointment as any).save();
          }

          await this.syncAppointmentConfirmationToSupabase(appointment, {
            confirmation_status: appointment.confirmation_status || 'declined',
            confirmation_response_at: appointment.confirmation_response_at || nowIso,
            confirmation_response_channel: 'telegram',
            confirmation_follow_up_choice: followUpChoice,
          });

          await this.clearInlineKeyboard(ctx);
          await ctx.answerCbQuery('So‘rovingiz yuborildi.');
          await ctx.reply(
            action === 'reschedule'
              ? `Yaxshi, administrator siz bilan bog‘lanib yangi vaqtni belgilaydi.`
              : `Administrator yaqin orada siz bilan bog‘lanadi.`,
          );
        }
      } catch (error) {
        this.logger.error('Error handling appointment confirmation action:', error);
        await ctx.answerCbQuery('Xatolik yuz berdi.');
      }
    });

    // Launch bot in background (polling)
    this.bot.launch().catch((err) => {
      this.logger.error('Failed to launch Telegram bot:', err);
    });

    this.logger.log('✅ Telegram bot started successfully!');

    // ✅ Global BotConfig auto-seed (barcha klinikalar uchun 1 ta bot)
    // Klinikalar alohida kirib token/username kiritib o‘tirmasligi uchun.
    this.ensureGlobalBotConfig().catch((e) => {
      this.logger.warn('Global BotConfig auto-seed skipped:', e?.message || e);
    });

    // Enable graceful stop
    process.once('SIGINT', () => this.bot.stop('SIGINT'));
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
  }

  /**
   * Send a message to a specific Telegram chat
   */
  async sendMessage(chatId: string, text: string, options: any = {}): Promise<boolean> {
    if (!this.bot) {
      this.logger.warn('Bot not initialized. Cannot send message.');
      return false;
    }
    try {
      await this.bot.telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...options });
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to chat ${chatId}:`, error.message);
      return false;
    }
  }

  async sendAppointmentConfirmationMessage(
    chatId: string,
    appointment: Partial<Appointment> & Record<string, any>,
    options: { includeActions?: boolean } = {},
  ): Promise<number | null> {
    if (!this.bot) return null;
    const appointmentId = String((appointment as any)?._id || (appointment as any)?.id || '');
    const includeActions = options.includeActions !== false;
    const message = this.buildAppointmentConfirmationText(appointment, includeActions);

    try {
      const sendOptions: any = {};

      if (includeActions && appointmentId) {
        sendOptions.reply_markup = {
          inline_keyboard: [
            [{ text: '✅ Ha, albatta boraman', callback_data: `appt:confirm:${appointmentId}` }],
            [{ text: '❌ Yo‘q, bugun bora olmayman', callback_data: `appt:decline:${appointmentId}` }],
          ],
        };
      }

      const sentMessage = await this.bot.telegram.sendMessage(chatId, message, sendOptions);

      return sentMessage?.message_id ?? null;
    } catch (error) {
      this.logger.error(`Failed to send appointment confirmation to chat ${chatId}:`, error.message);
      return null;
    }
  }

  async sendMorningAppointmentReminder(
    chatId: string,
    appointment: Partial<Appointment> & Record<string, any>,
  ): Promise<boolean> {
    const clinicName = await this.findClinicName(appointment?.clinic_id);
    const message = this.buildMorningReminderText(appointment, clinicName);
    return this.sendMessage(chatId, message);
  }

  /**
   * Link patient Telegram chat_id in Supabase CRM (primary data store).
   */
  private async _linkPatientInSupabase(
    patientId: string,
    chatId: string,
  ): Promise<{ full_name?: string } | null> {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_KEY');
    if (!url || !key || !patientId) return null;

    try {
      const fetchUrl = `${url}/rest/v1/patients?id=eq.${encodeURIComponent(patientId)}&select=id,full_name,notes&limit=1`;
      const response = await fetch(fetchUrl, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const rows: any[] = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) return null;

      const row = rows[0];
      const mergedNotes = this.mergeTechDataIntoNotes(row.notes || '', {
        telegram_chat_id: chatId,
      });

      const patchUrl = `${url}/rest/v1/patients?id=eq.${encodeURIComponent(patientId)}`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ notes: mergedNotes }),
      });

      if (!patchRes.ok) {
        this.logger.warn(
          `Supabase patient link failed: ${patchRes.status} ${patchRes.statusText}`,
        );
        return null;
      }

      this.logger.log(`✅ Supabase patient ${patientId} linked with chat_id ${chatId}`);
      return { full_name: row.full_name };
    } catch (error) {
      this.logger.error('Error linking patient in Supabase:', error?.message || error);
      return null;
    }
  }

  /**
   * Automatically Sync Chat ID to Supabase CRM
   * Handles the local [TECH_DATA] encoding format to preserve existing settings
   */
  private async _syncWithSupabase(clinicId: string, chatId: string) {
    const url = this.configService.get('SUPABASE_URL');
    const key = this.configService.get('SUPABASE_KEY');
    if (!url || !key) return;

    try {
      // 1. Get current config from Supabase (HybridEntityLoader uses 'botconfigs' table)
      const fetchUrl = `${url}/rest/v1/botconfigs?clinic_id=eq.${clinicId.toLowerCase()}`;
      const response = await fetch(fetchUrl, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      });
      const configs: any = await response.json();
      
      if (!Array.isArray(configs) || configs.length === 0) {
        this.logger.warn(`No BotConfig found for clinic: ${clinicId} in Supabase`);
        return;
      }

      const config = configs[0];
      let notes = config.notes || '';
      let techData = {};

      // 2. Parse existing [TECH_DATA] to avoid overwriting other settings
      if (notes.startsWith('[TECH_DATA]')) {
        try {
          const jsonStr = notes.split('[END_TECH]')[0].replace('[TECH_DATA]', '');
          techData = JSON.parse(jsonStr);
        } catch (e) {
          this.logger.error('JSON Parse error for existing techData:', e);
        }
      }

      // 3. Update the specific chat ID fields
      techData['leadChatId'] = chatId;
      techData['lead_chat_id'] = chatId;

      // 4. Re-encode using CRM format
      const userNotesPart = notes.includes('[END_TECH]') ? notes.split('[END_TECH]')[1] : '';
      const newNotes = `[TECH_DATA]${JSON.stringify(techData)}[END_TECH]${userNotesPart}`;

      // 5. Patch back to Supabase
      const patchUrl = `${url}/rest/v1/botconfigs?id=eq.${config.id}`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 
          'apikey': key, 
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ notes: newNotes })
      });

      if (patchRes.ok) {
        this.logger.log(`✅ Successfully synced Chat ID ${chatId} for clinic ${clinicId}`);
      } else {
        this.logger.error(`Failed to patch Supabase: ${patchRes.status} ${patchRes.statusText}`);
      }
    } catch (error) {
      this.logger.error('Error in _syncWithSupabase:', error.message);
    }
  }

  /**
   * Generate the deep link URL for a patient to connect to bot
   */
  async getBotDeepLink(patientId: string): Promise<string> {
    if (!this.bot) return '';
    try {
      const botInfo = await this.bot.telegram.getMe();
      return `https://t.me/${botInfo.username}?start=${patientId}`;
    } catch {
      return '';
    }
  }

  async findPatientById(patientId: string): Promise<any | null> {
    if (!patientId) return null;

    if (this.patientModel) {
      const patient = await this.patientModel.findById(patientId).exec();
      if (patient) return patient;
    }

    const { url, key } = this.getSupabaseCredentials();
    if (!url || !key) return null;

    try {
      const requestUrl = `${url}/rest/v1/patients?id=eq.${encodeURIComponent(patientId)}&select=id,full_name,phone,notes&limit=1`;
      const response = await fetch(requestUrl, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const rows: any[] = await response.json();
      return this.decodeTechDataFromNotes(Array.isArray(rows) ? rows[0] : null);
    } catch (error) {
      this.logger.error('Error finding patient by id:', error?.message || error);
      return null;
    }
  }

  async findPatientByName(name: string, requireTelegram = false): Promise<any | null> {
    if (!name) return null;

    if (this.patientModel) {
      const withTelegram = await this.patientModel.findOne({
        full_name: { $regex: name, $options: 'i' },
        ...(requireTelegram ? { telegram_chat_id: { $exists: true, $nin: [null, ''] } } : {}),
      }).exec();
      if (withTelegram) return withTelegram;
    }

    const { url, key } = this.getSupabaseCredentials();
    if (!url || !key) return null;

    try {
      const requestUrl =
        `${url}/rest/v1/patients?select=id,full_name,phone,notes` +
        `&full_name=ilike.*${encodeURIComponent(name)}*&limit=20`;
      const response = await fetch(requestUrl, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const rows: any[] = await response.json();
      const patients = (Array.isArray(rows) ? rows : []).map((row) => this.decodeTechDataFromNotes(row));
      if (requireTelegram) {
        return patients.find((patient) => patient?.telegram_chat_id) || null;
      }
      return patients[0] || null;
    } catch (error) {
      this.logger.error('Error finding patient by name:', error?.message || error);
      return null;
    }
  }

  async findAppointmentsForPatient(patientId: string): Promise<any[]> {
    if (!patientId) return [];

    if (this.appointmentModel) {
      return await this.appointmentModel.find({
        patient_id: patientId,
        status: { $in: ['scheduled', 'confirmed'] },
      }).sort({ date: 1, time: 1 }).limit(20).exec();
    }

    const { url, key } = this.getSupabaseCredentials();
    if (!url || !key) return [];

    try {
      const requestUrl =
        `${url}/rest/v1/appointments?select=id,clinic_id,patient_id,patient_name,doctor_name,date,time,status,notes` +
        `&patient_id=eq.${encodeURIComponent(patientId)}&limit=20`;
      const response = await fetch(requestUrl, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const rows: any[] = await response.json();
      return (Array.isArray(rows) ? rows : [])
        .map((row) => this.decodeTechDataFromNotes(row))
        .filter((appointment) => this.isReminderEligibleStatus(appointment?.status))
        .sort((a, b) => `${a?.date || ''} ${a?.time || ''}`.localeCompare(`${b?.date || ''} ${b?.time || ''}`));
    } catch (error) {
      this.logger.error('Error finding appointments for patient:', error?.message || error);
      return [];
    }
  }

  async findAppointmentById(appointmentId: string): Promise<any | null> {
    if (!appointmentId) return null;

    if (this.appointmentModel) {
      const appointment = await this.appointmentModel.findById(appointmentId).exec();
      if (appointment) return appointment;
    }

    const { url, key } = this.getSupabaseCredentials();
    if (!url || !key) return null;

    try {
      const requestUrl =
        `${url}/rest/v1/appointments?select=id,clinic_id,patient_id,patient_name,doctor_name,date,time,status,notes` +
        `&id=eq.${encodeURIComponent(appointmentId)}&limit=1`;
      const response = await fetch(requestUrl, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const rows: any[] = await response.json();
      return this.decodeTechDataFromNotes(Array.isArray(rows) ? rows[0] : null);
    } catch (error) {
      this.logger.error('Error finding appointment by id:', error?.message || error);
      return null;
    }
  }

  async findClinicName(clinicId?: string): Promise<string> {
    if (!clinicId) {
      return this.configService.get<string>('CLINIC_NAME') || 'Kliniyamiz';
    }

    if (this.clinicModel) {
      const clinic = await this.clinicModel.findOne({ id: clinicId }).exec();
      if (clinic?.name) return clinic.name;
    }

    const { url, key } = this.getSupabaseCredentials();
    if (!url || !key) {
      return this.configService.get<string>('CLINIC_NAME') || 'Kliniyamiz';
    }

    try {
      const requestUrl =
        `${url}/rest/v1/clinics?select=id,name&id=eq.${encodeURIComponent(clinicId)}&limit=1`;
      const response = await fetch(requestUrl, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const rows: any[] = await response.json();
      return rows?.[0]?.name || this.configService.get<string>('CLINIC_NAME') || 'Kliniyamiz';
    } catch {
      return this.configService.get<string>('CLINIC_NAME') || 'Kliniyamiz';
    }
  }

  async findDoctorByName(clinicId: string, name: string): Promise<any | null> {
    const { url, key } = this.getSupabaseCredentials();
    if (!url || !key) return null;

    try {
      const requestUrl =
        `${url}/rest/v1/users?select=id,name,role,notes&clinic_id=eq.${encodeURIComponent(clinicId)}` +
        `&role=eq.doctor&name=eq.${encodeURIComponent(name)}&limit=1`;
      const response = await fetch(requestUrl, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const rows: any[] = await response.json();
      if (Array.isArray(rows) && rows.length > 0) {
        return this.decodeTechDataFromNotes(rows[0]);
      }
      return null;
    } catch (error) {
      this.logger.error('Error finding doctor by name:', error?.message || error);
      return null;
    }
  }

  async syncAppointmentConfirmationToSupabase(
    appointment: Partial<Appointment>,
    updates: Record<string, any>,
  ): Promise<void> {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_KEY');
    if (!url || !key || !appointment?.clinic_id || !appointment?.date || !appointment?.time) return;

    try {
      const params = new URLSearchParams({
        clinic_id: `eq.${String(appointment.clinic_id).toLowerCase()}`,
        date: `eq.${appointment.date}`,
        time: `eq.${appointment.time}`,
        select: 'id,notes,patient_id,patient_name',
        limit: '1',
      });

      if (appointment.patient_id) {
        params.append('patient_id', `eq.${appointment.patient_id}`);
      } else if (appointment.patient_name) {
        params.append('patient_name', `eq.${appointment.patient_name}`);
      }

      const fetchUrl = `${url}/rest/v1/appointments?${params.toString()}`;
      const response = await fetch(fetchUrl, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });

      const records: any[] = await response.json();
      if (!Array.isArray(records) || records.length === 0) {
        this.logger.warn(
          `Supabase appointment not found for confirmation sync: ${appointment.patient_name} ${appointment.date} ${appointment.time}`,
        );
        return;
      }

      const record = records[0];
      const mergedNotes = this.mergeTechDataIntoNotes(record.notes || '', updates);

      const patchUrl = `${url}/rest/v1/appointments?id=eq.${record.id}`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ notes: mergedNotes }),
      });

      if (!patchRes.ok) {
        this.logger.error(
          `Failed to sync appointment confirmation to Supabase: ${patchRes.status} ${patchRes.statusText}`,
        );
      }
    } catch (error) {
      this.logger.error('Error syncing appointment confirmation to Supabase:', error.message);
    }
  }

  private mergeTechDataIntoNotes(existingNotes: string, updates: Record<string, any>) {
    let techData: Record<string, any> = {};
    let userNotes = existingNotes || '';

    if (typeof existingNotes === 'string' && existingNotes.startsWith('[TECH_DATA]')) {
      try {
        const endIdx = existingNotes.indexOf('[END_TECH]');
        if (endIdx !== -1) {
          const jsonStr = existingNotes.substring(11, endIdx);
          techData = JSON.parse(jsonStr || '{}');
          userNotes = existingNotes.substring(endIdx + 10).replace(/^\n/, '');
        }
      } catch (error) {
        this.logger.error('Failed to parse appointment tech notes:', error.message);
      }
    }

    const merged = { ...techData, ...updates };
    return `[TECH_DATA]${JSON.stringify(merged)}[END_TECH]${userNotes ? `\n${userNotes}` : ''}`;
  }

  private getSupabaseCredentials() {
    return {
      url: this.configService.get<string>('SUPABASE_URL'),
      key: this.configService.get<string>('SUPABASE_KEY'),
    };
  }

  private decodeTechDataFromNotes(record: any) {
    if (!record) return null;
    const notes = String(record.notes || '');
    if (!notes.startsWith('[TECH_DATA]')) return record;

    try {
      const endIdx = notes.indexOf('[END_TECH]');
      if (endIdx === -1) return record;
      const techData = JSON.parse(notes.substring(11, endIdx) || '{}');
      const userNotes = notes.substring(endIdx + 10).replace(/^\n/, '');
      return { ...record, ...techData, notes: userNotes };
    } catch (error) {
      this.logger.error('Failed to decode tech notes:', error?.message || error);
      return record;
    }
  }

  private isReminderEligibleStatus(status?: string) {
    const normalized = String(status || '').toLowerCase();
    return normalized === 'scheduled' || normalized === 'confirmed';
  }

  private buildMorningReminderText(
    appointment: Partial<Appointment> & Record<string, any>,
    clinicName: string,
  ) {
    return (
      `🗓 <b>XAYRLI TONG, ASSALOMU ALAYKUM!</b>\n\n` +
      `Bugun <b>${clinicName || 'Kliniyamiz'}</b> ga tashrif buyurish kuningiz.\n\n` +
      `⏰ <b>Qabul vaqti:</b> Bugun soat <b>${appointment.time || '--:--'}</b>\n` +
      `👤 <b>Shifokor:</b> ${appointment.doctor_name || 'Shifokorimiz'}\n\n` +
      `Iltimos, o'z vaqtida kelishingizni kutib qolamiz! 🦷✨`
    );
  }

  private buildAppointmentConfirmationText(
    appointment: Partial<Appointment> & Record<string, any>,
    includeActions: boolean,
  ) {
    return (
      `Assalomu alaykum, ${appointment.patient_name || 'Bemor'}.\n\n` +
      `Sizning bugungi qabulingiz:\n` +
      `🦷 ${this.formatAppointmentDate(appointment.date)}, ${appointment.time}\n` +
      `👨‍⚕️ ${appointment.doctor_name || 'Dr. Shahobiddin'}\n\n` +
      `Bugun qabulga kelasizmi?\n\n` +
      (includeActions
        ? `Iltimos, quyidagi tugmalardan birini tanlang.`
        : `Bu test preview xabari. Asl yuborishda shu yerda tasdiqlash tugmalari chiqadi.`)
    );
  }

  private formatDateUz(dateStr?: string, includeWeekday = true, includeYear = true) {
    if (!dateStr) return '';
    try {
      const normalized = String(dateStr).split('T')[0];
      const [year, month, day] = normalized.split('-').map(Number);
      if (!year || !month || !day) return normalized;

      const months = [
        'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
        'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
      ];

      const d = new Date(year, month - 1, day);
      const dayOfWeek = d.getDay();

      const weekdays = [
        'yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'
      ];

      const monthName = months[month - 1] || '';
      const weekdayName = weekdays[dayOfWeek] || '';

      let result = `${day}-${monthName}`;
      if (includeYear) {
        result = `${day}-${monthName} ${year}-yil`;
      }
      if (includeWeekday) {
        result += `, ${weekdayName}`;
      }
      return result;
    } catch {
      return dateStr || '';
    }
  }

  private formatAppointmentDate(dateStr?: string) {
    return this.formatDateUz(dateStr, true, true);
  }

  private async clearInlineKeyboard(ctx: any) {
    try {
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    } catch {
      // no-op
    }
  }

  /**
   * Global bot config’ni Supabase’ga avtomatik yozib qo‘yadi.
   * Klinikalar token/username kiritmasa ham, link chiqishi uchun.
   *
   * NOTE:
   * - `clinic_id = 'global'` yozuvini yaratamiz/yangilaymiz.
   * - Token va username’ni notes ichida [TECH_DATA] ko‘rinishida saqlaymiz
   *   (Supabase jadvalida ustunlar bo‘lmasa ham ishlashi uchun).
   */
  private async ensureGlobalBotConfig(): Promise<void> {
    const url = this.configService.get<string>('SUPABASE_URL');
    const key = this.configService.get<string>('SUPABASE_KEY');
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!url || !key || !token || !this.bot) return;

    let username = '';
    try {
      const me = await this.bot.telegram.getMe();
      username = String(me?.username || '').replace(/^@/, '').trim();
    } catch (e) {
      this.logger.warn('Could not get Telegram bot username via getMe()');
      return;
    }

    if (!username) return;

    const globalClinicId = 'global';
    const techUpdates = {
      botToken: token,
      botUsername: username,
      isActive: true,
      updated_at: new Date().toISOString(),
    };

    try {
      const fetchUrl = `${url}/rest/v1/botconfigs?clinic_id=eq.${globalClinicId}&select=id,notes&limit=1`;
      const response = await fetch(fetchUrl, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      const rows: any[] = await response.json();

      if (Array.isArray(rows) && rows.length > 0) {
        const row = rows[0];
        const mergedNotes = this.mergeTechDataIntoNotes(row?.notes || '', techUpdates);

        const patchUrl = `${url}/rest/v1/botconfigs?id=eq.${row.id}`;
        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({ notes: mergedNotes, isActive: true }),
        });

        if (patchRes.ok) {
          this.logger.log(`✅ Global BotConfig updated (@${username})`);
        } else {
          this.logger.warn(`Global BotConfig patch failed: ${patchRes.status} ${patchRes.statusText}`);
        }
        return;
      }

      // Create new global config
      const notes = this.mergeTechDataIntoNotes('', techUpdates);
      const createUrl = `${url}/rest/v1/botconfigs`;
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          clinic_id: globalClinicId,
          isActive: true,
          notes,
        }),
      });

      if (createRes.ok) {
        this.logger.log(`✅ Global BotConfig created (@${username})`);
      } else {
        this.logger.warn(`Global BotConfig create failed: ${createRes.status} ${createRes.statusText}`);
      }
    } catch (error) {
      this.logger.warn('Global BotConfig ensure failed:', error?.message || error);
    }
  }

  // Helper: Find doctor appointments on date
  async findAppointmentsForDoctorOnDate(clinicId: string, doctorName: string, date: string): Promise<any[]> {
    const { url, key } = this.getSupabaseCredentials();
    if (!url || !key) return [];
    try {
      const requestUrl = `${url}/rest/v1/appointments?select=time,status&clinic_id=eq.${encodeURIComponent(clinicId)}&doctor_name=eq.${encodeURIComponent(doctorName)}&date=eq.${encodeURIComponent(date)}&status=neq.Cancelled`;
      const response = await fetch(requestUrl, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
      const rows = await response.json();
      return Array.isArray(rows) ? rows : [];
    } catch (e) {
      this.logger.error('Error finding doctor appointments on date:', e.message);
      return [];
    }
  }

  // Helper: Update appointment date and time in Supabase
  async updateAppointmentDateTimeInSupabase(appointmentId: string, date: string, time: string): Promise<boolean> {
    const { url, key } = this.getSupabaseCredentials();
    if (!url || !key) return false;
    try {
      const patchUrl = `${url}/rest/v1/appointments?id=eq.${encodeURIComponent(appointmentId)}`;
      const res = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          date,
          time,
          confirmation_status: 'confirmed',
          pre_reminder_sent: true,
          confirmation_response_channel: 'telegram',
          confirmation_response_at: new Date().toISOString(),
        }),
      });
      return res.ok;
    } catch (e) {
      this.logger.error('Error updating appointment date time in Supabase:', e.message);
      return false;
    }
  }
}
