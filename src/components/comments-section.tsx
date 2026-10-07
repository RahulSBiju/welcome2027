import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { subscribeToComments } from '@/lib/chat';
import { openLink, splitLinks } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/time';
import type { Comment } from '@/lib/types';

type Props = {
  tripId: string;
  myUserId: string;
  /** 'location' for a place's comments, 'trip' for the whole-trip discussion */
  targetType: 'location' | 'trip';
  /** The place id (leave out for the trip discussion) */
  targetId?: string;
  /** Changes when the parent screen is pulled to refresh */
  refreshKey?: number;
  emptyText?: string;
};

function fetchComments(tripId: string, targetType: string, targetId?: string) {
  const query = supabase
    .from('comments')
    .select('id, user_id, body, created_at, profiles!user_id(display_name)')
    .eq('trip_id', tripId)
    .eq('target_type', targetType)
    .order('created_at');
  return targetId ? query.eq('target_id', targetId) : query.is('target_id', null);
}

/** A comment thread that updates live. Links typed into a comment become tappable. */
export function CommentsSection({ tripId, myUserId, targetType, targetId, refreshKey, emptyText }: Props) {
  const theme = useTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after posting or deleting, to reload the thread.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let active = true; // ignore results that arrive after leaving the screen
    fetchComments(tripId, targetType, targetId).then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(loadError.message);
      else setComments(data as unknown as Comment[]);
    });
    return () => {
      active = false;
    };
  }, [tripId, targetType, targetId, refreshKey, version]);

  // Live: when anyone posts in this thread, reload it straight away.
  useEffect(
    () =>
      subscribeToComments(tripId, (comment) => {
        if (comment.target_type === targetType && (comment.target_id ?? undefined) === targetId) {
          setVersion((v) => v + 1);
        }
      }),
    [tripId, targetType, targetId]
  );

  async function postComment() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    setPosting(true);
    const { error: insertError } = await supabase.from('comments').insert({
      trip_id: tripId,
      target_type: targetType,
      target_id: targetId ?? null,
      user_id: myUserId,
      body,
    });
    setPosting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setDraft('');
    reload();
  }

  async function deleteComment(id: string) {
    const { error: deleteError } = await supabase.from('comments').delete().eq('id', id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    reload();
  }

  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        💬 COMMENTS ({comments.length})
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.card}>
        {comments.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            {emptyText ?? 'No comments yet. Start the conversation!'}
          </ThemedText>
        )}

        {comments.map((comment) => {
          const isMine = comment.user_id === myUserId;
          return (
            <View key={comment.id} style={[styles.comment, { borderColor: theme.border }]}>
              <View style={styles.commentHeader}>
                <ThemedText type="smallBold" style={styles.flex}>
                  {isMine ? 'You' : comment.profiles?.display_name || 'Someone'}
                  <ThemedText type="small" themeColor="textSecondary">
                    {'  '}
                    {timeAgo(comment.created_at)}
                  </ThemedText>
                </ThemedText>
                {isMine && (
                  <Pressable
                    onPress={() => deleteComment(comment.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete comment">
                    <ThemedText type="small" style={{ color: theme.danger }}>
                      Delete
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              <ThemedText type="small">
                {splitLinks(comment.body).map((part, i) =>
                  part.link ? (
                    <ThemedText
                      key={i}
                      type="small"
                      style={[styles.link, { color: theme.primary }]}
                      onPress={() => openLink(part.link!)}>
                      {part.text}
                    </ThemedText>
                  ) : (
                    part.text
                  )
                )}
              </ThemedText>
            </View>
          );
        })}

        {/* New comment */}
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a comment… paste links too"
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={2000}
          style={[
            styles.input,
            { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
          ]}
        />
        {error && (
          <ThemedText type="small" style={{ color: theme.danger }}>
            {error}
          </ThemedText>
        )}
        <Button title="Post comment" onPress={postComment} loading={posting} disabled={!draft.trim()} />
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
    gap: Spacing.three,
  },
  comment: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  link: {
    textDecorationLine: 'underline',
  },
  input: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    fontSize: 16,
    textAlignVertical: 'top',
  },
});
