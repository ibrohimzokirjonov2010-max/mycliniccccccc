export type CrmUser = {
  id: string;
  username: string;
  name: string;
  full_name: string;
  role: string;
  clinic_id: string;
  phone?: string | null;
  specialty?: string | null;
};

export type CrmClinic = {
  id: string;
  name: string;
  status?: string | null;
  plan?: string | null;
  expires_at?: string | null;
};

export type Patient = {
  id: string;
  full_name: string;
  phone: string;
  status: string;
  total_debt: number;
  total_paid: number;
  notes?: string | null;
  created_date?: string | null;
  first_name?: string;
  last_name?: string;
  main_treatment_provider?: string | null;
  created_by_id?: string | null;
};

export type Appointment = {
  id: string;
  patient_id?: string | null;
  patient_name: string;
  patient_phone?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  date: string;
  time: string;
  status: string;
  service_name?: string | null;
  price?: number;
  duration?: number;
  notes?: string | null;
};

export type Payment = {
  id: string;
  patient_id?: string | null;
  patient_name: string;
  amount: number;
  type: string;
  method?: string | null;
  date?: string | null;
  category?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  notes?: string | null;
};

export type Doctor = {
  id: string;
  name: string;
  full_name: string;
  role: string;
  phone?: string | null;
  specialty?: string | null;
};

export type ServiceItem = {
  id: string;
  name: string;
  price: number;
};

export type AuthSnapshot = {
  user: CrmUser;
  clinic: CrmClinic;
};
