import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button, ErrorBox, Field } from '@/components/ui';
import { useAuth } from '@/auth/AuthContext';
import { takeAuthNotice } from '@/auth/notice';
import { errorText, useI18n } from '@/i18n';
import { isApiError } from '@/api/errors';
import { colors, radius } from '@/theme';

export default function LoginScreen() {
  const { login, bootError } = useAuth();
  const { t } = useI18n();
  const [clinicId, setClinicId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(bootError);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNotice(takeAuthNotice());
  }, []);

  const submit = async () => {
    if (!clinicId.trim() || !username.trim() || !password) {
      setError('required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login({ clinicId, username, password, remember });
      router.replace('/');
    } catch (caught) {
      setError(isApiError(caught) ? caught.code : 'generic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <Screen>
        <View style={styles.hero}>
          <Image source={require('../../assets/logo-icon.png')} style={styles.mark} resizeMode="contain" accessibilityIgnoresInvertColors />
          <Text style={styles.brand}>{t.brand}</Text>
          <Text style={styles.tagline}>{t.tagline}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>{t.login.title}</Text>
          <Text style={styles.subtitle}>{t.login.subtitle}</Text>
          <Field label={t.login.clinicId} autoCapitalize="none" autoCorrect={false} value={clinicId} onChangeText={setClinicId} />
          <Field label={t.login.username} autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
          <Field
            label={t.login.password}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
          <Pressable accessibilityRole="button" onPress={() => setShowPassword((value) => !value)}>
            <Text style={styles.link}>{showPassword ? t.login.hide : t.login.show}</Text>
          </Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: remember }} onPress={() => setRemember((value) => !value)} style={styles.remember}>
            <View style={[styles.box, remember && styles.boxOn]}>{remember ? <Text style={styles.check}>✓</Text> : null}</View>
            <Text style={styles.rememberText}>{t.login.remember}</Text>
          </Pressable>
          {notice ? <ErrorBox message={notice} /> : null}
          {error ? <ErrorBox message={errorText(error, t)} /> : null}
          <Button label={t.login.submit} onPress={() => { void submit(); }} loading={loading} />
        </View>
        <Text style={styles.note}>{t.login.noAccount}</Text>
        <Pressable accessibilityRole="link" onPress={() => router.push('/privacy')}>
          <Text style={styles.privacy}>{t.login.privacy}</Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  hero: { alignItems: 'center', gap: 4, paddingTop: 12 },
  mark: { height: 72, width: 72 },
  brand: { color: colors.text, fontSize: 28, fontWeight: '800' },
  tagline: { color: colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, gap: 12, padding: 16 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, fontWeight: '600', marginTop: -6 },
  link: { color: colors.brandDark, fontSize: 13, fontWeight: '700' },
  remember: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  box: { alignItems: 'center', borderColor: colors.line, borderRadius: 6, borderWidth: 1.5, height: 22, justifyContent: 'center', width: 22 },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  check: { color: '#fff', fontSize: 14, fontWeight: '800' },
  rememberText: { color: colors.text, flex: 1, fontSize: 14, fontWeight: '600' },
  note: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  privacy: { color: colors.brandDark, fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
