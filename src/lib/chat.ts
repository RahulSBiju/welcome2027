import { supabase } from '@/lib/supabase';

/** Number of Group chat messages from other people since I last opened the chat. */
export async function countUnreadChat(tripId: string, userId: string) {
  const { data: read, error: readError } = await supabase
    .from('chat_reads')
    .select('last_read_at')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .maybeSingle();
  if (readError) return 0; // e.g. database update 004 not run yet: show no badge rather than a wrong one

  let query = supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', tripId)
    .eq('target_type', 'trip')
    .neq('user_id', userId);
  if (read?.last_read_at) query = query.gt('created_at', read.last_read_at);

  const { count } = await query;
  return count ?? 0;
}

/** Records that I've seen the chat up to now. */
export async function markChatRead(tripId: string) {
  await supabase.rpc('mark_chat_read', { p_trip_id: tripId });
}

type NewComment = { id: string; trip_id: string; user_id: string; target_type: string; target_id: string | null };

/**
 * Calls onInsert whenever someone posts a comment in this trip (live, via Supabase Realtime).
 * Returns a function that stops listening.
 */
export function subscribeToComments(tripId: string, onInsert: (comment: NewComment) => void) {
  const channel = supabase
    .channel(`comments-${tripId}-${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments', filter: `trip_id=eq.${tripId}` },
      (payload) => onInsert(payload.new as NewComment)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
