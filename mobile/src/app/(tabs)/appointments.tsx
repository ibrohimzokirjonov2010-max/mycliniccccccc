import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/state-view';
import { StatusPill } from '@/components/status-pill';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import type { AppointmentRow } from '@/lib/types';

const LIMIT = 200;

export default function AppointmentsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error: queryError } = await supabase
      .from('appointments')
      .select('id,patient_name,doctor_name,date,time,status,service_name,clinic_id')
      .eq('clinic_id', session.user.clinic_id)
      .order('date', { ascending: false })
      .limit(LIMIT);

    if (queryError) {
      setError(queryError.message || "Qabullarni yuklab bo'lmadi");
      setRows([]);
      return;
    }
    setError('');
    const list = (data ?? []) as AppointmentRow[];
    list.sort((a, b) => {
      const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(a.time || '').localeCompare(String(b.time || ''));
    });
    setRows(list);
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.patient_name, row.doctor_name, row.service_name, row.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, rows]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Qabullar</Text>
      <Text style={styles.subtitle}>{session?.clinic.name}</Text>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Bemor, shifokor yoki xizmat"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          autoCapitalize="none"
        />
      </View>
      {loading ? <LoadingState /> : null}
      {!loading && error ? (
        <View style={styles.pad}>
          <ErrorState
            message={error}
            onRetry={() => {
              setLoading(true);
              load().finally(() => setLoading(false));
            }}
          />
        </View>
      ) : null}
      {!loading && !error ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }} tintColor={colors.teal} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title={query ? 'Hech narsa topilmadi' : "Qabullar yo'q"}
              body={query ? "Boshqa so'z bilan qidirib ko'ring." : "Bu klinika uchun qabullar hali yo'q."}
            />
          }
          ListFooterComponent={
            rows.length >= LIMIT ? <Text style={styles.footer}>So'nggi {LIMIT} ta yozuv ko'rsatilmoqda.</Text> : null
          }
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={styles.row}>
                <Text style={styles.patient}>{item.patient_name || 'Bemor'}</Text>
                <StatusPill status={item.status} />
              </View>
              <Text style={styles.meta}>
                {[formatDate(item.date), item.time].filter(Boolean).join(' · ') || "Sana ko'rsatilmagan"}
              </Text>
              <Text style={styles.meta}>
                {[item.service_name, item.doctor_name].filter(Boolean).join(' · ') || "Tafsilot yo'q"}
              </Text>
            </View>
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontWeight: '600',
    marginBottom: 12,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    minHeight: 46,
    color: colors.ink,
    fontWeight: '600',
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  pad: {
    paddingTop: 8,
  },
  item: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  patient: {
    flex: 1,
    color: colors.ink,
    fontWeight: '700',
    fontSize: 16,
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  footer: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    paddingVertical: 8,
  },
});
