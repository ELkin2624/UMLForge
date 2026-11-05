import * as dagre from '@dagrejs/dagre';

import type { UMLAttribute, UMLModel, UMLOperation } from '@/types/canonical-model';

// ── Tipos de la escena (lo que se dibuja) ────────────────────────────────────

/** `iface` = interfaz de un diagrama de componentes (círculo "lollipop"). */
export type NodeKind = 'class' | 'interface' | 'component' | 'iface';

export interface SceneRow {
  text: string;
  italic?: boolean;
  underline?: boolean;
}

export interface ScenePort {
  id: string;
  name: string;
  kind: 'provided' | 'required';
  interfaceId: string;
  /** Centro del puerto (cuadrado sobre el borde inferior del componente). */
  x: number;
  y: number;
}

export interface SceneNode {
  id: string;
  kind: NodeKind;
  name: string;
  stereotype?: string;
  isAbstract?: boolean;
  /** Clases e interfaces muestran siempre el compartimento de operaciones; las tablas de BD no. */
  showOperations: boolean;
  attributes: SceneRow[];
  operations: SceneRow[];
  ports: ScenePort[];
  x: number; // esquina superior izquierda
  y: number;
  width: number;
  height: number;
}

export type EdgeKind =
  | 'association'
  | 'generalization'
  | 'realization'
  | 'provided' // componente → interfaz (línea sólida hasta el círculo)
  | 'dependency'
  | 'composition'
  | 'aggregation'
  | 'connector'
  | 'assembly' // bola-y-socket
  | 'assoc-class'; // clase de asociación → asociación

export interface Point {
  x: number;
  y: number;
}

