import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { peekPendingInvite } from '@/lib/pending-invite';
import { supabase } from '@/lib/supabase';

type Mode = 'signIn' | 'signUp' | 'verify';

export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('signIn');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [pendingInvite, setPendingInvite] = useState<string | null>(null);

  // Email confirmation: after sign-up we email a code, which is entered here.
  const [code, setCode] = useState('');
  const [info, setInfo] = useState<string | null>(null);

  const isSignUp = mode === 'signUp';
  const isVerify = mode === 'verify';

  // Arrived from an invite link? Show a banner, and default to creating an account.
  useEffect(() => {
    peekPendingInvite().then((code) => {
      if (code) {
        setPendingInvite(code);
        setMode('signUp');
      }
    });
  }, []);

  async function handleSubmit() {
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (isSignUp && !displayName.trim()) {
      setError('Please enter your name so friends know who you are.');
      return;
    }
    if (isSignUp && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    // On success, the layout notices the new session and opens My Trips automatically.
    if (isSignUp) {
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      setLoading(false);
      if (authError) {
        setError(authError.message);
      } else if (!data.session) {
        // Email confirmation is on: ask for the code we just emailed.
        setInfo(`We've emailed a code to ${trimmedEmail}. Enter it below to finish creating your account.`);
        setMode('verify');
      }
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
    setLoading(false);
    if (authError?.message.toLowerCase().includes('not confirmed')) {
      // Signed up earlier but never entered the code: send a fresh one.
      await supabase.auth.resend({ type: 'signup', email: trimmedEmail });
      setInfo(`Your email isn't confirmed yet. We've sent a new code to ${trimmedEmail}.`);
      setMode('verify');
    } else if (authError) {
      setError(
        authError.message === 'Invalid login credentials'
          ? 'Wrong email or password. Forgot your password? Reset it below.'
          : authError.message
      );
    }
  }

  async function verifyCode() {
    setError(null);
    const token = code.replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) {
      setError('Enter the code from the email (numbers only).');
      return;
    }
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token,
      type: 'email',
    });
    setLoading(false);
    if (verifyError) setError('That code is wrong or has expired. Check the email, or send a new code.');
  }

  async function resendCode() {
    setError(null);
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
    setInfo(resendError ? null : `New code sent to ${email.trim().toLowerCase()}. Check spam too.`);
    if (resendError) setError(resendError.message);
  }

  function switchMode() {
    setMode(isSignUp ? 'signIn' : 'signUp');
    setError(null);
    setInfo(null);
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText style={styles.emoji}>🌴</ThemedText>
            <ThemedText type="subtitle" style={styles.center}>
              Welcome 2027
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.center}>
              {isVerify
                ? 'One last step: confirm your email.'
                : isSignUp
                  ? 'Create your account to join the planning.'
                  : 'Welcome back! Sign in to continue.'}
            </ThemedText>

            {pendingInvite && (
              <ThemedView style={[styles.banner, { borderColor: theme.primary }]}>
                <ThemedText type="small" style={styles.center}>
                  🎉 You&apos;ve been invited to a trip! {isSignUp ? 'Create an account' : 'Sign in'} and
                  you&apos;ll join it automatically (code{' '}
                  <ThemedText type="smallBold">{pendingInvite}</ThemedText>).
                </ThemedText>
              </ThemedView>
            )}

            {isVerify ? (
              <ThemedView type="backgroundElement" style={styles.card}>
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
                  onSubmitEditing={verifyCode}
                />
                {error && (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    {error}
                  </ThemedText>
                )}
                <Button title="Confirm email" onPress={verifyCode} loading={loading} />
                <Button title="Send a new code" variant="secondary" onPress={resendCode} />
                <Pressable
                  onPress={() => {
                    setMode('signIn');
                    setError(null);
                    setInfo(null);
                  }}
                  style={styles.switch}>
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    ← Back to sign in
                  </ThemedText>
                </Pressable>
              </ThemedView>
            ) : (
            <ThemedView type="backgroundElement" style={styles.card}>
              {isSignUp && (
                <TextField
                  label="Your name"
                  placeholder="e.g. Rahul"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  textContentType="name"
                />
              )}
              <TextField
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <TextField
                label="Password"
                placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                onSubmitEditing={handleSubmit}
              />

              {error && (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {error}
                </ThemedText>
              )}

              <Button
                title={isSignUp ? 'Create account' : 'Sign in'}
                onPress={handleSubmit}
                loading={loading}
              />

              {!isSignUp && (
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/forgot-password', params: { email: email.trim().toLowerCase() } })
                  }
                  style={styles.switch}>
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    Forgot password?
                  </ThemedText>
                </Pressable>
              )}
            </ThemedView>
            )}

            {!isVerify && (
            <Pressable onPress={switchMode} style={styles.switch}>
              <ThemedText type="small" themeColor="textSecondary">
                {isSignUp ? 'Already have an account? ' : 'New here? '}
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  {isSignUp ? 'Sign in' : 'Create an account'}
                </ThemedText>
              </ThemedText>
            </Pressable>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
  emoji: {
    fontSize: 56,
    lineHeight: 68,
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
    marginTop: Spacing.three,
  },
  banner: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  switch: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
});
