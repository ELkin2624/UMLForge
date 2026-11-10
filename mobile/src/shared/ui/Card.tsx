import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { border, colors, radius, shadow, spacing } from '@/shared/theme/tokens';

import { HardShadow } from './HardShadow';

interface Props {
  children: ReactNode;
  tone?: 'white' | 'cream' | 'yellow' | 'peach' | 'mint' | 'sky' | 'lilac' | 'error';
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

const tones = {
  white: colors.card,
  cream: colors.cream,
  yellow: colors.pastelYellow,
  peach: colors.pastelPeach,
  mint: colors.mint,
  sky: colors.sky,
  lilac: colors.lilac,
  error: colors.errorBg,
} as const;

/** Tarjeta: borde de tinta de 2px, radio 16 y sombra dura de 4px. */
export function Card({ children, tone = 'white', style, padded = true }: Props) {
  return (
    <HardShadow offset={shadow.lg} radius={radius.xl} style={style}>
      <View style={[styles.card, { backgroundColor: tones[tone] }, padded && styles.padded]}>
        {children}
      </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: border.thick,
    borderColor: colors.ink,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  padded: { padding: spacing.lg },
});
