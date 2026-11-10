import { Tabs, useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bot, Eye, History, ScanSearch } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProjectContext } from '@/features/projects/ProjectContext';
import { getDiagram } from '@/features/projects/api';
import { roleLabel } from '@/shared/format';
import { useAsync } from '@/shared/useAsync';
import { border, colors, MIN_TOUCH, radius, spacing } from '@/shared/theme/tokens';
import { Chip, ErrorBox, Loading, Text } from '@/shared/ui';

export default function ProjectLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const state = useAsync(() => getDiagram(id), [id]);
  const d = state.data;

  return (
    <ProjectContext.Provider value={{ ...state, id }}>
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a proyectos"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.back}
          >
            <ArrowLeft size={20} color={colors.ink} />
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="heading" numberOfLines={1}>
              {d?.name ?? 'Proyecto'}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
              {d ? <Chip label={`v${d.version}`} tone="yellow" /> : null}
              {d?.my_role ? <Chip label={roleLabel[d.my_role] ?? d.my_role} tone="peach" /> : null}
              <Chip label="Solo lectura" tone="mint" />
            </View>
          </View>
        </View>
        {state.error && !d ? (
          <View style={{ padding: spacing.lg }}>
            <ErrorBox message={state.error} onRetry={() => void state.reload()} />
          </View>
        ) : state.loading && !d ? (
          <Loading label="Abriendo proyecto…" />
        ) : (
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: colors.ink,
              tabBarInactiveTintColor: colors.gray,
              tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
              tabBarStyle: { backgroundColor: colors.card, borderTopWidth: border.thick, borderTopColor: colors.ink },
              tabBarActiveBackgroundColor: colors.btnPeach,
              sceneStyle: { backgroundColor: colors.cream },
            }}
          >
            <Tabs.Screen name="diagram" options={{ title: 'Diagrama', tabBarIcon: ({ color }) => <Eye size={20} color={color} /> }} />
            <Tabs.Screen name="versions" options={{ title: 'Versiones', tabBarIcon: ({ color }) => <History size={20} color={color} /> }} />
            <Tabs.Screen name="analyze" options={{ title: 'Analizar', tabBarIcon: ({ color }) => <ScanSearch size={20} color={color} /> }} />
            <Tabs.Screen name="ai" options={{ title: 'IA', tabBarIcon: ({ color }) => <Bot size={20} color={color} /> }} />
          </Tabs>
        )}
      </View>
    </ProjectContext.Provider>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: border.thick,
    borderBottomColor: colors.ink,
  },
  back: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
});