export interface EdgeLabel {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

export interface SceneEdge {
  id: string;
  kind: EdgeKind;
  source: string;
  target: string;
  points: Point[];
  labels: EdgeLabel[];
  /** Solo `assembly`: si el extremo inicial es el que provee la interfaz. */
  providerAtStart?: boolean;
}

export interface Scene {
  nodes: SceneNode[];
  edges: SceneEdge[];
  width: number;
  height: number;
}

// ── Medidas ──────────────────────────────────────────────────────────────────

export const METRICS = {
  nameH: 34,
  stereotypeH: 15,
  rowH: 20,
  padY: 5,
  emptyH: 14,
  minW: 150,
  rowCharW: 6.6,
  nameCharW: 8.2,
  padX: 22,
  margin: 40,
  ballR: 12,
  portSize: 10,
} as const;

const VIS: Record<string, string> = { public: '+', private: '-', protected: '#', package: '~' };

/** `vis nombre : tipo [mult] = valor {id}` (UML 2.5 §9.5). */
export function formatAttribute(a: UMLAttribute): SceneRow {
  let text = `${VIS[a.visibility ?? 'private'] ?? '-'} ${a.name}`;
  if (a.type) text += ` : ${a.type}`;
  if (a.multiplicity && a.multiplicity !== '1') text += ` [${a.multiplicity}]`;
  if (a.initial_value) text += ` = ${a.initial_value}`;
  if (a.is_primary_key) text += ' {id}';
  return { text, underline: a.is_static || undefined };
}

/** `vis nombre(dir p : tipo, …) : retorno`; `: void` se omite. */
export function formatOperation(o: UMLOperation): SceneRow {
  const params = (o.parameters ?? [])
    .map((p) => {
      const dir = p.direction && p.direction !== 'in' && p.direction !== 'return' ? `${p.direction} ` : '';
      return `${dir}${p.name}${p.type ? ` : ${p.type}` : ''}`;
    })
    .join(', ');
  const ret = o.return_type && o.return_type !== 'void' ? ` : ${o.return_type}` : '';
  return {
    text: `${VIS[o.visibility ?? 'public'] ?? '+'} ${o.name}(${params})${ret}`,
    italic: o.is_abstract || undefined,
    underline: o.is_static || undefined,
  };
}

/** Normaliza el tipo (el backend usa minúsculas; el frontend a veces Capitalizado o con alias). */
export function normalizeEdgeKind(raw: string | undefined): EdgeKind {
  const t = (raw ?? 'association').toLowerCase();
  if (t.includes('generalization') || t.includes('inheritance')) return 'generalization';
  if (t.includes('realization')) return 'realization';
  if (t.includes('dependency') || t.includes('abstraction')) return 'dependency';
  if (t.includes('composition')) return 'composition';
  if (t.includes('aggregation')) return 'aggregation';
  return 'association';
}

// ── Medición de nodos ────────────────────────────────────────────────────────

function compartmentH(count: number): number {
  return count > 0 ? METRICS.padY * 2 + count * METRICS.rowH : METRICS.emptyH;
}

export function headerHeight(n: Pick<SceneNode, 'stereotype'>): number {
  return METRICS.nameH + (n.stereotype ? METRICS.stereotypeH : 0);
}

function widthFor(name: string, rows: SceneRow[], stereotype?: string): number {
  const nameW = name.length * METRICS.nameCharW + (stereotype ? 0 : 0);
  const stW = stereotype ? (stereotype.length + 4) * METRICS.rowCharW : 0;
  const rowsW = Math.max(0, ...rows.map((r) => r.text.length * METRICS.rowCharW));
  return Math.max(METRICS.minW, Math.ceil(Math.max(nameW, stW, rowsW) + METRICS.padX));
}

/** Una interfaz sin atributos muestra solo nombre y operaciones (sin compartimento vacío en medio). */
export function attributesHeight(n: Pick<SceneNode, 'kind' | 'attributes'>): number {
  return n.kind === 'interface' && n.attributes.length === 0 ? 0 : compartmentH(n.attributes.length);
}

export function operationsHeight(n: Pick<SceneNode, 'showOperations' | 'operations'>): number {
  return n.showOperations ? compartmentH(n.operations.length) : 0;
}

function classHeight(n: Pick<SceneNode, 'kind' | 'stereotype' | 'attributes' | 'operations' | 'showOperations'>): number {
  return headerHeight(n) + attributesHeight(n) + operationsHeight(n);
}

// ── Construcción ─────────────────────────────────────────────────────────────

export type RawPort = Omit<ScenePort, 'x' | 'y'>;
export type RawNode = Omit<SceneNode, 'x' | 'y' | 'ports'> & {
  ports?: RawPort[];
  /** Clase de asociación: ids de los extremos de la asociación a la que se une. */
  assocFor?: { source: string; target: string };
};

export interface RawEdge {
  id: string;
  kind: EdgeKind;
  source: string;
  target: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  label?: string;
  fromPort?: string;
  toPort?: string;
  providerAtStart?: boolean;
}

type AnyRecord = Record<string, unknown>;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Convierte el modelo canónico en una escena con posiciones (layout automático con dagre). */
export function buildScene(model: UMLModel | null | undefined): Scene {
  const m = model ?? ({} as UMLModel);
  const raw: RawNode[] = [];
  const componentDiagram = (m.components?.length ?? 0) > 0;

  for (const c of m.classes ?? []) {
    const rec = c as unknown as AnyRecord;
    const attributes = (c.attributes ?? []).map(formatAttribute);
    const operations = (c.operations ?? []).map(formatOperation);
    const node: RawNode = {
      id: c.id,
      kind: 'class',
      name: c.name,
      isAbstract: c.is_abstract || undefined,
      showOperations: true,
      attributes,
      operations,
      width: widthFor(c.name, [...attributes, ...operations]),
      height: 0,
    };
    node.height = classHeight(node);
    const aSrc = str(rec.association_source_id);
    const aTgt = str(rec.association_target_id);
    if (rec.is_association_class === true && aSrc && aTgt) node.assocFor = { source: aSrc, target: aTgt };
    raw.push(node);
  }

  // Puertos agrupados por componente; conectores ensamblados (provista ↔ requerida de la misma interfaz).
  const portsById = new Map((m.ports ?? []).map((p) => [p.id, p]));
  const assembled = new Set<string>();
  for (const k of m.connectors ?? []) {
    const a = portsById.get(k.source_port_id);
    const b = portsById.get(k.target_port_id);
    if (a && b && a.interface_id === b.interface_id && a.kind !== b.kind) {
      assembled.add(a.id);
      assembled.add(b.id);
    }
  }

  for (const comp of m.components ?? []) {
    const ports: RawPort[] = (m.ports ?? [])
      .filter((p) => p.component_id === comp.id)
      .map((p) => ({ id: p.id, name: p.name, kind: p.kind, interfaceId: p.interface_id }));
    const node: RawNode = {
      id: comp.id,
      kind: 'component',
      name: comp.name,
      stereotype: 'component',
      showOperations: false,
      attributes: [],
      operations: [],
      ports,
      width: Math.max(widthFor(comp.name, [], 'component') + 24, 170),
      height: METRICS.nameH + METRICS.stereotypeH + 20,
    };
    raw.push(node);
  }

  // Una interfaz con todos sus puertos ensamblados se dibuja como bola-y-socket, no como nodo.
  const hiddenIfaces = new Set<string>();
  for (const itf of m.interfaces ?? []) {
    const refs = (m.ports ?? []).filter((p) => p.interface_id === itf.id);
    if (refs.length > 0 && refs.every((p) => assembled.has(p.id))) hiddenIfaces.add(itf.id);
  }

  for (const itf of m.interfaces ?? []) {
    if (hiddenIfaces.has(itf.id)) continue;
    const operations = (itf.operations ?? []).map(formatOperation);
    if (componentDiagram) {
      raw.push({
        id: itf.id,
        kind: 'iface',
        name: itf.name,
        stereotype: 'interface',
        showOperations: false,
        attributes: [],
        operations,
        width: Math.max(44, Math.ceil(itf.name.length * METRICS.rowCharW + 12)),
        height: METRICS.ballR * 2 + 22,
      });
    } else {
      const node: RawNode = {
        id: itf.id,
        kind: 'interface',
        name: itf.name,
        stereotype: 'interface',
        showOperations: true,
        attributes: [],
        operations,
        width: widthFor(itf.name, operations, 'interface'),
        height: 0,
      };
      node.height = classHeight(node);
      raw.push(node);
    }
  }

  const kinds = new Map(raw.map((n) => [n.id, n.kind]));
  const rawEdges: RawEdge[] = [];
  const seen = new Set<string>();
  const push = (e: RawEdge) => {
    const key = `${e.source}|${e.target}|${e.kind}`;
    if (e.kind !== 'association' && seen.has(key)) return;
    seen.add(key);
    rawEdges.push(e);
  };

  for (const r of m.relationships ?? []) {
    const rec = r as unknown as AnyRecord;
    const source = str(r.source_id) ?? str(rec.source);
    const target = str(r.target_id) ?? str(rec.target);
    if (!source || !target || !kinds.has(source) || !kinds.has(target)) continue;
    let kind = normalizeEdgeKind(r.type);
    if (kind === 'realization' && kinds.get(target) === 'iface') kind = 'provided';
    const name = str(rec.name);
    rawEdges.push({
      id: r.id,
      kind,
      source,
      target,
      sourceMultiplicity: r.source_multiplicity,
      targetMultiplicity: r.target_multiplicity,
      label: name && !name.startsWith('rel') ? name : undefined,
    });
  }
  for (const d of m.dependencies ?? []) {
    const rec = d as unknown as AnyRecord;
    const source = str(d.source_id) ?? str(rec.source);
    const target = str(d.target_id) ?? str(rec.target);
    if (!source || !target || !kinds.has(source) || !kinds.has(target)) continue;
    const toBall = kinds.get(target) === 'iface';
    const kind: EdgeKind = d.type === 'realization' ? (toBall ? 'provided' : 'realization') : 'dependency';
    push({ id: d.id, kind, source, target });
  }
  // Puertos sin ensamblar: provista = línea sólida al círculo; requerida = dependencia (uso).
  for (const p of m.ports ?? []) {
    if (assembled.has(p.id) || !kinds.has(p.component_id) || !kinds.has(p.interface_id)) continue;
    push({
      id: `port-${p.id}`,
      kind: p.kind === 'provided' ? 'provided' : 'dependency',
      source: p.component_id,
      target: p.interface_id,
      fromPort: p.id,
    });
  }
  for (const k of m.connectors ?? []) {
    const a = portsById.get(k.source_port_id);
    const b = portsById.get(k.target_port_id);
    if (!a || !b || !kinds.has(a.component_id) || !kinds.has(b.component_id)) continue;
    const isAssembly = assembled.has(a.id) && assembled.has(b.id);
    const itf = (m.interfaces ?? []).find((i) => i.id === a.interface_id);
    rawEdges.push({
      id: k.id,
      kind: isAssembly ? 'assembly' : 'connector',
      source: a.component_id,
      target: b.component_id,
      fromPort: a.id,
      toPort: b.id,
      label: isAssembly ? itf?.name : k.name || undefined,
      providerAtStart: isAssembly ? a.kind === 'provided' : undefined,
    });
  }

  return layoutGraph(raw, rawEdges);
}

// ── Layout ───────────────────────────────────────────────────────────────────

/** Posiciona nodos y aristas con dagre. Reutilizable por otros diagramas (p. ej. tablas de BD). */
export function layoutGraph(raw: RawNode[], rawEdges: RawEdge[], margin: number = METRICS.margin): Scene {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90, marginx: margin, marginy: margin });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of raw) g.setNode(n.id, { width: n.width, height: n.height });
  const flips = (k: EdgeKind) => k === 'generalization' || k === 'realization';
  for (const e of rawEdges) {
    if (e.source === e.target) continue; // los lazos se dibujan aparte
    g.setEdge(flips(e.kind) ? e.target : e.source, flips(e.kind) ? e.source : e.target, {}, e.id);
  }
  // Arista solo de layout: mantiene la clase de asociación junto a los extremos de su asociación.
  for (const n of raw) {
    if (n.assocFor && g.hasNode(n.assocFor.source)) g.setEdge(n.assocFor.source, n.id, {}, `layout-${n.id}`);
  }
  dagre.layout(g);

  // Lado del puerto: mira hacia el componente con el que se conecta (arriba o abajo).
  const centerY = new Map(raw.map((n) => [n.id, g.node(n.id).y as number]));
  const portFacesUp = new Map<string, boolean>();
  for (const e of rawEdges) {
    if (e.fromPort) portFacesUp.set(e.fromPort, (centerY.get(e.target) ?? 0) < (centerY.get(e.source) ?? 0));
    if (e.toPort) portFacesUp.set(e.toPort, (centerY.get(e.source) ?? 0) < (centerY.get(e.target) ?? 0));
  }

  const nodes: SceneNode[] = raw.map((n) => {
    const p = g.node(n.id);
    const x = Math.round(p.x - n.width / 2);
    const y = Math.round(p.y - n.height / 2);
    const ports = (n.ports ?? []).map((port, i, all) => ({
      ...port,
      x: Math.round(x + ((i + 1) / (all.length + 1)) * n.width),
      y: portFacesUp.get(port.id) ? y : y + n.height,
    }));
    const { assocFor: _ignored, ...rest } = n;
    void _ignored;
    return { ...rest, ports, x, y };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const portPos = new Map<string, Point>();
  for (const n of nodes) for (const p of n.ports) portPos.set(p.id, { x: p.x, y: p.y });

  const edges: SceneEdge[] = rawEdges.map((e) => {
    const src = byId.get(e.source)!;
    const tgt = byId.get(e.target)!;
    let points: Point[];
    if (e.source === e.target) {
      points = selfLoop(src);
    } else {
      const flip = flips(e.kind);
      const label = g.edge(flip ? e.target : e.source, flip ? e.source : e.target, e.id);
      const pts: Point[] = (label?.points as Point[] | undefined)?.map((p) => ({ x: p.x, y: p.y })) ?? [];
      points = flip ? pts.reverse() : pts;
      if (points.length < 2) points = straight(src, tgt);
    }
    points = fixEndpoints(points, src, tgt);
    const from = e.fromPort ? portPos.get(e.fromPort) : undefined;
    const to = e.toPort ? portPos.get(e.toPort) : undefined;
    if (from) points[0] = from;
    if (to) points[points.length - 1] = to;
    if (e.kind === 'assembly') points = [points[0], points[points.length - 1]];
    return {
      id: e.id,
      kind: e.kind,
      source: e.source,
      target: e.target,
      points,
      labels: edgeLabels(e, points, nodes),
      providerAtStart: e.providerAtStart,
    };
  });

  // Clases de asociación: línea discontinua hacia el punto medio de la asociación.
  for (const n of raw) {
    if (!n.assocFor) continue;
    const { source, target } = n.assocFor;
    const assoc = edges.find(
      (e) =>
        ['association', 'aggregation', 'composition'].includes(e.kind) &&
        ((e.source === source && e.target === target) || (e.source === target && e.target === source))
    );
    if (!assoc) continue;
    const mid = polylineMidpoint(assoc.points).point;
    const node = byId.get(n.id)!;
    edges.push({
      id: `assoc-class-${n.id}`,
      kind: 'assoc-class',
      source: n.id,
      target: assoc.id,
      points: [borderPoint(node, mid), mid],
      labels: [],
    });
  }

  const graph = g.graph();
  const width = Math.max(graph.width ?? 0, ...nodes.map((n) => n.x + n.width + margin), nodes.length ? 0 : 200);
  const height = Math.max(graph.height ?? 0, ...nodes.map((n) => n.y + n.height + margin), nodes.length ? 0 : 200);
  return { nodes, edges, width: Math.ceil(width), height: Math.ceil(height) };
}

// ── Geometría ────────────────────────────────────────────────────────────────

function center(n: SceneNode): Point {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 };
}

