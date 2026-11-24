import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, TitleBlock } from '@/components/Screen';
import { Card, EmptyState, ErrorBox, LoadingState, Pill, statusTone } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { listAppointments, listPatients, listPayments } from '@/api/crm';
import { buildDashboard } from '@/lib/stats';
import { formatLongDate, tashkentToday } from '@/lib/dates';
import { formatSom } from '@/lib/format';
import { errorText, useI18n } from '@/i18n';
import { useLoader } from '@/hooks/useLoader';
import { colors } from '@/theme';

export default function HomeScreen() {
  const { user, clinic } = useAuth();
  const { t } = useI18n();
  const { data, error, loading, refreshing, reload } = useLoader(async () => {
    const [appointments, payments, patients] = await Promise.all([listAppointments(), listPayments(), listPatients()]);
    return buildDashboard({ today: tashkentToday(), appointments, payments, patients });
  });
  const name = (user?.full_name || user?.name || '').split(' ')[0];

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void reload(); }}>
      <TitleBlock title={`${t.home.hello}${name ? `, ${name}` : ''}`} subtitle={`${clinic?.name || ''} · ${formatLongDate(tashkentToday(), t.locale)}`} />
      {loading && !data ? <LoadingState /> : null}
      {error ? <ErrorBox message={errorText(error, t)} onRetry={() => { void reload(); }} retryLabel={t.common.retry} /> : null}
      {data ? (
        <>
          <View style={styles.grid}>
            <Metric label={t.home.appointments} value={String(data.todayAppointments.length)} />
            <Metric label={t.home.revenue} value={formatSom(data.todayRevenue, t.common.currency)} />
            <Metric label={t.home.patients} value={String(data.patientCount)} />
            <Metric label={t.home.debt} value={formatSom(data.debtTotal, t.common.currency)} hint={String(data.debtCount)} />
          </View>
          <Text style={styles.section}>{t.home.week}: {formatSom(data.weekRevenue, t.common.currency)}</Text>
          <Card>
            <Text style={styles.kicker}>{t.home.next}</Text>
            {data.next ? (
              <Pressable onPress={() => data.next?.patient_id ? router.push(`/patient/${data.next.patient_id}`) : router.push('/appointments')}>
                <Text style={styles.nextName}>{data.next.patient_name || t.common.patient}</Text>
                <Text style={styles.meta}>{data.next.time} · {data.next.service_name || data.next.doctor_name || ''}</Text>
              </Pressable>
            ) : <Text style={styles.meta}>{t.home.noNext}</Text>}
          </Card>
          <View style={styles.row}>
            <Text style={styles.section}>{t.home.schedule}</Text>
            <Pressable onPress={() => router.push('/doctors')}><Text style={styles.link}>{t.home.doctors}</Text></Pressable>
          </View>
          {data.todayAppointments.length === 0 ? <EmptyState title={t.home.empty} /> : data.todayAppointments.map((item) => (
            <Card key={item.id}>
              <View style={styles.row}>
                <Text style={styles.time}>{item.time || '—'}</Text>
                <Pill label={t.status[item.status] || item.status} tone={statusTone(item.status)} />
              </View>
              <Text style={styles.nextName}>{item.patient_name}</Text>
              <Text style={styles.meta}>{[item.service_name, item.doctor_name].filter(Boolean).join(' · ')}</Text>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
      {hint ? <Text style={styles.meta}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { backgroundColor: colors.card, borderRadius: 18, flexBasis: '47%', flexGrow: 1, gap: 4, padding: 14 },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  section: { color: colors.text, fontSize: 16, fontWeight: '800' },
  kicker: { color: colors.brandDark, fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  nextName: { color: colors.text, fontSize: 17, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.brandDark, fontSize: 16, fontWeight: '800' },
  link: { color: colors.brandDark, fontSize: 14, fontWeight: '800' },
});
