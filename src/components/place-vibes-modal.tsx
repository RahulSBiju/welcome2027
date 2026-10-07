import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { openLink } from '@/lib/links';
import {
  funFactPrefix,
  getPlaceVibes,
  lowdownPrefix,
  vibesOpener,
  weatherLine,
  type PlaceVibes,
  type VibesWindow,
} from '@/lib/place-vibes';

type Props = {
  /** The place to show vibes for, or null to keep the pop-up closed. */
  place: { id: string; name: string } | null;
  window: VibesWindow;
  onClose: () => void;
};

/** "✨ Place vibes" pop-up: weather for the trip dates, a quick intro and a fun fact. */
export function PlaceVibesModal({ place, window, onClose }: Props) {
  const theme = useTheme();
  const [vibes, setVibes] = useState<PlaceVibes | null>(null);
  const [failed, setFailed] = useState(false);

  const { start, end, label } = window;
  const placeId = place?.id;
  const placeName = place?.name;
  useEffect(() => {
    if (!placeId || !placeName) return;
    let active = true;
    getPlaceVibes(placeId, placeName, { start, end, label })
      .then((result) => {
        if (active) setVibes(result);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      setVibes(null);
      setFailed(false);
    };
  }, [placeId, placeName, start, end, label]);

  const name = vibes?.location?.name ?? place?.name.split(',')[0] ?? '';
  const nothingFound = vibes && !vibes.weather && !vibes.lowdown && !vibes.wiki;

  // Credit each source we actually used (Wikimedia content is CC BY-SA).
  const sources: { label: string; url: string }[] = [];
  for (const url of [vibes?.lowdown?.url, vibes?.wiki?.url]) {
    if (!url) continue;
    const sourceLabel = url.includes('wikivoyage') ? 'Wikivoyage' : 'Wikipedia';
    if (!sources.some((s) => s.label === sourceLabel)) sources.push({ label: sourceLabel, url });
  }

  return (
    <Modal visible={place !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close place vibes">
        {/* Inner Pressable stops taps on the card from closing it */}
        <Pressable onPress={() => {}} style={styles.cardWrapper}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.header}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  ✨ PLACE VIBES
                </ThemedText>
                <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
                  <ThemedText style={[styles.close, { color: theme.textSecondary }]}>✕</ThemedText>
                </Pressable>
              </View>

              {!vibes && !failed && (
                <View style={styles.loading}>
                  <ActivityIndicator color={theme.primary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Digging up the good stuff on {place?.name}… 🕵️
                  </ThemedText>
                </View>
              )}

              {(failed || nothingFound) && (
                <ThemedText themeColor="textSecondary">
                  Couldn&apos;t find much on &quot;{place?.name}&quot; 🤷. Try a more specific name, like
                  &quot;Gokarna, Karnataka&quot;. Or keep the mystery alive!
                </ThemedText>
              )}

              {vibes && !nothingFound && (
                <>
                  {vibes.imageUrl && (
                    <Image source={vibes.imageUrl} style={styles.image} contentFit="cover" transition={200} />
                  )}
                  <ThemedText style={styles.opener}>{vibesOpener(name)}</ThemedText>

                  {vibes.weather && (
                    <View style={styles.block}>
                      <ThemedText type="smallBold">🌤️ Weather around {vibes.window.label}</ThemedText>
                      <ThemedText style={styles.temps}>
                        {vibes.weather.minC}° – {vibes.weather.maxC}°C
                      </ThemedText>
                      <ThemedText type="small">{weatherLine(vibes.weather).mood}</ThemedText>
                      <ThemedText type="small">{weatherLine(vibes.weather).rain}</ThemedText>
                    </View>
                  )}

                  {vibes.lowdown && (
                    <View style={styles.block}>
                      <ThemedText type="smallBold">{lowdownPrefix(name)}</ThemedText>
                      <ThemedText type="small">{vibes.lowdown.text}</ThemedText>
                    </View>
                  )}

                  {vibes.wiki && (
                    <View style={styles.block}>
                      <ThemedText type="smallBold">{funFactPrefix(name)}</ThemedText>
                      <ThemedText type="small">{vibes.wiki.fact}</ThemedText>
                    </View>
                  )}

                  <ThemedText type="small" themeColor="textSecondary" style={styles.credits}>
                    {vibes.weather ? `Weather: Open-Meteo, same dates in ${vibes.weather.years.join(' & ')}. ` : ''}
                    {sources.length > 0 && 'Info: '}
                    {sources.map((source, i) => (
                      <ThemedText
                        key={source.label}
                        type="small"
                        style={{ color: theme.primary }}
                        onPress={() => openLink(source.url)}>
                        {i > 0 ? ' & ' : ''}
                        {source.label}
                      </ThemedText>
                    ))}
                    {sources.length > 0 && ' (CC BY-SA)'}
                  </ThemedText>
                </>
              )}

              <Button title="Got it 👍" onPress={onClose} />
            </ScrollView>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
  },
  card: {
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  close: {
    fontSize: 20,
    lineHeight: 24,
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Spacing.three,
  },
  opener: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  block: {
    gap: Spacing.half,
  },
  temps: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: 700,
  },
  credits: {
    fontStyle: 'italic',
  },
});
