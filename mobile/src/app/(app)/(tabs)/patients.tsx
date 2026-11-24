import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, TitleBlock } from '@/components/Screen';
import { Avatar, Button, Card, EmptyState, ErrorBox, Field, LoadingState, Pill, statusTone } from '@/components/ui';
import { listPatients } from '@/api/crm';
import { formatPhone, formatSom, initials } from '@/lib/format';
import { errorText, useI18n } from '@/i18n';
import { useLoader } from '@/hooks/useLoader';
import { colors } from '@/theme';

export default function PatientsScreen() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const { data, error, loading, refreshing, reload } = useLoader(listPatients);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data || []).filter((patient) => {
      if (!needle) return true;
      return patient.full_name.toLowerCase().includes(needle) || patient.phone.includes(needle);
    });
  }, [data, query]);

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void reload(); }}>
      <TitleBlock title={t.patients.title} subtitle={data ? String(filtered.length) : undefined} action={<Button label={t.common.add} onPress={() => router.push('/patient/new')} />} />
      <Field label={t.common.search} value={query} onChangeText={setQuery} placeholder={t.patients.search} />
      {loading && !data ? <LoadingState /> : null}
      {error ? <ErrorBox message={errorText(error, t)} onRetry={() => { void reload(); }} retryLabel={t.common.retry} /> : null}
      {!loading && filtered.length === 0 ? <EmptyState title={t.patients.empty} /> : null}
      {filtered.map((patient) => (
        <Pressable accessibilityRole="button" key={patient.id} onPress={() => router.push(`/patient/${patient.id}`)}>
          <Card>
            <View style={styles.row}>
              <Avatar label={initials(patient.full_name)} />
              <View style={styles.copy}>
                <Text style={styles.name} numberOfLines={1}>{patient.full_name || t.common.patient}</Text>
                <Text style={styles.meta}>{patient.phone ? formatPhone(patient.phone) : t.patients.none}</Text>
              </View>
              <Pill label={t.status[patient.status] || patient.status} tone={statusTone(patient.status)} />
            </View>
            {patient.total_debt > 0 ? <Text style={styles.debt}>{t.patients.debt}: {formatSom(patient.total_debt, t.common.currency)}</Text> : null}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  copy: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  debt: { color: colors.warning, fontSize: 13, fontWeight: '700' },
});
