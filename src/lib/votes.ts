import { supabase } from '@/lib/supabase';

/** Adds or removes my upvote on a place. Returns an error message, or null on success. */
export async function setVote(placeId: string, userId: string, vote: boolean) {
  const { error } = vote
    ? await supabase.from('location_votes').insert({ location_id: placeId, user_id: userId })
    : await supabase.from('location_votes').delete().eq('location_id', placeId).eq('user_id', userId);
  return error?.message ?? null;
}
