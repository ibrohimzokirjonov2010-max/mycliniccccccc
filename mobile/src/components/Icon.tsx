import { type ColorValue } from 'react-native';
import { SymbolView } from 'expo-symbols';

type IconName = {
  ios: 'house.fill' | 'person.2.fill' | 'calendar' | 'creditcard.fill' | 'person.crop.circle' | 'stethoscope' | 'chevron.left';
  android: 'home' | 'group' | 'calendar_month' | 'payments' | 'account_circle' | 'medical_services' | 'arrow_back';
};

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: ColorValue }) {
  return (
    <SymbolView
      name={{ ios: name.ios, android: name.android, web: name.android }}
      size={size}
      tintColor={color}
      fallback={null}
    />
  );
}

export const icons = {
  home: { ios: 'house.fill', android: 'home' },
  patients: { ios: 'person.2.fill', android: 'group' },
  visits: { ios: 'calendar', android: 'calendar_month' },
  payments: { ios: 'creditcard.fill', android: 'payments' },
  account: { ios: 'person.crop.circle', android: 'account_circle' },
  doctor: { ios: 'stethoscope', android: 'medical_services' },
  back: { ios: 'chevron.left', android: 'arrow_back' },
} as const satisfies Record<string, IconName>;
