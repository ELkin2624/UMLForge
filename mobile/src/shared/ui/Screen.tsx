import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/shared/theme/tokens';

interface Props {
  children: ReactNode;
  /** Sin scroll propio (listas, lienzos). */
  fixed?: boolean;
  /** Respeta el borde superior (pantallas sin cabecera de navegación). */
  topInset?: boolean;
}

/** Fondo crema con márgenes seguros y gutter de 16px. */
export function Screen({ children, fixed, topInset = true }: Props) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: topInset ? insets.top + spacing.sm : spacing.sm, paddingBottom: insets.bottom + spacing.lg };
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {fixed ? (
        <View style={[styles.fixed, pad]}>{children}</View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, pad]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  fixed: { flex: 1, paddingHorizontal: spacing.lg },
});
