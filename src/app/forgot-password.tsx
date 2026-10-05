import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/**
 * Reset a forgotten password with a code sent by email:
 * 1. enter email → we send a code   2. enter code + new password → done.
 * (This screen sits outside the signed-in/out guards, because entering the code signs you in.)
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const theme = useTheme();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();

  async function sendCode() {
    setError(null);
    if (!cleanEmail.includes('@')) {
      setError('Enter the email you signed up with.');
      return;
    }
    setLoading(true);
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    setLoading(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setInfo(`If ${cleanEmail} has an account, a reset code is on its way. Check spam too.`);
    setStep('reset');
  }

  async function resetPassword() {
    setError(null);
    const token = code.replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) {
      setError('Enter the code from the email (numbers only).');
      return;
    }
    if (password.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: cleanEmail, token, type: 'recovery' });
    if (verifyError) {
      setLoading(false);
      setError('That code is wrong or has expired. Send a new one and try again.');
      return;
    }
    // The code signed us in, so now we're allowed to set the new password.
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.replace('/');
  }

  return (
    <ThemedView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="subtitle" style={styles.center}>
            Reset password 🔑
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.card}>
            {step === 'email' ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  Enter your email and we&apos;ll send you a code to set a new password.
                </ThemedText>
                <TextField
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onSubmitEditing={sendCode}
                />
                {error && (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {error}
                  </ThemedText>
                )}
                <Button title="Send reset code" onPress={sendCode} loading={loading} />
              </>
            ) : (
              <>
                {info && <ThemedText type="small">{info}</ThemedText>}
                <TextField
                  label="Code from the email"
                  placeholder="e.g. 123456"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={10}
                />
                <TextField
                  label="New password"
                  placeholder="At least 6 characters"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  onSubmitEditing={resetPassword}
                />
                {error && (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {error}
                  </ThemedText>
                )}
                <Button title="Set new password" onPress={resetPassword} loading={loading} />
                <Button title="Send a new code" variant="secondary" onPress={sendCode} />
              </>
            )}
          </ThemedView>

          <Button title="← Back to sign in" variant="secondary" onPress={() => router.replace('/sign-in')} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth / 2,
    alignSelf: 'center',
  },
  center: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
});
