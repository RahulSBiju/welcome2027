import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { NotificationsCard } from '@/components/notifications-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/auth-context';
import { takePendingInvite } from '@/lib/pending-invite';
import { supabase } from '@/lib/supabase';
import type { Trip } from '@/lib/types';

type TripWithCount = Trip & { trip_members: { count: number }[] };

export default function MyTripsScreen() {
  const theme = useTheme();
  const { session } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [trips, setTrips] = useState<TripWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newTripName, setNewTripName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!session) return;
    setLoadError(null);

    const [profileResult, tripsResult] = await Promise.all([
      supabase.from('profiles').select('display_name').eq('id', session.user.id).single(),
      supabase
        .from('trips')
        .select('id, name, invite_code, created_by, created_at, trip_members(count)')
        .order('created_at', { ascending: false }),
    ]);

    if (profileResult.data) setDisplayName(profileResult.data.display_name);
    if (tripsResult.error) {
      setLoadError(tripsResult.error.message);
    } else {
      setTrips(tripsResult.data as TripWithCount[]);
    }
    setLoading(false);
  }, [session]);

  // Signed in after opening an invite link/QR code? Join that trip now.
  useEffect(() => {
    takePendingInvite().then(async (code) => {
      if (!code) return;
      const { data, error } = await supabase.rpc('join_trip', { p_code: code });
      if (error) {
        setJoinError(`Couldn't join with invite code ${code}: ${error.message}`);
        return;
      }
      router.push({ pathname: '/trip/[id]', params: { id: data as string } });
    });
  }, []);

  // Reload whenever this screen comes back into view (e.g. after leaving a trip).
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function handleCreateTrip() {
    const name = newTripName.trim();
    if (!name) {
      setCreateError('Give your trip a name first.');
      return;
    }
    setCreateError(null);
    setCreating(true);
    const { data, error } = await supabase.rpc('create_trip', { p_name: name });
    setCreating(false);

    if (error) {
      setCreateError(error.message);
      return;
    }
    setNewTripName('');
    router.push({ pathname: '/trip/[id]', params: { id: (data as Trip).id } });
  }

  async function handleJoinTrip() {
    const code = inviteCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError('Invite codes are 6 characters long.');
      return;
    }
    setJoinError(null);
    setJoining(true);
    const { data, error } = await supabase.rpc('join_trip', { p_code: code });
    setJoining(false);

    if (error) {
      setJoinError(error.message.includes('Invalid invite code') ? 'No trip found with that code.' : error.message);
      return;
    }
    setInviteCode('');
    router.push({ pathname: '/trip/[id]', params: { id: data as string } });
  }

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => supabase.auth.signOut()} hitSlop={12}>
              <ThemedText type="small" style={{ color: theme.primary }}>
                Sign out
              </ThemedText>
            </Pressable>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} />}>
        <ThemedText type="subtitle">Hi{displayName ? `, ${displayName}` : ''} 👋</ThemedText>

        {/* Trips list */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            YOUR TRIPS
          </ThemedText>

          {loadError && <ThemedText style={{ color: theme.danger }}>{loadError}</ThemedText>}

          {!loading && trips.length === 0 && !loadError && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText themeColor="textSecondary">
                No trips yet. Create one below, or join a friend&apos;s trip with their invite code.
              </ThemedText>
            </ThemedView>
          )}

          {trips.map((trip) => {
            const memberCount = trip.trip_members[0]?.count ?? 0;
            return (
              <Pressable
                key={trip.id}
                onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="default" style={styles.tripName}>
                    {trip.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {memberCount} {memberCount === 1 ? 'member' : 'members'} · Code {trip.invite_code}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </View>

        {session && <NotificationsCard userId={session.user.id} />}

        {/* Create a trip */}
        <ThemedView type="backgroundElement" style={[styles.card, styles.form]}>
          <ThemedText type="smallBold">Start a new trip</ThemedText>
          <TextField
            label="Trip name"
            placeholder="e.g. Year End 2026 🎉"
            value={newTripName}
            onChangeText={setNewTripName}
            maxLength={80}
            onSubmitEditing={handleCreateTrip}
          />
          {createError && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {createError}
            </ThemedText>
          )}
          <Button title="Create trip" onPress={handleCreateTrip} loading={creating} />
        </ThemedView>

        {/* Join a trip */}
        <ThemedView type="backgroundElement" style={[styles.card, styles.form]}>
          <ThemedText type="smallBold">Join a friend&apos;s trip</ThemedText>
          <TextField
            label="Invite code"
            placeholder="e.g. A1B2C3"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            onSubmitEditing={handleJoinTrip}
          />
          {joinError && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {joinError}
            </ThemedText>
          )}
          <Button title="Join trip" variant="secondary" onPress={handleJoinTrip} loading={joining} />
        </ThemedView>
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
  section: {
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
  tripName: {
    fontWeight: 600,
  },
  pressed: {
    opacity: 0.7,
  },
});
