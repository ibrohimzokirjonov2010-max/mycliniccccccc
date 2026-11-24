import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Screen, TitleBlock } from '@/components/Screen';
import { Button, Card } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { readDeletionRequest } from '@/api/session';
import { useI18n, type Lang } from '@/i18n';
import { useLoader } from '@/hooks/useLoader';
import { colors } from '@/theme';

const languages: { id: Lang; label: string }[] = [
  { id: 'uz', label: 'O‘zbek' },
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
];

export default function AccountScreen() {
  const { user, clinic, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [leaving, setLeaving] = useState(false);
  const deletion = useLoader(readDeletionRequest);
  const role = user?.role === 'admin' ? t.account.roleAdmin : user?.role === 'doctor' ? t.account.roleDoctor : t.account.roleStaff;

  return (
    <Screen>
      <TitleBlock title={t.account.title} subtitle={role} />
      <Card>
        <Text style={styles.name}>{user?.full_name || user?.name}</Text>
        <Text style={styles.meta}>@{user?.username}</Text>
        <Text style={styles.meta}>{t.account.clinic}: {clinic?.name}</Text>
        {clinic?.plan ? <Text style={styles.meta}>{clinic.plan}</Text> : null}
      </Card>
      <Text style={styles.label}>{t.account.language}</Text>
      <View style={styles.langs}>
        {languages.map((item) => (
          <Pressable accessibilityRole="button" key={item.id} onPress={() => setLang(item.id)} style={[styles.lang, lang === item.id && styles.langOn]}>
            <Text style={[styles.langText, lang === item.id && styles.langTextOn]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Button label={t.account.privacy} tone="ghost" onPress={() => router.push('/privacy')} />
      <Button label={t.account.password} tone="ghost" onPress={() => router.push('/password')} />
      <Button label={t.home.doctors} tone="ghost" onPress={() => router.push('/doctors')} />
      <Button label={t.account.delete} tone="danger" onPress={() => router.push('/delete-account')} />
      {deletion.data ? <Text style={styles.note}>{deletion.data.requestedAt.slice(0, 10)} · {t.deleteAccount.pendingTitle}</Text> : null}
      <Button label={t.account.logout} onPress={() => { setLeaving(true); void logout().finally(() => setLeaving(false)); }} loading={leaving} />
      <Text style={styles.version}>{t.account.version} {Constants.expoConfig?.version || '1.0.0'}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontSize: 20, fontWeight: '800' },
  meta: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  langs: { flexDirection: 'row', gap: 8 },
  lang: { backgroundColor: colors.card, borderRadius: 999, flex: 1, paddingVertical: 10 },
  langOn: { backgroundColor: colors.brand },
  langText: { color: colors.text, fontWeight: '800', textAlign: 'center' },
  langTextOn: { color: '#fff' },
  note: { color: colors.muted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  version: { color: colors.muted, fontSize: 12, fontWeight: '700', textAlign: 'center' },
});
