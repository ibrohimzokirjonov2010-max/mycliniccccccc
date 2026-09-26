import Constants from 'expo-constants';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';
import { roleLabel } from '@/lib/labels';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, signOut } = useAuth();
  const name = session?.user.name || 'Xodim';
  const version = Constants.expoConfig?.version || '1.0.0';

  const onLogout = () => {
    Alert.alert('Chiqish', 'Hisobdan chiqmoqchimisiz?', [
      { text: 'Bekor qilish', style: 'cancel' },
      { text: 'Chiqish', style: 'destructive', onPress: () => { void signOut(); } },
    ]);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 }]}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.role}>{roleLabel(session?.user.role)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Klinika</Text>
        <Row label="Nomi" value={session?.clinic.name || '—'} />
        <Row label="ID" value={session?.clinic.id || session?.user.clinic_id || '—'} />
        <Row label="Holat" value={session?.clinic.status || '—'} />
        <Row label="Tarif" value={session?.clinic.plan || '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ilova</Text>
        <Row label="Hisob" value={session?.user.username || '—'} />
        <Row label="Versiya" value={version} />
        <Text style={styles.note}>
          Bu mobil v1: bugungi qabullar, qabullar ro'yxati va bemorlar. To'liq CRM veb-ilovada qoladi.
        </Text>
      </View>

      <Pressable
        onPress={onLogout}
        style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
        accessibilityRole="button">
        <Text style={styles.logoutText}>Chiqish</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  hero: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 26,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '800',
  },
  name: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  role: {
    color: colors.cyan,
    fontWeight: '700',
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  cardTitle: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLabel: {
    color: colors.muted,
    fontWeight: '600',
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    color: colors.ink,
    fontWeight: '700',
  },
  note: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  logout: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 16,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutPressed: {
    opacity: 0.8,
  },
  logoutText: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 16,
  },
});
