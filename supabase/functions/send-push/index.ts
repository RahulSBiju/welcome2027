// Supabase Edge Function "send-push" (runs on Supabase's servers, in Deno).
// The database calls this when a place is suggested, a comment is posted, someone joins,
// or the organiser pins the final plan. It sends a push notification to the trip's
// other members on every device where they turned notifications on.
//
// Deploy: Supabase dashboard > Edge Functions > Deploy a new function > Via Editor,
// name it "send-push", paste this file, and turn OFF "Verify JWT". See docs/PUSH_SETUP.md.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!
);

type Row = Record<string, any>;
type Message = { tripId: string; actorId: string; body: string; url: string; tag: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = (date: string) => {
  const [, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
const snippet = (text: string) => (text.length > 80 ? `${text.slice(0, 77)}…` : text);

async function nameOf(userId: string) {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle();
  return data?.display_name || 'Someone';
}

/** Works out what to say for each kind of event. Returns null if nothing should be sent. */
async function buildMessage(table: string, record: Row, old: Row | null): Promise<Message | null> {
  if (table === 'locations') {
    return {
      tripId: record.trip_id,
      actorId: record.added_by,
      body: `📍 ${await nameOf(record.added_by)} suggested ${record.name}`,
      url: `/trip/${record.trip_id}/place/${record.id}`,
      tag: `place-${record.id}`,
    };
  }

  if (table === 'comments') {
    const who = await nameOf(record.user_id);
    if (record.target_type === 'location' && record.target_id) {
      const { data: place } = await supabase.from('locations').select('name').eq('id', record.target_id).maybeSingle();
      return {
        tripId: record.trip_id,
        actorId: record.user_id,
        body: `💬 ${who} on ${place?.name ?? 'a place'}: ${snippet(record.body)}`,
        url: `/trip/${record.trip_id}/place/${record.target_id}`,
        tag: `comments-${record.target_id}`,
      };
    }
    return {
      tripId: record.trip_id,
      actorId: record.user_id,
      body: `💬 ${who} in Group chat: ${snippet(record.body)}`,
      url: `/trip/${record.trip_id}/discussion`,
      tag: `chat-${record.trip_id}`,
    };
  }

  if (table === 'trip_members') {
    if (record.role === 'owner') return null; // the organiser creating the trip
    return {
      tripId: record.trip_id,
      actorId: record.user_id,
      body: `👋 ${await nameOf(record.user_id)} joined the trip!`,
      url: `/trip/${record.trip_id}`,
      tag: `joined-${record.trip_id}`,
    };
  }

  if (table === 'trips' && old) {
    const placeNewlyPinned = record.pinned_location_id && record.pinned_location_id !== old.pinned_location_id;
    const datesNewlyPinned =
      record.pinned_start && (record.pinned_start !== old.pinned_start || record.pinned_end !== old.pinned_end);
    if (!placeNewlyPinned && !datesNewlyPinned) return null;

    const parts: string[] = [];
    if (placeNewlyPinned) {
      const { data: place } = await supabase.from('locations').select('name').eq('id', record.pinned_location_id).maybeSingle();
      parts.push(`we're going to ${place?.name ?? 'the chosen place'}`);
    }
    if (datesNewlyPinned) parts.push(`dates locked: ${day(record.pinned_start)} – ${day(record.pinned_end)}`);
    return {
      tripId: record.id,
      actorId: record.created_by,
      body: `📌 It's decided, ${parts.join(' · ')}! 🎉`,
      url: `/trip/${record.id}`,
      tag: `pinned-${record.id}`,
    };
  }

  return null;
}

Deno.serve(async (req) => {
  // Only the database (which knows the shared secret) may trigger notifications.
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('PUSH_WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { table, record, old_record } = await req.json();
  const message = await buildMessage(table, record, old_record);
  if (!message) return Response.json({ sent: 0, reason: 'nothing to send' });

  const { data: trip } = await supabase.from('trips').select('name').eq('id', message.tripId).maybeSingle();
  const { data: members } = await supabase.from('trip_members').select('user_id').eq('trip_id', message.tripId);
  const recipients = (members ?? []).map((m) => m.user_id).filter((id) => id !== message.actorId);
  if (recipients.length === 0) return Response.json({ sent: 0, reason: 'no recipients' });

  const { data: subscriptions } = await supabase.from('push_subscriptions').select('*').in('user_id', recipients);

  const payload = JSON.stringify({
    title: trip?.name ?? 'Welcome 2027',
    body: message.body,
    url: message.url,
    tag: message.tag,
  });

  let sent = 0;
  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent += 1;
      } catch (error) {
        // 404/410 = that browser unsubscribed or was reset: forget it.
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.error('push failed', status, error);
        }
      }
    })
  );

  return Response.json({ sent });
});
