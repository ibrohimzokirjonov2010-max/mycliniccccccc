import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth-context';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { session, signIn } = useAuth();
  const [clinicId, setClinicId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await signIn(clinicId, username, password);
      if (!result.success) setError(result.error);
    } catch {
      setError('Server bilan aloqa uzildi');
    } finally {
      setLoading(false);
    }
  };

  if (session) return <Redirect href="/" />;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
          <Text style={styles.title}>My Clinic</Text>
          <Text style={styles.subtitle}>Klinika hisobingiz bilan kiring</Text>
        </View>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Field label="Klinika ID" value={clinicId} onChangeText={setClinicId} placeholder="klinika-id" icon="business" />
          <Field
            label="Foydalanuvchi nomi"
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            icon="person"
            autoCapitalize="none"
          />
          <Field
            label="Parol"
            value={password}
            onChangeText={setPassword}
            placeholder="Parol"
            icon="lock-closed"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            trailing={
              <Pressable onPress={() => setShowPassword((value) => !value)} hitSlop={8} accessibilityRole="button">
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.muted} />
              </Pressable>
            }
          />

          <Pressable
            onPress={onSubmit}
            disabled={loading}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonDisabled]}
            accessibilityRole="button">
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Kirish</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  trailing,
  icon,
  ...inputProps
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  trailing?: ReactNode;
} & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons name={icon} size={18} color={colors.teal} />
        <TextInput
          placeholderTextColor="#94A3B8"
          style={styles.input}
          {...inputProps}
        />
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: 20,
    gap: 24,
  },
  brand: {
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '500',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    padding: 12,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  field: {
    gap: 6,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FFFE',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    minHeight: 50,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 12,
  },
  button: {
    marginTop: 4,
    backgroundColor: colors.teal,
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: colors.tealDark,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
});
