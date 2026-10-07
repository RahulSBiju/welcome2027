import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/ui/avatar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { findBestStretches } from '@/lib/best-dates';
import { formatRange, weekdayCount } from '@/lib/dates';
import { pinDates } from '@/lib/pin';
import type { Availability, Trip, TripMember } from '@/lib/types';

type Props = {
  trip: Trip;
  isOrganiser: boolean;
  members: TripMember[];
  availability: Availability[];
  onChanged: () => void;
};

/** Ranks the stretches of days when the most people are free. */
export function BestDatesCard({ trip, isOrganiser, members, availability, onChanged }: Props) {
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);

  const stretches = findBestStretches(
    members.map((m) => m.user_id),
    availability
  );
  const nameOf = (userId: string) =>
    members.find((m) => m.user_id === userId)?.profiles?.display_name || 'Unnamed';
  // List names in the same order as the Members section.
  const memberOrder = (userId: string) => members.findIndex((m) => m.user_id === userId);
  const inMemberOrder = (ids: string[]) => [...ids].sort((a, b) => memberOrder(a) - memberOrder(b));

  // Bars are drawn relative to the longest stretch shown.
  const longest = Math.max(1, ...stretches.map((s) => s.days));

  async function lockIn(start: string, end: string) {
    setError(null);
    const err = await pinDates(trip.id, start, end);
    if (err) setError(err);
    onChanged();
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        ⭐ BEST DATES
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        {error && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        )}

        {stretches.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Once people pick their dates below, the days when the most people are free will show up here.
          </ThemedText>
        ) : (
          stretches.map((stretch, index) => {
            const everyone = stretch.freeUserIds.length === members.length;
            const notFree = members.filter((m) => !stretch.freeUserIds.includes(m.user_id));
            const isTop = index === 0;
            const isPinned = trip.pinned_start === stretch.start && trip.pinned_end === stretch.end;

            // Leave-days warning: weekdays in this stretch vs each free person's leave days.
            const leaveNeeded = weekdayCount(stretch.start, stretch.end);
            const shortOfLeave = stretch.freeUserIds
              .map((id) => members.find((m) => m.user_id === id))
              .filter((m): m is TripMember => !!m && m.leave_days != null && m.leave_days < leaveNeeded);

            return (
              <View
                key={`${stretch.start}-${stretch.freeUserIds.join()}`}
                style={[
                  styles.stretch,
                  index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border },
                ]}>
                <View style={styles.titleRow}>
                  <ThemedText style={[styles.bold, isTop && { color: theme.primary }]}>
                    {isPinned ? '📌 ' : isTop ? '🏆 ' : ''}
                    {formatRange(stretch.start, stretch.end)}
                  </ThemedText>
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.badge,
                      { backgroundColor: everyone ? theme.primary : theme.backgroundSelected },
                      everyone && { color: theme.onPrimary },
                    ]}>
                    {everyone ? 'Everyone 🎉' : `${stretch.freeUserIds.length} of ${members.length}`}
                  </ThemedText>
                </View>
                {/* Bar: length = number of days (vs the longest stretch), strength = share of people free */}
                <View
                  style={styles.barRow}
                  accessible
                  accessibilityLabel={`${stretch.days} days, ${stretch.freeUserIds.length} of ${members.length} free`}>
                  <View style={[styles.barTrack, { backgroundColor: theme.backgroundSelected }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.max(8, (stretch.days / longest) * 100)}%`,
                          backgroundColor: theme.primary,
                          opacity: 0.35 + 0.65 * (stretch.freeUserIds.length / members.length),
                        },
                      ]}
                    />
                  </View>
                  <ThemedText type="smallBold" style={styles.barLabel}>
                    {stretch.days} {stretch.days === 1 ? 'day' : 'days'}
                  </ThemedText>
                </View>

                {/* Who's in: full colour = free, greyed out = not free / no dates */}
                <View style={styles.avatarRow}>
                  {members.map((m) => {
                    const free = stretch.freeUserIds.includes(m.user_id);
                    return (
                      <View
                        key={m.user_id}
                        accessible
                        accessibilityLabel={`${nameOf(m.user_id)}: ${free ? 'free' : 'not free'}`}>
                        <Avatar id={m.user_id} name={nameOf(m.user_id)} size={30} muted={!free} />
                      </View>
                    );
                  })}
                </View>
                {notFree.length > 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    Not free / no dates: {notFree.map((m) => m.profiles?.display_name || 'Unnamed').join(', ')}
                  </ThemedText>
                )}
                <ThemedText type="small" themeColor="textSecondary">
                  Needs {leaveNeeded} weekday{leaveNeeded === 1 ? '' : 's'} off
                </ThemedText>
                {shortOfLeave.length > 0 && (
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    ⚠️ Not enough leave:{' '}
                    {inMemberOrder(shortOfLeave.map((m) => m.user_id))
                      .map((id) => {
                        const m = members.find((x) => x.user_id === id)!;
                        return `${m.profiles?.display_name || 'Unnamed'} (${m.leave_days})`;
                      })
                      .join(', ')}
                  </ThemedText>
                )}

                {isOrganiser && !isPinned && (
                  <Pressable onPress={() => lockIn(stretch.start, stretch.end)} hitSlop={6} style={styles.lockLink}>
                    <ThemedText type="smallBold" style={{ color: theme.primary }}>
                      📌 Lock in these dates
                    </ThemedText>
                  </Pressable>
                )}
                {isPinned && (
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    📌 Locked in
                  </ThemedText>
                )}
              </View>
            );
          })
        )}

        {stretches.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
            Weekdays only. Public holidays aren&apos;t counted, so you may need fewer leave days than shown.
          </ThemedText>
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.two,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  stretch: {
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
  bold: {
    fontWeight: 600,
    flexShrink: 1,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  barTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 6,
  },
  barLabel: {
    minWidth: 52,
    textAlign: 'right',
  },
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginVertical: Spacing.one,
  },
  lockLink: {
    alignSelf: 'flex-start',
    paddingTop: Spacing.one,
  },
  footnote: {
    paddingTop: Spacing.two,
    fontStyle: 'italic',
  },
});
