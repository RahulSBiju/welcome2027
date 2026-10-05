import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRange } from '@/lib/dates';
import { pinDates, pinPlace } from '@/lib/pin';
import type { Trip } from '@/lib/types';

type Props = {
  trip: Trip;
  pinnedPlaceName: string | null;
  isOrganiser: boolean;
  onChanged: () => void;
};

/** The locked-in plan (📌). Shown at the top of the trip page. */
export function FinalPlanCard({ trip, pinnedPlaceName, isOrganiser, onChanged }: Props) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);

  const hasPlace = !!trip.pinned_location_id && !!pinnedPlaceName;
  const hasDates = !!trip.pinned_start && !!trip.pinned_end;

  async function unpin(what: 'place' | 'dates') {
    setError(null);
    const err = what === 'place' ? await pinPlace(trip.id, null) : await pinDates(trip.id, null, null);
    if (err) setError(err);
    onChanged();
  }

  // Nothing decided yet: only the organiser sees a hint about how to pin.
  if (!hasPlace && !hasDates) {
    if (!isOrganiser) return null;
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="small" themeColor="textSecondary">
          📌 As organiser, you can lock in the final plan: pin a place from its page in Places, and dates from
          Best dates below.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.card, styles.decided, { borderColor: theme.primary }]}>
      <ThemedText type="smallBold" style={{ color: theme.primary }}>
        🎉 IT&apos;S DECIDED!
      </ThemedText>

      {hasPlace && (
        <View style={styles.row}>
          <Pressable
            style={styles.flex}
            onPress={() =>
              router.push({
                pathname: '/trip/[id]/place/[placeId]',
                params: { id: trip.id, placeId: trip.pinned_location_id! },
              })
            }>
            <ThemedText style={styles.big}>📍 {pinnedPlaceName}</ThemedText>
          </Pressable>
          {isOrganiser && <UnpinLink onPress={() => unpin('place')} />}
        </View>
      )}
      {!hasPlace && (
        <ThemedText type="small" themeColor="textSecondary">
          📍 Place: still being decided
        </ThemedText>
      )}

      {hasDates && (
        <View style={styles.row}>
          <ThemedText style={[styles.big, styles.flex]}>📅 {formatRange(trip.pinned_start!, trip.pinned_end!)}</ThemedText>
          {isOrganiser && <UnpinLink onPress={() => unpin('dates')} />}
        </View>
      )}
      {!hasDates && (
        <ThemedText type="small" themeColor="textSecondary">
          📅 Dates: still being decided
        </ThemedText>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      )}
    </ThemedView>
  );
}

function UnpinLink({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <ThemedText type="small" style={{ color: theme.danger }}>
        Unpin
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  decided: {
    borderWidth: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  big: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: 700,
  },
});
