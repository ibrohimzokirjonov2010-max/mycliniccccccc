import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen, BackHeader } from '@/components/Screen';
import { Button, ErrorBox, Field } from '@/components/ui';
import { changePassword, login } from '@/api/session';
import { useAuth } from '@/auth/AuthContext';
import { errorText, useI18n } from '@/i18n';
import { isApiError } from '@/api/errors';
import { colors } from '@/theme';

export default function PasswordScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!user) return;
    if (!current || !next) {
      setError('required');
      return;
    }
    if (next.length < 8 || next !== confirm) {
      setError('weak_password');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login({ clinicId: user.clinic_id, username: user.username, password: current, remember: true });
      await changePassword(user.id, next);
      setSaved(true);
    } catch (caught) {
      setError(isApiError(caught) ? caught.code : 'generic');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen footer={<Button label={t.common.save} onPress={() => { void save(); }} loading={loading} />}>
      <BackHeader title={t.password.title} />
      <Text style={styles.hint}>{t.password.hint}</Text>
      <Field label={t.password.current} secureTextEntry value={current} onChangeText={setCurrent} autoCapitalize="none" />
      <Field label={t.password.next} secureTextEntry value={next} onChangeText={setNext} autoCapitalize="none" />
      <Field label={t.password.confirm} secureTextEntry value={confirm} onChangeText={setConfirm} autoCapitalize="none" />
      {error ? <ErrorBox message={errorText(error, t)} /> : null}
      {saved ? <Text style={styles.saved}>{t.password.saved}</Text> : null}
      {saved ? <Button label={t.common.back} tone="ghost" onPress={() => router.back()} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  saved: { color: colors.success, fontSize: 15, fontWeight: '800' },
});
