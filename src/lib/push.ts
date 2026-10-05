import { Platform } from 'react-native';

import { VAPID_PUBLIC_KEY } from '@/lib/config';
import { supabase } from '@/lib/supabase';

// Web push notifications. Works in Chrome/Edge/Firefox (Android + desktop), and on iPhone
// once the app has been added to the Home Screen (iOS 16.4+).

export type PushSupport = 'supported' | 'needs-home-screen' | 'unsupported';

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function getPushSupport(): PushSupport {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'unsupported';
  const hasApis = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (hasApis) return 'supported';
  // iPhone Safari only allows push for apps added to the Home Screen.
  return isIos() ? 'needs-home-screen' : 'unsupported';
}

/** The browser wants the key as bytes, not as text. */
function keyToBytes(base64Url: string) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function getRegistration() {
  return navigator.serviceWorker.register('/sw.js');
}

/** Is this browser currently subscribed? */
export async function isPushEnabled() {
  if (getPushSupport() !== 'supported' || Notification.permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return !!(await registration?.pushManager.getSubscription());
}

/** Asks permission, subscribes this browser, and saves it so the server can notify us. */
export async function enablePush(userId: string): Promise<string | null> {
  if (getPushSupport() !== 'supported') return 'This browser does not support notifications.';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return 'Notifications are blocked. Allow them in your browser settings for this site, then try again.';
  }

  const registration = await getRegistration();
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    return error.message.includes('push_subscriptions')
      ? 'Notifications need database update 003. Run supabase/003_pin_packing_push.sql in Supabase.'
      : error.message;
  }
  return null;
}

/** Stops notifications on this browser. */
export async function disablePush(): Promise<string | null> {
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
  await subscription.unsubscribe();
  return error?.message ?? null;
}
