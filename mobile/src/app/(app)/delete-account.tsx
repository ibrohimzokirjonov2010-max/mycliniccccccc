import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, BackHeader } from '@/components/Screen';
import { Button, ErrorBox } from '@/components/ui';
import { requestAccountDeletion } from '@/api/session';
import { config } from '@/api/config';
import { setAuthNotice } from '@/auth/notice';
import { useAuth } from '@/auth/AuthContext';
import { errorText, useI18n } from '@/i18n';
import { isApiError } from '@/api/errors';
import { colors, radius } from '@/theme';
import type { DeletionResult } from '@/api/session';

export default function DeleteAccountScreen() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeletionResult | null>(null);

  const shownError = (caught: unknown) => {
    if (isApiError(caught) && caught.serverMessage) return caught.serverMessage;
    return errorText(isApiError(caught) ? caught.code : 'generic', t);
  };

  const submit = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const next = await requestAccountDeletion();
      setConfirming(false);
      if (next.outcome === 'deleted' || next.outcome === 'requested') {
        setAuthNotice(next.message || (next.outcome === 'deleted' ? t.deleteAccount.doneBody : t.deleteAccount.pendingBody));
        await logout();
        return;
      }
      setResult(next);
    } catch (caught) {
      setConfirming(false);
      setError(shownError(caught));
    } finally {
      setLoading(false);
    }
  };

  const support = () => {
    const text = encodeURIComponent(`My Clinic account deletion\nclinic: ${user?.clinic_id}\nusername: ${user?.username}`);
    void Linking.openURL(`${config.supportUrl}?text=${text}`);
  };

  if (result?.outcome === 'fallback') {
    return (
      <Screen>
        <BackHeader title={t.deleteAccount.title} />
        <Text style={styles.title}>{t.deleteAccount.pendingTitle}</Text>
        <Text style={styles.body}>{t.deleteAccount.pendingBody}</Text>
        <Button label={t.deleteAccount.webPage} tone="ghost" onPress={() => { void Linking.openURL(config.deleteAccountUrl); }} />
        <Button label={t.deleteAccount.support} tone="ghost" onPress={support} />
      </Screen>
    );
  }

  if (result?.outcome === 'blocked') {
    return (
      <Screen>
        <BackHeader title={t.deleteAccount.title} />
        <Text style={styles.title}>{t.deleteAccount.blockedTitle}</Text>
        <Text style={styles.body}>{result.message || errorText(result.code, t)}</Text>
        <Button label={t.deleteAccount.support} tone="ghost" onPress={support} />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button label={t.deleteAccount.submit} tone="danger" onPress={() => setConfirming(true)} />}>
      <BackHeader title={t.deleteAccount.title} />
      <Text style={styles.body}>{t.deleteAccount.body}</Text>
      {error ? <ErrorBox message={error} /> : null}
      <Modal animationType="fade" transparent visible={confirming} onRequestClose={() => { if (!loading) setConfirming(false); }}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.title}>{t.deleteAccount.confirmTitle}</Text>
            <Text style={styles.body}>{t.deleteAccount.confirmBody}</Text>
            <Button label={t.deleteAccount.confirmAction} tone="danger" onPress={() => { void submit(); }} loading={loading} />
            <Pressable accessibilityRole="button" disabled={loading} onPress={() => setConfirming(false)}>
              <Text style={styles.cancel}>{t.common.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#fff', borderRadius: radius.lg, gap: 12, padding: 20, width: '100%', maxWidth: 420 },
  cancel: { color: colors.muted, fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
