import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Appointment, AppointmentDocument } from '../appointments/schemas/appointment.schema';
import { Clinic, ClinicDocument } from '../clinics/schemas/clinic.schema';

@Injectable()
export class PublicService {
  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(Clinic.name) private clinicModel: Model<ClinicDocument>,
  ) {}

  async getBusySlots(clinicId: string, date: string, doctorId?: string) {
    if (!clinicId) {
      throw new BadRequestException('clinic_id parameter is required');
    }
    if (!date) {
      throw new BadRequestException('date parameter is required');
    }

    // Build query for appointments matching clinic_id and date
    // Date can be stored as '2026-08-10' or ISO string starting with '2026-08-10'
    const dateRegex = new RegExp(`^${date}`);
    const filter: any = {
      clinic_id: clinicId,
      date: dateRegex,
      status: { $ne: 'cancelled' },
    };

    if (doctorId) {
      filter.$or = [{ doctor_id: doctorId }, { doctor_name: doctorId }];
    }

    const appointments = await this.appointmentModel.find(filter).exec();

    // Extract unique HH:mm time slots
    const busySlots = Array.from(
      new Set(
        appointments
          .map((apt) => apt.time)
          .filter((t) => typeof t === 'string' && t.trim().length > 0)
      )
    ).sort();

    return {
      success: true,
      clinic_id: clinicId,
      date,
      busy_slots: busySlots,
    };
  }

  async createAppointment(dto: any) {
    const {
      clinic_id,
      patient_name,
      patient_phone,
      service_name,
      doctor_name,
      appointment_date,
      appointment_time,
      notes,
      source,
    } = dto || {};

    if (!clinic_id) {
      throw new BadRequestException('clinic_id is required');
    }
    if (!patient_name) {
      throw new BadRequestException('patient_name is required');
    }
    if (!patient_phone) {
      throw new BadRequestException('patient_phone is required');
    }
    if (!appointment_date) {
      throw new BadRequestException('appointment_date is required');
    }
    if (!appointment_time) {
      throw new BadRequestException('appointment_time is required');
    }

    // Generate unique Appointment ID format: APT-98214
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const appointmentId = `APT-${randomDigits}`;

    const newAppointment = new this.appointmentModel({
      clinic_id,
      appointment_id: appointmentId,
      patient_name,
      patient_phone,
      service_type: service_name || 'Umumiy ko\'rik',
      doctor_name: doctor_name || 'Tayinlanmagan',
      date: appointment_date,
      time: appointment_time,
      notes: notes || 'Vebsayt shabloni orqali yozilgan bemor',
      source: source || 'website_template',
      status: 'scheduled',
      patient_id: `pat_${Date.now()}`,
    });

    await newAppointment.save();

    return {
      success: true,
      appointment_id: appointmentId,
      message: `Qabulga muvaffaqiyatli yozildingiz! ID: ${appointmentId}`,
    };
  }
}
