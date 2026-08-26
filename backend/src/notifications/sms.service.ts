import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

interface SmsSettings {
  sms_enabled: boolean;
  on_appointment_created: boolean;
  on_appointment_day: boolean;
  on_appointment_day_time: string;
  on_day_before: boolean;
  on_day_before_time: string;
  birthday_greetings: boolean;
  recall_reminder: boolean;
  debt_reminder: boolean;
}

interface SentMessageLog {
  id: string;
  patient_name: string;
  phone: string;
  message: string;
  type: 'sms' | 'telegram';
  status: 'sent' | 'pending' | 'failed';
  sent_at: string;
  clinic_id?: string;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly ESKIZ_BASE = 'https://notify.eskiz.uz/api';
  private eskizToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private sentLog: SentMessageLog[] = [];
  private currentSettings: SmsSettings;

  constructor(private readonly configService: ConfigService) {
    this.currentSettings = this.loadSettings();
  }

  // ─── Eskiz.com Token ──────────────────────────────────────────────────────
  private async getToken(): Promise<string | null> {
    // Token hali amal qilsa, qaytarish
    if (this.eskizToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.eskizToken;
    }

    const email = this.configService.get<string>('ESKIZ_EMAIL');
    const password = this.configService.get<string>('ESKIZ_PASSWORD');

    if (!email || !password) {
      this.logger.warn('ESKIZ_EMAIL yoki ESKIZ_PASSWORD .env da topilmadi');
      return null;
    }

    try {
      const body = new URLSearchParams({ email, password });
      const res = await fetch(`${this.ESKIZ_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        this.logger.error(`Eskiz login failed: ${res.status} ${await res.text()}`);
        return null;
      }

      const data = await res.json();
      this.eskizToken = data?.data?.token || null;
      // Token 29 kun amal qiladi — 28 kundan keyin yangilash
      if (this.eskizToken) {
        this.tokenExpiry = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000);
        this.logger.log('✅ Eskiz.com token olindi');
      }
      return this.eskizToken;
    } catch (err) {
      this.logger.error('Eskiz token olishda xato:', err);
      return null;
    }
  }

  // ─── Asosiy SMS yuborish ──────────────────────────────────────────────────
  async sendSms(phone: string, message: string, patientName = 'Bemor', clinicId = ''): Promise<boolean> {
    const token = await this.getToken();
    if (!token) {
      this.logger.warn(`SMS yuborilmadi (token yo'q): ${phone}`);
      return false;
    }

    const from = this.configService.get<string>('ESKIZ_FROM') || '4546';
    // O'zbekiston format: 998XXXXXXXXX
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      this.logger.warn(`Noto'g'ri telefon raqami: ${phone}`);
      return false;
    }

    try {
      const body = new URLSearchParams({
        mobile_phone: normalizedPhone,
        message,
        from,
        callback_url: '',
      });

      const res = await fetch(`${this.ESKIZ_BASE}/message/sms/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      const data = await res.json();

      if (res.ok && (data.status === 'waiting' || data.id)) {
        this.logger.log(`📱 SMS yuborildi → ${normalizedPhone}`);
        this.logMessage({ patientName, phone: normalizedPhone, message, clinicId, status: 'sent' });
        return true;
      } else {
        this.logger.error(`SMS yuborishda xato: ${JSON.stringify(data)}`);
        // Token eskirgan bo'lsa, yangilash
        if (data.message?.includes('token') || res.status === 401) {
          this.eskizToken = null;
        }
        this.logMessage({ patientName, phone: normalizedPhone, message, clinicId, status: 'failed' });
        return false;
      }
    } catch (err) {
      this.logger.error('SMS yuborishda kutilmagan xato:', err);
      this.logMessage({ patientName, phone: normalizedPhone, message, clinicId, status: 'failed' });
      return false;
    }
  }

  // ─── Telefon normalizatsiya ───────────────────────────────────────────────
  private normalizePhone(phone: string): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('998') && digits.length === 12) return digits;
    if (digits.startsWith('8') && digits.length === 11) return '7' + digits.slice(1); // Russia
    if (digits.length === 9) return '998' + digits;
    if (digits.length === 12 && digits.startsWith('998')) return digits;
    return null;
  }

  // ─── Log yozish ──────────────────────────────────────────────────────────
  private logMessage(opts: {
    patientName: string;
    phone: string;
    message: string;
    clinicId: string;
    status: 'sent' | 'failed' | 'pending';
  }) {
    const entry: SentMessageLog = {
      id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      patient_name: opts.patientName,
      phone: opts.phone,
      message: opts.message,
      type: 'sms',
      status: opts.status,
      sent_at: new Date().toISOString(),
      clinic_id: opts.clinicId,
    };
    this.sentLog.unshift(entry);
    // Oxirgi 500 ta log
    if (this.sentLog.length > 500) this.sentLog = this.sentLog.slice(0, 500);
  }

  // ─── Log o'qish ──────────────────────────────────────────────────────────
  getLogByDate(date: string): SentMessageLog[] {
    return this.sentLog.filter(m => m.sent_at.startsWith(date));
  }

  // ─── SMS shablonlari ─────────────────────────────────────────────────────

  /** Navbat yaratilganda darhol SMS */
  async sendAppointmentCreatedSms(phone: string, patientName: string, date: string, time: string, clinicName: string, clinicId = '') {
    if (!this.isSmsEnabled('on_appointment_created')) return false;
    const msg = `${clinicName}: Hurmatli ${patientName}, ${date} kuni soat ${time}da navbatingiz tasdiqlandi. Kutib qolamiz! 🦷`;
    return this.sendSms(phone, msg, patientName, clinicId);
  }

  /** Qabul kuni eslatma SMS */
  async sendAppointmentDaySms(phone: string, patientName: string, time: string, clinicName: string, clinicId = '') {
    if (!this.isSmsEnabled('on_appointment_day')) return false;
    const msg = `${clinicName}: Hurmatli ${patientName}, bugun soat ${time}da qabulingiz bor. Biz sizni kutmoqdamiz! 🦷`;
    return this.sendSms(phone, msg, patientName, clinicId);
  }

  /** 1 kun oldin eslatma SMS */
  async sendDayBeforeReminderSms(phone: string, patientName: string, date: string, time: string, clinicName: string, clinicId = '') {
    if (!this.isSmsEnabled('on_day_before')) return false;
    const msg = `${clinicName}: Hurmatli ${patientName}, ertaga ${date} kuni soat ${time}da qabulingiz bor. Eslab qoling! 🦷`;
    return this.sendSms(phone, msg, patientName, clinicId);
  }

  /** Tug'ilgan kun tabrik SMS */
  async sendBirthdaySms(phone: string, patientName: string, clinicName: string, clinicId = '') {
    if (!this.isSmsEnabled('birthday_greetings')) return false;
    const msg = `${clinicName}: Hurmatli ${patientName}, tug'ilgan kuningiz muborak! 🎉 Sizni doim sog'liq va baxt tilaymiz! 🦷`;
    return this.sendSms(phone, msg, patientName, clinicId);
  }

  /** Recall (qayta ko'rik) eslatma SMS */
  async sendRecallSms(phone: string, patientName: string, clinicName: string, clinicId = '') {
    if (!this.isSmsEnabled('recall_reminder')) return false;
    const msg = `${clinicName}: Hurmatli ${patientName}, navbatdagi tekshiruvingiz vaqti keldi. Qabulga yozing yoki qo'ng'iroq qiling. 🦷`;
    return this.sendSms(phone, msg, patientName, clinicId);
  }

  /** Qarz eslatma SMS */
  async sendDebtReminderSms(phone: string, patientName: string, amount: number, clinicName: string, clinicId = '') {
    if (!this.isSmsEnabled('debt_reminder')) return false;
    const msg = `${clinicName}: Hurmatli ${patientName}, ${amount.toLocaleString()} so'm to'lovni amalga oshirishingizni so'raymiz. To'lov uchun klinikaga murojaat qiling.`;
    return this.sendSms(phone, msg, patientName, clinicId);
  }

  // ─── Sozlama tekshirish ───────────────────────────────────────────────────
  public isSmsEnabled(key: keyof SmsSettings): boolean {
    if (!this.currentSettings.sms_enabled) return false;
    return !!this.currentSettings[key];
  }

  // ─── Sozlamalarni saqlash va o'qish (fayl orqali) ────────────────────────
  private loadSettings(): SmsSettings {
    const defaultSettings: SmsSettings = {
      sms_enabled: true,
      on_appointment_created: true,
      on_appointment_day: true,
      on_appointment_day_time: '08:00',
      on_day_before: true,
      on_day_before_time: '08:00',
      birthday_greetings: true,
      recall_reminder: true,
      debt_reminder: true,
    };
    try {
      const filePath = path.join(process.cwd(), 'sms_settings.json');
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return { ...defaultSettings, ...JSON.parse(data) };
      }
    } catch (e) {
      this.logger.error('SMS sozlamalarini yuklashda xato:', e);
    }
    return defaultSettings;
  }

  saveSettings(settings: Partial<SmsSettings>) {
    this.currentSettings = { ...this.currentSettings, ...settings } as SmsSettings;
    try {
      const filePath = path.join(process.cwd(), 'sms_settings.json');
      fs.writeFileSync(filePath, JSON.stringify(this.currentSettings, null, 2), 'utf8');
      this.logger.log('📋 SMS sozlamalari faylga saqlandi');
    } catch (e) {
      this.logger.error('SMS sozlamalarini faylga saqlashda xato:', e);
    }
  }

  getSettings(): SmsSettings {
    return this.currentSettings;
  }
}
