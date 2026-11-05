import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { border, colors, MIN_TOUCH, radius, spacing } from '@/shared/theme/tokens';

import { Text } from './Text';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
}

/** Campo con etiqueta arriba (12px/600 gris); el foco se marca con borde más grueso. */
export function Input({ label, error, onFocus, onBlur, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.gray}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.focused, !!error && styles.invalid, style]}
      />
      {error ? (
        <Text variant="caption" style={{ color: colors.errorText }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    minHeight: MIN_TOUCH,
    backgroundColor: colors.card,
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 14,
    color: colors.ink,
  },
  focused: { borderWidth: border.thick, backgroundColor: colors.pastelYellow },
  invalid: { borderColor: colors.error },
});
