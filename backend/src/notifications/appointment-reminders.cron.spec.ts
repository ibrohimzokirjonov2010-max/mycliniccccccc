import { AppointmentRemindersCron } from './appointment-reminders.cron';

const execResult = <T>(value: T) => ({
  exec: jest.fn().mockResolvedValue(value),
});

describe('AppointmentRemindersCron', () => {
  let cron: AppointmentRemindersCron;
  let appointmentModel: any;
  let patientModel: any;
  let clinicModel: any;
  let userModel: any;
  let telegramService: any;
  let smsService: any;

  const createAppointment = (overrides: Record<string, any> = {}) => ({
    _id: 'appt-1',
    patient_id: 'patient-1',
    clinic_id: 'clinic-1',
    patient_name: 'Ali Valiyev',
    doctor_name: 'Dr Test',
    date: '2026-06-28',
    time: '10:00',
    status: 'scheduled',
    confirmation_status: 'pending',
    pre_reminder_sent: false,
    current_reminder_sent: false,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  const mockReminderQueries = ({
    apps2H = [],
    appsNow = [],
  }: {
    apps2H?: any[];
    appsNow?: any[];
  }) => {
    appointmentModel.find.mockImplementation((query: Record<string, any>) => {
      if ('pre_reminder_sent' in query) {
        return execResult(apps2H);
      }

      if ('current_reminder_sent' in query) {
        return execResult(appsNow);
      }

      return execResult([]);
    });
  };

  const mockRelatedData = ({
    patients = {},
    clinic = { name: 'Shifo Dent' },
    doctor = null,
  }: {
    patients?: Record<string, any>;
    clinic?: any;
    doctor?: any;
  } = {}) => {
    patientModel.findById.mockImplementation((patientId: string) =>
      execResult(patients[patientId] || null),
    );
    clinicModel.findOne.mockReturnValue(execResult(clinic));
    userModel.findOne.mockReturnValue(execResult(doctor));
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-28T05:00:00.000Z'));

    appointmentModel = { find: jest.fn() };
    patientModel = { findById: jest.fn() };
    clinicModel = { findOne: jest.fn() };
    userModel = { findOne: jest.fn() };
    telegramService = {
      sendMessage: jest.fn().mockResolvedValue(true),
      sendAppointmentConfirmationMessage: jest.fn().mockResolvedValue(501),
      syncAppointmentConfirmationToSupabase: jest.fn().mockResolvedValue(undefined),
    };
    smsService = {
      getSettings: jest.fn().mockReturnValue({
        sms_enabled: true,
        on_appointment_day: true,
        on_appointment_day_time: '08:00',
        on_day_before: true,
        on_day_before_time: '08:00',
        birthday_greetings: true,
        recall_reminder: true,
        debt_reminder: true,
      }),
      sendAppointmentDaySms: jest.fn().mockResolvedValue(true),
      sendDayBeforeReminderSms: jest.fn().mockResolvedValue(true),
      sendSms: jest.fn().mockResolvedValue(true),
    };

    cron = new AppointmentRemindersCron(
      appointmentModel,
      patientModel,
      clinicModel,
      userModel,
      telegramService,
      smsService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('2 soat oldingi confirmation xabarini yuboradi va appointment ni yangilaydi', async () => {
    const appointment = createAppointment({ time: '12:00' });

    mockReminderQueries({ apps2H: [appointment] });
    mockRelatedData({
      patients: {
        'patient-1': { telegram_chat_id: 'chat-1' },
      },
    });

    await cron.handleRealtimeReminders();

    expect(telegramService.sendAppointmentConfirmationMessage).toHaveBeenCalledWith(
      'chat-1',
      appointment,
    );
    expect(appointment.pre_reminder_sent).toBe(true);
    expect(appointment.confirmation_status).toBe('pending');
    expect(telegramService.syncAppointmentConfirmationToSupabase).toHaveBeenCalledWith(
      appointment,
      expect.objectContaining({
        confirmation_status: 'pending',
        confirmation_message_id: 501,
      }),
    );
  });

  it('Telegram ulanmagan bemorda 2 soatlik reminder ni qayta urinmaslik uchun belgilaydi', async () => {
    const appointment = createAppointment({ time: '12:00' });

    mockReminderQueries({ apps2H: [appointment] });
    mockRelatedData({
      patients: {
        'patient-1': { _id: 'patient-1' },
      },
    });

    await cron.handleRealtimeReminders();

    expect(telegramService.sendAppointmentConfirmationMessage).not.toHaveBeenCalled();
    expect(appointment.pre_reminder_sent).toBe(true);
    expect(appointment.save).toHaveBeenCalledTimes(1);
  });

  it('Tasdiqlangan qabul uchun hozirgi vaqtdagi bemor va doktor xabarlarini yuboradi', async () => {
    const appointment = createAppointment({ confirmation_status: 'confirmed' });

    mockReminderQueries({ appsNow: [appointment] });
    mockRelatedData({
      patients: {
        'patient-1': { telegram_chat_id: 'patient-chat-1' },
      },
      doctor: { telegram_chat_id: 'doctor-chat-1' },
    });

    await cron.handleRealtimeReminders();

    expect(telegramService.sendMessage).toHaveBeenCalledTimes(2);
    expect(telegramService.sendMessage).toHaveBeenNthCalledWith(
      1,
      'patient-chat-1',
      expect.stringContaining('SIZNING VAQTINGIZ KELDI'),
    );
    expect(telegramService.sendMessage).toHaveBeenNthCalledWith(
      2,
      'doctor-chat-1',
      expect.stringContaining('YANGI BEMOR'),
    );
    expect(appointment.current_reminder_sent).toBe(true);
  });

  it('Pending qabulni no_response ga o‘tkazadi va baribir hozirgi reminderlarni yuboradi', async () => {
    const appointment = createAppointment({ confirmation_status: 'pending' });

    mockReminderQueries({ appsNow: [appointment] });
    mockRelatedData({
      patients: {
        'patient-1': { telegram_chat_id: 'patient-chat-1' },
      },
      doctor: { telegram_chat_id: 'doctor-chat-1' },
    });

    await cron.handleRealtimeReminders();

    expect(appointment.confirmation_status).toBe('no_response');
    expect(telegramService.syncAppointmentConfirmationToSupabase).toHaveBeenCalledWith(
      appointment,
      expect.objectContaining({
        confirmation_status: 'no_response',
        confirmation_response_channel: 'system',
      }),
    );
    expect(telegramService.sendMessage).toHaveBeenCalledTimes(2);
    expect(appointment.current_reminder_sent).toBe(true);
  });

  it('Declined qabul uchun hozirgi xabarlarni yubormaydi', async () => {
    const appointment = createAppointment({ confirmation_status: 'declined' });

    mockReminderQueries({ appsNow: [appointment] });
    mockRelatedData();

    await cron.handleRealtimeReminders();

    expect(telegramService.sendMessage).not.toHaveBeenCalled();
    expect(appointment.current_reminder_sent).toBe(true);
    expect(appointment.save).toHaveBeenCalledTimes(1);
  });
});
