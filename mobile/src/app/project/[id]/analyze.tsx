import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DataDesignView, type DataTab } from '@/features/analysis/DataDesignView';
import { ValidationView } from '@/features/analysis/ValidationView';
import { useProject } from '@/features/projects/ProjectContext';
import { border, colors, MIN_TOUCH, radius, spacing } from '@/shared/theme/tokens';
import { EmptyState, Screen, Text } from '@/shared/ui';

type Section = 'validation' | DataTab;
const sections: { key: Section; label: string }[] = [
  { key: 'validation', label: 'Validación' },
  { key: 'logical', label: 'Lógico' },
  { key: 'normalization', label: 'Normalización' },
  { key: 'db', label: 'Diagrama BD' },
];

export default function AnalyzeScreen() {
  const { id, data } = useProject();
  const [section, setSection] = useState<Section>('validation');
  const model = data?.data;
  const empty = !model || ((model.classes?.length ?? 0) === 0 && (model.components?.length ?? 0) === 0);

  return (
    <Screen topInset={false}>
      <View style={styles.segments} accessibilityRole="tablist">
        {sections.map((s) => (
          <Pressable
            key={s.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === s.key }}
            onPress={() => setSection(s.key)}
            style={[styles.segment, section === s.key && styles.active]}
          >
            <Text style={{ fontWeight: section === s.key ? '800' : '600', fontSize: 12 }}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      {empty ? (
        <EmptyState title="Nada que analizar" hint="El diagrama está vacío." />
      ) : section === 'validation' ? (
        <ValidationView model={model} />
      ) : (
        <DataDesignView id={id} model={model} tab={section} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  segment: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  active: { backgroundColor: colors.btnPeach },
});
