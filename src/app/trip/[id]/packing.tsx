import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { PackingItem, TripMember } from '@/lib/types';

export default function PackingScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { session } = useSession();
  const myUserId = session!.user.id;

  const [items, setItems] = useState<PackingItem[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [organiserId, setOrganiserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newIsPersonal, setNewIsPersonal] = useState(false);
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    const [itemsResult, membersResult, tripResult] = await Promise.all([
      supabase.from('packing_items').select('*').eq('trip_id', tripId).order('created_at'),
      supabase.from('trip_members').select('user_id, role, leave_days, profiles(display_name)').eq('trip_id', tripId),
      supabase.from('trips').select('created_by').eq('id', tripId).maybeSingle(),
    ]);
    if (itemsResult.error) {
      setError(
        itemsResult.error.message.includes('packing_items')
          ? 'The packing list needs database update 003. Run supabase/003_pin_packing_push.sql in Supabase.'
          : itemsResult.error.message
      );
    } else {
      setError(null);
      setItems(itemsResult.data as PackingItem[]);
    }
    setMembers((membersResult.data ?? []) as unknown as TripMember[]);
    setOrganiserId(tripResult.data?.created_by ?? null);
    setLoading(false);
  }, [tripId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const nameOf = (userId: string | null) =>
    userId === myUserId ? 'You' : members.find((m) => m.user_id === userId)?.profiles?.display_name || 'Someone';

  async function addItem() {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    const { error: insertError } = await supabase
      .from('packing_items')
      .insert({ trip_id: tripId, title, is_personal: newIsPersonal, created_by: myUserId });
    setAdding(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setNewTitle('');
    loadData();
  }

  /** Update one item on screen straight away, then save it. */
  async function updateItem(item: PackingItem, changes: Partial<PackingItem>) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...changes } : i)));
    const { error: updateError } = await supabase.from('packing_items').update(changes).eq('id', item.id);
    if (updateError) {
      setError(updateError.message);
      loadData();
    }
  }

  async function deleteItem(item: PackingItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error: deleteError } = await supabase.from('packing_items').delete().eq('id', item.id);
    if (deleteError) {
      setError(deleteError.message);
      loadData();
    }
  }

  const shared = items.filter((i) => !i.is_personal);
  const personal = items.filter((i) => i.is_personal && i.created_by === myUserId);
  const canDelete = (item: PackingItem) => item.created_by === myUserId || organiserId === myUserId;

  function renderRow(item: PackingItem) {
    const mine = item.assigned_to === myUserId;
    return (
      <View key={item.id} style={[styles.itemRow, { borderColor: theme.border }]}>
        {/* Packed checkbox */}
        <Pressable
          onPress={() => updateItem(item, { is_packed: !item.is_packed })}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.is_packed }}
          accessibilityLabel={`Packed: ${item.title}`}
          style={[
            styles.checkbox,
            { borderColor: item.is_packed ? theme.primary : theme.border },
            item.is_packed && { backgroundColor: theme.primary },
          ]}>
          {item.is_packed && <ThemedText style={[styles.tick, { color: theme.onPrimary }]}>✓</ThemedText>}
        </Pressable>

        <View style={styles.flex}>
          <ThemedText style={[item.is_packed && styles.done, item.is_packed && { color: theme.textSecondary }]}>
            {item.title}
          </ThemedText>
          {!item.is_personal &&
            (item.assigned_to ? (
              <ThemedText type="small" themeColor="textSecondary">
                {mine ? '🙋 You’re bringing this · ' : `🙋 ${nameOf(item.assigned_to)} is bringing this`}
                {mine && (
                  <ThemedText
                    type="small"
                    style={{ color: theme.primary }}
                    onPress={() => updateItem(item, { assigned_to: null, is_packed: false })}>
                    Unclaim
                  </ThemedText>
                )}
              </ThemedText>
            ) : (
              <ThemedText
                type="smallBold"
                style={{ color: theme.primary }}
                onPress={() => updateItem(item, { assigned_to: myUserId })}>
                I&apos;ll bring it
              </ThemedText>
            ))}
        </View>

        {canDelete(item) && (
          <Pressable onPress={() => deleteItem(item)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Delete ${item.title}`}>
            <ThemedText type="small" style={{ color: theme.danger }}>
              ✕
            </ThemedText>
          </Pressable>
        )}
      </View>
    );
  }

  const packedCount = (list: PackingItem[]) => list.filter((i) => i.is_packed).length;

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: 'Packing list' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} />}>
        {/* Add an item */}
        <ThemedView type="backgroundElement" style={[styles.card, styles.form]}>
          <TextField
            label="Add an item"
            placeholder={newIsPersonal ? 'e.g. Sunscreen, charger…' : 'e.g. Bluetooth speaker, first-aid kit…'}
            value={newTitle}
            onChangeText={setNewTitle}
            maxLength={120}
            onSubmitEditing={addItem}
          />
          <View style={styles.toggleRow}>
            {[
              { personal: false, label: '🎒 Group gear' },
              { personal: true, label: '🧳 Just for me' },
            ].map((option) => {
              const selected = newIsPersonal === option.personal;
              return (
                <Pressable
                  key={option.label}
                  onPress={() => setNewIsPersonal(option.personal)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[
                    styles.toggle,
                    { borderColor: selected ? theme.primary : theme.border },
                    selected && { backgroundColor: theme.primary },
                  ]}>
                  <ThemedText type="smallBold" style={{ color: selected ? theme.onPrimary : theme.text }}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <Button title="Add" onPress={addItem} loading={adding} disabled={!newTitle.trim()} />
        </ThemedView>

        {error && <ThemedText style={{ color: theme.danger }}>{error}</ThemedText>}

        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          <>
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                🎒 GROUP GEAR {shared.length > 0 && `· ${packedCount(shared)}/${shared.length} packed`}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                {shared.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Things the group needs, like a speaker, cards or a first-aid kit. Tap &quot;I&apos;ll bring it&quot;
                    so nothing gets packed twice.
                  </ThemedText>
                ) : (
                  shared.map(renderRow)
                )}
              </ThemedView>
            </View>

            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                🧳 MY LIST {personal.length > 0 && `· ${packedCount(personal)}/${personal.length} packed`}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                {personal.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Your private checklist. Only you can see it.
                  </ThemedText>
                ) : (
                  personal.map(renderRow)
                )}
              </ThemedView>
            </View>
          </>
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
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  toggle: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: 800,
  },
  done: {
    textDecorationLine: 'line-through',
  },
});
