import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, shadow } from '@/shared/theme/tokens';

interface Props {
  children: ReactNode;
  offset?: number;
  radius: number;
  style?: StyleProp<ViewStyle>;
}

/** Sombra dura sin desenfoque: una capa de tinta desplazada detrás del contenido. */
export function HardShadow({ children, offset = shadow.md, radius, style }: Props) {
  return (
    <View style={[{ paddingRight: offset, paddingBottom: offset }, style]}>
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { top: offset, left: offset, backgroundColor: colors.ink, borderRadius: radius },
        ]}
      />
      {children}
    </View>
  );
}