export function ballCenter(n: SceneNode): Point {
  return { x: n.x + n.width / 2, y: n.y + METRICS.ballR + 2 };
}

/** Punto del borde del nodo en dirección a `toward`. */
export function borderPoint(n: SceneNode, toward: Point): Point {
  if (n.kind === 'iface') {
    const c = ballCenter(n);
    const d = Math.hypot(toward.x - c.x, toward.y - c.y) || 1;
    return {
      x: c.x + ((toward.x - c.x) / d) * METRICS.ballR,
      y: c.y + ((toward.y - c.y) / d) * METRICS.ballR,
    };
  }
  const c = center(n);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const sx = dx !== 0 ? n.width / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? n.height / 2 / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: c.x + dx * s, y: c.y + dy * s };
}

/** Los extremos de los nodos-círculo deben tocar el círculo, no la caja que incluye el nombre. */
function fixEndpoints(points: Point[], src: SceneNode, tgt: SceneNode): Point[] {
  const out = points.map((p) => ({ ...p }));
  if (src.kind === 'iface' && out.length >= 2) out[0] = borderPoint(src, out[1]);
  if (tgt.kind === 'iface' && out.length >= 2) out[out.length - 1] = borderPoint(tgt, out[out.length - 2]);
  return out;
}

function straight(a: SceneNode, b: SceneNode): Point[] {
  return [borderPoint(a, center(b)), borderPoint(b, center(a))];
}

