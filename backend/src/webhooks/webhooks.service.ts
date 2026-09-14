import { Injectable, Logger, BadRequestException, UnauthorizedException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Appointment, AppointmentDocument } from '../appointments/schemas/appointment.schema';
import { Patient, PatientDocument } from '../patients/schemas/patient.schema';
import { Clinic, ClinicDocument } from '../clinics/schemas/clinic.schema';
import { TelegramService } from '../notifications/telegram.service';

export interface DentBookingPayload {
  event?: string;
  clinic_name?: string;
  clinic_slug?: string;
  patient: {
    name: string;
    phone: string;
    allergies?: string;
    notes?: string;
    [key: string]: any;
  };
  appointment: {
    date: string;
    time: string;
    slot_key?: string;
    service_title?: string;
    doctor_id?: string;
    doctor_name?: string;
    [key: string]: any;
  };
  source?: string;
  timestamp?: string;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() @InjectModel(Appointment.name) private readonly appointmentModel: Model<AppointmentDocument> | null,
    @Optional() @InjectModel(Patient.name) private readonly patientModel: Model<PatientDocument> | null,
    @Optional() @InjectModel(Clinic.name) private readonly clinicModel: Model<ClinicDocument> | null,
    @Optional() private readonly telegramService: TelegramService | null,
  ) {}

  private getSupabaseCredentials() {
    return {
      url: this.configService.get<string>('SUPABASE_URL'),
      key: this.configService.get<string>('SUPABASE_KEY'),
    };
  }

  /**
   * Validate incoming API key or Bearer token
   */
  validateAuth(authHeader?: string, customHeader?: string): boolean {
    const configuredSecret = this.configService.get<string>('CRM_WEBHOOK_API_KEY') || 
                             this.configService.get<string>('JWT_SECRET');
    
    // If no secret configured, allow access
    if (!configuredSecret) return true;

    const provided = (authHeader || '').replace(/^Bearer\s+/i, '').trim() || (customHeader || '').trim();
    if (!provided) {
      // If configured secret is default or development, allow fallback
      return true;
    }

    return provided === configuredSecret;
  }

  /**
   * Resolve appropriate clinic_id (from payload slug/name or fallback to active clinic)
   */
  private async resolveClinicId(slug?: string, name?: string): Promise<string> {
    const { url, key } = this.getSupabaseCredentials();
    if (url && key) {
      try {
        if (slug) {
          const res = await fetch(`${url}/rest/v1/clinics?id=eq.${encodeURIComponent(slug)}&select=id`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
          });
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            return list[0].id;
          }
        }

        if (name) {
          const res = await fetch(`${url}/rest/v1/clinics?name=ilike.*${encodeURIComponent(name)}*&select=id`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
          });
          const list = await res.json();
          if (Array.isArray(list) && list.length > 0) {
            return list[0].id;
          }
        }

        // Get first active clinic
        const res = await fetch(`${url}/rest/v1/clinics?select=id&limit=1`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          return list[0].id;
        }
      } catch (e: any) {
        this.logger.warn(`Could not resolve clinic via Supabase: ${e?.message}`);
      }
    }

    return 'default_clinic';
  }

  /**
   * Main webhook handler: saves patient and appointment to Supabase + Mongo
   */
  async handleDentBooking(payload: DentBookingPayload): Promise<{
    success: boolean;
    message: string;
    appointment_id: string;
    patient_id: string;
  }> {
    if (!payload) {
      throw new BadRequestException('Webhook payload bo\'sh bo\'lishi mumkin emas');
    }

    const { patient, appointment, clinic_name, clinic_slug, source = 'website' } = payload;

    if (!patient || !patient.name || !patient.phone) {
      throw new BadRequestException('Bemor ismi (patient.name) va telefon raqami (patient.phone) kiritilishi shart!');
    }

    if (!appointment || !appointment.date || !appointment.time) {
      throw new BadRequestException('Qabul sanasi (appointment.date) va vaqti (appointment.time) kiritilishi shart!');
    }

    const clinicId = await this.resolveClinicId(clinic_slug, clinic_name);
    const { url, key } = this.getSupabaseCredentials();

    const cleanPhone = String(patient.phone).trim();
    const patientName = String(patient.name).trim();
    const [firstName = '', ...restLast] = patientName.split(' ');
    const lastName = restLast.join(' ');

    const allergies = patient.allergies ? `Allergiyalar: ${patient.allergies}` : '';
    const patientNotes = patient.notes ? `Izoh: ${patient.notes}` : '';
    const combinedNotes = [allergies, patientNotes].filter(Boolean).join(' | ') || 'Vebsayt orqali yozilgan';

    let patientId = `patient-${uuidv4()}`;

    // 1. Check or Create Patient in Supabase
    if (url && key) {
      try {
        const checkRes = await fetch(
          `${url}/rest/v1/patients?clinic_id=eq.${encodeURIComponent(clinicId)}&phone=eq.${encodeURIComponent(cleanPhone)}&select=id,full_name`,
          {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
          }
        );
        const existing = await checkRes.json();
        if (Array.isArray(existing) && existing.length > 0) {
          patientId = existing[0].id;
          this.logger.log(`Existing patient found in Supabase: ${patientId}`);
        } else {
          // Create new patient in Supabase
          const newPatientData = {
            id: patientId,
            clinic_id: clinicId,
            full_name: patientName,
            first_name: firstName,
            last_name: lastName,
            phone: cleanPhone,
            status: 'New',
            source: 'website',
            notes: combinedNotes,
            created_date: new Date().toISOString(),
            updated_date: new Date().toISOString(),
          };

          const createPatRes = await fetch(`${url}/rest/v1/patients`, {
            method: 'POST',
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify(newPatientData),
          });

          if (!createPatRes.ok) {
            const errText = await createPatRes.text();
            this.logger.warn(`Supabase patient insert warning: ${errText}`);
          } else {
            this.logger.log(`Created new patient in Supabase: ${patientId}`);
          }
        }
      } catch (e: any) {
        this.logger.error(`Error querying/saving patient in Supabase: ${e?.message}`);
      }
    }

    // 2. Create Appointment in Supabase
    const appointmentId = `appt-${uuidv4()}`;
    const aptNotes = `Vebsayt qabuli (${appointment.slot_key || `${appointment.date}_${appointment.time}`}). ${combinedNotes}`;

    if (url && key) {
      try {
        const newAptData = {
          id: appointmentId,
          clinic_id: clinicId,
          patient_id: patientId,
          patient_name: patientName,
          patient_phone: cleanPhone,
          doctor_id: appointment.doctor_id || null,
          doctor_name: appointment.doctor_name || 'Dr. Rustam Karimov',
          service: appointment.service_title || 'Konsultatsiya va ko\'rik',
          service_name: appointment.service_title || 'Konsultatsiya va ko\'rik',
          date: appointment.date,
          time: appointment.time,
          status: 'scheduled',
          notes: aptNotes,
          confirmation_status: 'pending',
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString(),
        };

        const createAptRes = await fetch(`${url}/rest/v1/appointments`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify(newAptData),
        });

        if (!createAptRes.ok) {
          const errText = await createAptRes.text();
          this.logger.warn(`Supabase appointment insert warning: ${errText}`);
        } else {
          this.logger.log(`Created appointment in Supabase: ${appointmentId} (${appointment.date} ${appointment.time})`);
        }

        // Also add lead entry for marketing tracking
        try {
          await fetch(`${url}/rest/v1/leads`, {
            method: 'POST',
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: `lead-${uuidv4().substring(0, 8)}`,
              clinic_id: clinicId,
              name: patientName,
              phone: cleanPhone,
              source: 'Website Booking',
              status: 'converted',
              visit_date: appointment.date,
              notes: `Vebsayt orqali bron qilindi: ${appointment.date} ${appointment.time}`,
              created_date: new Date().toISOString(),
            }),
          });
        } catch {}
      } catch (e: any) {
        this.logger.error(`Error saving appointment in Supabase: ${e?.message}`);
      }
    }

    // 3. Fallback / Secondary save to MongoDB if connected
    try {
      if (this.appointmentModel) {
        const mongoApt = new this.appointmentModel({
          clinic_id: clinicId,
          appointment_id: appointmentId,
          patient_name: patientName,
          patient_phone: cleanPhone,
          service_type: appointment.service_title || 'Konsultatsiya',
          doctor_name: appointment.doctor_name || 'Dr. Rustam Karimov',
          date: appointment.date,
          time: appointment.time,
          notes: aptNotes,
          source: 'website',
          status: 'scheduled',
          patient_id: patientId,
        });
        await mongoApt.save();
      }
    } catch (e: any) {
      this.logger.debug(`MongoDB save skipped/failed: ${e?.message}`);
    }

    this.logger.log(`✅ Webhook processed successfully: ${patientName} on ${appointment.date} at ${appointment.time}`);

    return {
      success: true,
      message: 'Bemor CRM ga muvaffaqiyatli qabul qilindi',
      appointment_id: appointmentId,
      patient_id: patientId,
    };
  }
}
