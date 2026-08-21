import { Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { Clinic, ClinicSchema } from '../clinics/schemas/clinic.schema';

const useMongo = process.env.SKIP_DB !== 'true';

// In-memory mock store for standalone dev/testing mode without MongoDB
const inMemoryAppointments: any[] = [];
const mockModel = {
  find: (query: any) => ({
    exec: async () => {
      const clinicId = query?.clinic_id;
      return inMemoryAppointments.filter((a) => a.clinic_id === clinicId);
    },
  }),
};

@Module({
  imports: useMongo
    ? [
        MongooseModule.forFeature([
          { name: Appointment.name, schema: AppointmentSchema },
          { name: Clinic.name, schema: ClinicSchema },
        ]),
      ]
    : [],
  controllers: [PublicController],
  providers: [
    PublicService,
    ...(useMongo
      ? []
      : [
          {
            provide: getModelToken(Appointment.name),
            useValue: class MockAppointment {
              constructor(private data: any) {
                Object.assign(this, data);
              }
              async save() {
                inMemoryAppointments.push(this);
                return this;
              }
              static find = mockModel.find;
            },
          },
          { provide: getModelToken(Clinic.name), useValue: null },
        ]),
  ],
  exports: [PublicService],
})
export class PublicModule {}
