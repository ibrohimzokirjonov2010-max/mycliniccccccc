import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/state-view';
import { StatusPill } from '@/components/status-pill';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDate, greeting, isWaiting, todayISO } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import type { AppointmentRow } from '@/lib/types';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    const today = todayISO();
    const tomorrow = shiftDate(today, 1);
    const { data, error: queryError } = await supabase
      .from('appointments')
      .select('id,patient_name,doctor_name,date,time,status,service_name,clinic_id')
      .eq('clinic_id', session.user.clinic_id)
      .gte('date', today)
      .lt('date', tomorrow)
      .order('time', { ascending: true });

    if (queryError) {
      setError(queryError.message || "Qabullarni yuklab bo'lmadi");
      setRows([]);
      return;
    }
    setError('');
    setRows((data ?? []) as AppointmentRow[]);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      load().finally(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const waiting = rows.filter((row) => isWaiting(row.status)).length;
  const completed = rows.filter((row) => row.status === 'Completed').length;
  const name = session?.user.name || 'xodim';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: 28 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} />}>
      <Text style={styles.kicker}>{formatDate(todayISO())}</Text>
      <Text style={styles.title}>{greeting(name)}</Text>
      <Text style={styles.clinic}>{session?.clinic.name}</Text>

      <View style={styles.stats}>
        <Stat label="Bugungi qabullar" value={loading ? '—' : String(rows.length)} />
        <Stat label="Kutilmoqda" value={loading ? '—' : String(waiting)} />
        <Stat label="Yakunlangan" value={loading ? '—' : String(completed)} />
      </View>

      <Text style={styles.section}>Bugungi jadval</Text>
      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState message={error} onRetry={() => { setLoading(true); load().finally(() => setLoading(false)); }} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="Bugun qabul yo'q" body="Yangi yozuvlar paydo bo'lsa, bu yerda ko'rinadi." />
      ) : null}
      {!loading && !error
        ? rows.map((row) => (
            <View key={row.id} style={styles.item}>
              <View style={styles.timeCol}>
                <Text style={styles.time}>{row.time || '—'}</Text>
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.patient}>{row.patient_name || 'Bemor'}</Text>
                <Text style={styles.meta}>
                  {[row.service_name, row.doctor_name].filter(Boolean).join(' · ') || 'Qabul'}
                </Text>
              </View>
              <StatusPill status={row.status} />
            </View>
          ))
        : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    gap: 12,
  },
  kicker: {
    color: colors.cyan,
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: '800',
  },
  clinic: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  statValue: {
    color: colors.teal,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
  },
  item: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeCol: {
    minWidth: 52,
  },
  time: {
    color: colors.tealDark,
    fontWeight: '800',
    fontSize: 15,
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  patient: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 15,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
});
