import { Linking, StyleSheet, Text, View } from 'react-native';
import { Screen, BackHeader } from '@/components/Screen';
import { Button, Card } from '@/components/ui';
import { config } from '@/api/config';
import { useI18n } from '@/i18n';
import { colors } from '@/theme';

export default function PrivacyScreen() {
  const { t } = useI18n();
  return (
    <Screen>
      <BackHeader title={t.privacy.title} />
      {t.privacy.sections.map((section) => (
        <Card key={section.title}>
          <Text style={styles.heading}>{section.title}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </Card>
      ))}
      <Button label={t.privacy.open} tone="ghost" onPress={() => { void Linking.openURL(config.privacyPolicyUrl); }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.brandDark, fontSize: 15, fontWeight: '800' },
  body: { color: colors.text, fontSize: 14, lineHeight: 21 },
});
