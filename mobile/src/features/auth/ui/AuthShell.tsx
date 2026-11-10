import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Screen, Text } from '@/shared/ui';
import { border, colors, spacing } from '@/shared/theme/tokens';

/** Fondo crema con formas decorativas inclinadas, marca arriba y tarjeta de formulario (AuthPage web). */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View pointerEvents="none" style={[styles.shape, styles.yellow]} />
      <View pointerEvents="none" style={[styles.shape, styles.peach]} />
      <Screen>
        <Text style={styles.brand}>UMLForge</Text>
        <View style={{ height: spacing.xl }} />
        <Card>
          <View style={{ gap: spacing.lg }}>
            <View style={{ gap: 4 }}>
              <Text variant="title">{title}</Text>
              <Text variant="caption">{subtitle}</Text>
            </View>
            {children}
          </View>
        </Card>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  shape: { position: 'absolute', borderWidth: border.thick, borderColor: colors.ink, borderRadius: 12 },
  yellow: { width: 150, height: 150, backgroundColor: colors.yellow, top: 80, right: -40, transform: [{ rotate: '12deg' }] },
  peach: { width: 130, height: 130, backgroundColor: colors.peach, bottom: 60, left: -40, transform: [{ rotate: '-10deg' }] },
});
