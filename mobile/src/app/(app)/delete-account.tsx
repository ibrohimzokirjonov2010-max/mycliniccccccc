import { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { Screen, BackHeader } from '@/components/Screen';
import { Button, ErrorBox, Field } from '@/components/ui';
import { login, requestAccountDeletion } from '@/api/session';
import { config } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { errorText, useI18n } from '@/i18n';
import { isApiError } from '@/api/errors';
import { colors } from '@/theme';
import type { DeletionResult } from '@/api/session';

export default function DeleteAccountScreen() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeletionResult | null>(null);

  const submit = async () => {
    if (!user) return;
    if (username.trim().toLowerCase() !== user.username.toLowerCase() || !password) {
      setError('required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login({ clinicId: user.clinic_id, username: user.username, password, remember: true });
      const next = await requestAccountDeletion();
      setResult(next);
      if (next.deleted) await logout();
    } catch (caught) {
      setError(isApiError(caught) ? caught.code : 'generic');
    } finally {
      setLoading(false);
    }
  };

  const support = () => {
    const text = encodeURIComponent(`My Clinic account deletion\nclinic: ${user?.clinic_id}\nusername: ${user?.username}`);
    void Linking.openURL(`${config.supportUrl}?text=${text}`);
  };

  if (result) {
    const deleted = result.deleted;
    return (
      <Screen>
        <BackHeader title={t.deleteAccount.title} />
        <Text style={styles.title}>{deleted ? t.deleteAccount.doneTitle : t.deleteAccount.pendingTitle}</Text>
        <Text style={styles.body}>{deleted ? t.deleteAccount.doneBody : t.deleteAccount.pendingBody}</Text>
        {!deleted ? <Button label={t.deleteAccount.support} tone="ghost" onPress={support} /> : null}
        <Button label={t.deleteAccount.signOut} onPress={() => { void logout(); }} />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label={t.deleteAccount.submit} tone="danger" onPress={() => { void submit(); }} loading={loading} />}>
      <BackHeader title={t.deleteAccount.title} />
      <Text style={styles.body}>{t.deleteAccount.body}</Text>
      <Field label={t.deleteAccount.typeName} autoCapitalize="none" autoCorrect={false} value={username} onChangeText={setUsername} />
      <Field label={t.deleteAccount.current} secureTextEntry value={password} onChangeText={setPassword} autoCapitalize="none" />
      {error ? <ErrorBox message={errorText(error, t)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
