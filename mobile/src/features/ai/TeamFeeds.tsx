import { FlatList, View } from 'react-native';

import { useProject } from '@/features/projects/ProjectContext';
import { relativeTime } from '@/shared/format';
import { spacing } from '@/shared/theme/tokens';
import { useAsync } from '@/shared/useAsync';
import { Avatar, Card, EmptyState, ErrorBox, Loading, Text } from '@/shared/ui';

import { fetchAuditFeed, fetchSharedMemory, type SharedDecision } from './api';

export function ActivityFeed() {
  const { id } = useProject();
  const { data, loading, error, reload } = useAsync(() => fetchAuditFeed(id), [id]);
  if (loading && !data) return <Loading />;
  if (error) return <View style={{ padding: spacing.lg }}><ErrorBox message={error} onRetry={() => void reload()} /></View>;
  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(e, i) => `${e.timestamp}-${i}`}
      refreshing={loading}
      onRefresh={() => void reload()}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}
      ListEmptyComponent={<EmptyState title="Sin actividad" hint="Aún no hay eventos del equipo o de la IA." />}
      renderItem={({ item }) => {
        const ai = /ia|ai|agente/i.test(item.actor);
        return (
          <Card tone={ai ? 'lilac' : 'white'}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Avatar name={item.actor} ai={ai} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{item.actor}</Text>
                <Text>{item.action_summary}</Text>
                <Text variant="caption">{relativeTime(item.timestamp)}</Text>
              </View>
            </View>
          </Card>
        );
      }}
    />
  );
}

function decisionText(d: SharedDecision): string {
  return d.decision ?? d.note ?? (typeof d === 'string' ? (d as string) : JSON.stringify(d));
}

export function SharedDecisions() {
  const { id } = useProject();
  const { data, loading, error, reload } = useAsync(() => fetchSharedMemory(id), [id]);
  if (loading && !data) return <Loading />;
  if (error) return <View style={{ padding: spacing.lg }}><ErrorBox message={error} onRetry={() => void reload()} /></View>;
  const items = data?.architectural_decisions ?? [];
  return (
    <FlatList
      data={items}
      keyExtractor={(_, i) => String(i)}
      refreshing={loading}
      onRefresh={() => void reload()}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}
      ListEmptyComponent={<EmptyState title="Sin decisiones" hint="La IA aún no ha registrado decisiones de diseño del equipo." />}
      renderItem={({ item }) => (
        <Card tone="yellow">
          <View style={{ gap: 4 }}>
            <Text>{decisionText(item)}</Text>
            <Text variant="caption">
              {[item.author ?? item.user_name, item.timestamp ? relativeTime(item.timestamp) : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Card>
      )}
    />
  );
}
