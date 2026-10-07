import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { BellIcon, PowerIcon } from '@/components/ui/icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { disablePush, enablePush, getPushSupport, isPushEnabled } from '@/lib/push';
import { supabase } from '@/lib/supabase';

type Props = {
  userId: string;
  /** Shows a short message to the user (e.g. "Push Notifications are active"). */
  onMessage: (text: string, isError?: boolean) => void;
};

/** Top-right of My Trips: 🔔 notifications toggle (YouTube-style bell) and ⏻ sign out. */
export function HeaderActions({ userId, onMessage }: Props) {
  const theme = useTheme();
  const support = getPushSupport();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

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

  async function toggleNotifications() {
    if (support === 'needs-home-screen') {
      onMessage('On iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then open it from there.');
      return;
    }
    setBusy(true);
    const error = enabled ? await disablePush() : await enablePush(userId);
    setBusy(false);
    if (error) {
      onMessage(error, true);
      return;
    }
    setEnabled(!enabled);
    onMessage(enabled ? 'Push Notifications are off' : 'Push Notifications are active 🔔');
  }

  return (
    <View style={styles.row}>
      {support !== 'unsupported' && (
        <Pressable
          onPress={toggleNotifications}
          disabled={busy}
          hitSlop={8}
          accessibilityRole="switch"
          accessibilityState={{ checked: enabled }}
          accessibilityLabel={enabled ? 'Turn off push notifications' : 'Turn on push notifications'}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          {busy ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <BellIcon filled={enabled} color={enabled ? theme.primary : theme.text} />
          )}
        </Pressable>
      )}
      <Pressable
        onPress={() => supabase.auth.signOut()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
        <PowerIcon color={theme.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
