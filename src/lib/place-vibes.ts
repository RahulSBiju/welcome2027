// "Place vibes": free facts about a suggested place, no API keys or costs.
//  - Map lookup + weather: Open-Meteo (geocoding + historical archive)
//  - Travel intro: Wikivoyage · Fun fact + photo: Wikipedia
// We save the raw facts once per place (locations.vibes). The casual wording is written
// at display time by the helpers at the bottom, so it can be tweaked without re-fetching.

import { formatDay } from '@/lib/dates';
import { supabase } from '@/lib/supabase';

export type VibesWindow = { start: string; end: string; label: string };

export type PlaceVibes = {
  version: 1;
  fetchedAt: string;
  query: string;
  window: VibesWindow;
  location: { name: string; region: string | null; country: string | null; lat: number; lon: number } | null;
  weather: { minC: number; maxC: number; rainyShare: number; years: number[] } | null;
  lowdown: { text: string; url: string } | null; // Wikivoyage
  wiki: { fact: string; url: string } | null; // Wikipedia
  imageUrl: string | null;
};

/** The dates to report weather for: the pinned trip dates, otherwise late December (it's a year-end trip). */
export function vibesWindow(pinnedStart?: string | null, pinnedEnd?: string | null): VibesWindow {
  if (pinnedStart && pinnedEnd) {
    return { start: pinnedStart, end: pinnedEnd, label: `${formatDay(pinnedStart)} – ${formatDay(pinnedEnd)}` };
  }
  return { start: '2026-12-20', end: '2026-12-31', label: 'late December' };
}

// ---------------------------------------------------------------- fetching

async function getJson(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

type Location = NonNullable<PlaceVibes['location']>;

/** Map matches for "Gokarna, Karnataka". hintMatch = the one whose region/country matches the part after the comma. */
async function findLocations(query: string) {
  const [placePart, ...hintParts] = query.split(',').map((s) => s.trim());
  const hint = hintParts.join(' ').toLowerCase();
  const data = await getJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(placePart)}&count=10&language=en`
  );
  const candidates: Location[] = (data.results ?? []).map((r: any) => ({
    name: r.name,
    region: r.admin1 ?? null,
    country: r.country ?? null,
    lat: r.latitude,
    lon: r.longitude,
  }));
  const hintMatch =
    (hint &&
      candidates.find((c) => [c.region, c.country].some((v) => v && hint.includes(v.toLowerCase())))) ||
    null;
  return { candidates, hintMatch };
}

/** Distance between two points in km. */
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Same dates shifted back by `years` (29 Feb becomes 28 Feb). */
function shiftYears(date: string, years: number) {
  const [y, m, d] = date.split('-');
  const day = m === '02' && d === '29' ? '28' : d;
  return `${Number(y) - years}-${m}-${day}`;
}

/** Real weather for the same dates over the last two years. */
async function fetchWeather(lat: number, lon: number, window: VibesWindow) {
  const years = [1, 2];
  const series = await Promise.all(
    years.map((back) =>
      getJson(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
          `&start_date=${shiftYears(window.start, back)}&end_date=${shiftYears(window.end, back)}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
      ).catch(() => null)
    )
  );
  const maxes: number[] = [];
  const mins: number[] = [];
  const rain: number[] = [];
  for (const s of series) {
    if (!s?.daily) continue;
    maxes.push(...s.daily.temperature_2m_max.filter((v: number | null) => v != null));
    mins.push(...s.daily.temperature_2m_min.filter((v: number | null) => v != null));
    rain.push(...s.daily.precipitation_sum.filter((v: number | null) => v != null));
  }
  if (maxes.length === 0) return null;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const thisYear = Number(window.start.slice(0, 4));
  return {
    minC: Math.round(avg(mins)),
    maxC: Math.round(avg(maxes)),
    rainyShare: rain.length ? rain.filter((mm) => mm >= 1).length / rain.length : 0,
    years: years.map((back) => thisYear - back),
  };
}

/**
 * Splits text into sentences: a . ! or ? followed by a space and a capital letter.
 * (So "1.4 million" or "St. Mary" don't count as sentence ends.)
 */
