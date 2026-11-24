import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, BackHeader } from '@/components/Screen';
import { Button, ErrorBox, Field } from '@/components/ui';
import { createAppointment, listDoctors, listPatients, listServices } from '@/api/crm';
import { useAuth } from '@/auth/AuthContext';
import { tashkentToday } from '@/lib/dates';
import { errorText, useI18n } from '@/i18n';
import { useLoader } from '@/hooks/useLoader';
import { isApiError } from '@/api/errors';
import { colors } from '@/theme';

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

const TIMES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

export default function NewAppointmentScreen() {
  const params = useLocalSearchParams<{ date?: string; patientId?: string }>();
  const { t } = useI18n();
  const { user } = useAuth();
  const bundle = useLoader(async () => {
    const [patients, doctors, services] = await Promise.all([listPatients(), listDoctors(), listServices()]);
    return { patients, doctors: doctors.filter((doctor) => doctor.role === 'doctor'), services };
  });
  const [patientId, setPatientId] = useState(one(params.patientId));
  const [doctorId, setDoctorId] = useState(user?.role === 'doctor' ? user.id : '');
  const [date, setDate] = useState(one(params.date) || tashkentToday());
  const [time, setTime] = useState('10:00');
  const [serviceName, setServiceName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const patient = bundle.data?.patients.find((item) => item.id === patientId);
    if (!patient) {
      setError('required');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      setError('time');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const doctor = bundle.data?.doctors.find((item) => item.id === doctorId) || null;
      await createAppointment({
        patient,
        doctor,
        date,
        time,
        serviceName: serviceName.trim(),
        price: Number(price.replace(/\s/g, '')) || 0,
      });
      router.back();
    } catch (caught) {
      setError(isApiError(caught) ? caught.code : 'generic');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button label={t.common.save} onPress={() => { void save(); }} loading={saving} />}>
      <BackHeader title={t.appointments.newTitle} />
      {bundle.error ? <ErrorBox message={errorText(bundle.error, t)} onRetry={() => { void bundle.reload(); }} retryLabel={t.common.retry} /> : null}
      <Text style={styles.label}>{t.appointments.pickPatient}</Text>
      <View style={styles.wrap}>
        {(bundle.data?.patients || []).map((patient) => (
          <Pressable accessibilityRole="button" key={patient.id} onPress={() => setPatientId(patient.id)} style={[styles.chip, patientId === patient.id && styles.chipOn]}>
            <Text style={[styles.chipText, patientId === patient.id && styles.chipTextOn]}>{patient.full_name}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t.appointments.pickDoctor}</Text>
      <View style={styles.wrap}>
        {(bundle.data?.doctors || []).map((doctor) => (
          <Pressable accessibilityRole="button" key={doctor.id} onPress={() => setDoctorId(doctor.id)} style={[styles.chip, doctorId === doctor.id && styles.chipOn]}>
            <Text style={[styles.chipText, doctorId === doctor.id && styles.chipTextOn]}>{doctor.full_name || doctor.name}</Text>
          </Pressable>
        ))}
      </View>
      <Field label={t.home.today} value={date} onChangeText={setDate} autoCapitalize="none" placeholder="YYYY-MM-DD" />
      <Text style={styles.label}>{t.appointments.time}</Text>
      <View style={styles.wrap}>
        {TIMES.map((item) => (
          <Pressable accessibilityRole="button" key={item} onPress={() => setTime(item)} style={[styles.chip, time === item && styles.chipOn]}>
            <Text style={[styles.chipText, time === item && styles.chipTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {(bundle.data?.services || []).length ? (
        <View style={styles.wrap}>
          {bundle.data?.services.slice(0, 12).map((service) => (
            <Pressable accessibilityRole="button" key={service.id} onPress={() => { setServiceName(service.name); if (!price) setPrice(String(service.price || '')); }} style={[styles.chip, serviceName === service.name && styles.chipOn]}>
              <Text style={[styles.chipText, serviceName === service.name && styles.chipTextOn]}>{service.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Field label={t.appointments.service} value={serviceName} onChangeText={setServiceName} />
      <Field label={t.appointments.price} value={price} onChangeText={setPrice} keyboardType="numeric" />
      {error ? <ErrorBox message={errorText(error, t)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.brand },
  chipText: { color: colors.text, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
});
