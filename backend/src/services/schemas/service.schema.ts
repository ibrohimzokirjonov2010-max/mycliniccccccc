import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ServiceDocument = Service & Document;

@Schema({ timestamps: true })
export class Service {
  @Prop({ required: true })
  clinic_id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop()
  description?: string;

  @Prop({ default: 'active', enum: ['active', 'inactive'] })
  status: string;

  @Prop()
  category?: string;

  @Prop()
  duration_minutes?: number;

  @Prop({ default: false })
  is_popular: boolean;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
ServiceSchema.index({ clinic_id: 1, name: 1 });
