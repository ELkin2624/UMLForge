import { memo, useMemo } from 'react';
import Svg, { Circle, Path, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { colors } from '@/shared/theme/tokens';

import { drawScene, type DrawOp } from './draw';
import type { Scene } from './scene';

function renderOp(o: DrawOp, i: number) {
  switch (o.t) {
    case 'rect':
      return <Rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} fill={o.fill} stroke={o.stroke} strokeWidth={o.sw} />;
    case 'circle':
      return <Circle key={i} cx={o.cx} cy={o.cy} r={o.r} fill={o.fill} stroke={o.stroke} strokeWidth={o.sw} />;
    case 'path':
      return <Path key={i} d={o.d} fill="none" stroke={o.stroke} strokeWidth={o.sw} />;
    case 'poly': {
      const points = o.points.map((p) => `${p.x},${p.y}`).join(' ');
      const Shape = o.closed ? Polygon : Polyline;
      return <Shape key={i} points={points} fill={o.fill} stroke={o.stroke} strokeWidth={o.sw} strokeDasharray={o.dash} strokeLinejoin="round" />;
    }
    case 'text':
      return (
        <SvgText
          key={i}
          x={o.x}
          y={o.y}
          fontSize={o.size}
          fill={colors.ink}
          textAnchor={o.anchor}
          fontWeight={o.bold ? 'bold' : 'normal'}
          fontStyle={o.italic ? 'italic' : 'normal'}
          textDecoration={o.underline ? 'underline' : 'none'}
        >
          {o.text}
        </SvgText>
      );
  }
}

/** Dibujo estático de la escena; se memoiza para que pan/zoom no lo repinte. */
export const SceneSvg = memo(function SceneSvg({ scene, selectedId }: { scene: Scene; selectedId: string | null }) {
  const ops = useMemo(() => drawScene(scene, { selectedId }), [scene, selectedId]);
  return (
    <Svg width={scene.width} height={scene.height}>
      {ops.map(renderOp)}
    </Svg>
  );
});
