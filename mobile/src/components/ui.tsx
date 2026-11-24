import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { colors, radius } from '@/theme';
import { useOnline } from '@/hooks/useOnline';
import { useI18n } from '@/i18n';

export function OfflineBanner() {
  const online = useOnline();
  const { t } = useI18n();
  if (online) return null;
  return (
    <View style={styles.offline}>
      <Text style={styles.offlineText}>{t.common.offline}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  tone = 'primary',
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'danger' | 'ghost';
  loading?: boolean;
}) {
  const isGhost = tone === 'ghost';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'danger' && styles.dangerButton,
        isGhost && styles.ghostButton,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={isGhost ? colors.brand : '#fff'} /> : (
        <Text
          maxFontSizeMultiplier={2}
          style={[styles.buttonText, isGhost && styles.ghostText, tone === 'danger' && styles.dangerText]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text maxFontSizeMultiplier={2} style={styles.fieldLabel}>{label}</Text>
      <TextInput
        maxFontSizeMultiplier={2}
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function ErrorBox({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry && retryLabel ? <Button label={retryLabel} onPress={onRetry} tone="ghost" /> : null}
    </View>
  );
}

export function EmptyState({ title }: { title: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{title}</Text>
    </View>
  );
}

export function LoadingState() {
  const { t } = useI18n();
  return (
    <View style={styles.empty}>
      <ActivityIndicator color={colors.brand} />
      <Text style={styles.emptyText}>{t.common.loading}</Text>
    </View>
  );
}

export function Avatar({ label }: { label: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{label}</Text>
    </View>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }) {
  return (
    <View style={[styles.pill, tone === 'good' && styles.pillGood, tone === 'warn' && styles.pillWarn, tone === 'bad' && styles.pillBad, tone === 'info' && styles.pillInfo]}>
      <Text style={[styles.pillText, tone === 'good' && styles.pillTextGood, tone === 'warn' && styles.pillTextWarn, tone === 'bad' && styles.pillTextBad, tone === 'info' && styles.pillTextInfo]}>{label}</Text>
    </View>
  );
}

export function statusTone(status: string): 'neutral' | 'good' | 'warn' | 'bad' | 'info' {
  const value = status.toLowerCase();
  if (value === 'completed' || value === 'active' || value === 'income') return 'good';
  if (value === 'cancelled' || value === 'canceled' || value.includes('no-show') || value.includes('noshow')) return 'bad';
  if (value === 'waiting' || value === 'debt' || value === 'new') return 'warn';
  if (value === 'scheduled' || value === 'in progress') return 'info';
  return 'neutral';
}

const styles = StyleSheet.create({
  offline: { backgroundColor: colors.brandDeep, paddingHorizontal: 16, paddingVertical: 8 },
  offlineText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  button: { backgroundColor: colors.brand, borderRadius: radius.md, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  dangerButton: { backgroundColor: colors.danger },
  ghostButton: { backgroundColor: colors.brandSoft },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  ghostText: { color: colors.brandDark },
  dangerText: { color: '#fff' },
  field: { gap: 6 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: '#EEF2F6',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    gap: 8,
  },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, gap: 8, padding: 14 },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  avatar: { alignItems: 'center', backgroundColor: colors.brandSoft, borderRadius: 16, height: 46, justifyContent: 'center', width: 46 },
  avatarText: { color: colors.brandDark, fontSize: 15, fontWeight: '800' },
  pill: { alignSelf: 'flex-start', backgroundColor: '#F1F5F9', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillGood: { backgroundColor: colors.successSoft },
  pillWarn: { backgroundColor: colors.warningSoft },
  pillBad: { backgroundColor: colors.dangerSoft },
  pillInfo: { backgroundColor: colors.infoSoft },
  pillText: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  pillTextGood: { color: colors.success },
  pillTextWarn: { color: colors.warning },
  pillTextBad: { color: colors.danger },
  pillTextInfo: { color: colors.info },
});
