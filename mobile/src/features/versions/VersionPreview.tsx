import { X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiagramCanvas } from '@/features/diagram/DiagramCanvas';
import { getVersion } from '@/features/projects/api';
import { useAsync } from '@/shared/useAsync';
import { border, colors, radius, spacing } from '@/shared/theme/tokens';
import { Chip, ErrorBox, Loading, Text } from '@/shared/ui';

/** Vista previa de solo lectura de una versión pasada (no hay botón de restaurar en móvil). */
export function VersionPreview({ diagramId, version, onClose }: { diagramId: string; version: number; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useAsync(() => getVersion(diagramId, version), [diagramId, version]);
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.sm }]}>
        <View style={styles.head}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="heading">Versión {version}</Text>
            <Chip label="Vista previa · solo lectura" tone="mint" />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar vista previa" onPress={onClose} style={styles.close}>
            <X size={20} color={colors.ink} />
          </Pressable>
        </View>
        <View style={{ flex: 1 }}>
          {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={() => void reload()} /> : <DiagramCanvas model={data?.data} />}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream, paddingHorizontal: spacing.md, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
});
