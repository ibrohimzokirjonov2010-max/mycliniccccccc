import { Module } from '@nestjs/common';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { TelegramService } from './telegram.service';
import { SmsService } from './sms.service';
import { AppointmentRemindersCron } from './appointment-reminders.cron';
import { DebtRemindersCron } from './debt-reminders.cron';
import { NotificationsController } from './notifications.controller';
import { Patient, PatientSchema } from '../patients/schemas/patient.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { ConfigModule } from '@nestjs/config';
import { Clinic, ClinicSchema } from '../clinics/schemas/clinic.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Debt, DebtSchema } from '../debts/schemas/debt.schema';

const useMongo = process.env.SKIP_DB !== 'true';

@Module({
  imports: useMongo
    ? [
        ConfigModule,
        MongooseModule.forFeature([
          { name: Patient.name, schema: PatientSchema },
          { name: Appointment.name, schema: AppointmentSchema },
          { name: Clinic.name, schema: ClinicSchema },
          { name: User.name, schema: UserSchema },
          { name: Debt.name, schema: DebtSchema },
        ]),
      ]
    : [ConfigModule],
  providers: [
    TelegramService,
    SmsService,
    AppointmentRemindersCron,
    DebtRemindersCron,
    ...(useMongo
      ? []
      : [
          { provide: getModelToken(Patient.name), useValue: null },
          { provide: getModelToken(Appointment.name), useValue: null },
          { provide: getModelToken(Clinic.name), useValue: null },
          { provide: getModelToken(User.name), useValue: null },
          { provide: getModelToken(Debt.name), useValue: null },
        ]),
  ],
  controllers: [NotificationsController],
  exports: [TelegramService, SmsService, AppointmentRemindersCron],
})
export class NotificationsModule {}
