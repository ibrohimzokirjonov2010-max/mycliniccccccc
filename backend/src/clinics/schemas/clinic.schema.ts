import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ClinicDocument = Clinic & Document;

@Schema({ timestamps: true })
export class Clinic {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  password: string; // Hashed password

  @Prop()
  logo?: string;

  @Prop()
  expires_at?: string;

  @Prop({ default: 'Active', enum: ['Active', 'Suspended', 'Expired'] })
  status: string;

  @Prop()
  created_at: string;

  @Prop()
  monthly_fee?: number;

  @Prop()
  last_payment_date?: string;

  @Prop()
  stripe_customer_id?: string;

  @Prop()
  stripe_subscription_id?: string;

  @Prop()
  address?: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop()
  api_key?: string;
}

export const ClinicSchema = SchemaFactory.createForClass(Clinic);
