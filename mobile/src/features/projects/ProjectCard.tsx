import { useRouter } from 'expo-router';
import { ArrowRight, Clock, Folder } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { relativeTime, roleLabel } from '@/shared/format';
import { colors, spacing } from '@/shared/theme/tokens';
import { Card, Chip, Text } from '@/shared/ui';
import type { DiagramSummary } from '@/types/api';

interface Props {
  diagram: DiagramSummary;
}

const ACCENT_TONES = ['yellow', 'peach', 'mint', 'sky', 'lilac'] as const;

export function ProjectCard({ diagram }: Props) {
  const router = useRouter();
  const tone = ACCENT_TONES[diagram.id % ACCENT_TONES.length];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir proyecto ${diagram.name}`}
      onPress={() => router.push(`/project/${diagram.id}/diagram`)}
    >
      <Card tone={tone}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Folder size={18} color={colors.ink} />
              <Text variant="heading" numberOfLines={1} style={styles.title}>
                {diagram.name}
              </Text>
            </View>
            <ArrowRight size={18} color={colors.ink} />
          </View>

          <View style={styles.metaRow}>
            {diagram.my_role ? (
              <Chip label={roleLabel[diagram.my_role] ?? diagram.my_role} tone="white" />
            ) : null}
            <View style={styles.timeRow}>
              <Clock size={12} color={colors.gray} />
              <Text variant="caption">{relativeTime(diagram.updated_at)}</Text>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
