import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { CommentsSection } from '@/components/comments-section';
import { PhotoGallery } from '@/components/photo-gallery';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/auth-context';
import { openLink, shortHost } from '@/lib/links';
import { pinPlace } from '@/lib/pin';
import { supabase } from '@/lib/supabase';
import type { Place, Trip } from '@/lib/types';
import { setVote } from '@/lib/votes';

function fetchPlaceAndTrip(placeId: string, tripId: string) {
  return Promise.all([
    supabase
      .from('locations')
      .select('id, trip_id, name, description, link_url, added_by, created_at, profiles(display_name), location_votes(user_id)')
      .eq('id', placeId)
      .maybeSingle(),
    supabase.from('trips').select('*').eq('id', tripId).maybeSingle(),
  ]);
}

export default function PlaceDetailScreen() {
  const { id: tripId, placeId } = useLocalSearchParams<{ id: string; placeId: string }>();
  const theme = useTheme();
  const { session } = useSession();
  const myUserId = session!.user.id;

  const [place, setPlace] = useState<Place | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [pinning, setPinning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Pull-to-refresh bumps refreshKey, which reloads the place (and its photos & comments).
  const reload = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let active = true; // ignore results that arrive after leaving the screen
    fetchPlaceAndTrip(placeId, tripId).then(([placeResult, tripResult]) => {
      if (!active) return;
      const { data, error: loadError } = placeResult;
      if (loadError) setError(loadError.message);
      else if (!data) setError('This place was deleted, or you no longer have access to it.');
      setPlace(data as unknown as Place | null);
      setTrip(tripResult.data as Trip | null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [placeId, tripId, refreshKey]);

  async function togglePin() {
    if (!trip || !place) return;
    setPinning(true);
    const isPinned = trip.pinned_location_id === place.id;
    const pinError = await pinPlace(trip.id, isPinned ? null : place.id);
    setPinning(false);
    if (pinError) setError(pinError);
    reload();
  }

  async function toggleVote() {
    if (!place) return;
    const hasVoted = place.location_votes.some((v) => v.user_id === myUserId);
    setPlace({
      ...place,
      location_votes: hasVoted
        ? place.location_votes.filter((v) => v.user_id !== myUserId)
        : [...place.location_votes, { user_id: myUserId }],
    });
    const voteError = await setVote(place.id, myUserId, !hasVoted);
    if (voteError) {
      setError(voteError);
      reload(); // undo the on-screen change
    }
  }

  if (loading) {
    return (
      <ThemedView style={[styles.flex, styles.centered]}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (!place) {
    return (
      <ThemedView style={[styles.flex, styles.centered, styles.content]}>
        <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>
        <Button title="Back to places" variant="secondary" onPress={() => router.back()} />
      </ThemedView>
    );
  }

  const votes = place.location_votes.length;
  const hasVoted = place.location_votes.some((v) => v.user_id === myUserId);

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: place.name }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
          {/* Place info + vote */}
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.headerRow}>
              <View style={[styles.flex, styles.gapSmall]}>
                <ThemedText style={styles.placeName}>{place.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Suggested by {place.added_by === myUserId ? 'you' : place.profiles?.display_name || 'someone'}
                </ThemedText>
              </View>
              <Pressable
                onPress={toggleVote}
                accessibilityRole="button"
                accessibilityLabel={hasVoted ? 'Remove your vote' : 'Vote for this place'}
                style={({ pressed }) => [
                  styles.voteButton,
                  {
                    backgroundColor: hasVoted ? theme.primary : theme.background,
                    borderColor: hasVoted ? theme.primary : theme.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText style={[styles.voteArrow, { color: hasVoted ? theme.onPrimary : theme.text }]}>▲</ThemedText>
                <ThemedText type="smallBold" style={{ color: hasVoted ? theme.onPrimary : theme.text }}>
                  {votes}
                </ThemedText>
              </Pressable>
            </View>
            {place.description && <ThemedText>{place.description}</ThemedText>}
            {place.link_url && (
              <Pressable onPress={() => openLink(place.link_url!)} hitSlop={6}>
                <ThemedText type="small" style={{ color: theme.primary }}>
                  🔗 {shortHost(place.link_url)}
                </ThemedText>
              </Pressable>
            )}
            {trip?.pinned_location_id === place.id && (
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                📌 This is the final destination!
              </ThemedText>
            )}
            {trip?.created_by === myUserId && (
              <Button
                title={trip.pinned_location_id === place.id ? 'Unpin final destination' : '📌 Pin as final destination'}
                variant={trip.pinned_location_id === place.id ? 'secondary' : 'primary'}
                onPress={togglePin}
                loading={pinning}
              />
            )}
            {error && (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
            )}
          </ThemedView>

          <PhotoGallery tripId={tripId} placeId={place.id} myUserId={myUserId} refreshKey={refreshKey} />

          <CommentsSection
            tripId={tripId}
            myUserId={myUserId}
            targetType="location"
            targetId={place.id}
            refreshKey={refreshKey}
            emptyText="No comments yet. What does everyone think of this place?"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  gapSmall: {
    gap: Spacing.one,
  },
  placeName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: 700,
  },
  voteButton: {
    width: 56,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
  },
  voteArrow: {
    fontSize: 14,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.7,
  },
});
