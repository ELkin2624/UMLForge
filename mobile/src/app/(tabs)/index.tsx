import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuthStore } from '@/features/auth/store';
import { listDiagrams } from '@/features/projects/api';
import { ProjectCard } from '@/features/projects/ProjectCard';
import { useAsync } from '@/shared/useAsync';
import { border, colors, MIN_TOUCH, radius, spacing } from '@/shared/theme/tokens';
import { Chip, EmptyState, ErrorBox, Loading, Text } from '@/shared/ui';

export default function ProjectsScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { data, loading, error, reload } = useAsync(listDiagrams, []);
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...(data ?? [])].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return q ? all.filter((d) => d.name.toLowerCase().includes(q)) : all;
  }, [data, query]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text variant="caption">Hola, {user?.display_name || user?.username}</Text>
          <Text variant="title">Mis proyectos</Text>
        </View>
        <Chip label="Solo lectura" tone="mint" />
      </View>
      <View style={styles.search}>
        <Search size={16} color={colors.gray} />
        <TextInput
          accessibilityLabel="Buscar proyecto"
          placeholder="Buscar proyecto"
          placeholderTextColor={colors.gray}
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
        />
      </View>
      {loading && !data ? (
        <Loading label="Cargando proyectos…" />
      ) : error && !data ? (
        <View style={{ padding: spacing.lg }}>
          <ErrorBox message={error} onRetry={() => void reload()} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(d) => String(d.id)}
          renderItem={({ item }) => <ProjectCard diagram={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} />}
          ListEmptyComponent={
            <EmptyState
              title={query ? 'Sin resultados' : 'Aún no tienes proyectos'}
              hint={query ? 'Prueba con otro nombre.' : 'Los diagramas que crees o te compartan en la web aparecerán aquí.'}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, gap: spacing.md },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink },
  list: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
});
