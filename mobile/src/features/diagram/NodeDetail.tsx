import { X } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { border, colors, radius, spacing } from '@/shared/theme/tokens';
import { Chip, Text } from '@/shared/ui';

import type { SceneNode } from './scene';

/** Hoja inferior de solo lectura con el detalle de un elemento. */
export function NodeDetail({ node, onClose }: { node: SceneNode; onClose: () => void }) {
  return (
    <View style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 4 }}>
          <Chip label={node.stereotype ? `«${node.stereotype}»` : node.isAbstract ? 'clase abstracta' : 'clase'} tone={node.kind === 'class' ? 'yellow' : node.kind === 'component' ? 'mint' : 'sky'} />
          <Text variant="heading">{node.name}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar detalle" onPress={onClose} style={styles.close}>
          <X size={18} color={colors.ink} />
        </Pressable>
      </View>
      <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: spacing.md }}>
        {node.attributes.length > 0 ? (
          <View style={{ gap: 2 }}>
            <Text variant="label">Atributos</Text>
            {node.attributes.map((r, i) => (
              <Text key={i} variant="mono">{r.text}</Text>
            ))}
          </View>
        ) : null}
        {node.operations.length > 0 ? (
          <View style={{ gap: 2 }}>
            <Text variant="label">{node.kind === 'interface' || node.kind === 'iface' ? 'Operaciones' : 'Métodos'}</Text>
            {node.operations.map((r, i) => (
              <Text key={i} variant="mono">{r.text}</Text>
            ))}
          </View>
        ) : null}
        {node.attributes.length === 0 && node.operations.length === 0 ? (
          <Text variant="caption">Sin atributos ni métodos.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.card,
    borderWidth: border.thick,
    borderColor: colors.ink,
    borderRadius: radius.xl,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  close: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
});
