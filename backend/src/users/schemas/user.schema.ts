import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  password: string; // Hashed password

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['admin', 'doctor', 'receptionist'] })
  role: string;

  @Prop({ required: true })
  clinic_id: string;

  @Prop()
  phone?: string;

  @Prop()
  email?: string;

  @Prop({ default: true })
  is_active: boolean;

  @Prop()
  telegram_chat_id?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
