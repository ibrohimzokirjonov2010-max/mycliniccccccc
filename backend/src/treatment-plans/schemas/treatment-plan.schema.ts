import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TreatmentPlanDocument = TreatmentPlan & Document;

@Schema({ timestamps: true })
export class TreatmentPlan {
  @Prop({ required: true })
  clinic_id: string;

  @Prop({ required: true })
  patient_id: string;

  @Prop({ required: true })
  patient_name: string;

  @Prop({ required: true })
  tooth_number: string;

  @Prop()
  diagnosis?: string;

  @Prop()
  proposed_treatment?: string;

  @Prop()
  estimated_cost?: number;

  @Prop({ default: 'planned', enum: ['planned', 'in_progress', 'completed', 'cancelled'] })
  status: string;

  @Prop()
  start_date?: string;

  @Prop()
  end_date?: string;

  @Prop()
  doctor_name?: string;

  @Prop()
  notes?: string;

  @Prop()
  xray_urls?: string[];
}

export const TreatmentPlanSchema = SchemaFactory.createForClass(TreatmentPlan);
TreatmentPlanSchema.index({ clinic_id: 1, patient_id: 1 });
