import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { border, colors, MIN_TOUCH, radius, spacing } from '@/shared/theme/tokens';

import { Text } from './Text';

interface Props extends TextInputProps {
  label: string;
  error?: string | null;
  /** Si es true o si secureTextEntry es true, muestra el botón de ver/ocultar contraseña */
  isPassword?: boolean;
}

/** Campo con etiqueta arriba (12px/600 gris); el foco se marca con borde más grueso y soporte para ver contraseña. */
export function Input({ label, error, onFocus, onBlur, style, secureTextEntry, isPassword, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const isPasswordField = isPassword ?? !!secureTextEntry;
  const [showPassword, setShowPassword] = useState(!isPasswordField);

  return (
    <View style={styles.wrap}>
      <Text variant="label">{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.gray}
          secureTextEntry={isPasswordField ? !showPassword : secureTextEntry}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            isPasswordField && styles.passwordInput,
            focused && styles.focused,
            !!error && styles.invalid,
            style,
          ]}
        />
        {isPasswordField ? (
          <Pressable
            hitSlop={12}
            onPress={() => setShowPassword((prev) => !prev)}
            style={styles.eyeBtn}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
          >
            {showPassword ? (
              <EyeOff size={20} color={colors.ink} />
            ) : (
              <Eye size={20} color={colors.gray} />
            )}
          </Pressable>
        ) : null}
      </View>
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
  inputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
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
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  focused: { borderWidth: border.thick, backgroundColor: colors.pastelYellow },
  invalid: { borderColor: colors.error },
});
