import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { statusLabel } from '@/lib/labels';

function tone(status?: string | null) {
  if (status === 'Completed' || status === 'Active') {
    return { bg: colors.tealSoft, fg: colors.tealDark };
  }
  if (status === 'Cancelled' || status === 'No-Show' || status === 'Inactive' || status === 'Archived') {
    return { bg: colors.dangerSoft, fg: colors.danger };
  }
  if (status === 'Waiting' || status === 'In Progress' || status === 'In Treatment') {
    return { bg: colors.cyanSoft, fg: colors.cyan };
  }
  if (status === 'New') {
    return { bg: colors.warningSoft, fg: colors.warning };
  }
  return { bg: '#E2E8F0', fg: colors.ink };
}

export function StatusPill({ status }: { status?: string | null }) {
  const palette = tone(status);
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{statusLabel(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
