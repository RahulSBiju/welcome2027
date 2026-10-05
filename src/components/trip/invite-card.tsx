import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { inviteLink } from '@/lib/config';
import type { Trip } from '@/lib/types';

/** Invite code, QR code and share button, so friends can join without typing. */
export function InviteCard({ trip }: { trip: Trip }) {
  const theme = useTheme();
  const [showQr, setShowQr] = useState(false);
  const link = inviteLink(trip.invite_code);

  async function shareInvite() {
    await Share.share({
      message: `Join our trip "${trip.name}" on the Year End Trip Planner! 🌴\n\nTap to join: ${link}\n\nOr enter invite code: ${trip.invite_code}`,
    });
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        INVITE FRIENDS
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Invite code
        </ThemedText>
        <ThemedText selectable style={[styles.code, { color: theme.primary }]}>
          {trip.invite_code}
        </ThemedText>

        {showQr && (
          <View style={styles.qrWrapper}>
            {/* Always dark-on-white so phone cameras can read it, even in dark mode. */}
            <View style={styles.qrBox}>
              <QRCode value={link} size={200} color="#000000" backgroundColor="#ffffff" />
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Friends scan this with their phone camera to join.
            </ThemedText>
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.flex}>
            <Button title="Share invite" onPress={shareInvite} />
          </View>
          <View style={styles.flex}>
            <Button
              title={showQr ? 'Hide QR code' : 'Show QR code'}
              variant="secondary"
              onPress={() => setShowQr((s) => !s)}
            />
          </View>
        </View>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  code: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: 700,
    letterSpacing: 6,
    textAlign: 'center',
  },
  qrWrapper: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  qrBox: {
    padding: Spacing.three,
    backgroundColor: '#ffffff',
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
