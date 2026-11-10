import { Maximize2, Minus, Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Animated, type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { border, colors, MIN_TOUCH, radius, spacing } from '@/shared/theme/tokens';
import { EmptyState } from '@/shared/ui';
import type { UMLModel } from '@/types/canonical-model';

import { SceneSvg } from './SceneSvg';
import { CanvasController } from './canvas-controller';
import { buildScene, type Scene, type SceneNode } from './scene';

interface Props {
  model?: UMLModel | null;
  /** Escena ya construida (p. ej. diagrama de BD); tiene prioridad sobre `model`. */
  scene?: Scene;
  onSelectNode?: (node: SceneNode | null) => void;
  selectedId?: string | null;
}

/** Lienzo de solo lectura: pan con un dedo, pinch con dos, doble toque para encajar, toque para seleccionar. */
export function DiagramCanvas({ model, scene: sceneProp, onSelectNode, selectedId = null }: Props) {
  const scene = useMemo(() => sceneProp ?? buildScene(model), [model, sceneProp]);
  const [ctrl] = useState(() => new CanvasController());
  const [size, setSize] = useState({ w: 0, h: 0 });

  // El controlador lee la escena, el tamaño y el callback vigentes; se sincroniza en efectos.
  useEffect(() => {
    ctrl.setOnSelect(onSelectNode);
  }, [ctrl, onSelectNode]);

  useEffect(() => {
    ctrl.setView(scene, size);
    ctrl.fit(); // encaja al cargar un modelo nuevo o al conocer el tamaño
  }, [ctrl, scene, size]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  if (scene.nodes.length === 0) {
    return (
      <View style={styles.empty} onLayout={onLayout}>
        <EmptyState title="Diagrama vacío" hint="Este proyecto aún no tiene elementos." />
      </View>
    );
  }

  return (
    <View style={styles.wrap} onLayout={onLayout} {...ctrl.panHandlers}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: scene.width,
          height: scene.height,
          transformOrigin: '0% 0%',
          transform: [{ translateX: ctrl.tx }, { translateY: ctrl.ty }, { scale: ctrl.scale }],
        }}
      >
        <SceneSvg scene={scene} selectedId={selectedId} />
      </Animated.View>
      <View style={styles.controls} pointerEvents="box-none">
        <ControlButton label="Acercar" onPress={() => ctrl.zoomBy(1.3)} icon={<Plus size={18} color={colors.ink} />} />
        <ControlButton label="Alejar" onPress={() => ctrl.zoomBy(1 / 1.3)} icon={<Minus size={18} color={colors.ink} />} />
        <ControlButton label="Encajar en pantalla" onPress={() => ctrl.fit()} icon={<Maximize2 size={18} color={colors.ink} />} />
      </View>
    </View>
  );
}

function ControlButton({ label, onPress, icon }: { label: string; onPress: () => void; icon: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.ctrl, pressed && { backgroundColor: colors.btnPeach }]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.cream,
    borderWidth: border.thick,
    borderColor: colors.ink,
    borderRadius: radius.xl,
  },
  empty: { flex: 1, justifyContent: 'center' },
  controls: { position: 'absolute', right: spacing.md, bottom: spacing.md, gap: spacing.sm },
  ctrl: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.lg,
  },
});
