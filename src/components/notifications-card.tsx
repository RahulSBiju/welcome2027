import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { disablePush, enablePush, getPushSupport, isPushEnabled } from '@/lib/push';

/** Lets each person turn on push notifications for this phone or browser. */
export function NotificationsCard({ userId }: { userId: string }) {
  const theme = useTheme();
  const support = getPushSupport();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  useEffect(() => {
    if (support !== 'supported') return;
    let active = true;
    isPushEnabled().then((on) => {
      if (active) setEnabled(on);
    });
    return () => {
      active = false;
    };
  }, [support]);

  async function toggle() {
    setBusy(true);
    setMessage(null);
    const error = enabled ? await disablePush() : await enablePush(userId);
    setBusy(false);
    if (error) {
      setMessage({ text: error, isError: true });
      return;
    }
    setEnabled(!enabled);
    setMessage({ text: enabled ? 'Notifications turned off on this device.' : "You're all set! 🔔", isError: false });
  }

  if (support === 'unsupported') return null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.gapSmall}>
        <ThemedText type="smallBold">🔔 Notifications</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {support === 'needs-home-screen'
            ? 'On iPhone, first add this app to your Home Screen (Share → Add to Home Screen), open it from there, then turn on notifications here.'
            : enabled
              ? 'On for this device. You’ll hear about new places, comments, people joining and the final plan.'
              : 'Get a heads-up when friends suggest places, comment, join, or the final plan is locked in.'}
        </ThemedText>
      </View>
      {support === 'supported' && enabled !== null && (
        <Button
          title={enabled ? 'Turn off' : 'Turn on notifications'}
          variant={enabled ? 'secondary' : 'primary'}
          onPress={toggle}
          loading={busy}
        />
      )}
      {message && (
        <ThemedText type="small" style={{ color: message.isError ? theme.danger : theme.textSecondary }}>
          {message.text}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.three,
  },
  gapSmall: {
    gap: Spacing.one,
  },
});
