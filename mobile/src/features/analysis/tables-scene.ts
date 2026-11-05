import {
  layoutGraph,
  METRICS,
  attributesHeight,
  headerHeight,
  type RawEdge,
  type RawNode,
  type Scene,
  type SceneRow,
} from '@/features/diagram/scene';

import type { LogicalColumn, LogicalModel, LogicalTable } from './data-design-api';

/** Columna según el Perfil UML de modelado de datos: «PK» / «FK», `nombre : TIPO {NOT NULL}`. */
export function formatColumn(c: LogicalColumn): SceneRow {
  const keys = `${c.is_pk ? '«PK» ' : ''}${c.is_fk ? '«FK» ' : ''}`;
  const notNull = !c.nullable && !c.is_pk ? ' {NOT NULL}' : '';
  return { text: `${keys}${c.name} : ${c.sql_type}${notNull}` };
}

/** Tabla como clase UML «Table» (Perfil de datos): nombre, estereotipo y solo compartimento de columnas. */
function tableNode(t: LogicalTable): RawNode {
  const attributes = t.columns.map(formatColumn);
  const stereotype = t.kind === 'join' ? 'Join Table' : 'Table';
  const longest = Math.max(
    t.name.length * METRICS.nameCharW,
    (stereotype.length + 4) * METRICS.rowCharW,
    ...attributes.map((a) => a.text.length * METRICS.rowCharW)
  );
  const node: RawNode = {
    id: t.name,
    kind: 'class',
    name: t.name,
    stereotype,
    showOperations: false,
    attributes,
    operations: [],
    width: Math.max(METRICS.minW, Math.ceil(longest + METRICS.padX)),
    height: 0,
  };
  node.height = headerHeight(node) + attributesHeight(node);
  return node;
}

/** Una sola tabla como caja UML «Table» (vista del modelo lógico). */
export function buildTableScene(t: LogicalTable): Scene {
  return layoutGraph([tableNode(t)], [], 4);
}

/**
 * Escena del diagrama de BD con la notación del Perfil UML de datos (Data Modeling Profile):
 * cada tabla es una clase «Table» (solo columnas) y cada clave foránea, una asociación con multiplicidades.
 */
export function buildTablesScene(logical: LogicalModel): Scene {
  const nodes: RawNode[] = logical.tables.map(tableNode);
  const ids = new Set(nodes.map((n) => n.id));
  const edges: RawEdge[] = logical.edges
    .filter((e) => ids.has(e.from_table) && ids.has(e.to_table))
    .map((e) => ({
      id: e.id,
      kind: 'association',
      source: e.from_table,
      target: e.to_table,
      // La tabla con la FK participa 0..* (o 0..1 si es 1:1); la referenciada, exactamente 1.
      sourceMultiplicity: e.cardinality === 'N:1' ? '0..*' : '0..1',
      targetMultiplicity: '1',
      label: e.label ?? e.columns.join(', '),
    }));
  return layoutGraph(nodes, edges);
}
