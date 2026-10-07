import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type Props = {
  message: string | null;
  isError?: boolean;
  /** Called when the toast should disappear (after a few seconds). */
  onHide: () => void;
};

/** A short message that floats at the top of the screen, then fades away by itself. */
export function Toast({ message, isError, onHide }: Props) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onHide, isError ? 5000 : 2500);
    return () => clearTimeout(timer);
  }, [message, isError, onHide]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { backgroundColor: isError ? '#D93036' : '#1F2328' }]}>
        <ThemedText type="smallBold" style={styles.text}>
          {message}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
    zIndex: 100,
  },
  toast: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: {
    color: '#ffffff',
    textAlign: 'center',
  },
});
