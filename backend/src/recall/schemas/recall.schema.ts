import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RecallDocument = Recall & Document;

@Schema({ timestamps: true })
export class Recall {
  @Prop({ required: true })
  clinic_id: string;

  @Prop({ required: true })
  patient_id: string;

  @Prop({ required: true })
  patient_name: string;

  @Prop()
  patient_phone?: string;

  @Prop({ required: true })
  recall_date: string;

  @Prop()
  recall_type?: string; // Checkup, cleaning, follow-up, etc.

  @Prop()
  tooth_number?: string;

  @Prop({ default: 'pending', enum: ['pending', 'completed', 'cancelled'] })
  status: string;

  @Prop()
  notes?: string;

  @Prop()
  reminder_sent?: boolean;

  @Prop()
  completed_date?: string;
}

export const RecallSchema = SchemaFactory.createForClass(Recall);
RecallSchema.index({ clinic_id: 1, recall_date: 1 });
