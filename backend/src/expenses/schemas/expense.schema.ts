import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExpenseDocument = Expense & Document;

@Schema({ timestamps: true })
export class Expense {
  @Prop({ required: true })
  clinic_id: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  date: string;

  @Prop()
  description?: string;

  @Prop()
  payment_method?: string;

  @Prop()
  recipient?: string;

  @Prop()
  receipt_url?: string;

  @Prop()
  notes?: string;

  @Prop({ default: 'pending', enum: ['pending', 'approved', 'rejected'] })
  status: string;

  @Prop()
  approved_by?: string;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
ExpenseSchema.index({ clinic_id: 1, date: -1 });
