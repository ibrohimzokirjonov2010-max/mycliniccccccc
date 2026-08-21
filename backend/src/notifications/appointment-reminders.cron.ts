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
  ) {}

  /**
   * Runs every day at 07:00 AM
   */
  @Cron('00 07 * * *', {
    timeZone: 'Asia/Tashkent',
  })
  async handleDailyMorningReminders() {
    this.logger.log('🌅 Kunlik eslatmalarni tekshirishni boshladim (07:00)...');
    if (!this.appointmentModel || !this.patientModel || !this.clinicModel) {
      this.logger.warn('Mongo modeli topilmadi, morning reminder cron skip qilindi.');
      return;
    }
    try {
      const today = dayjs().format('YYYY-MM-DD');
      
      const appointmentsToday = await this.appointmentModel.find({
        date: today,
        status: { $in: ['scheduled', 'confirmed'] },
        morning_reminder_sent: { $ne: true }
      }).exec();

      for (const appointment of appointmentsToday) {
        try {
          const patient = await this.patientModel.findById(appointment.patient_id).exec();
          
          if (patient?.telegram_chat_id) {
            await this.telegramService.sendMorningAppointmentReminder(
              patient.telegram_chat_id,
              appointment,
            );
          }
          appointment.morning_reminder_sent = true;
          await appointment.save();
        } catch (e) {
          this.logger.error(`Morning reminder error for ${appointment._id}:`, e);
        }
      }
    } catch (error) {
      this.logger.error('Error fetching morning appointments:', error);
    }
  }

  /**
   * Runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleRealtimeReminders() {
    if (!this.appointmentModel || !this.patientModel || !this.clinicModel || !this.userModel) {
      this.logger.warn('Mongo modeli topilmadi, realtime reminder cron skip qilindi.');
      return;
    }
    try {
      // Always use Tashkent timezone so server location doesn't matter
      const now = dayjs().tz('Asia/Tashkent');
      const todayDate = now.format('YYYY-MM-DD');

      this.logger.debug(
        `⏱ Realtime check: Tashkent time = ${now.format('HH:mm')}, date = ${todayDate}`,
      );
      
      // 1. Check for 2-hour reminders
      // Bug fix: was using server UTC time instead of Tashkent time
      const target2H = now.add(2, 'hour').format('HH:mm');
      this.logger.debug(`🔍 Looking for 2h reminder appointments at time: ${target2H}`);

      const apps2H = await this.appointmentModel.find({
        date: todayDate,
        time: target2H,
        status: { $in: ['scheduled', 'confirmed'] },
        pre_reminder_sent: { $ne: true }
      }).exec();

      this.logger.debug(`📋 Found ${apps2H.length} appointments for 2h reminder`);

      for (const app of apps2H) {
        const patient = await this.patientModel.findById(app.patient_id).exec();

        if (!patient?.telegram_chat_id) {
          app.pre_reminder_sent = true;
          await app.save();
          continue;
        }

        const nowIso = new Date().toISOString();
        const messageId = await this.telegramService.sendAppointmentConfirmationMessage(
          patient.telegram_chat_id,
          app,
        );

        if (messageId) {
          app.pre_reminder_sent = true;
          app.confirmation_status = 'pending';
          app.confirmation_sent_at = nowIso;
          app.confirmation_requested_at = nowIso;
          app.confirmation_message_id = messageId;
          await app.save();

          await this.telegramService.syncAppointmentConfirmationToSupabase(app, {
            confirmation_status: 'pending',
            confirmation_sent_at: nowIso,
            confirmation_requested_at: nowIso,
            confirmation_message_id: messageId,
          });
        }
      }

      // 2. Check for "Starting Now" reminders
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

        // NEW: Notify Doctor
        // We look for a user in this clinic with the role 'doctor' and name matching app.doctor_name
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
