import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { border, colors, MIN_TOUCH, radius, shadow, spacing } from '@/shared/theme/tokens';

import { HardShadow } from './HardShadow';
import { Text } from './Text';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Etiqueta accesible si difiere del texto visible. */
  accessibilityLabel?: string;
}

/** Botón táctil: primario durazno, secundario blanco; presionado = durazno oscuro y sombra más corta. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  accessibilityLabel,
}: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
    >
      {({ pressed }) => (
        <HardShadow offset={pressed ? 0 : shadow.sm} radius={radius.md}>
          <View
            style={[
              styles.base,
              variant === 'primary' && { backgroundColor: pressed ? colors.btnPeachPressed : colors.btnPeach },
              variant === 'secondary' && { backgroundColor: pressed ? colors.cream : colors.card },
              variant === 'ghost' && { backgroundColor: pressed ? colors.cream : 'transparent' },
              inactive && { opacity: 0.55 },
              pressed && { transform: [{ translateX: shadow.sm }, { translateY: shadow.sm }] },
            ]}
          >
            {loading ? <ActivityIndicator color={colors.ink} /> : icon}
            <Text style={styles.label}>{label}</Text>
          </View>
        </HardShadow>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.lg,
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: { fontWeight: '600', fontSize: 14 },
});
