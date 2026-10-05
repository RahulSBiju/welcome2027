import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/auth-context';
import { savePendingInvite } from '@/lib/pending-invite';
import { supabase } from '@/lib/supabase';

/**
 * Opened from an invite link or QR code: /join/A1B2C3
 * Signed in → join the trip now. Signed out → remember the code and sign in first.
 */
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useSession();
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const inviteCode = (code ?? '').trim().toUpperCase();

    async function run() {
      if (!session) {
        await savePendingInvite(inviteCode);
        router.replace('/sign-in');
        return;
      }

      const { data, error: joinError } = await supabase.rpc('join_trip', { p_code: inviteCode });
      if (joinError) {
        setError(
          joinError.message.includes('Invalid invite code')
            ? `No trip found for invite code ${inviteCode}. Ask your friend to send the link again.`
            : joinError.message
        );
        return;
      }
      router.replace('/');
      router.push({ pathname: '/trip/[id]', params: { id: data as string } });
    }

    run();
  }, [code, session]);

  return (
    <ThemedView style={styles.container}>
      {error ? (
        <>
          <ThemedText style={[styles.center, { color: theme.danger }]}>{error}</ThemedText>
          <Button title="Go to my trips" variant="secondary" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={theme.primary} />
          <ThemedText themeColor="textSecondary">Joining the trip…</ThemedText>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  center: {
    textAlign: 'center',
  },
});
