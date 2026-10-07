import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { PlaceVibesModal } from '@/components/place-vibes-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/auth-context';
import { normaliseLink, openLink, shortHost } from '@/lib/links';
import { vibesWindow } from '@/lib/place-vibes';
import { supabase } from '@/lib/supabase';
import type { Place, Trip } from '@/lib/types';
import { setVote } from '@/lib/votes';

type PlaceWithCounts = Place & { location_images: { count: number }[] };

export default function PlacesScreen() {
  // ?suggest=1 (from the "Suggest a place" button on the trip page) opens the form straight away.
  const { id: tripId, suggest } = useLocalSearchParams<{ id: string; suggest?: string }>();
  const theme = useTheme();
  const { session } = useSession();
  const myUserId = session!.user.id;

  const [places, setPlaces] = useState<PlaceWithCounts[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [pinnedPlaceId, setPinnedPlaceId] = useState<string | null>(null);
  const [pinnedDates, setPinnedDates] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [vibesPlace, setVibesPlace] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-place form
  const [formOpen, setFormOpen] = useState(suggest === '1');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const loadPlaces = useCallback(async () => {
    setError(null);
    const [placesResult, commentsResult, tripResult] = await Promise.all([
      supabase
        .from('locations')
        .select(
          'id, trip_id, name, description, link_url, added_by, created_at, profiles!added_by(display_name), location_votes(user_id), location_images(count)'
        )
        .eq('trip_id', tripId)
        .order('created_at'),
      supabase.from('comments').select('target_id').eq('trip_id', tripId).eq('target_type', 'location'),
      supabase.from('trips').select('*').eq('id', tripId).maybeSingle(),
    ]);
    const loadedTrip = tripResult.data as Trip | null;
    setPinnedPlaceId(loadedTrip?.pinned_location_id ?? null);
    setPinnedDates({ start: loadedTrip?.pinned_start ?? null, end: loadedTrip?.pinned_end ?? null });
    if (placesResult.error) {
      setError(placesResult.error.message);
    } else {
      setPlaces(placesResult.data as unknown as PlaceWithCounts[]);
    }
    const counts: Record<string, number> = {};
    commentsResult.data?.forEach((c) => {
      if (c.target_id) counts[c.target_id] = (counts[c.target_id] ?? 0) + 1;
    });
    setCommentCounts(counts);
    setLoading(false);
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      loadPlaces();
    }, [loadPlaces])
  );

  async function addPlace() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Give the place a name.');
      return;
    }
    const cleanLink = link.trim() ? normaliseLink(link) : null;
    if (link.trim() && !cleanLink) {
      setFormError("That link doesn't look right. Try copying it from your browser.");
      return;
    }

    setFormError(null);
    setSaving(true);
    const { data: added, error: insertError } = await supabase
      .from('locations')
      .insert({
        trip_id: tripId,
        added_by: myUserId,
        name: trimmedName,
        description: description.trim() || null,
        link_url: cleanLink,
      })
      .select('id')
      .single();
    setSaving(false);

    if (insertError) {
      setFormError(insertError.message);
      return;
    }
    setName('');
    setDescription('');
    setLink('');
    setFormOpen(false);
    loadPlaces();
    // Pop up "Place vibes" for the person who suggested it (others open it from the place page).
    setVibesPlace({ id: added.id, name: trimmedName });
  }

  async function toggleVote(place: Place) {
    const hasVoted = place.location_votes.some((v) => v.user_id === myUserId);

    // Update the screen straight away, then save.
    setPlaces((prev) =>
      prev.map((p) =>
        p.id !== place.id
          ? p
          : {
              ...p,
              location_votes: hasVoted
                ? p.location_votes.filter((v) => v.user_id !== myUserId)
                : [...p.location_votes, { user_id: myUserId }],
            }
      )
    );

    const voteError = await setVote(place.id, myUserId, !hasVoted);
    if (voteError) {
      setError(voteError);
      loadPlaces(); // undo the on-screen change
    }
  }

  async function deletePlace(placeId: string) {
    setConfirmingDelete(null);
    const { error: deleteError } = await supabase.from('locations').delete().eq('id', placeId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    loadPlaces();
  }

  // Most votes first; ties keep the order they were suggested in.
  const ranked = [...places].sort((a, b) => b.location_votes.length - a.location_votes.length);

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: 'Places' }} />
      <PlaceVibesModal
        place={vibesPlace}
        window={vibesWindow(pinnedDates.start, pinnedDates.end)}
        onClose={() => setVibesPlace(null)}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadPlaces} />}>
        {/* Suggest a place */}
        {formOpen ? (
          <ThemedView type="backgroundElement" style={[styles.card, styles.form]}>
            <ThemedText type="smallBold">Suggest a place</ThemedText>
            <TextField
              label="Place"
              placeholder="e.g. Gokarna, Karnataka"
              value={name}
              onChangeText={setName}
              maxLength={120}
            />
            <TextField
              label="Why go? (optional)"
              placeholder="Beaches, cafes, sunset treks…"
              value={description}
              onChangeText={setDescription}
              multiline
              style={styles.multiline}
            />
            <TextField
              label="Link (optional)"
              placeholder="Paste a blog, Instagram or stay link"
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {formError && (
              <ThemedText type="small" style={{ color: theme.danger }}>
                {formError}
              </ThemedText>
            )}
            <View style={styles.row}>
              <View style={styles.flex}>
                <Button title="Add place" onPress={addPlace} loading={saving} />
              </View>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  setFormOpen(false);
                  setFormError(null);
                }}
              />
            </View>
          </ThemedView>
        ) : (
          <Button title="＋ Suggest a place" onPress={() => setFormOpen(true)} />
        )}

        {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : ranked.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText themeColor="textSecondary">
              No places yet. Be the first to suggest where the gang should go! 🏝️
            </ThemedText>
          </ThemedView>
        ) : (
          <View style={styles.list}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              RANKED BY VOTES
            </ThemedText>
            {ranked.map((place, index) => {
              const votes = place.location_votes.length;
              const hasVoted = place.location_votes.some((v) => v.user_id === myUserId);
              const isMine = place.added_by === myUserId;

              return (
                <ThemedView key={place.id} type="backgroundElement" style={[styles.card, styles.placeCard]}>
                  <View style={styles.placeRow}>
                    {/* Tap the place to open photos & comments */}
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: '/trip/[id]/place/[placeId]',
                          params: { id: tripId, placeId: place.id },
                        })
                      }
                      style={({ pressed }) => [styles.flex, styles.gapSmall, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${place.name}`}>
                      <ThemedText style={styles.placeName}>
                        {index === 0 && votes > 0 ? '🏆 ' : `${index + 1}. `}
                        {place.name}
                      </ThemedText>
                      {place.id === pinnedPlaceId && (
                        <ThemedText type="smallBold" style={{ color: theme.primary }}>
                          📌 Final destination
                        </ThemedText>
                      )}
                      {place.description && (
                        <ThemedText type="small" numberOfLines={3}>
                          {place.description}
                        </ThemedText>
                      )}
                      {place.link_url && (
                        <Pressable onPress={() => openLink(place.link_url!)} hitSlop={6} style={styles.linkPress}>
                          <ThemedText type="small" style={{ color: theme.primary }}>
                            🔗 {shortHost(place.link_url)}
                          </ThemedText>
                        </Pressable>
                      )}
                      <ThemedText type="small" themeColor="textSecondary">
                        Suggested by {isMine ? 'you' : place.profiles?.display_name || 'someone'}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.primary }}>
                        💬 {commentCounts[place.id] ?? 0} · 📷 {place.location_images[0]?.count ?? 0} · Open ›
                      </ThemedText>
                    </Pressable>

                    {/* Vote button */}
                    <Pressable
                      onPress={() => toggleVote(place)}
                      accessibilityRole="button"
                      accessibilityLabel={hasVoted ? `Remove your vote for ${place.name}` : `Vote for ${place.name}`}
                      style={({ pressed }) => [
                        styles.voteButton,
                        {
                          backgroundColor: hasVoted ? theme.primary : theme.background,
                          borderColor: hasVoted ? theme.primary : theme.border,
                        },
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText style={[styles.voteArrow, { color: hasVoted ? theme.onPrimary : theme.text }]}>
                        ▲
                      </ThemedText>
                      <ThemedText type="smallBold" style={{ color: hasVoted ? theme.onPrimary : theme.text }}>
                        {votes}
                      </ThemedText>
                    </Pressable>
                  </View>

                  {isMine &&
                    (confirmingDelete === place.id ? (
                      <View style={styles.row}>
                        <View style={styles.flex}>
                          <Button title="Yes, delete" variant="danger" onPress={() => deletePlace(place.id)} />
                        </View>
                        <View style={styles.flex}>
                          <Button title="Cancel" variant="secondary" onPress={() => setConfirmingDelete(null)} />
                        </View>
                      </View>
                    ) : (
                      <Pressable onPress={() => setConfirmingDelete(place.id)} hitSlop={6} style={styles.deleteLink}>
                        <ThemedText type="small" style={{ color: theme.danger }}>
                          Delete my suggestion
                        </ThemedText>
                      </Pressable>
                    ))}
                </ThemedView>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  form: {
    gap: Spacing.three,
  },
  multiline: {
    minHeight: 80,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  gapSmall: {
    gap: Spacing.one,
  },
  placeCard: {
    gap: Spacing.two,
  },
  placeRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  placeName: {
    fontWeight: 600,
    fontSize: 17,
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
  deleteLink: {
    alignSelf: 'flex-start',
  },
  linkPress: {
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.7,
  },
});
