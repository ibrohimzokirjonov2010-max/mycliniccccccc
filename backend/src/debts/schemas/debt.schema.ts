import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DebtDocument = Debt & Document;

@Schema({ timestamps: true })
export class Debt {
  @Prop({ required: true })
  clinic_id: string;

  @Prop({ required: true })
  patient_id: string;

  @Prop({ required: true })
  patient_name: string;

  @Prop()
  patient_phone?: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  original_amount: number;

  @Prop({ default: 'pending', enum: ['pending', 'partial', 'paid', 'cancelled'] })
  status: string;

  @Prop()
  due_date?: string;

  @Prop()
  service_name?: string;

  @Prop()
  notes?: string;

  @Prop()
  payment_plan?: Array<{
    date: string;
    amount: number;
    paid: boolean;
  }>;

  // Telegram qarz eslatmasini bir kunda takror yubormaslik uchun
  @Prop()
  last_reminder_at?: Date;
}

export const DebtSchema = SchemaFactory.createForClass(Debt);
DebtSchema.index({ clinic_id: 1, status: 1 });