function selfLoop(n: SceneNode): Point[] {
  const r = n.x + n.width;
  const y = n.y + n.height / 2;
  return [
    { x: r, y: y - 14 },
    { x: r + 36, y: y - 14 },
    { x: r + 36, y: y + 14 },
    { x: r, y: y + 14 },
  ];
}

/** Punto a la mitad de la longitud de la polilínea y la dirección del tramo donde cae. */
export function polylineMidpoint(pts: Point[]): { point: Point; dir: Point } {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (acc + len >= total / 2 && len > 0) {
      const t = (total / 2 - acc) / len;
      return {
        point: { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t },
        dir: { x: (pts[i].x - pts[i - 1].x) / len, y: (pts[i].y - pts[i - 1].y) / len },
      };
    }
    acc += len;
  }
  return { point: pts[0], dir: { x: 1, y: 0 } };
}

type Placed = Pick<EdgeLabel, 'x' | 'y' | 'anchor'>;

/**
 * Candidatos para una etiqueta junto a un extremo, en orden de preferencia: 16 px a lo largo del
 * primer tramo y 10 px a un lado (arriba si es horizontal, a la derecha si es vertical), luego
 * el otro lado y más lejos.
 */
export function endLabelCandidates(from: Point, next: Point): Placed[] {
  const len = Math.hypot(next.x - from.x, next.y - from.y) || 1;
  const ux = (next.x - from.x) / len;
  const uy = (next.y - from.y) / len;
  let px = -uy;
  let py = ux;
  if (Math.abs(py) > 0.5) {
    if (py > 0) {
      px = -px;
      py = -py;
    }
  } else if (px < 0) {
    px = -px;
    py = -py;
  }
  const out: Placed[] = [];
  for (const along of [16, 28]) {
    for (const side of [1, -1]) {
      const x = from.x + ux * along + px * 10 * side;
      const sy = py * side;
      const y = from.y + uy * along + sy * 10 + (sy < 0 ? 0 : 10);
      const horizontalSide = Math.abs(sy) <= 0.5;
      out.push({ x, y, anchor: horizontalSide ? (px * side >= 0 ? 'start' : 'end') : 'middle' });
    }
  }
  return out;
}

