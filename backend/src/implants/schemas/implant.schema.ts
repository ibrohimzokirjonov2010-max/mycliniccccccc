import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ImplantDocument = Implant & Document;

@Schema({ timestamps: true })
export class Implant {
  @Prop({ required: true })
  clinic_id: string;

  @Prop({ required: true })
  patient_id: string;

  @Prop({ required: true })
  patient_name: string;

  @Prop()
  patient_phone?: string;

  @Prop({ type: [String], required: true })
  tooth_numbers: string[];

  @Prop()
  implant_type?: string;

  @Prop()
  firma?: string;

  @Prop()
  firma_custom?: string;

  @Prop()
  brend?: string;

  @Prop()
  diameter?: number;

  @Prop()
  length?: number;

  @Prop()
  lot_number?: string;

  @Prop()
  torque?: number;

  @Prop()
  isq?: number;

  @Prop()
  bone_type?: string;

  @Prop({ required: true })
  placed_date: string;

  @Prop({ default: 'Rejalashtirilgan' })
  lifecycle_status: string;

  @Prop()
  doctor?: string;

  @Prop()
  reminder_months?: number;

  @Prop()
  reminder_date?: string;

  @Prop()
  notes?: string;

  @Prop()
  passport_url?: string;

  @Prop()
  xray_urls?: string[];

  @Prop()
  complications?: Array<{
    type: string;
    date: string;
    note: string;
    status: string;
  }>;

  @Prop()
  timeline?: Array<{
    date: string;
    status: string;
    note: string;
    user: string;
  }>;

  @Prop()
  audit_log?: Array<{
    date: string;
    user: string;
    action: string;
  }>;
}

export const ImplantSchema = SchemaFactory.createForClass(Implant);
ImplantSchema.index({ clinic_id: 1, patient_id: 1 });
ImplantSchema.index({ clinic_id: 1, tooth_number: 1 });
