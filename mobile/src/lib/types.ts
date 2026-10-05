export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: string;
  clinic_id: string;
};

export type SessionClinic = {
  id: string;
  name: string;
  status: string;
  plan: string;
};

export type Session = {
  user: SessionUser;
  clinic: SessionClinic;
};

export type AppointmentRow = {
  id: string;
  patient_name?: string | null;
  doctor_name?: string | null;
  date?: string | null;
  time?: string | null;
  status?: string | null;
  service_name?: string | null;
  clinic_id?: string | null;
};

export type PatientRow = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  status?: string | null;
  clinic_id?: string | null;
};
