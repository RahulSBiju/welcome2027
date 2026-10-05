import * as WebBrowser from 'expo-web-browser';

/** Adds https:// if someone types "airbnb.com/..." without it. Returns null if it isn't a usable link. */
export function normaliseLink(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 'https://www.airbnb.com/rooms/123' → 'airbnb.com' */
export function shortHost(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

/** Opens a link in the in-app browser (a new tab on the web). */
export function openLink(link: string) {
  return WebBrowser.openBrowserAsync(link);
}

const URL_PATTERN = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

/** Splits text into plain parts and link parts, so links in comments can be made tappable. */
export function splitLinks(text: string): { text: string; link: string | null }[] {
  const parts: { text: string; link: string | null }[] = [];
  for (const part of text.split(URL_PATTERN)) {
    if (part === '') continue;
    if (!/^(https?:\/\/|www\.)/i.test(part)) {
      parts.push({ text: part, link: null });
      continue;
    }
    // Punctuation straight after a link ("see example.com, it's great") isn't part of it.
    const trailing = part.match(/[.,!?;:)\]'"]+$/)?.[0] ?? '';
    const url = trailing ? part.slice(0, -trailing.length) : part;
    parts.push({ text: url, link: normaliseLink(url) });
    if (trailing) parts.push({ text: trailing, link: null });
  }
  return parts;
}
