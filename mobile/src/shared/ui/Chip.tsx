import { StyleSheet, View } from 'react-native';

import { border, colors, radius, spacing } from '@/shared/theme/tokens';

import { Text } from './Text';

type Tone = 'mint' | 'yellow' | 'sky' | 'lilac' | 'peach' | 'white' | 'error';
const tones: Record<Tone, string> = {
  mint: colors.mint,
  yellow: colors.pastelYellow,
  sky: colors.sky,
  lilac: colors.lilac,
  peach: colors.pastelPeach,
  white: colors.card,
  error: colors.errorBg,
};

/** Pastilla de estado: siempre lleva texto (no solo color). */
export function Chip({ label, tone = 'white' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.chip, { backgroundColor: tones[tone] }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '700' },
});
