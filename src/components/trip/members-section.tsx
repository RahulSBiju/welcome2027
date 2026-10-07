import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatRange } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import type { Availability, TripMember } from '@/lib/types';

type Props = {
  tripId: string;
  myUserId: string;
  isOrganiser: boolean;
  members: TripMember[];
  availability: Availability[];
  onChanged: () => void;
};

/**
 * Everyone in the trip. Collapsed (default): a row of initials avatars, so the page stays short
 * as the group grows. "More details" opens each person's leave days and preferred dates.
 */
export function MembersSection({ tripId, myUserId, isOrganiser, members, availability, onChanged }: Props) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [resettingRange, setResettingRange] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (member: TripMember) => member.profiles?.display_name || 'Unnamed';

  async function resetRange(rangeId: string) {
    setError(null);
    setResettingRange(rangeId);
    const { error: deleteError } = await supabase.from('availability').delete().eq('id', rangeId);
    setResettingRange(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    onChanged();
  }

  async function removeMember(userId: string) {
    setError(null);
    setRemoving(true);
    // .select() returns the deleted rows, so we can tell if the database actually allowed it.
    const { data, error: deleteError } = await supabase
      .from('trip_members')
      .delete()
      .eq('trip_id', tripId)
      .eq('user_id', userId)
      .select('user_id');
    setRemoving(false);
    setConfirmingRemoval(null);

    if (deleteError) {
      setError(deleteError.message);
    } else if (!data?.length) {
      setError("Couldn't remove this member. Has database update 002 been run in Supabase?");
    }
    onChanged();
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        MEMBERS ({members.length})
      </ThemedText>

      {error && (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      )}

      <ThemedView type="backgroundElement" style={styles.card}>
        {/* Collapsed view: avatars with initials */}
        <View style={styles.avatarRow}>
          {members.map((member) => {
            const isMe = member.user_id === myUserId;
            return (
              <View key={member.user_id} style={styles.avatarItem}>
                <View>
                  <Avatar id={member.user_id} name={nameOf(member)} highlighted={isMe} />
                  {member.role === 'owner' && <ThemedText style={styles.crown}>👑</ThemedText>}
                </View>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.avatarName}>
                  {isMe ? 'You' : nameOf(member).split(' ')[0]}
                </ThemedText>
              </View>
            );
          })}
        </View>

        <Button
          title={expanded ? 'Hide details ▴' : 'More details ▾'}
          variant="tertiary"
          size="small"
          onPress={() => setExpanded((e) => !e)}
          accessibilityState={{ expanded }}
          style={styles.toggle}
        />

        {/* Expanded view: everyone's leave days and dates */}
        {expanded &&
          members.map((member) => {
            const isMe = member.user_id === myUserId;
            const ranges = availability.filter((a) => a.user_id === member.user_id);
            const canRemove = isOrganiser && !isMe;

            return (
              <View key={member.user_id} style={[styles.detail, { borderColor: theme.border }]}>
                <View style={styles.headerRow}>
                  <Avatar id={member.user_id} name={nameOf(member)} size={32} />
                  <View style={styles.flex}>
                    <ThemedText style={styles.bold}>
                      {nameOf(member)}
                      {isMe ? ' (you)' : ''}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {member.role === 'owner' ? '👑 Organiser' : 'Member'} ·{' '}
                      {member.leave_days != null ? `${member.leave_days} leave days` : 'Leave days not set'}
                    </ThemedText>
                  </View>
                  {canRemove && confirmingRemoval !== member.user_id && (
                    <Button
                      title="Remove"
                      variant="danger"
                      size="small"
                      onPress={() => setConfirmingRemoval(member.user_id)}
                      accessibilityLabel={`Remove ${nameOf(member)} from trip`}
                    />
                  )}
                </View>

                {/* Their preferred dates */}
                {ranges.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No dates picked yet
                  </ThemedText>
                ) : (
                  ranges.map((range) => (
                    <View key={range.id} style={styles.rangeRow}>
                      <ThemedText type="small" style={styles.flex}>
                        📅 {formatRange(range.start_date, range.end_date)}
                      </ThemedText>
                      {isMe && (
                        <Button
                          title="Reset dates"
                          variant="secondary"
                          size="small"
                          loading={resettingRange === range.id}
                          onPress={() => resetRange(range.id)}
                          accessibilityLabel={`Reset dates ${formatRange(range.start_date, range.end_date)}`}
                        />
                      )}
                    </View>
                  ))
                )}

                {/* Organiser confirms before removing someone */}
                {confirmingRemoval === member.user_id && (
                  <View style={[styles.confirmBox, { borderColor: theme.danger }]}>
                    <ThemedText type="small">
                      Remove {nameOf(member)} from the trip? Their dates and votes will be deleted too.
                    </ThemedText>
                    <View style={styles.confirmButtons}>
                      <View style={styles.flex}>
                        <Button
                          title="Yes, remove"
                          variant="danger"
                          loading={removing}
                          onPress={() => removeMember(member.user_id)}
                        />
                      </View>
                      <View style={styles.flex}>
                        <Button title="Cancel" variant="secondary" onPress={() => setConfirmingRemoval(null)} />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
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
  avatarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  avatarItem: {
    alignItems: 'center',
    width: 56,
    gap: Spacing.one,
  },
  avatarName: {
    maxWidth: 56,
    textAlign: 'center',
  },
  crown: {
    position: 'absolute',
    top: -10,
    right: -6,
    fontSize: 16,
    lineHeight: 20,
  },
  toggle: {
    alignSelf: 'flex-start',
  },
  detail: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  confirmBox: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bold: {
    fontWeight: 600,
  },
});
