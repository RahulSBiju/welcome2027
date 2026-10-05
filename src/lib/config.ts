import { Platform } from 'react-native';

/** The published web app. Invite links and QR codes point here. */
const PRODUCTION_URL = 'https://yearend-trip.expo.app';

/**
 * Public half of the push-notification key pair (safe to publish).
 * The private half is only in push-keys.local.txt and Supabase's Edge Function secrets.
 */
export const VAPID_PUBLIC_KEY =
  'BNJ8zxdZOSASqdyfl2wSficLaGjiDKic_TW_iZuTfb3TUNTx5C7FkFoH-EziUPpdm23pWiAY358Z2kVKmHSqpA0';

/** People can pick trip dates up to this day. */
export const LAST_SELECTABLE_DATE = '2026-12-31';

/** Link that opens the app and joins a trip, e.g. https://yearend-trip.expo.app/join/A1B2C3 */
export function inviteLink(code: string) {
  // On the web, use whatever site we're on (so local testing links back to localhost).
  const base =
    Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : PRODUCTION_URL;
  return `${base}/join/${code}`;
}
