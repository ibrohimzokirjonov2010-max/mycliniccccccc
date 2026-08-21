import { Controller, Post, Body, Get, Query, UseGuards, Logger } from '@nestjs/common';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { TelegramService } from './telegram.service';
import { AppointmentRemindersCron } from './appointment-reminders.cron';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

dayjs.extend(utc);
dayjs.extend(timezone);

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly remindersCron: AppointmentRemindersCron,
  ) {}

  @Post('send-custom')
  async sendCustomMessage(@Body() body: { chatId: string; message: string }) {
    return this.telegramService.sendMessage(body.chatId, body.message);
  }

  /**
   * TEST: Qabul ID bo'yicha DARHOL eslatma yuboradi (flag, vaqt, sana tekshirmaydi).
   * Test tugmasini bosganingizda hoziroq xabar boradi.
   * POST /notifications/test-send-now  { appointmentId: "...", type: "2h" | "morning" }
   */
  @Post('test-send-now')
  async testSendNow(
    @Body() body: { appointmentId: string; type?: 'confirmation' | 'morning' | 'now' },
  ) {
    const { appointmentId, type = 'confirmation' } = body;

    if (!appointmentId) {
      return { success: false, message: 'appointmentId kerak.' };
    }

    const appointment = await this.telegramService.findAppointmentById(appointmentId);
    if (!appointment) {
      return { success: false, message: `Qabul topilmadi: ${appointmentId}` };
    }

    const patientId = String((appointment as any).patient_id || '');
    const patient = patientId ? await this.telegramService.findPatientById(patientId) : null;
    const chatId = patient?.telegram_chat_id || (appointment as any).telegram_chat_id;

    if (!chatId) {
      return {
        success: false,
        message: `Bemor Telegram bilan bog'lanmagan. Bemorga bot havolasini yuboring.`,
        patient_name: appointment.patient_name || 'Noma\'lum',
        hint: 'GET /notifications/patient-bot-link?patientId=...',
      };
    }

    const now = dayjs().tz('Asia/Tashkent');
    let sent: boolean | number | null = false;

    if (type === 'morning') {
      sent = await this.telegramService.sendMorningAppointmentReminder(chatId, appointment);
    } else if (type === 'now') {
      const msg =
        `🔔 <b>[TEST] SIZNING VAQTINGIZ KELDI!</b>\n\n` +
        `<b>Qabul:</b> ${appointment.date}, ${appointment.time}\n` +
        `👨‍⚕️ <b>Shifokor:</b> ${appointment.doctor_name || 'Shifokor'}\n\n` +
        `Bu test xabari — haqiqiy xabar qabul vaqtida avtomatik boradi. 🧪`;
      sent = await this.telegramService.sendMessage(chatId, msg);
    } else {
      // Default: confirmation (2h reminder style)
      const messageId = await this.telegramService.sendAppointmentConfirmationMessage(
        chatId,
        appointment,
        { includeActions: false },
      );
      sent = messageId !== null;
    }

    return {
      success: !!sent,
      message: sent
        ? `✅ Test xabari muvaffaqiyatli yuborildi!`
        : `❌ Xabar yuborishda xato. Chat ID: ${chatId}`,
      appointment_id: appointmentId,
      patient_name: appointment.patient_name,
      chat_id: chatId,
      type,
      tashkent_time: now.format('HH:mm'),
    };
  }

  /**
   * Test: Bemorni ismi bo'yicha topib, hoziroq 2 soatlik eslatma yuboradi.
   * Misol: GET /notifications/test-reminder?name=Odil+Hamidov
   */
  @Get('test-reminder')
  async testReminderByName(@Query('name') name: string) {
    if (!name) {
      return { success: false, message: 'name parametri kerak. Misol: ?name=Odil+Hamidov' };
    }

    // Ismni qidirish (case-insensitive, qisman moslik)
    const patient = await this.telegramService.findPatientByName(name, true);

    if (!patient) {
      // telegram_chat_id siz ham qidirib ko'ramiz
      const patientNoTg = await this.telegramService.findPatientByName(name, false);

      if (patientNoTg) {
        return {
          success: false,
          message: `Bemor topildi: "${patientNoTg.full_name}", lekin Telegram bog'lanmagan (telegram_chat_id yo'q).`,
          patient_id: String((patientNoTg as any)._id || (patientNoTg as any).id),
          hint: 'Bemorga bot linkini yuboring: GET /notifications/patient-bot-link?patientId=...',
        };
      }

      return { success: false, message: `"${name}" ismli bemor topilmadi.` };
    }

    const now = dayjs().tz('Asia/Tashkent');
    const todayDate = now.format('YYYY-MM-DD');
    const testTime = now.add(2, 'hour').format('HH:mm');

    // Bugungi qabulini topish
    const appointments = await this.telegramService.findAppointmentsForPatient(
      String((patient as any)._id || (patient as any).id),
    );
    const appointment = (appointments || []).find((item) => item.date === todayDate) || null;

    if (!appointment) {
      // Hech qanday qabul yo'q — shunchaki test xabari yuboramiz
      this.logger.log(`TEST: Bugun qabul yo'q, oddiy test xabari yuborilmoqda → ${patient.full_name}`);
      const testMsg =
        `🧪 <b>TEST ESLATMA</b>\n\n` +
        `Assalomu alaykum, ${patient.full_name}!\n\n` +
        `Bu Telegram eslatma tizimining test xabari.\n` +
        `✅ Agar siz bu xabarni ko'rsangiz — tizim to'g'ri ishlayapti!\n\n` +
        `⏰ Toshkent vaqti: <b>${now.format('HH:mm')}</b>`;

      const sent = await this.telegramService.sendMessage(patient.telegram_chat_id, testMsg);
      return {
        success: sent,
        message: sent
          ? `Test xabari "${patient.full_name}" ga yuborildi (bugun qabul yo'q edi, oddiy test xabari).`
          : `Xabar yuborishda xato. Chat ID: ${patient.telegram_chat_id}`,
        patient_name: patient.full_name,
        chat_id: patient.telegram_chat_id,
        tashkent_time: now.format('HH:mm'),
      };
    }

    // Qabul bor — tasdiqlash xabarini yuboramiz
    this.logger.log(`TEST: 2 soatlik eslatma yuborilmoqda → ${patient.full_name}, qabul: ${appointment.time}`);
    const messageId = await this.telegramService.sendAppointmentConfirmationMessage(
      patient.telegram_chat_id,
      appointment,
    );

    return {
      success: !!messageId,
      message: messageId
        ? `✅ Tasdiqlash xabari "${patient.full_name}" ga muvaffaqiyatli yuborildi!`
        : `❌ Xabar yuborishda xato. Chat ID: ${patient.telegram_chat_id}`,
      patient_name: patient.full_name,
      chat_id: patient.telegram_chat_id,
      appointment_time: appointment.time,
      appointment_date: appointment.date,
      tashkent_time: now.format('HH:mm'),
      expected_2h_target: testTime,
    };
  }

  /**
   * Test: Patient ID bo'yicha 2 soat oldingi confirmation xabarini yuboradi.
   * GET /notifications/test-reminder-patient?patientId=...
   */
  @Get('test-reminder-patient')
  async testReminderByPatientId(@Query('patientId') patientId: string) {
    if (!patientId) {
      return { success: false, message: 'patientId parametri kerak.' };
    }

    const patient = await this.telegramService.findPatientById(patientId);
    if (!patient) {
      return { success: false, message: 'Bemor topilmadi.' };
    }

    if (!patient.telegram_chat_id) {
      return {
        success: false,
        message: `Bemor topildi: "${patient.full_name}", lekin Telegram bog'lanmagan (telegram_chat_id yo'q).`,
        patient_id: String((patient as any)._id || (patient as any).id),
      };
    }

    const now = dayjs().tz('Asia/Tashkent');
    const nowKey = now.format('YYYY-MM-DD HH:mm');

    const appointments = await this.telegramService.findAppointmentsForPatient(
      String((patient as any)._id || (patient as any).id),
    );

    const upcomingAppointment = (appointments || []).find((appointment) => {
      const apptDateTime = dayjs.tz(
        `${appointment.date} ${appointment.time}`,
        'YYYY-MM-DD HH:mm',
        'Asia/Tashkent',
      );
      return apptDateTime.isValid() && apptDateTime.format('YYYY-MM-DD HH:mm') >= nowKey;
    }) || appointments?.[0];

    if (!upcomingAppointment) {
      const testMsg =
        `🧪 <b>TEST ESLATMA</b>\n\n` +
        `Assalomu alaykum, ${patient.full_name}!\n\n` +
        `Bu 2 soat oldingi Telegram eslatma tizimining test xabari.\n` +
        `✅ Agar siz bu xabarni ko'rsangiz — bot eslatma tizimi ishlayapti.\n\n` +
        `⏰ Toshkent vaqti: <b>${now.format('HH:mm')}</b>`;

      const sent = await this.telegramService.sendMessage(patient.telegram_chat_id, testMsg);
      return {
        success: sent,
        message: sent
          ? `Test xabari "${patient.full_name}" ga yuborildi.`
          : `Xabar yuborishda xato. Chat ID: ${patient.telegram_chat_id}`,
        patient_name: patient.full_name,
        chat_id: patient.telegram_chat_id,
      };
    }

    const messageId = await this.telegramService.sendAppointmentConfirmationMessage(
      patient.telegram_chat_id,
      upcomingAppointment,
    );

    return {
      success: !!messageId,
      message: messageId
        ? `✅ 2 soat oldingi test eslatma "${patient.full_name}" ga yuborildi.`
        : `❌ Xabar yuborishda xato. Chat ID: ${patient.telegram_chat_id}`,
      patient_name: patient.full_name,
      chat_id: patient.telegram_chat_id,
      appointment_time: upcomingAppointment.time,
      appointment_date: upcomingAppointment.date,
      tashkent_time: now.format('HH:mm'),
    };
  }

  /**
   * Test: Barcha eslatma cron'larini hoziroq qo'lda ishga tushirish
   * POST /notifications/trigger-reminders
   */
  @Post('trigger-reminders')
  async triggerRemindersNow() {
    this.logger.log('Qolda eslatma cron ishga tushirilmoqda...');
    await this.remindersCron.handleRealtimeReminders();
    const now = dayjs().tz('Asia/Tashkent');
    return {
      success: true,
      message: "Realtime eslatma cron qo'lda ishlatildi.",
      tashkent_time: now.format('HH:mm'),
      checked_2h_target: now.add(2, 'hour').format('HH:mm'),
    };
  }

  /**
   * Debug: Bemorning bot havolasini olish
   * GET /notifications/patient-bot-link?patientId=...
   */
  @Get('patient-bot-link')
  async getPatientBotLink(@Query('patientId') patientId: string) {
    if (!patientId) return { success: false, message: 'patientId kerak' };
    const link = await this.telegramService.getBotDeepLink(patientId);
    return { success: !!link, link };
  }

  /**
   * Debug: Toshkent vaqtini va 2 soatdan keyingi targetni ko'rish
   * GET /notifications/debug-time
   */
  @Get('debug-time')
  debugTime() {
    const now = dayjs().tz('Asia/Tashkent');
    return {
      tashkent_now: now.format('YYYY-MM-DD HH:mm:ss'),
      tashkent_date: now.format('YYYY-MM-DD'),
      tashkent_time: now.format('HH:mm'),
      target_2h: now.add(2, 'hour').format('HH:mm'),
      server_utc: new Date().toISOString(),
    };
  }
}
