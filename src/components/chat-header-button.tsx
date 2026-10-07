import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ChatIcon } from '@/components/ui/icons';
import { useTheme } from '@/hooks/use-theme';
import { countUnreadChat, subscribeToComments } from '@/lib/chat';

/** 💬 in the trip page header, with a red badge for unread Group chat messages (updates live). */
export function ChatHeaderButton({ tripId, userId }: { tripId: string; userId: string }) {
  const theme = useTheme();
  const [unread, setUnread] = useState(0);

  // Recount whenever the trip page comes back into view (e.g. after reading the chat).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      countUnreadChat(tripId, userId).then((n) => {
        if (active) setUnread(n);
      });
      return () => {
        active = false;
      };
    }, [tripId, userId])
  );

  // Someone else posts in the Group chat → bump the badge straight away.
  useEffect(
    () =>
      subscribeToComments(tripId, (comment) => {
        if (comment.target_type === 'trip' && comment.user_id !== userId) setUnread((n) => n + 1);
      }),
    [tripId, userId]
  );

  const label = unread > 0 ? `Group chat, ${unread} unread` : 'Group chat';

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trip/[id]/discussion', params: { id: tripId } })}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <ChatIcon color={theme.text} />
      {unread > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.background }]}>
          <ThemedText style={styles.badgeText}>{unread > 99 ? '99+' : unread}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: 800,
  },
  pressed: {
    opacity: 0.6,
  },
});
