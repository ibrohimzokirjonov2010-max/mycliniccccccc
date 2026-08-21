import 'dotenv/config';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ScheduleModule } from '@nestjs/schedule';

// Feature Modules
import { NotificationsModule } from './notifications/notifications.module';
import { PublicModule } from './public/public.module';

const importsArray = [] as any[];

// Configuration
importsArray.push(ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }));

// Background jobs / Cron
importsArray.push(ScheduleModule.forRoot());

// Conditionally initialize MongoDB (set SKIP_DB=true in .env to skip during local dev)
if (process.env.SKIP_DB !== 'true') {
  importsArray.push(MongooseModule.forRootAsync({
    imports: [ConfigModule],
    useFactory: async (configService: ConfigService) => ({
      uri: configService.get<string>('MONGODB_URI'),
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 3000,
    }),
    inject: [ConfigService],
  }));
}

// JWT Authentication
importsArray.push(
  JwtModule.registerAsync({
    imports: [ConfigModule],
    useFactory: async (configService: ConfigService) => ({
      secret: configService.get<string>('JWT_SECRET'),
      signOptions: { expiresIn: '7d' },
    }),
    global: true,
    inject: [ConfigService],
  }),
);

// Passport
importsArray.push(PassportModule.register({ defaultStrategy: 'jwt' }));

// Feature Modules
importsArray.push(NotificationsModule);
importsArray.push(PublicModule);

@Module({
  imports: importsArray,
})
export class AppModule {}
