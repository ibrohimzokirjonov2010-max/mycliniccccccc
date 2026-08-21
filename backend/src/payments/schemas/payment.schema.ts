import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentDocument = Payment & Document;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ required: true })
  clinic_id: string;

  @Prop({ required: true })
  patient_id: string;

  @Prop({ required: true })
  patient_name: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true, enum: ['cash', 'card', 'transfer', 'credit'] })
  payment_method: string;

  @Prop({ required: true, enum: ['payment', 'refund'] })
  payment_type: string;

  @Prop()
  service_name?: string;

  @Prop()
  notes?: string;

  @Prop({ default: 'completed' })
  status: string;

  @Prop()
  transaction_id?: string;

  @Prop()
  stripe_payment_intent_id?: string;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ clinic_id: 1, created_date: -1 });
