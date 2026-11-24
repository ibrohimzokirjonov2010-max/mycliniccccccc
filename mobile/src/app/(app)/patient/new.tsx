import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, BackHeader } from '@/components/Screen';
import { Button, ErrorBox, Field } from '@/components/ui';
import { createPatient, listDoctors } from '@/api/crm';
import { useAuth } from '@/auth/AuthContext';
import { digitsOnly } from '@/lib/format';
import { errorText, useI18n } from '@/i18n';
import { useLoader } from '@/hooks/useLoader';
import { isApiError } from '@/api/errors';
import { colors } from '@/theme';

export default function NewPatientScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const doctors = useLoader(listDoctors);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [doctorId, setDoctorId] = useState(user?.role === 'doctor' ? user.id : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError('required');
      return;
    }
    const digits = digitsOnly(phone);
    if (digits.length < 9) {
      setError('phone');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patient = await createPatient({ firstName, lastName, phone: digits, doctorId: doctorId || null });
      router.replace(`/patient/${patient.id}`);
    } catch (caught) {
      setError(isApiError(caught) ? caught.code : 'generic');
    } finally {
      setSaving(false);
    }
  };

  const choices = (doctors.data || []).filter((doctor) => doctor.role === 'doctor');

  return (
    <Screen footer={<Button label={t.common.save} onPress={() => { void save(); }} loading={saving} />}>
      <BackHeader title={t.patients.newTitle} />
      <Field label={t.patients.firstName} value={firstName} onChangeText={setFirstName} />
      <Field label={t.patients.lastName} value={lastName} onChangeText={setLastName} />
      <Field label={t.patients.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+998" />
      {choices.length ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t.common.doctor}</Text>
          <View style={styles.wrap}>
            {choices.map((doctor) => {
              const selected = doctorId === doctor.id;
              return (
                <Pressable accessibilityRole="button" key={doctor.id} onPress={() => setDoctorId(doctor.id)} style={[styles.chip, selected && styles.chipOn]}>
                  <Text style={[styles.chipText, selected && styles.chipTextOn]}>{doctor.full_name || doctor.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      {error ? <ErrorBox message={errorText(error, t)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.brand },
  chipText: { color: colors.text, fontWeight: '700' },
  chipTextOn: { color: '#fff' },
});
