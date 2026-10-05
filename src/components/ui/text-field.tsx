import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = TextInputProps & {
  label: string;
};

export function TextField({ label, style, secureTextEntry, ...rest }: TextFieldProps) {
  const theme = useTheme();
  // Password fields get a Show/Hide toggle so people can check what they typed.
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrapper}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.background }]}>
        <TextInput
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={secureTextEntry && hidden}
          style={[styles.input, { color: theme.text }, style]}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            style={styles.toggle}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {hidden ? 'Show' : 'Hide'}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.one,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
  input: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  toggle: {
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
});
