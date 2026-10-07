import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  /**
   * primary: main action (solid blue) · secondary: grey · danger: grey with red text ·
   * tertiary: text only, for small inline actions like "More details"
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'tertiary';
  /** small: compact button for inline actions inside cards */
  size?: 'regular' | 'small';
  /** Red text, for tertiary actions like "Delete trip". */
  destructive?: boolean;
  loading?: boolean;
};

export function Button({ title, variant = 'primary', size = 'regular', destructive, loading, disabled, style, ...rest }: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  // Secondary buttons usually sit on grey cards, so they use the stronger "selected" grey.
  const backgroundColor =
    variant === 'primary' ? theme.primary : variant === 'tertiary' ? 'transparent' : theme.backgroundSelected;
  const textColor =
    variant === 'primary'
      ? theme.onPrimary
      : variant === 'danger'
        ? theme.danger
        : variant === 'tertiary'
          ? destructive
            ? theme.danger
            : theme.primary
          : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      hitSlop={size === 'small' ? 6 : undefined}
      style={(state) => [
        styles.button,
        size === 'small' && styles.small,
        variant === 'tertiary' && styles.tertiary,
        { backgroundColor },
        (state.pressed || isDisabled) && styles.dimmed,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <ThemedText type={size === 'small' ? 'smallBold' : 'default'} style={[styles.label, { color: textColor }]}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: {
    minHeight: 34,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  tertiary: {
    paddingHorizontal: Spacing.two,
  },
  label: {
    fontWeight: 600,
  },
  dimmed: {
    opacity: 0.6,
  },
});