export function endLabelPos(from: Point, next: Point): Placed {
  return endLabelCandidates(from, next)[0];
}

const LABEL_CHAR_W = 6.2;

function labelBox(p: Placed, text: string) {
  const w = text.length * LABEL_CHAR_W;
  const x0 = p.anchor === 'start' ? p.x : p.anchor === 'middle' ? p.x - w / 2 : p.x - w;
  return { x0, x1: x0 + w, y0: p.y - 10, y1: p.y + 3 };
}

/** Primer candidato cuya caja no toca ningún nodo; si todos chocan, el preferido. */
function pickFree(cands: Placed[], text: string, nodes: SceneNode[]): Placed {
  const free = cands.find((c) => {
    const b = labelBox(c, text);
    return !nodes.some((n) => b.x0 < n.x + n.width + 2 && b.x1 > n.x - 2 && b.y0 < n.y + n.height + 2 && b.y1 > n.y - 2);
  });
  return free ?? cands[0];
}

function edgeLabels(e: RawEdge, pts: Point[], nodes: SceneNode[]): EdgeLabel[] {
  const labels: EdgeLabel[] = [];
  if (pts.length < 2) return labels;
  if (e.sourceMultiplicity) {
    labels.push({ text: e.sourceMultiplicity, ...pickFree(endLabelCandidates(pts[0], pts[1]), e.sourceMultiplicity, nodes) });
  }
  if (e.targetMultiplicity) {
    const last = pts[pts.length - 1];
    labels.push({
      text: e.targetMultiplicity,
      ...pickFree(endLabelCandidates(last, pts[pts.length - 2]), e.targetMultiplicity, nodes),
    });
  }
  if (e.label) {
    const { point, dir } = polylineMidpoint(pts);
    const vertical = Math.abs(dir.y) > 0.5;
    const cands: Placed[] = vertical
      ? [
          { x: point.x + 8, y: point.y + 4, anchor: 'start' },
          { x: point.x - 8, y: point.y + 4, anchor: 'end' },
        ]
      : [
          { x: point.x, y: point.y - 8, anchor: 'middle' },
          { x: point.x, y: point.y + 16, anchor: 'middle' },
        ];
    labels.push({ text: e.label, ...pickFree(cands, e.label, nodes) });
  }
  return labels;
}

