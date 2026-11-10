import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { listVersions } from '@/features/projects/api';
import { useProject } from '@/features/projects/ProjectContext';
import { VersionPreview } from '@/features/versions/VersionPreview';
import { VersionRow } from '@/features/versions/VersionRow';
import { spacing } from '@/shared/theme/tokens';
import { useAsync } from '@/shared/useAsync';
import { Button, EmptyState, ErrorBox, Loading } from '@/shared/ui';
import type { VersionSummary } from '@/types/api';

const PAGE = 20;

export default function VersionsScreen() {
  const { id, data } = useProject();
  const first = useAsync(() => listVersions(id, { limit: PAGE }), [id]);
  const [older, setOlder] = useState<VersionSummary[]>([]);
  const [exhausted, setExhausted] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);

  const items = [...(first.data ?? []), ...older];
  const more = !exhausted && (first.data?.length ?? 0) === PAGE;

  async function loadMore() {
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listVersions(id, { limit: PAGE, before: items[items.length - 1]?.version });
      setOlder((prev) => [...prev, ...page]);
      if (page.length < PAGE) setExhausted(true);
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : 'No se pudo cargar más');
    } finally {
      setLoadingMore(false);
    }
  }

  if (first.loading && !first.data) return <Loading label="Cargando historial…" />;
  if (first.error && !first.data) {
    return (
      <View style={{ padding: spacing.lg }}>
        <ErrorBox message={first.error} onRetry={() => void first.reload()} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(v) => String(v.version)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}
        renderItem={({ item }) => (
          <VersionRow v={item} isCurrent={item.version === data?.version} onView={() => setPreview(item.version)} />
        )}
        ListEmptyComponent={<EmptyState title="Sin versiones" hint="Aún no hay historial para este proyecto." />}
        ListFooterComponent={
          more ? (
            <View style={{ gap: spacing.md }}>
              {moreError ? <ErrorBox message={moreError} /> : null}
              <Button label="Cargar más" variant="secondary" loading={loadingMore} onPress={() => void loadMore()} />
            </View>
          ) : undefined
        }
      />
      {preview !== null ? <VersionPreview diagramId={id} version={preview} onClose={() => setPreview(null)} /> : null}
    </>
  );
}
