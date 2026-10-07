import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import type { Trip } from '@/lib/types';

type Props = {
  trip: Trip;
  memberCount: number;
  myUserId: string;
  onChanged: () => void;
};

type Mode = 'view' | 'rename' | 'confirmDelete' | 'confirmLeave';

/**
 * A trip on My Trips. The organiser can rename or delete it (e.g. duplicates);
 * other members can leave it.
 */
export function TripCard({ trip, memberCount, myUserId, onChanged }: Props) {
  const theme = useTheme();
  const isOrganiser = trip.created_by === myUserId;
  const [mode, setMode] = useState<Mode>('view');
  const [name, setName] = useState(trip.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setMode('view');
    setName(trip.name);
    setError(null);
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('The trip needs a name.');
      return;
    }
    if (trimmed === trip.name) {
      reset();
      return;
    }
    setBusy(true);
    // .select() returns the changed row, so we can tell if the database allowed it.
    const { data, error: updateError } = await supabase.from('trips').update({ name: trimmed }).eq('id', trip.id).select('id');
    setBusy(false);
    if (updateError || !data?.length) {
      setError(updateError?.message ?? 'Only the organiser can rename this trip.');
      return;
    }
    setMode('view');
    onChanged();
  }

  async function deleteTrip() {
    setBusy(true);
    const { data, error: deleteError } = await supabase.from('trips').delete().eq('id', trip.id).select('id');
    setBusy(false);
    if (deleteError || !data?.length) {
      setError(deleteError?.message ?? 'Only the organiser can delete this trip.');
      return;
    }
    onChanged();
  }

  async function leaveTrip() {
    setBusy(true);
    const { error: leaveError } = await supabase.from('trip_members').delete().eq('trip_id', trip.id).eq('user_id', myUserId);
    setBusy(false);
    if (leaveError) {
      setError(leaveError.message);
      return;
    }
    onChanged();
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {mode === 'rename' ? (
        <View style={styles.gap}>
          <TextField
            label="Trip name"
            value={name}
            onChangeText={setName}
            maxLength={80}
            autoFocus
            onSubmitEditing={saveName}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title="Save" size="small" onPress={saveName} loading={busy} />
            </View>
            <View style={styles.flex}>
              <Button title="Cancel" variant="secondary" size="small" onPress={reset} />
            </View>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Open ${trip.name}`}
          style={({ pressed }) => [styles.gapSmall, pressed && styles.pressed]}>
          <ThemedText style={styles.tripName}>
            {trip.name} <ThemedText style={{ color: theme.textSecondary }}>›</ThemedText>
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {memberCount} {memberCount === 1 ? 'member' : 'members'} · Code {trip.invite_code}
            {isOrganiser ? ' · 👑 You organise this' : ''}
          </ThemedText>
        </Pressable>
      )}

      {/* Confirmations */}
      {mode === 'confirmDelete' && (
        <View style={[styles.confirmBox, { borderColor: theme.danger }]}>
          <ThemedText type="small">
            Delete <ThemedText type="smallBold">{trip.name}</ThemedText> for everyone? All its places, photos, dates,
            chat and packing list are deleted too. This can&apos;t be undone.
          </ThemedText>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title="Yes, delete trip" variant="danger" size="small" onPress={deleteTrip} loading={busy} />
            </View>
            <View style={styles.flex}>
              <Button title="Cancel" variant="secondary" size="small" onPress={reset} />
            </View>
          </View>
        </View>
      )}
      {mode === 'confirmLeave' && (
        <View style={[styles.confirmBox, { borderColor: theme.danger }]}>
          <ThemedText type="small">
            Leave <ThemedText type="smallBold">{trip.name}</ThemedText>? Your dates and votes are removed. You can rejoin
            with the invite code.
          </ThemedText>
          <View style={styles.row}>
            <View style={styles.flex}>
              <Button title="Yes, leave" variant="danger" size="small" onPress={leaveTrip} loading={busy} />
            </View>
            <View style={styles.flex}>
              <Button title="Cancel" variant="secondary" size="small" onPress={reset} />
            </View>
          </View>
        </View>
      )}

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      )}

      {/* Actions */}
      {mode === 'view' && (
        <View style={styles.actions}>
          {isOrganiser ? (
            <>
              <Button title="✏️ Rename" variant="tertiary" size="small" onPress={() => {
                  setName(trip.name);
                  setMode('rename');
                }}
              />
              <Button title="Delete trip" variant="tertiary" size="small" destructive onPress={() => setMode('confirmDelete')} />
            </>
          ) : (
            <Button title="Leave trip" variant="tertiary" size="small" destructive onPress={() => setMode('confirmLeave')} />
          )}
        </View>
      )}
    </ThemedView>
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
  gap: {
    gap: Spacing.two,
  },
  gapSmall: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tripName: {
    fontWeight: 600,
    fontSize: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginLeft: -Spacing.two, // line up the text-only buttons with the trip name
  },
  confirmBox: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});
