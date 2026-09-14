import { Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { Patient, PatientSchema } from '../patients/schemas/patient.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { Clinic, ClinicSchema } from '../clinics/schemas/clinic.schema';
import { NotificationsModule } from '../notifications/notifications.module';

const useMongo = process.env.SKIP_DB !== 'true';

@Module({
  imports: [
    ConfigModule,
    NotificationsModule,
    ...(useMongo
      ? [
          MongooseModule.forFeature([
            { name: Patient.name, schema: PatientSchema },
            { name: Appointment.name, schema: AppointmentSchema },
            { name: Clinic.name, schema: ClinicSchema },
          ]),
        ]
      : []),
  ],
  providers: [
    WebhooksService,
    ...(useMongo
      ? []
      : [
          { provide: getModelToken(Patient.name), useValue: null },
          { provide: getModelToken(Appointment.name), useValue: null },
          { provide: getModelToken(Clinic.name), useValue: null },
        ]),
  ],
  controllers: [WebhooksController],
  exports: [WebhooksService],
})
export class WebhooksModule {}
