import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '@/i18n';
import { Icon, icons } from '@/components/Icon';
import { colors } from '@/theme';

export default function TabLayout() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: colors.line,
          height: 52 + bottom,
          paddingBottom: bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t.tabs.home, tabBarIcon: ({ color, size }) => <Icon name={icons.home} color={color} size={size} /> }} />
      <Tabs.Screen name="patients" options={{ title: t.tabs.patients, tabBarIcon: ({ color, size }) => <Icon name={icons.patients} color={color} size={size} /> }} />
      <Tabs.Screen name="appointments" options={{ title: t.tabs.appointments, tabBarIcon: ({ color, size }) => <Icon name={icons.visits} color={color} size={size} /> }} />
      <Tabs.Screen name="payments" options={{ title: t.tabs.payments, tabBarIcon: ({ color, size }) => <Icon name={icons.payments} color={color} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: t.tabs.account, tabBarIcon: ({ color, size }) => <Icon name={icons.account} color={color} size={size} /> }} />
    </Tabs>
  );
}
