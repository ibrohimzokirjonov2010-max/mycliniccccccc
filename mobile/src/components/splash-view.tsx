import { Image, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/constants/theme';

export function SplashView() {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <Image source={require('../../assets/images/splash-icon.png')} style={styles.mark} />
      <Text style={styles.title}>My Clinic</Text>
      <Text style={styles.subtitle}>Stomatologiya klinikasi</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mark: {
    width: 120,
    height: 120,
    marginBottom: 8,
  },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: '#D1FAF5',
    fontSize: 14,
    fontWeight: '500',
  },
});
