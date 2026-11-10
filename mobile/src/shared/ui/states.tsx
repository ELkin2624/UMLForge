import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/shared/theme/tokens';

import { Button } from './Button';
import { Card } from './Card';
import { Text } from './Text';

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.ink} />
      <Text variant="caption">{label}</Text>
    </View>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <View style={styles.center}>
      {icon}
      <Text variant="heading">{title}</Text>
      {hint ? (
        <Text variant="caption" style={{ textAlign: 'center' }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tone="error">
      <View accessibilityRole="alert" style={{ gap: spacing.md }}>
        <Text variant="heading" style={{ color: colors.errorText }}>
          Algo salió mal
        </Text>
        <Text style={{ color: colors.errorText }}>{message}</Text>
        {onRetry ? <Button label="Reintentar" variant="secondary" onPress={onRetry} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xxl },
});
