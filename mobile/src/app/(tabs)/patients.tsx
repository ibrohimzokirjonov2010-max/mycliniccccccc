import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/state-view';
import { StatusPill } from '@/components/status-pill';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { patientName } from '@/lib/labels';
import { supabase } from '@/lib/supabase';
import type { PatientRow } from '@/lib/types';

const LIMIT = 300;

export default function PatientsScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [rows, setRows] = useState<PatientRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    const { data, error: queryError } = await supabase
      .from('patients')
      .select('id,full_name,first_name,last_name,phone,status,clinic_id')
      .eq('clinic_id', session.user.clinic_id)
      .limit(LIMIT);

    if (queryError) {
      setError(queryError.message || "Bemorlarni yuklab bo'lmadi");
      setRows([]);
      return;
    }
    const list = (data ?? []) as PatientRow[];
    list.sort((a, b) => patientName(a).localeCompare(patientName(b), 'uz'));
    setError('');
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
      [patientName(row), row.phone].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, rows]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Bemorlar</Text>
      <Text style={styles.subtitle}>
        {loading ? 'Yuklanmoqda...' : `${rows.length} ta yozuv`}
      </Text>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ism yoki telefon"
          placeholderTextColor="#94A3B8"
          style={styles.input}
          autoCapitalize="none"
        />
      </View>
      {loading ? <LoadingState /> : null}
      {!loading && error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            load().finally(() => setLoading(false));
          }}
        />
      ) : null}
      {!loading && !error ? (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.teal}
            />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title={query ? 'Bemor topilmadi' : "Bemorlar yo'q"}
              body={query ? "Boshqa so'z bilan qidirib ko'ring." : "Bu klinika uchun bemorlar hali yo'q."}
            />
          }
          ListFooterComponent={
            rows.length >= LIMIT ? <Text style={styles.footer}>So'nggi {LIMIT} ta yozuv ko'rsatilmoqda.</Text> : null
          }
          renderItem={({ item }) => {
            const name = patientName(item);
            return (
              <View style={styles.item}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.body}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.phone}>{item.phone || "Telefon yo'q"}</Text>
                </View>
                <StatusPill status={item.status} />
              </View>
            );
          }}
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
  item: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.tealDark,
    fontWeight: '800',
    fontSize: 16,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 16,
  },
  phone: {
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
