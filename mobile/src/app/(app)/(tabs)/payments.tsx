import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, TitleBlock } from '@/components/Screen';
import { Button, Card, EmptyState, ErrorBox, LoadingState, Pill } from '@/components/ui';
import { listPayments } from '@/api/crm';
import { dateKey, formatShortDate, tashkentToday } from '@/lib/dates';
import { formatSom } from '@/lib/format';
import { errorText, useI18n } from '@/i18n';
import { useLoader } from '@/hooks/useLoader';
import { colors } from '@/theme';

export default function PaymentsScreen() {
  const { t } = useI18n();
  const { data, error, loading, refreshing, reload } = useLoader(listPayments);
  const today = tashkentToday();
  const income = (data || []).filter((item) => item.type.toLowerCase() === 'income');
  const todaySum = income.filter((item) => dateKey(item.date) === today).reduce((sum, item) => sum + item.amount, 0);
  const methodLabel = (method?: string | null) => {
    if (method === 'Cash') return t.payments.cash;
    if (method === 'Card') return t.payments.card;
    if (method === 'Transfer') return t.payments.transfer;
    return method || '';
  };

  return (
    <Screen refreshing={refreshing} onRefresh={() => { void reload(); }}>
      <TitleBlock title={t.payments.title} action={<Button label={t.common.add} onPress={() => router.push('/payment/new')} />} />
      <Card>
        <Text style={styles.kicker}>{t.payments.today}</Text>
        <Text style={styles.amount}>{formatSom(todaySum, t.common.currency)}</Text>
      </Card>
      {loading && !data ? <LoadingState /> : null}
      {error ? <ErrorBox message={errorText(error, t)} onRetry={() => { void reload(); }} retryLabel={t.common.retry} /> : null}
      {!loading && (data || []).length === 0 ? <EmptyState title={t.payments.empty} /> : null}
      {(data || []).map((item) => (
        <Card key={item.id}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{item.patient_name || t.common.patient}</Text>
            <Text style={styles.money}>{formatSom(item.amount, t.common.currency)}</Text>
          </View>
          <View style={styles.row}>
            <Pill label={t.status[item.type] || item.type} tone={item.type.toLowerCase() === 'income' ? 'good' : 'warn'} />
            <Text style={styles.meta}>{[formatShortDate(item.date || '', t.locale), methodLabel(item.method)].filter(Boolean).join(' · ')}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  amount: { color: colors.text, fontSize: 28, fontWeight: '800' },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800' },
  money: { color: colors.brandDark, fontSize: 14, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600' },
});
