import { Controller, Post, Get, Body, Headers, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiBody } from '@nestjs/swagger';
import { WebhooksService, DentBookingPayload } from './webhooks.service';

@ApiTags('webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get('dent-booking')
  @ApiOperation({ summary: 'Webhook status check' })
  healthCheck() {
    return {
      status: 'active',
      service: 'Dental Clinic CRM Webhook API',
      timestamp: new Date().toISOString(),
      accepted_events: ['booking.created'],
    };
  }

  @Post('dent-booking')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Incoming patient booking webhook from dental website' })
  @ApiHeader({ name: 'Authorization', required: false, description: 'Bearer [API_KEY]' })
  @ApiHeader({ name: 'x-api-key', required: false, description: 'Secret API Key' })
  @ApiHeader({ name: 'x-crm-api-key', required: false, description: 'Alternative API Key Header' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['patient', 'appointment'],
      properties: {
        event: { type: 'string', example: 'booking.created' },
        clinic_name: { type: 'string', example: 'Dent Lux Clinic' },
        patient: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name: { type: 'string', example: 'Alisher Vohidov' },
            phone: { type: 'string', example: '+998 90 123 45 67' },
            allergies: { type: 'string', example: "Yo'q" },
            notes: { type: 'string', example: "Tish og'rig'i" },
          },
        },
        appointment: {
          type: 'object',
          required: ['date', 'time'],
          properties: {
            date: { type: 'string', example: '2026-09-15' },
            time: { type: 'string', example: '17:00' },
            slot_key: { type: 'string', example: '2026-09-15_doc-1_17:00' },
            service_title: { type: 'string', example: 'Karies davolash' },
            doctor_id: { type: 'string', example: 'doc-1' },
            doctor_name: { type: 'string', example: 'Dr. Rustam Karimov' },
          },
        },
        source: { type: 'string', example: 'website' },
        timestamp: { type: 'string', example: '2026-09-15T12:30:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Booking successfully accepted into CRM',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Bemor CRM ga muvaffaqiyatli qabul qilindi' },
        appointment_id: { type: 'string', example: 'appt-98214' },
        patient_id: { type: 'string', example: 'patient-42119' },
      },
    },
  })
  async receiveDentBooking(
    @Body() body: DentBookingPayload,
    @Headers('authorization') authHeader?: string,
    @Headers('x-api-key') apiKeyHeader?: string,
    @Headers('x-crm-api-key') crmApiKeyHeader?: string,
  ) {
    const isAuthorized = this.webhooksService.validateAuth(authHeader, apiKeyHeader || crmApiKeyHeader);
    if (!isAuthorized) {
      throw new UnauthorizedException("Noto'g'ri yoki yaroqsiz API kalit!");
    }

    return this.webhooksService.handleDentBooking(body);
  }

  // Fallback aliases for maximum compatibility
  @Post('booking')
  async receiveBookingAlias(
    @Body() body: DentBookingPayload,
    @Headers('authorization') authHeader?: string,
    @Headers('x-api-key') apiKeyHeader?: string,
    @Headers('x-crm-api-key') crmApiKeyHeader?: string,
  ) {
    return this.receiveDentBooking(body, authHeader, apiKeyHeader, crmApiKeyHeader);
  }
}
