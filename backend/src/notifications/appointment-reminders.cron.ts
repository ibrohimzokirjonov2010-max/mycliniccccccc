import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import { Appointment, AppointmentDocument } from '../appointments/schemas/appointment.schema';
import { Patient, PatientDocument } from '../patients/schemas/patient.schema';
import { Clinic, ClinicDocument } from '../clinics/schemas/clinic.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { TelegramService } from './telegram.service';
import { SmsService } from './sms.service';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class AppointmentRemindersCron {
  private readonly logger = new Logger(AppointmentRemindersCron.name);

  constructor(
    @Optional() @InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument> | null,
    @Optional() @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument> | null,
    @Optional() @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument> | null,
    @Optional() @InjectModel(User.name) private readonly userModel: Model<UserDocument> | null,
    private readonly telegramService: TelegramService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Runs every minute
   * Handles realtime 2h reminders, starting-now alerts, and user-scheduled morning/day-before notifications.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleRealtimeReminders() {
    if (!this.appointmentModel || !this.patientModel || !this.clinicModel || !this.userModel) {
      this.logger.warn('Mongo modeli topilmadi, realtime reminder cron skip qilindi.');
      return;
    }
    try {
      const now = dayjs().tz('Asia/Tashkent');
      const todayDate = now.format('YYYY-MM-DD');
      const currentHM = now.format('HH:mm');

      this.logger.debug(
        `⏱ Realtime check: Tashkent time = ${currentHM}, date = ${todayDate}`,
      );

      const settings = this.smsService.getSettings();

      // ─── 1. Bemor Keladigan Kun Eslatmalari (Custom Time) ───
      if (settings.sms_enabled && settings.on_appointment_day && currentHM === settings.on_appointment_day_time) {
        this.logger.log(`🌅 Running scheduled day-of reminders at ${currentHM}`);
        const appointmentsToday = await this.appointmentModel.find({
          date: todayDate,
          status: { $in: ['scheduled', 'confirmed'] },
          morning_reminder_sent: { $ne: true }
        }).exec();

        for (const appointment of appointmentsToday) {
          try {
            const patient = await this.patientModel.findById(appointment.patient_id).exec();
            const clinic = await this.clinicModel.findOne({ id: appointment.clinic_id }).exec();
            const clinicName = clinic?.name || 'Klinika';

            if (patient?.telegram_chat_id) {
              await this.telegramService.sendMorningAppointmentReminder(
                patient.telegram_chat_id,
                appointment,
              );
            }
            if (patient?.phone) {
              await this.smsService.sendAppointmentDaySms(
                patient.phone,
                appointment.patient_name || 'Bemor',
                appointment.time,
                clinicName,
                appointment.clinic_id,
              );
            }
            appointment.morning_reminder_sent = true;
            await appointment.save();
          } catch (e) {
            this.logger.error(`Error sending day-of reminder for ${appointment._id}:`, e);
          }
        }
      }

      // ─── 2. Bir Kun Oldingi Eslatmalari (Custom Time) ───
      if (settings.sms_enabled && settings.on_day_before && currentHM === settings.on_day_before_time) {
        const tomorrowDate = now.add(1, 'day').format('YYYY-MM-DD');
        this.logger.log(`📅 Running scheduled 1-day-before reminders for ${tomorrowDate} at ${currentHM}`);
        const appointmentsTomorrow = await this.appointmentModel.find({
          date: tomorrowDate,
          status: { $in: ['scheduled', 'confirmed'] },
          day_before_reminder_sent: { $ne: true }
        }).exec();

        for (const appointment of appointmentsTomorrow) {
          try {
            const patient = await this.patientModel.findById(appointment.patient_id).exec();
            const clinic = await this.clinicModel.findOne({ id: appointment.clinic_id }).exec();
            const clinicName = clinic?.name || 'Klinika';

            if (patient?.telegram_chat_id) {
              const msg = `📅 <b>ESLATMA (ERTALABKI QABUL)</b>\n\n` +
                          `Hurmatli <b>${appointment.patient_name}</b>, ertaga <b>${appointment.time}</b>da <b>${clinicName}</b> klinikasida qabulingiz bor. Eslab qoling! 🦷`;
              await this.telegramService.sendMessage(patient.telegram_chat_id, msg);
            }
            if (patient?.phone) {
              await this.smsService.sendDayBeforeReminderSms(
                patient.phone,
                appointment.patient_name || 'Bemor',
                appointment.date,
                appointment.time,
                clinicName,
                appointment.clinic_id,
              );
            }
            appointment.day_before_reminder_sent = true;
            await appointment.save();
          } catch (e) {
            this.logger.error(`Error sending 1-day-before reminder for ${appointment._id}:`, e);
          }
        }
      }

      // ─── 3. 2-Hour Pre-Appointment Reminders (Realtime) ───
      const target2H = now.add(2, 'hour').format('HH:mm');
      this.logger.debug(`🔍 Looking for 2h reminder appointments at time: ${target2H}`);

      const apps2H = await this.appointmentModel.find({
        date: todayDate,
        time: target2H,
        status: { $in: ['scheduled', 'confirmed'] },
        pre_reminder_sent: { $ne: true }
      }).exec();

      for (const app of apps2H) {
        const patient = await this.patientModel.findById(app.patient_id).exec();
        const clinic = await this.clinicModel.findOne({ id: app.clinic_id }).exec();
        const clinicName = clinic?.name || 'Klinika';

        if (!patient?.telegram_chat_id && !patient?.phone) {
          app.pre_reminder_sent = true;
          await app.save();
          continue;
        }

        const nowIso = new Date().toISOString();
        let sent = false;
        let messageId: number | null = null;

        if (patient?.telegram_chat_id) {
          messageId = await this.telegramService.sendAppointmentConfirmationMessage(
            patient.telegram_chat_id,
            app,
          );
          if (messageId) sent = true;
        }

        if (patient?.phone) {
          const ok = await this.smsService.sendDayBeforeReminderSms(
            patient.phone,
            app.patient_name || 'Bemor',
            app.date,
            app.time,
            clinicName,
            app.clinic_id,
          );
          if (ok) sent = true;
        }

        if (sent) {
          app.pre_reminder_sent = true;
          app.confirmation_status = 'pending';
          app.confirmation_sent_at = nowIso;
          app.confirmation_requested_at = nowIso;
          if (messageId) app.confirmation_message_id = messageId;
          await app.save();

          await this.telegramService.syncAppointmentConfirmationToSupabase(app, {
            confirmation_status: 'pending',
            confirmation_sent_at: nowIso,
            confirmation_requested_at: nowIso,
            confirmation_message_id: messageId,
          });
        } else {
          app.pre_reminder_sent = true;
          await app.save();
        }
      }

      // ─── 4. "Starting Now" Reminders (Realtime) ───
      const targetNow = now.format('HH:mm');
      const appsNow = await this.appointmentModel.find({
        date: todayDate,
        time: targetNow,
        status: { $in: ['scheduled', 'confirmed'] },
        current_reminder_sent: { $ne: true }
      }).exec();

      for (const app of appsNow) {
        if (app.confirmation_status === 'declined') {
          app.current_reminder_sent = true;
          await app.save();
          continue;
        }

        if (!app.confirmation_status || app.confirmation_status === 'pending') {
          const nowIso = new Date().toISOString();
          app.confirmation_status = 'no_response';
          app.confirmation_response_at = nowIso;
          app.confirmation_response_channel = 'system';
          app.current_reminder_sent = true;
          await app.save();

          await this.telegramService.syncAppointmentConfirmationToSupabase(app, {
            confirmation_status: 'no_response',
            confirmation_response_at: nowIso,
            confirmation_response_channel: 'system',
          });
        }

        const patient = await this.patientModel.findById(app.patient_id).exec();
        const clinic = await this.clinicModel.findOne({ id: app.clinic_id }).exec();

        // Notify Patient
        if (patient?.telegram_chat_id) {
          const msg = `🔔 <b>SIZNING VAQTINGIZ KELDI!</b>\n\n` +
                      `<b>${clinic?.name || 'Klinika'}</b>: Sizning qabulingiz hozir boshlanishi kerak (<b>${app.time}</b>).\n\n` +
                      `Sizni kutmoqdamiz! 👨‍⚕️🩺`;
          await this.telegramService.sendMessage(patient.telegram_chat_id, msg);
        }
        if (patient?.phone) {
          const msg = `${clinic?.name || 'Klinika'}: Qabulingiz boshlanish arafasida (${app.time}). Sizni kutmoqdamiz!`;
          await this.smsService.sendSms(patient.phone, msg, app.patient_name, app.clinic_id);
        }

        // NEW: Notify Doctor
        const doctor = await this.userModel.findOne({
          clinic_id: app.clinic_id,
          name: app.doctor_name,
          role: 'doctor'
        }).exec();

        if (doctor?.telegram_chat_id) {
          const docMsg = `📢 <b>DIQQAT, YANGI BEMOR!</b>\n\n` +
                         `Doktor, hozir qabulingizga bemor kirdi: <b>${app.patient_name}</b>\n` +
                         `⏰ <b>Vaqt:</b> ${app.time}\n\n` +
                         `Iltimos, ish joyingizda bo'lishingizni so'raymiz! 🦷💼`;
          await this.telegramService.sendMessage(doctor.telegram_chat_id, docMsg);
        }

        app.current_reminder_sent = true;
        await app.save();
      }
    } catch (error) {
      this.logger.error('Error in handleRealtimeReminders:', error);
    }
  }
}
