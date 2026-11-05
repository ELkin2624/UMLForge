import { useState } from 'react';
import { View } from 'react-native';

import { DiagramCanvas } from '@/features/diagram/DiagramCanvas';
import { NodeDetail } from '@/features/diagram/NodeDetail';
import type { SceneNode } from '@/features/diagram/scene';
import { useProject } from '@/features/projects/ProjectContext';
import { spacing } from '@/shared/theme/tokens';
import { Text } from '@/shared/ui';

export default function DiagramScreen() {
  const { data } = useProject();
  const [selected, setSelected] = useState<SceneNode | null>(null);

  return (
    <View style={{ flex: 1, padding: spacing.md, gap: spacing.sm }}>
      <Text variant="caption">Arrastra para mover · pellizca para zoom · doble toque para encajar · toca un elemento para ver su detalle.</Text>
      <View style={{ flex: 1 }}>
        <DiagramCanvas model={data?.data} selectedId={selected?.id ?? null} onSelectNode={setSelected} />
        {selected ? <NodeDetail node={selected} onClose={() => setSelected(null)} /> : null}
      </View>
    </View>
  );
}
