import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet } from 'react-native';

import { CommentsSection } from '@/components/comments-section';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth-context';

/** General discussion for the whole trip: budget, travel plans, ideas… */
export default function DiscussionScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: 'Group chat' }} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => setRefreshKey((k) => k + 1)} />}>
          <CommentsSection
            tripId={tripId}
            myUserId={session!.user.id}
            targetType="trip"
            refreshKey={refreshKey}
            emptyText="Nothing here yet. Talk budget, travel plans, or share ideas and links with the gang."
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
  content: {
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
});