// ── Decoraciones de los extremos ─────────────────────────────────────────────

export interface Marker {
  kind: 'triangle' | 'diamond' | 'arrow';
  filled: boolean;
  /** `arrow` es una "V" abierta (no se cierra); los demás son polígonos cerrados. */
  closed: boolean;
  points: Point[];
}

/** Marcador en el extremo `tip`, orientado según el segmento que llega desde `from`. */
export function markerAt(kind: Marker['kind'], tip: Point, from: Point, filled: boolean): Marker {
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const at = (back: number, side: number): Point => ({
    x: tip.x - ux * back + px * side,
    y: tip.y - uy * back + py * side,
  });
  if (kind === 'triangle') return { kind, filled, closed: true, points: [tip, at(14, 8), at(14, -8)] };
  if (kind === 'diamond') return { kind, filled, closed: true, points: [tip, at(10, 6), at(20, 0), at(10, -6)] };
  return { kind, filled, closed: false, points: [at(11, 6), tip, at(11, -6)] };
}

/**
 * Marcadores de una arista (UML 2.5 §11.5), siempre en el extremo destino, como el editor web:
 * generalización/realización = triángulo hueco; dependencia = flecha abierta;
 * agregación = rombo hueco; composición = rombo relleno; asociación = sin marcador.
 */
export function edgeMarkers(e: SceneEdge): Marker[] {
  const pts = e.points;
  if (pts.length < 2) return [];
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  switch (e.kind) {
    case 'generalization':
    case 'realization':
      return [markerAt('triangle', last, prev, false)];
    case 'dependency':
      return [markerAt('arrow', last, prev, false)];
    case 'composition':
      return [markerAt('diamond', last, prev, true)];
    case 'aggregation':
      return [markerAt('diamond', last, prev, false)];
    default:
      return [];
  }
}

export const isDashed = (k: EdgeKind) => k === 'realization' || k === 'dependency' || k === 'assoc-class';
