import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AppointmentDocument = Appointment & Document;

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ required: true })
  clinic_id: string;

  @Prop()
  appointment_id?: string;

  @Prop()
  patient_id?: string;

  @Prop({ required: true })
  patient_name: string;

  @Prop()
  patient_phone?: string;

  @Prop({ required: true })
  date: string; // ISO date string or YYYY-MM-DD

  @Prop({ required: true })
  time: string; // HH:mm format

  @Prop()
  duration_minutes?: number;

  @Prop()
  service_type?: string;

  @Prop()
  doctor_name?: string;

  @Prop({ default: 'scheduled', enum: ['scheduled', 'confirmed', 'completed', 'cancelled', 'no-show'] })
  status: string;

  @Prop()
  notes?: string;

  @Prop()
  source?: string;

  @Prop({ default: false })
  reminder_sent?: boolean;

  @Prop({ default: false })
  morning_reminder_sent?: boolean;

  @Prop({ default: false })
  pre_reminder_sent?: boolean;

  @Prop({ default: false })
  current_reminder_sent?: boolean;

  @Prop({ default: false })
  day_before_reminder_sent?: boolean;

  @Prop({ default: 'pending' })
  confirmation_status?: string;

  @Prop()
  confirmation_sent_at?: string;

  @Prop()
  confirmation_requested_at?: string;

  @Prop()
  confirmation_response_at?: string;

  @Prop()
  confirmation_response_channel?: string;

  @Prop()
  confirmation_follow_up_choice?: string;

  @Prop()
  confirmation_message_id?: number;

  @Prop()
  tooth_number?: string;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
AppointmentSchema.index({ clinic_id: 1, date: 1, time: 1 });
