import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, TitleBlock } from '@/components/Screen';
import { Button, Card, EmptyState, ErrorBox, LoadingState, Pill, statusTone } from '@/components/ui';
import { listAppointments, setAppointmentStatus } from '@/api/crm';
import { addDays, tashkentToday, weekdayShort } from '@/lib/dates';
import { errorText, useI18n } from '@/i18n';
import { useLoader } from '@/hooks/useLoader';
import { colors } from '@/theme';

export default function AppointmentsScreen() {
  const { t } = useI18n();
  const today = tashkentToday();
  const [day, setDay] = useState(today);
  const { data, error, loading, refreshing, reload } = useLoader(listAppointments);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(today, index - 1)), [today]);
  const rows = (data || []).filter((item) => item.date === day);

  const update = async (id: string, status: 'Completed' | 'Cancelled') => {
    await setAppointmentStatus(id, status);
    await reload();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void reload(); }}>
      <TitleBlock title={t.appointments.title} action={<Button label={t.common.add} onPress={() => router.push(`/appointment/new?date=${day}`)} />} />
      <View style={styles.days}>
        {days.map((item) => {
          const selected = item === day;
          return (
            <Pressable accessibilityRole="button" key={item} onPress={() => setDay(item)} style={[styles.day, selected && styles.dayOn]}>
              <Text style={[styles.week, selected && styles.dayOnText]}>{weekdayShort(item, t.locale)}</Text>
              <Text style={[styles.num, selected && styles.dayOnText]}>{item.slice(8)}</Text>
            </Pressable>
          );
        })}
      </View>
      {loading && !data ? <LoadingState /> : null}
      {error ? <ErrorBox message={errorText(error, t)} onRetry={() => { void reload(); }} retryLabel={t.common.retry} /> : null}
      {!loading && rows.length === 0 ? <EmptyState title={t.appointments.empty} /> : null}
      {rows.map((item) => (
        <Card key={item.id}>
          <View style={styles.row}>
            <Text style={styles.time}>{item.time || '—'}</Text>
            <Pill label={t.status[item.status] || item.status} tone={statusTone(item.status)} />
          </View>
          <Pressable onPress={() => item.patient_id ? router.push(`/patient/${item.patient_id}`) : undefined}>
            <Text style={styles.name}>{item.patient_name}</Text>
          </Pressable>
          <Text style={styles.meta}>{[item.service_name, item.doctor_name].filter(Boolean).join(' · ')}</Text>
          {['completed', 'cancelled', 'canceled'].includes(item.status.toLowerCase()) ? null : (
            <View style={styles.actions}>
              <Button label={t.appointments.complete} onPress={() => { void update(item.id, 'Completed'); }} />
              <Button label={t.appointments.cancelVisit} tone="ghost" onPress={() => { void update(item.id, 'Cancelled'); }} />
            </View>
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: 'row', gap: 6 },
  day: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, flex: 1, paddingVertical: 8 },
  dayOn: { backgroundColor: colors.brand },
  week: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  num: { color: colors.text, fontSize: 15, fontWeight: '800' },
  dayOnText: { color: '#fff' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.brandDark, fontSize: 16, fontWeight: '800' },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  actions: { gap: 8 },
});
