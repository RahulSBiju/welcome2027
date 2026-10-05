import { supabase } from '@/lib/supabase';

// Only the organiser can change these (database rule "trips: owner updates").
// Each function returns an error message, or null on success.

async function updateTrip(tripId: string, values: Record<string, string | null>) {
  // .select() returns the updated row, so we can tell if the database allowed it.
  const { data, error } = await supabase.from('trips').update(values).eq('id', tripId).select('id');
  if (error) {
    return error.message.includes('pinned_')
      ? 'Pinning needs database update 003. Run supabase/003_pin_packing_push.sql in Supabase.'
      : error.message;
  }
  if (!data?.length) return 'Only the organiser can lock in the final plan.';
  return null;
}

export function pinPlace(tripId: string, placeId: string | null) {
  return updateTrip(tripId, { pinned_location_id: placeId });
}

export function pinDates(tripId: string, start: string | null, end: string | null) {
  return updateTrip(tripId, { pinned_start: start, pinned_end: end });
}
