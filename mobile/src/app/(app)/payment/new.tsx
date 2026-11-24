import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, BackHeader } from '@/components/Screen';
import { Button, ErrorBox, Field } from '@/components/ui';
import { createPayment, listDoctors, listPatients } from '@/api/crm';
import { useAuth } from '@/auth/AuthContext';
import { errorText, useI18n } from '@/i18n';
import { useLoader } from '@/hooks/useLoader';
import { isApiError } from '@/api/errors';
import { colors } from '@/theme';

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default function NewPaymentScreen() {
  const params = useLocalSearchParams<{ patientId?: string }>();
  const { t } = useI18n();
  const { user } = useAuth();
  const bundle = useLoader(async () => {
    const [patients, doctors] = await Promise.all([listPatients(), listDoctors()]);
    return { patients, doctors: doctors.filter((doctor) => doctor.role === 'doctor') };
  });
  const [patientId, setPatientId] = useState(one(params.patientId));
  const [doctorId, setDoctorId] = useState(user?.role === 'doctor' ? user.id : '');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'Cash' | 'Card' | 'Transfer'>('Cash');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const methods = [
    { id: 'Cash' as const, label: t.payments.cash },
    { id: 'Card' as const, label: t.payments.card },
    { id: 'Transfer' as const, label: t.payments.transfer },
  ];

  const save = async () => {
    const patient = bundle.data?.patients.find((item) => item.id === patientId);
    const value = Number(amount.replace(/\s/g, ''));
    if (!patient) {
      setError('required');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('amount');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const doctor = bundle.data?.doctors.find((item) => item.id === doctorId) || null;
      await createPayment({ patient, amount: value, method, doctor });
      router.back();
    } catch (caught) {
      setError(isApiError(caught) ? caught.code : 'generic');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen footer={<Button label={t.common.save} onPress={() => { void save(); }} loading={saving} />}>
      <BackHeader title={t.payments.newTitle} />
      {bundle.error ? <ErrorBox message={errorText(bundle.error, t)} onRetry={() => { void bundle.reload(); }} retryLabel={t.common.retry} /> : null}
      <Text style={styles.label}>{t.appointments.pickPatient}</Text>
      <View style={styles.wrap}>
        {(bundle.data?.patients || []).map((patient) => (
          <Pressable accessibilityRole="button" key={patient.id} onPress={() => setPatientId(patient.id)} style={[styles.chip, patientId === patient.id && styles.chipOn]}>
            <Text style={[styles.chipText, patientId === patient.id && styles.chipTextOn]}>{patient.full_name}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>{t.payments.method}</Text>
      <View style={styles.wrap}>
        {methods.map((item) => (
          <Pressable accessibilityRole="button" key={item.id} onPress={() => setMethod(item.id)} style={[styles.chip, method === item.id && styles.chipOn]}>
            <Text style={[styles.chipText, method === item.id && styles.chipTextOn]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Field label={t.payments.amount} value={amount} onChangeText={setAmount} keyboardType="numeric" />
      <Text style={styles.label}>{t.common.doctor}</Text>
      <View style={styles.wrap}>
        {(bundle.data?.doctors || []).map((doctor) => (
          <Pressable accessibilityRole="button" key={doctor.id} onPress={() => setDoctorId(doctor.id)} style={[styles.chip, doctorId === doctor.id && styles.chipOn]}>
            <Text style={[styles.chipText, doctorId === doctor.id && styles.chipTextOn]}>{doctor.full_name || doctor.name}</Text>
          </Pressable>
        ))}
      </View>
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
