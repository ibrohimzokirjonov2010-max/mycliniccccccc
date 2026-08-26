import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as dayjs from 'dayjs';
import { ConfigService } from '@nestjs/config';

import { Debt, DebtDocument } from '../debts/schemas/debt.schema';
import { Patient, PatientDocument } from '../patients/schemas/patient.schema';
import { Clinic, ClinicDocument } from '../clinics/schemas/clinic.schema';
import { TelegramService } from './telegram.service';
import { SmsService } from './sms.service';

@Injectable()
export class DebtRemindersCron {
  private readonly logger = new Logger(DebtRemindersCron.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() @InjectModel(Debt.name) private readonly debtModel: Model<DebtDocument> | null,
    @Optional() @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument> | null,
    @Optional() @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument> | null,
    private readonly telegramService: TelegramService,
    private readonly smsService: SmsService,
  ) {}

  /**
   * Qarz eslatmasi: har kuni ertalab 09:00 (Toshkent vaqti).
   * - Faqat TELEGRAM_DEBT_REMINDERS_ENABLED=true bo'lsa ishlaydi.
   * - Default: faqat due_date bo'lsa va muddati bugun/oldin bo'lsa yuboradi.
   * - Bitta qarzga bir kunda bir marta yuboradi (last_reminder_at).
   */
  @Cron('00 09 * * *', {
    timeZone: 'Asia/Tashkent',
  })
  async handleDebtReminders() {
    const enabled = (this.configService.get<string>('TELEGRAM_DEBT_REMINDERS_ENABLED') || 'false').toLowerCase() === 'true';
    if (!enabled) return;
    if (!this.debtModel || !this.patientModel || !this.clinicModel) {
      this.logger.warn('Mongo modeli topilmadi, debt reminder cron skip qilindi.');
      return;
    }

    const remindOnlyIfDueDate =
      (this.configService.get<string>('TELEGRAM_DEBT_REMIND_ONLY_IF_DUE_DATE') || 'true').toLowerCase() === 'true';

    const today = dayjs().format('YYYY-MM-DD');
    const startOfToday = dayjs().startOf('day').toDate();

    this.logger.log(`💳 Qarz eslatmalarini tekshirish (09:00) — ${today}`);

    try {
      const lastReminderCond = { $or: [{ last_reminder_at: { $exists: false } }, { last_reminder_at: { $lt: startOfToday } }] };
      const dueCond = remindOnlyIfDueDate
        ? { due_date: { $exists: true, $ne: null, $lte: today } }
        : {
            $or: [
              { due_date: { $exists: true, $ne: null, $lte: today } },
              { due_date: { $exists: false } },
              { due_date: null },
              { due_date: '' },
            ],
          };

      const query: any = {
        status: { $in: ['pending', 'partial'] },
        amount: { $gt: 0 },
        $and: [lastReminderCond, dueCond],
      };

      const debts = await this.debtModel.find(query).limit(300).exec();
      if (!debts.length) return;

      for (const debt of debts) {
        try {
          const patient = await this.patientModel.findById(debt.patient_id).exec();
          if (!patient?.telegram_chat_id && !patient?.phone) {
            continue;
          }

          const clinic = await this.clinicModel.findOne({ id: debt.clinic_id }).exec();
          const clinicName = clinic?.name || this.configService.get<string>('CLINIC_NAME') || 'Kliniyamiz';

          const amount = Number(debt.amount || 0);
          let sent = false;

          if (patient?.telegram_chat_id) {
            const duePart = debt.due_date ? `📅 <b>Muddat:</b> ${debt.due_date}\n` : '';
            const servicePart = debt.service_name ? `🦷 <b>Xizmat:</b> ${debt.service_name}\n` : '';

            const message =
              `💳 <b>QARZ ESLATMASI</b>\n\n` +
              `Hurmatli <b>${patient.full_name}</b>, sizda <b>${clinicName}</b> bo'yicha qarzdorlik mavjud.\n\n` +
              `💰 <b>Qarz miqdori:</b> <b>${amount.toLocaleString()}</b> so'm\n` +
              duePart +
              servicePart +
              `\nAgar to'lov qilgan bo'lsangiz, bu xabarni e'tiborsiz qoldirishingiz mumkin.\n` +
              `To'lov va aniqlik uchun klinikaga bog'laning.`;

            const ok = await this.telegramService.sendMessage(patient.telegram_chat_id, message);
            if (ok) sent = true;
          }

          if (patient?.phone) {
            const ok = await this.smsService.sendDebtReminderSms(
              patient.phone,
              patient.full_name || 'Bemor',
              amount,
              clinicName,
              debt.clinic_id,
            );
            if (ok) sent = true;
          }

          if (sent) {
            debt.last_reminder_at = new Date();
            await debt.save();
          }
        } catch (e) {
          this.logger.error(`Debt reminder error for ${debt?._id}:`, e);
        }
      }
    } catch (error) {
      this.logger.error('Error in handleDebtReminders:', error);
    }
  }
}
