import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { DiagramCanvas } from '@/features/diagram/DiagramCanvas';
import { SceneSvg } from '@/features/diagram/SceneSvg';
import { colors, spacing } from '@/shared/theme/tokens';
import { useAsync } from '@/shared/useAsync';
import { Card, Chip, ErrorBox, Loading, Text } from '@/shared/ui';
import type { UMLModel } from '@/types/canonical-model';

import { analyzeDataDesign, getDependencyDecisions, type DataDesignResult, type TableNormalization } from './data-design-api';
import { buildTableScene, buildTablesScene } from './tables-scene';

export type DataTab = 'logical' | 'normalization' | 'db';

async function load(id: string, model: UMLModel): Promise<DataDesignResult> {
  // Solo lectura: se usan las decisiones guardadas por el equipo, sin modificarlas.
  const decisions = await getDependencyDecisions(id).catch(() => []);
  return analyzeDataDesign(model, decisions);
}

export function DataDesignView({ id, model, tab }: { id: string; model: UMLModel; tab: DataTab }) {
  const { data, loading, error, reload } = useAsync(() => load(id, model), [id, model]);
  const scene = useMemo(() => (data ? buildTablesScene(data.logical) : null), [data]);

  if (loading && !data) return <Loading label="Analizando diseño de datos…" />;
  if (error) return <ErrorBox message={error} onRetry={() => void reload()} />;
  if (!data) return null;

  if (tab === 'db') {
    return <View style={{ height: 520 }}>{scene ? <DiagramCanvas scene={scene} /> : null}</View>;
  }
  if (tab === 'logical') return <Logical data={data} />;
  return <Normalization data={data} />;
}

function Logical({ data }: { data: DataDesignResult }) {
  return (
    <View style={{ gap: spacing.xl }}>
      <Text variant="caption">Cada tabla se muestra con la notación UML del Perfil de modelado de datos («Table», «PK», «FK»).</Text>
      {data.logical.tables.map((t) => (
        <View key={t.name} style={{ gap: spacing.sm }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <SceneSvg scene={buildTableScene(t)} selectedId={null} />
          </ScrollView>
          {t.foreign_keys.map((fk, i) => (
            <Text key={i} variant="mono">
              «FK» {fk.columns.join(', ')} → {fk.ref_table}({fk.ref_columns.join(', ')}){fk.on_delete ? ` · ON DELETE ${fk.on_delete}` : ''}
            </Text>
          ))}
          {t.notes.map((n, i) => (
            <Text key={i} variant="caption">• {n}</Text>
          ))}
        </View>
      ))}
      {data.logical.mappings.length > 0 ? (
        <Card tone="white">
          <View style={{ gap: spacing.md }}>
            <Text variant="heading">Del modelo conceptual al lógico</Text>
            {data.logical.mappings.map((m, i) => (
              <View key={i} style={{ gap: 2 }}>
                <Text style={{ fontWeight: '700' }}>{m.element} → {m.result}</Text>
                <Text variant="caption">{m.rule}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

function Normalization({ data }: { data: DataDesignResult }) {
  const s = data.summary;
  return (
    <View style={{ gap: spacing.xl }}>
      <Card tone={s.all_in_3nf ? 'mint' : 'yellow'}>
        <View style={{ gap: 4 }}>
          <Text variant="heading">{s.all_in_3nf ? 'Todas las tablas en 3FN o mejor' : 'Hay tablas por debajo de 3FN'}</Text>
          <Text variant="caption">
            {s.tables} tablas · {Object.entries(s.by_form).map(([k, v]) => `${v} en ${k}`).join(' · ')}
            {s.pending_suggestions > 0 ? ` · ${s.pending_suggestions} sugerencias pendientes` : ''}
          </Text>
        </View>
      </Card>
      {data.normalization.map((t) => (
        <TableCard key={t.table} t={t} />
      ))}
    </View>
  );
}

function TableCard({ t }: { t: TableNormalization }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="heading" style={{ flex: 1 }}>{t.table}</Text>
          <Chip label={t.normal_form} tone={['3FN', 'FNBC', 'BCNF'].includes(t.normal_form) ? 'mint' : 'yellow'} />
        </View>
        {t.checks.map((c) => (
          <View key={c.form} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Text style={{ fontWeight: '800', color: c.ok ? colors.successText : colors.errorText }}>{c.ok ? '✓' : '✗'}</Text>
            <Text style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{c.form}: </Text>
              {c.detail}
            </Text>
          </View>
        ))}
        {t.warnings.map((w, i) => (
          <Text key={i} variant="caption" style={{ color: colors.errorText }}>⚠ {w}</Text>
        ))}
        {t.dependencies.length > 0 ? (
          <View style={{ gap: 2 }}>
            <Text variant="label">Dependencias funcionales</Text>
            {t.dependencies.map((d) => (
              <Text key={d.id} variant="mono">
                {d.lhs.join(', ')} → {d.rhs.join(', ')} ({d.status === 'confirmed' ? 'confirmada' : d.status === 'suggested' ? 'sugerida' : 'rechazada'})
              </Text>
            ))}
          </View>
        ) : null}
        {t.proof.length > 0 || t.decomposition ? (
          <Text onPress={() => setOpen((o) => !o)} style={{ fontWeight: '700', textDecorationLine: 'underline' }} accessibilityRole="button">
            {open ? 'Ocultar demostración' : 'Ver demostración y descomposición'}
          </Text>
        ) : null}
        {open ? (
          <View style={{ gap: spacing.md }}>
            {t.proof.map((p, i) => (
              <Text key={i} variant="caption">{p}</Text>
            ))}
            {t.decomposition ? (
              <View style={{ gap: spacing.sm }}>
                <Text variant="label">Descomposición propuesta (solo informativa)</Text>
                <Text variant="caption">{t.decomposition.explanation}</Text>
                {t.decomposition.relations.map((r) => (
                  <Text key={r.name} variant="mono">{r.name}({r.attributes.join(', ')}) · PK: {r.primary_key.join(', ')}</Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}
