import { StyleSheet, View } from 'react-native';

import { border, colors } from '@/shared/theme/tokens';

import { Text } from './Text';

const palette = [colors.mint, colors.sky, colors.lilac, colors.pastelYellow, colors.pastelPeach];

export function Avatar({ name, size = 32, ai }: { name: string; size?: number; ai?: boolean }) {
  const initial = (ai ? 'IA' : name.trim().charAt(0) || '?').toUpperCase();
  const bg = ai ? colors.violet : palette[(name.length || 0) % palette.length];
  return (
    <View
      accessibilityLabel={ai ? 'IA' : name}
      style={[styles.base, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}
    >
      <Text style={{ fontWeight: '800', fontSize: size * 0.4, color: ai ? colors.card : colors.ink }}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: border.thin, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
});
