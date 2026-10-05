import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

/** A tappable card that opens another screen ("📍 Places ›"). */
export function NavCard({ title, subtitle, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.flex}>
          <ThemedText style={styles.title}>{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>
        <ThemedText style={[styles.chevron, { color: theme.textSecondary }]}>›</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontWeight: 600,
  },
  chevron: {
    fontSize: 28,
    lineHeight: 32,
  },
  pressed: {
    opacity: 0.7,
  },
});
