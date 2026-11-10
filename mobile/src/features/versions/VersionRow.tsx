import { Minus, Pencil, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import { relativeTime } from '@/shared/format';
import { colors, spacing } from '@/shared/theme/tokens';
import { Avatar, Button, Card, Chip, Text } from '@/shared/ui';
import type { VersionChange, VersionSummary } from '@/types/api';

const sourceLabel: Record<string, string> = {
  user: 'Manual',
  ai: 'IA',
  restore: 'Restauración',
  import: 'Importación',
  migration: 'Migración',
};

function ChangeLine({ c }: { c: VersionChange }) {
  const Icon = c.op === 'added' ? Plus : c.op === 'removed' ? Minus : Pencil;
  const color = c.op === 'added' ? colors.successText : c.op === 'removed' ? colors.errorText : colors.gray;
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
      <Icon size={13} color={color} style={{ marginTop: 2 }} />
      <Text variant="caption" style={{ flex: 1 }}>
        {c.kind} <Text style={{ fontWeight: '700' }}>{c.parent ? `${c.parent}.` : ''}{c.name}</Text>
        {c.detail ? ` — ${c.detail}` : ''}
      </Text>
    </View>
  );
}

export function VersionRow({
  v,
  isCurrent,
  onView,
}: {
  v: VersionSummary;
  isCurrent: boolean;
  onView: () => void;
}) {
  const ai = v.author.type === 'ai';
  return (
    <Card tone={isCurrent ? 'yellow' : 'white'}>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Avatar name={v.author.name} ai={ai} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>
              {ai ? 'IA' : v.author.name}
              {v.author.on_behalf_of ? ` · a petición de ${v.author.on_behalf_of.name}` : ''}
            </Text>
            <Text variant="caption">{relativeTime(v.created_at)}</Text>
          </View>
          <Chip label={`v${v.version}`} tone="yellow" />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Chip label={sourceLabel[v.source] ?? v.source} tone={ai ? 'lilac' : 'white'} />
          {isCurrent ? <Chip label="Actual" tone="mint" /> : null}
          {v.restored_from ? <Chip label={`Restaurada de v${v.restored_from}`} tone="sky" /> : null}
        </View>
        <Text>{v.summary}</Text>
        {v.changes.length > 0 ? (
          <View style={{ gap: 3 }}>
            {v.changes.slice(0, 6).map((c, i) => (
              <ChangeLine key={`${c.id}-${i}`} c={c} />
            ))}
            {v.changes.length > 6 ? <Text variant="caption">… y {v.changes.length - 6} cambios más</Text> : null}
          </View>
        ) : null}
        <Button label="Ver esta versión" variant="secondary" onPress={onView} />
      </View>
    </Card>
  );
}
