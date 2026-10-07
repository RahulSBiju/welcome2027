import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// Friendly colours that keep white initials readable.
const COLOURS = ['#E5484D', '#F76B15', '#D6A100', '#30A46C', '#12A594', '#0090FF', '#3E63DD', '#8E4EC6', '#D6409F'];

/** 'Rahul S Biju' → 'RS', 'priya' → 'P' */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/** The same person always gets the same colour. */
function colourFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLOURS[hash % COLOURS.length];
}

type Props = {
  id: string;
  name: string;
  size?: number;
  /** Draws a ring around the avatar (used for "you"). */
  highlighted?: boolean;
};

export function Avatar({ id, name, size = 44, highlighted }: Props) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colourFor(id) },
        highlighted && { borderWidth: 3, borderColor: theme.primary },
      ]}>
      <ThemedText style={[styles.initials, { fontSize: size * 0.38, lineHeight: size * 0.46 }]}>
        {initialsOf(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#ffffff',
    fontWeight: 700,
  },
});
