import { CheckCircle2, TriangleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { colors, spacing } from '@/shared/theme/tokens';
import { useAsync } from '@/shared/useAsync';
import { Card, ErrorBox, Loading, Text } from '@/shared/ui';
import type { UMLModel } from '@/types/canonical-model';

import { validateModel } from './api';

export function ValidationView({ model }: { model: UMLModel }) {
  const { data, loading, error, reload } = useAsync(() => validateModel(model), [model]);
  if (loading && !data) return <Loading label="Validando modelo…" />;
  if (error) return <ErrorBox message={error} onRetry={() => void reload()} />;
  if (!data) return null;

  if (data.is_valid && data.errors.length === 0) {
    return (
      <Card tone="mint">
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <CheckCircle2 size={24} color={colors.successText} />
          <View style={{ flex: 1 }}>
            <Text variant="heading">Modelo válido</Text>
            <Text variant="caption" style={{ color: colors.successText }}>
              No se encontraron errores ni advertencias.
            </Text>
          </View>
        </View>
      </Card>
    );
  }
  return (
    <View style={{ gap: spacing.lg }}>
      <Card tone={data.is_valid ? 'yellow' : 'error'}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <TriangleAlert size={24} color={colors.ink} />
          <Text variant="heading">
            {data.is_valid ? 'Válido con avisos' : 'Modelo con errores'} ({data.errors.length})
          </Text>
        </View>
      </Card>
      {data.errors.map((e, i) => (
        <Card key={i} tone="white">
          <View style={{ gap: 4 }}>
            <Text style={{ fontWeight: '700' }}>{e.field || e.type || 'Modelo'}</Text>
            <Text>{e.message}</Text>
            {e.model_element_id ? <Text variant="mono">{e.model_element_id}</Text> : null}
          </View>
        </Card>
      ))}
    </View>
  );
}