function splitSentences(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z"“(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** First 1–2 sentences, kept short. */
function firstSentences(text: string, count: number, maxLength = 320) {
  let result = splitSentences(text).slice(0, count).join(' ');
  if (result.length > maxLength) result = `${result.slice(0, maxLength - 1).trim()}…`;
  return result;
}

/** Picks the most "fun fact"-like sentence from a Wikipedia intro (not the dry first one). */
function pickFunFact(text: string) {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return null;
  const interesting = /famous|known|name|derived|meaning|oldest|largest|tallest|highest|only|first|legend|mentioned|nickname|popular|home to|referred/i;
  const boring = /population|census|as of \d{4}|inhabitants|square kilomet|km2|elevation of/i;
  const candidates = sentences.slice(1).filter((s) => !boring.test(s));
  const pick = candidates.find((s) => interesting.test(s)) ?? candidates[0] ?? sentences[0];
  return pick.length > 240 ? `${pick.slice(0, 239).trim()}…` : pick;
}

async function searchWiki(host: string, query: string) {
  const data = await getJson(
    `https://${host}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=3`
  );
  const titles: string[] = (data.query?.search ?? []).map((r: any) => r.title);
  for (const title of titles) {
    const summary = await getJson(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`).catch(
      () => null
    );
    if (summary && summary.type !== 'disambiguation' && summary.extract) return summary;
  }
  return null;
}

/**
 * Looks everything up from scratch. Each source is optional; whatever is found is returned.
 * Many names exist more than once (there's a Manali in Himachal *and* in Chennai), so the
 * travel guide (Wikivoyage) picks the destination, and its coordinates pick the map match,
 * unless the user typed a region ("Manali, Tamil Nadu"), which always wins.
 */
export async function fetchPlaceVibes(placeName: string, window: VibesWindow): Promise<PlaceVibes> {
  const [{ candidates, hintMatch }, voyageResult] = await Promise.all([
    findLocations(placeName).catch(() => ({ candidates: [] as Location[], hintMatch: null })),
    // Search the guide by the place name only ("Gokarna, Karnataka" would also match the Karnataka page).
    searchWiki('en.wikivoyage.org', placeName.split(',')[0].trim()).catch(() => null),
  ]);

  let voyage = voyageResult;
  const voyagePoint = voyage?.coordinates ? { lat: voyage.coordinates.lat, lon: voyage.coordinates.lon } : null;
  // The guide found a different place from the region the user typed → ignore the guide.
  if (hintMatch && voyagePoint && distanceKm(hintMatch, voyagePoint) > 100) voyage = null;

  let location: Location | null = hintMatch;
  if (!location && voyage && voyagePoint) {
    const nearest = [...candidates].sort((a, b) => distanceKm(a, voyagePoint) - distanceKm(b, voyagePoint))[0];
    location =
      nearest && distanceKm(nearest, voyagePoint) < 100
        ? nearest
        : { name: voyage.title, region: voyage.description ?? null, country: null, ...voyagePoint };
  }
  if (!location) location = candidates[0] ?? null;

  const searchName = location ? `${location.name} ${location.region ?? location.country ?? ''}`.trim() : placeName;
  const [weather, wiki] = await Promise.all([
    location ? fetchWeather(location.lat, location.lon, window).catch(() => null) : Promise.resolve(null),
    searchWiki('en.wikipedia.org', searchName).catch(() => null),
  ]);

  const fact = wiki ? pickFunFact(wiki.extract) : null;
  return {
    version: 1,
    fetchedAt: new Date().toISOString(),
    query: placeName,
    window,
    location,
    weather,
    lowdown: voyage
      ? { text: firstSentences(voyage.extract, 2), url: voyage.content_urls?.mobile?.page ?? voyage.content_urls?.desktop?.page }
      : wiki
        ? { text: firstSentences(wiki.extract, 1), url: wiki.content_urls?.mobile?.page ?? wiki.content_urls?.desktop?.page }
        : null,
    wiki: wiki && fact ? { fact, url: wiki.content_urls?.mobile?.page ?? wiki.content_urls?.desktop?.page } : null,
    imageUrl: voyage?.thumbnail?.source ?? wiki?.thumbnail?.source ?? null,
  };
}

/**
 * Saved vibes if they're for the same trip dates, otherwise fresh ones (then saved for everyone).
 * Works even before database update 004: it just won't save.
 */
export async function getPlaceVibes(placeId: string, placeName: string, window: VibesWindow) {
  const { data } = await supabase.from('locations').select('vibes').eq('id', placeId).maybeSingle();
  const saved = (data as { vibes?: PlaceVibes | null } | null)?.vibes;
  if (saved?.version === 1 && saved.window.start === window.start && saved.window.end === window.end) return saved;

  const fresh = await fetchPlaceVibes(placeName, window);
  await supabase.rpc('save_place_vibes', { p_place_id: placeId, p_vibes: fresh });
  return fresh;
}

// ---------------------------------------------------------------- casual wording

/** Same place → same phrasing every time (so it doesn't change on every open). */
function pick<T>(seed: string, options: T[]) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return options[hash % options.length];
}

export function vibesOpener(name: string) {
  return pick(name, [
    `Ooh, ${name}? Good shout 👀`,
    `${name}, huh? Someone's got taste 😏`,
    `Okay okay, ${name} is officially on the table 🍽️`,
    `${name}! Now we're talking 🙌`,
    `${name}? The group chat is about to get loud 📣`,
  ]);
}

export function weatherLine(w: NonNullable<PlaceVibes['weather']>) {
  const mood =
    w.maxC >= 32
      ? 'Properly hot. Sunscreen is non-negotiable ☀️🔥'
      : w.maxC >= 26
        ? 'Beach weather, basically. Shorts mode: on 😎'
        : w.maxC >= 20
          ? "T-shirt days, light-jacket nights. Chef's kiss 👌"
          : w.maxC >= 12
            ? 'Hoodie weather. Layers, my friend 🧥'
            : w.maxC >= 3
              ? 'Chilly! Bring the big jacket ❄️'
              : 'Freezing. Snowball fight, anyone? ⛄';
  const freezing = w.minC <= 0;
  const rain =
    freezing && w.rainyShare >= 0.2
      ? "Snow's on the cards ❄️ Waterproof boots, people"
      : w.rainyShare >= 0.5
      ? 'It rains a lot, so the umbrella is coming, no excuses ☔'
      : w.rainyShare >= 0.2
        ? 'A few showers here and there 🌦️'
        : 'Barely any rain 🙌';
  return { mood, rain };
}

export function funFactPrefix(name: string) {
  return pick(`${name}-fact`, ['Pub-quiz ammo 🍻', "Bet you didn't know 🤓", 'Drop this at dinner 💬', 'Fun fact, free of charge 🎁']);
}

export function lowdownPrefix(name: string) {
  return pick(`${name}-low`, ['The lowdown 📝', 'The vibe check ✅', 'Quick briefing 🗺️']);
}
