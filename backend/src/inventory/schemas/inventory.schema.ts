import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InventoryDocument = Inventory & Document;

@Schema({ timestamps: true })
export class Inventory {
  @Prop({ required: true })
  clinic_id: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  quantity: number;

  @Prop()
  unit?: string;

  @Prop()
  min_quantity?: number;

  @Prop()
  price_per_unit?: number;

  @Prop()
  supplier?: string;

  @Prop()
  category?: string;

  @Prop({ default: 'in_stock', enum: ['in_stock', 'low_stock', 'out_of_stock'] })
  stock_status: string;

  @Prop()
  expiry_date?: string;

  @Prop()
  batch_number?: string;

  @Prop()
  notes?: string;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);
InventorySchema.index({ clinic_id: 1, name: 1 });
