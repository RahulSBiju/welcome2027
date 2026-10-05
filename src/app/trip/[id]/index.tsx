import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BestDatesCard } from '@/components/trip/best-dates-card';
import { FinalPlanCard } from '@/components/trip/final-plan-card';
import { InviteCard } from '@/components/trip/invite-card';
import { MembersSection } from '@/components/trip/members-section';
import { MyAvailabilityCard } from '@/components/trip/my-availability-card';
import { Button } from '@/components/ui/button';
import { NavCard } from '@/components/ui/nav-card';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Availability, Trip, TripMember } from '@/lib/types';

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { session } = useSession();
  const myUserId = session!.user.id;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [placeCount, setPlaceCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);
  const [pinnedPlaceName, setPinnedPlaceName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leavingTrip, setLeavingTrip] = useState(false);

  const loadData = useCallback(async () => {
    setLoadError(null);
    const [tripResult, membersResult, availabilityResult, placesResult, chatResult] = await Promise.all([
      supabase.from('trips').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('trip_members')
        .select('user_id, role, leave_days, profiles(display_name)')
        .eq('trip_id', id)
        .order('joined_at'),
      supabase
        .from('availability')
        .select('id, user_id, start_date, end_date')
        .eq('trip_id', id)
        .order('start_date'),
      supabase.from('locations').select('id', { count: 'exact', head: true }).eq('trip_id', id),
      supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', id)
        .eq('target_type', 'trip'),
    ]);

    const firstError = tripResult.error ?? membersResult.error ?? availabilityResult.error;
    if (firstError) {
      setLoadError(firstError.message);
    } else if (!tripResult.data) {
      setTrip(null);
      setLoadError("This trip doesn't exist, or you're no longer a member of it.");
    } else {
      const loadedTrip = tripResult.data as Trip;
      setTrip(loadedTrip);
      // Name of the pinned (final) place, if the organiser has pinned one.
      if (loadedTrip.pinned_location_id) {
        const { data: pinned } = await supabase
          .from('locations')
          .select('name')
          .eq('id', loadedTrip.pinned_location_id)
          .maybeSingle();
        setPinnedPlaceName(pinned?.name ?? null);
      } else {
        setPinnedPlaceName(null);
      }
      setMembers(membersResult.data as unknown as TripMember[]);
      setAvailability(availabilityResult.data as Availability[]);
      setPlaceCount(placesResult.count ?? 0);
      setChatCount(chatResult.count ?? 0);
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  async function leaveTrip() {
    setLeavingTrip(true);
    const { error } = await supabase.from('trip_members').delete().eq('trip_id', id).eq('user_id', myUserId);
    setLeavingTrip(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    router.back();
  }

  if (loading) {
    return (
      <ThemedView style={[styles.flex, styles.centered]}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (!trip) {
    return (
      <ThemedView style={[styles.flex, styles.centered, styles.content]}>
        <ThemedText style={{ color: theme.danger }}>{loadError}</ThemedText>
        <Button title="Back to my trips" variant="secondary" onPress={() => router.replace('/')} />
      </ThemedView>
    );
  }

  const isOrganiser = trip.created_by === myUserId;
  const me = members.find((m) => m.user_id === myUserId);

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: trip.name }} />

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} />}>
        {loadError && <ThemedText style={{ color: theme.danger }}>{loadError}</ThemedText>}

        {/* 0. The locked-in plan (📌), if the organiser has pinned anything */}
        <FinalPlanCard trip={trip} pinnedPlaceName={pinnedPlaceName} isOrganiser={isOrganiser} onChanged={loadData} />

        {/* 1. Members, with their leave days and preferred dates */}
        <MembersSection
          tripId={trip.id}
          myUserId={myUserId}
          isOrganiser={isOrganiser}
          members={members}
          availability={availability}
          onChanged={loadData}
        />

        {/* 2. Best dates, worked out from everyone's dates */}
        <BestDatesCard
          trip={trip}
          isOrganiser={isOrganiser}
          members={members}
          availability={availability}
          onChanged={loadData}
        />

        {/* 3. My leave days + calendar */}
        <MyAvailabilityCard
          tripId={trip.id}
          myUserId={myUserId}
          myLeaveDays={me?.leave_days ?? null}
          myRanges={availability.filter((a) => a.user_id === myUserId)}
          onChanged={loadData}
        />

        {/* 4. Places, group chat, packing */}
        <View style={styles.navList}>
          <NavCard
            title="📍 Places"
            subtitle={
              placeCount === 0
                ? 'No suggestions yet. Suggest where to go!'
                : `${placeCount} ${placeCount === 1 ? 'suggestion' : 'suggestions'} · vote for your favourites`
            }
            onPress={() => router.push({ pathname: '/trip/[id]/places', params: { id: trip.id } })}
          />
          <NavCard
            title="💬 Group chat"
            subtitle={
              chatCount === 0
                ? 'Talk budget, travel and plans with the gang'
                : `${chatCount} ${chatCount === 1 ? 'message' : 'messages'}`
            }
            onPress={() => router.push({ pathname: '/trip/[id]/discussion', params: { id: trip.id } })}
          />
          <NavCard
            title="🎒 Packing list"
            subtitle="Group gear (who's bringing what) and your own checklist"
            onPress={() => router.push({ pathname: '/trip/[id]/packing', params: { id: trip.id } })}
          />
        </View>

        {/* 5. Invite */}
        <InviteCard trip={trip} />

        {!isOrganiser && (
          <Button title="Leave this trip" variant="danger" onPress={leaveTrip} loading={leavingTrip} />
        )}
      </ScrollView>
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
  navList: {
    gap: Spacing.two,
  },
});
