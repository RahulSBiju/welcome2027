import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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

/** Everyone in the trip, with their leave days and preferred dates in one place. */
export function MembersSection({ tripId, myUserId, isOrganiser, members, availability, onChanged }: Props) {
  const theme = useTheme();
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function deleteRange(rangeId: string) {
    setError(null);
    const { error: deleteError } = await supabase.from('availability').delete().eq('id', rangeId);
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

      {members.map((member) => {
        const isMe = member.user_id === myUserId;
        const ranges = availability.filter((a) => a.user_id === member.user_id);
        const canRemove = isOrganiser && !isMe;

        return (
          <ThemedView key={member.user_id} type="backgroundElement" style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.flex}>
                <ThemedText style={styles.bold}>
                  {member.profiles?.display_name || 'Unnamed'}
                  {isMe ? ' (you)' : ''}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {member.role === 'owner' ? '👑 Organiser' : 'Member'} ·{' '}
                  {member.leave_days != null ? `${member.leave_days} leave days` : 'Leave days not set'}
                </ThemedText>
              </View>
              {canRemove && confirmingRemoval !== member.user_id && (
                <Pressable
                  onPress={() => setConfirmingRemoval(member.user_id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${member.profiles?.display_name ?? 'member'} from trip`}>
                  <ThemedText type="small" style={{ color: theme.danger }}>
                    Remove
                  </ThemedText>
                </Pressable>
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
                    <Pressable
                      onPress={() => deleteRange(range.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Remove these dates">
                      <ThemedText type="small" style={{ color: theme.danger }}>
                        ✕
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              ))
            )}

            {/* Organiser confirms before removing someone */}
            {confirmingRemoval === member.user_id && (
              <View style={[styles.confirmBox, { borderColor: theme.danger }]}>
                <ThemedText type="small">
                  Remove {member.profiles?.display_name || 'this member'} from the trip? Their dates and votes
                  will be deleted too.
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
          </ThemedView>
        );
      })}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
