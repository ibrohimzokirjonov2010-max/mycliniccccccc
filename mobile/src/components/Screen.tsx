import { type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '@/theme';
import { useI18n } from '@/i18n';
import { OfflineBanner } from '@/components/ui';
import { Icon, icons } from '@/components/Icon';

export function Screen({
  children,
  refreshing,
  onRefresh,
  footer,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 768;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={[styles.content, wide && styles.wideContent]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} colors={[colors.brand]} />
        ) : undefined}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View style={[styles.footer, wide && styles.wideContent, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export function TitleBlock({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={styles.titleRow}>
      <View style={styles.titleCopy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function BackHeader({ title }: { title: string }) {
  const { t } = useI18n();
  return (
    <View style={styles.backRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={() => router.back()} style={styles.backButton}>
        <Icon name={icons.back} color={colors.brandDark} size={20} />
      </Pressable>
      <Text style={styles.backTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.bg, flex: 1 },
  content: { gap: 12, padding: 16, paddingBottom: 28, width: '100%' },
  wideContent: { alignSelf: 'center', maxWidth: 960, paddingHorizontal: 28, width: '100%' },
  footer: { padding: 16, paddingTop: 0 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  titleCopy: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  backRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  backButton: { alignItems: 'center', backgroundColor: colors.card, borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  backTitle: { color: colors.text, flex: 1, fontSize: 22, fontWeight: '800' },
});
