import { Controller, Get, Post, Query, Body, Header, Headers } from '@nestjs/common';
import { PublicService } from './public.service';
import { ApiTags, ApiOperation, ApiQuery, ApiBody } from '@nestjs/swagger';

@ApiTags('public')
@Controller('api/v1/public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('busy-slots')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  @ApiOperation({ summary: 'Get busy time slots for a clinic on a given date' })
  @ApiQuery({ name: 'clinic_id', required: true, example: 'shifo_clinic_102' })
  @ApiQuery({ name: 'date', required: true, example: '2026-08-10' })
  @ApiQuery({ name: 'doctor_id', required: false })
  async getBusySlots(
    @Query('clinic_id') clinicId: string,
    @Query('date') date: string,
    @Query('doctor_id') doctorId?: string,
    @Headers('x-api-key') apiKey?: string,
  ) {
    return this.publicService.getBusySlots(clinicId, date, doctorId);
  }

  @Post('appointments')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  @ApiOperation({ summary: 'Create a new patient appointment from external website' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        clinic_id: { type: 'string', example: 'shifo_clinic_102' },
        patient_name: { type: 'string', example: 'Jasur Rahimov' },
        patient_phone: { type: 'string', example: '+998901234567' },
        service_name: { type: 'string', example: 'Tish implantatsiyasi' },
        doctor_name: { type: 'string', example: 'Dr. Khamidov Shakhboz' },
        appointment_date: { type: 'string', example: '2026-08-10' },
        appointment_time: { type: 'string', example: '10:00' },
        notes: { type: 'string', example: 'Shablon vebsayti orqali onlayn yozilgan bemor' },
        source: { type: 'string', example: 'website_template' },
      },
    },
  })
  async createAppointment(
    @Body() body: any,
    @Headers('x-api-key') apiKey?: string,
  ) {
    return this.publicService.createAppointment(body);
  }
}
