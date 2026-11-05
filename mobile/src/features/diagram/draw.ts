import { colors } from '@/shared/theme/tokens';

import {
  attributesHeight,
  ballCenter,
  edgeMarkers,
  headerHeight,
  isDashed,
  METRICS,
  type Point,
  type Scene,
  type SceneEdge,
  type SceneNode,
  type SceneRow,
} from './scene';

/**
 * Primitivas de dibujo independientes del renderizador. `SceneSvg` las pinta con react-native-svg
 * y `to-svg-string` las convierte a texto SVG (para pruebas y revisión visual).
 */
export type DrawOp =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: string; stroke: string; sw: number }
  | { t: 'poly'; points: Point[]; closed: boolean; fill: string; stroke: string; sw: number; dash?: string }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string; stroke: string; sw: number }
  | { t: 'path'; d: string; stroke: string; sw: number }
  | {
      t: 'text';
      x: number;
      y: number;
      text: string;
      size: number;
      anchor: 'start' | 'middle' | 'end';
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
    };

const INK = colors.ink;
const LINE = 1.5;
const DASH = '7 4';

export interface DrawOptions {
  selectedId?: string | null;
}

export function drawScene(scene: Scene, opts: DrawOptions = {}): DrawOp[] {
  const ops: DrawOp[] = [];
  for (const e of scene.edges) drawEdge(e, ops);
  for (const n of scene.nodes) drawNode(n, n.id === opts.selectedId, ops);
  return ops;
}

function drawRows(rows: SceneRow[], x: number, top: number, ops: DrawOp[]) {
  rows.forEach((r, i) => {
    ops.push({
      t: 'text',
      x,
      y: top + METRICS.padY + i * METRICS.rowH + 14,
      text: r.text,
      size: 12,
      anchor: 'start',
      italic: r.italic,
      underline: r.underline,
    });
  });
}

function drawNode(n: SceneNode, selected: boolean, ops: DrawOp[]) {
  const stroke = selected ? colors.violet : INK;
  const sw = selected ? 3 : LINE;
  const cx = n.x + n.width / 2;

  if (n.kind === 'iface') {
    const c = ballCenter(n);
    ops.push({ t: 'circle', cx: c.x, cy: c.y, r: METRICS.ballR, fill: '#ffffff', stroke, sw });
    ops.push({ t: 'text', x: cx, y: c.y + METRICS.ballR + 15, text: n.name, size: 12, anchor: 'middle', bold: true });
    return;
  }

  ops.push({ t: 'rect', x: n.x, y: n.y, w: n.width, h: n.height, fill: '#ffffff', stroke, sw });
  const hh = headerHeight(n);
  if (n.stereotype) {
    ops.push({ t: 'text', x: cx, y: n.y + 15, text: `«${n.stereotype}»`, size: 11, anchor: 'middle' });
  }
  ops.push({
    t: 'text',
    x: cx,
    y: n.y + (n.stereotype ? METRICS.stereotypeH : 0) + 23,
    text: n.name,
    size: 14,
    anchor: 'middle',
    bold: true,
    italic: n.isAbstract,
  });

  if (n.kind === 'component') {
    // Icono de componente: rectángulo con dos pestañas (UML 2.5 §8.3.1).
    const ix = n.x + n.width - 28;
    const iy = n.y + 7;
    ops.push({ t: 'rect', x: ix, y: iy, w: 16, h: 11, fill: '#ffffff', stroke: INK, sw: 1 });
    ops.push({ t: 'rect', x: ix - 4, y: iy + 2, w: 8, h: 3, fill: '#ffffff', stroke: INK, sw: 1 });
    ops.push({ t: 'rect', x: ix - 4, y: iy + 6.5, w: 8, h: 3, fill: '#ffffff', stroke: INK, sw: 1 });
    for (const p of n.ports) {
      ops.push({ t: 'rect', x: p.x - METRICS.portSize / 2, y: p.y - METRICS.portSize / 2, w: METRICS.portSize, h: METRICS.portSize, fill: '#ffffff', stroke: INK, sw: LINE });
    }
    return;
  }

  const line = (y: number) =>
    ops.push({ t: 'poly', points: [{ x: n.x, y }, { x: n.x + n.width, y }], closed: false, fill: 'none', stroke: INK, sw: LINE });

  line(n.y + hh);
  const ah = attributesHeight(n);
  drawRows(n.attributes, n.x + 8, n.y + hh, ops);
  if (n.showOperations) {
    if (ah > 0) line(n.y + hh + ah);
    drawRows(n.operations, n.x + 8, n.y + hh + ah, ops);
  }
}

function drawAssembly(e: SceneEdge, ops: DrawOp[]) {
  const a = e.points[0];
  const b = e.points[e.points.length - 1];
  const [p, q] = e.providerAtStart === false ? [b, a] : [a, b];
  const len = Math.hypot(q.x - p.x, q.y - p.y) || 1;
  const ux = (q.x - p.x) / len;
  const uy = (q.y - p.y) / len;
  const mx = (p.x + q.x) / 2;
  const my = (p.y + q.y) / 2;
  const rb = 6; // bola (interfaz provista)
  const rs = 10; // socket (interfaz requerida)
  const c = { x: mx - ux * 2, y: my - uy * 2 };
  const stroke = INK;
  ops.push({ t: 'poly', points: [p, { x: c.x - ux * rb, y: c.y - uy * rb }], closed: false, fill: 'none', stroke, sw: LINE });
  ops.push({ t: 'poly', points: [{ x: c.x + ux * rs, y: c.y + uy * rs }, q], closed: false, fill: 'none', stroke, sw: LINE });
  ops.push({ t: 'circle', cx: c.x, cy: c.y, r: rb, fill: '#ffffff', stroke, sw: LINE });
  // Semicírculo del socket: del lado perpendicular, pasando por el frente (hacia el requirente).
  const px = -uy;
  const py = ux;
  const f = (n: number) => n.toFixed(2);
  ops.push({
    t: 'path',
    d: `M ${f(c.x + px * rs)} ${f(c.y + py * rs)} A ${rs} ${rs} 0 0 0 ${f(c.x - px * rs)} ${f(c.y - py * rs)}`,
    stroke,
    sw: LINE,
  });
  for (const l of e.labels) {
    ops.push({ t: 'text', x: l.x, y: l.y - 12, text: l.text, size: 11, anchor: l.anchor });
  }
}

function drawEdge(e: SceneEdge, ops: DrawOp[]) {
  if (e.points.length < 2) return;
  if (e.kind === 'assembly') {
    drawAssembly(e, ops);
    return;
  }
  ops.push({
    t: 'poly',
    points: e.points,
    closed: false,
    fill: 'none',
    stroke: INK,
    sw: LINE,
    dash: isDashed(e.kind) ? DASH : undefined,
  });
  for (const m of edgeMarkers(e)) {
    ops.push({
      t: 'poly',
      points: m.points,
      closed: m.closed,
      fill: m.closed ? (m.filled ? INK : '#ffffff') : 'none',
      stroke: INK,
      sw: LINE,
    });
  }
  for (const l of e.labels) {
    ops.push({ t: 'text', x: l.x, y: l.y, text: l.text, size: 11, anchor: l.anchor });
  }
}
