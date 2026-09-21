import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findAll(clinicId: string): Promise<UserDocument[]> {
    return this.userModel.find({ clinic_id: clinicId }).select('-password').exec();
  }

  async findOne(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).select('-password').exec();
  }

  async findByUsername(username: string, clinicId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username, clinic_id: clinicId }).exec();
  }

  async create(createUserDto: any): Promise<any> {
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const createdUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });
    const saved = await createdUser.save();
    const obj = saved.toObject();
    return obj;
  }

  async update(id: string, updateUserDto: any): Promise<any> {
    const payload = { ...updateUserDto };
    if (payload.password) {
      payload.password = await bcrypt.hash(payload.password, 10);
    } else {
      delete payload.password;
    }
    const updated = await this.userModel.findByIdAndUpdate(id, payload, { new: true }).select('-password').exec();
    return updated;
  }

  async delete(id: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndDelete(id).exec();
  }

  async validateUser(username: string, password: string, clinicId: string): Promise<any> {
    const user = await this.findByUsername(username, clinicId);
    const storedHash = user?.password;
    if (user && storedHash && (await bcrypt.compare(password, storedHash))) {
      return user.toObject();
    }
    return null;
  }
}
