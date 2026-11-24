import { Linking, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen, BackHeader } from '@/components/Screen';
import { Button, Card, EmptyState, ErrorBox, LoadingState, Pill, statusTone } from '@/components/ui';
import { getPatient, listAppointments } from '@/api/crm';
import { formatPhone, formatSom } from '@/lib/format';
import { formatShortDate } from '@/lib/dates';
import { errorText, useI18n } from '@/i18n';
import { useLoader } from '@/hooks/useLoader';
import { colors } from '@/theme';

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = one(id);
  const { t } = useI18n();
  const { data, error, loading, refreshing, reload } = useLoader(async () => {
    const [patient, appointments] = await Promise.all([getPatient(patientId), listAppointments()]);
    return { patient, visits: appointments.filter((item) => item.patient_id === patientId) };
  });
  const patient = data?.patient;

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void reload(); }}>
      <BackHeader title={patient?.full_name || t.patients.title} />
      {loading && !data ? <LoadingState /> : null}
      {error ? <ErrorBox message={errorText(error, t)} onRetry={() => { void reload(); }} retryLabel={t.common.retry} /> : null}
      {!loading && data && !patient ? <EmptyState title={t.patients.empty} /> : null}
      {patient ? (
        <>
          <Card>
            <View style={styles.row}>
              <Text style={styles.meta}>{patient.phone ? formatPhone(patient.phone) : t.patients.none}</Text>
              <Pill label={t.status[patient.status] || patient.status} tone={statusTone(patient.status)} />
            </View>
            <Text style={styles.line}>{t.patients.debt}: {formatSom(patient.total_debt, t.common.currency)}</Text>
            <Text style={styles.line}>{t.patients.paid}: {formatSom(patient.total_paid, t.common.currency)}</Text>
          </Card>
          <View style={styles.actions}>
            {patient.phone ? <Button label={t.common.call} tone="ghost" onPress={() => { void Linking.openURL(`tel:${patient.phone}`); }} /> : null}
            <Button label={t.patients.book} onPress={() => router.push(`/appointment/new?patientId=${patient.id}`)} />
            <Button label={t.patients.pay} onPress={() => router.push(`/payment/new?patientId=${patient.id}`)} />
          </View>
          <Text style={styles.section}>{t.patients.visits}</Text>
          {data?.visits.length ? data.visits.map((visit) => (
            <Card key={visit.id}>
              <Text style={styles.line}>{formatShortDate(visit.date, t.locale)} · {visit.time}</Text>
              <Text style={styles.meta}>{visit.service_name || visit.status}</Text>
            </Card>
          )) : <EmptyState title={t.appointments.empty} />}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  line: { color: colors.text, fontSize: 15, fontWeight: '700' },
  actions: { gap: 8 },
  section: { color: colors.text, fontSize: 16, fontWeight: '800' },
});
