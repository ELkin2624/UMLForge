import React, { useMemo } from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import dagre from 'dagre';
import { Key, Link2 } from 'lucide-react';
import type { DataDesignResult, LogicalTable } from '../api/data-design-api';

const NODE_WIDTH = 230;
const HEADER_H = 34;
const ROW_H = 22;

type TableNodeData = { table: LogicalTable };
type TableFlowNode = Node<TableNodeData, 'table'>;

const TableNode: React.FC<NodeProps<TableFlowNode>> = ({ data }) => {
  const { table } = data;
  return (
    <div className={`dd-node${table.kind === 'join' ? ' dd-node--join' : ''}`} style={{ width: NODE_WIDTH }}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="dd-node-head" style={{ height: HEADER_H }}>{table.name}</div>
      <ul className="dd-node-cols">
        {table.columns.map((c) => (
          <li key={c.name} style={{ height: ROW_H }}>
            <span className="dd-node-col">
              {c.is_pk && <Key size={11} aria-label="PK" className="dd-icon-pk" />}
              {c.is_fk && <Link2 size={11} aria-label="FK" className="dd-icon-fk" />}
              {c.name}
            </span>
            <span className="dd-node-type">{c.sql_type}</span>
          </li>
        ))}
      </ul>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
};

const nodeTypes = { table: TableNode };

export function layoutTables(result: DataDesignResult): { nodes: TableFlowNode[]; edges: Edge[] } {
  const { tables, edges } = result.logical;
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 110 });
  g.setDefaultEdgeLabel(() => ({}));

  const height = (t: LogicalTable) => HEADER_H + t.columns.length * ROW_H + 8;
  tables.forEach((t) => g.setNode(t.name, { width: NODE_WIDTH, height: height(t) }));
  edges.forEach((e) => g.setEdge(e.from_table, e.to_table));
  dagre.layout(g);

  const nodes: TableFlowNode[] = tables.map((t) => {
    const pos = g.node(t.name);
    return {
      id: t.name,
      type: 'table',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - height(t) / 2 },
      data: { table: t },
      draggable: true,
    };
  });

  const flowEdges: Edge[] = edges.map((e) => ({
    id: e.id,
    source: e.from_table,
    target: e.to_table,
    label: `${e.cardinality} · ${e.label ?? ''}`,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#1a1a1a', strokeWidth: 1.5 },
    labelStyle: { fontSize: 11, fontWeight: 700 },
    labelBgStyle: { fill: '#fff8ef' },
  }));

  return { nodes, edges: flowEdges };
}

/** Diagrama de base de datos (tablas + claves foráneas), derivado del modelo lógico. */
export const DbDiagramTab: React.FC<{ result: DataDesignResult }> = ({ result }) => {
  const { nodes, edges } = useMemo(() => layoutTables(result), [result]);

  if (nodes.length === 0) {
    return <p className="dd-empty">El modelo no tiene clases todavía.</p>;
  }
  return (
    <div className="dd-flow" role="img" aria-label="Diagrama de base de datos">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        nodesConnectable={false}
        minZoom={0.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
};
