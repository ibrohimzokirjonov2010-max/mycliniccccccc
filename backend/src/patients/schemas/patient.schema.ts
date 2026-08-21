import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PatientDocument = Patient & Document;

@Schema({ timestamps: true })
export class Patient {
  @Prop({ required: true })
  clinic_id: string;

  @Prop({ required: true })
  full_name: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  birth_date?: string;

  @Prop()
  gender?: string;

  @Prop()
  address?: string;

  @Prop()
  occupation?: string;

  @Prop()
  notes?: string;

  @Prop({ default: 'active' })
  status: string;

  @Prop()
  avatar_url?: string;

  @Prop()
  telegram_username?: string;

  @Prop()
  telegram_chat_id?: string;

  @Prop()
  last_visit_date?: string;

  @Prop()
  next_appointment_date?: string;
}

export const PatientSchema = SchemaFactory.createForClass(Patient);
PatientSchema.index({ clinic_id: 1, full_name: 1 });
