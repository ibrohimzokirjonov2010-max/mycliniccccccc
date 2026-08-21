import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LeadDocument = Lead & Document;

@Schema({ timestamps: true })
export class Lead {
  @Prop({ required: true })
  clinic_id: string;

  @Prop({ required: true })
  full_name: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  source?: string; // Website, referral, social media, etc.

  @Prop()
  interested_service?: string;

  @Prop({ default: 'new', enum: ['new', 'contacted', 'qualified', 'converted', 'lost'] })
  status: string;

  @Prop()
  notes?: string;

  @Prop()
  follow_up_date?: string;

  @Prop()
  converted_patient_id?: string;
}

export const LeadSchema = SchemaFactory.createForClass(Lead);
LeadSchema.index({ clinic_id: 1, created_date: -1 });
