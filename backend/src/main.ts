import { NestFactory } from '@nestjs/core';
// import { ValidationPipe } from '@nestjs/common';
import * as common from '@nestjs/common'; 
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for frontend & public template integration
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or any origin for public API
      callback(null, true);
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-clinic-id'],
    credentials: true,
  });

  // Global validation pipe
  /*
  app.useGlobalPipes(
    new (common.ValidationPipe as any)({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  */

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Dental Clinic API')
    .setDescription('Professional Dental Clinic Management System API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('patients', 'Patient management')
    .addTag('appointments', 'Appointment scheduling')
    .addTag('payments', 'Payment processing')
    .addTag('services', 'Service catalog')
    .addTag('inventory', 'Inventory management')
    .addTag('leads', 'Lead tracking')
    .addTag('treatment-plans', 'Treatment planning')
    .addTag('implants', 'Implant tracking')
    .addTag('users', 'User management')
    .addTag('expenses', 'Expense tracking')
    .addTag('recall', 'Recall reminders')
    .addTag('debts', 'Debt management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Get port from config
  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 3000;

  await app.listen(port);
  console.log(`🦷 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
