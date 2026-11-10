import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

export function LoadingState({ label = 'Yuklanmoqda...' }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.teal} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Ma'lumot yuklanmadi</Text>
      <Text style={styles.body}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.button} accessibilityRole="button">
        <Text style={styles.buttonText}>Qayta urinish</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 8,
  },
  title: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: colors.tealSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buttonText: {
    color: colors.tealDark,
    fontWeight: '700',
    fontSize: 14,
  },
});
