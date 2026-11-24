import { Linking, StyleSheet, Text, View } from 'react-native';
import { Screen, BackHeader } from '@/components/Screen';
import { Avatar, Card, EmptyState, ErrorBox, LoadingState } from '@/components/ui';
import { listDoctors } from '@/api/crm';
import { formatPhone, initials } from '@/lib/format';
import { errorText, useI18n } from '@/i18n';
import { useLoader } from '@/hooks/useLoader';
import { colors } from '@/theme';

export default function DoctorsScreen() {
  const { t } = useI18n();
  const { data, error, loading, refreshing, reload } = useLoader(async () => {
    const rows = await listDoctors();
    return rows.filter((doctor) => doctor.role === 'doctor');
  });
  return (
    <Screen refreshing={refreshing} onRefresh={() => { void reload(); }}>
      <BackHeader title={t.doctors.title} />
      {loading && !data ? <LoadingState /> : null}
      {error ? <ErrorBox message={errorText(error, t)} onRetry={() => { void reload(); }} retryLabel={t.common.retry} /> : null}
      {!loading && (data || []).length === 0 ? <EmptyState title={t.doctors.empty} /> : null}
      {(data || []).map((doctor) => (
        <Card key={doctor.id}>
          <View style={styles.row}>
            <Avatar label={initials(doctor.full_name || doctor.name)} />
            <View style={styles.copy}>
              <Text style={styles.name}>{doctor.full_name || doctor.name}</Text>
              <Text style={styles.meta}>{doctor.specialty || t.doctors.specialty}</Text>
              {doctor.phone ? (
                <Text style={styles.link} onPress={() => { void Linking.openURL(`tel:${doctor.phone}`); }}>{formatPhone(doctor.phone)}</Text>
              ) : null}
            </View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  copy: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  link: { color: colors.brandDark, fontSize: 13, fontWeight: '800' },
});
