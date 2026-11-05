import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChatView } from '@/features/ai/ChatView';
import { ActivityFeed, SharedDecisions } from '@/features/ai/TeamFeeds';
import { border, colors, MIN_TOUCH, radius, spacing } from '@/shared/theme/tokens';
import { Text } from '@/shared/ui';

const sections = [
  { key: 'chat', label: 'Mi chat' },
  { key: 'activity', label: 'Actividad' },
  { key: 'decisions', label: 'Decisiones' },
] as const;

export default function AIScreen() {
  const [section, setSection] = useState<(typeof sections)[number]['key']>('chat');
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.segments} accessibilityRole="tablist">
        {sections.map((s) => (
          <Pressable
            key={s.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === s.key }}
            onPress={() => setSection(s.key)}
            style={[styles.segment, section === s.key && styles.active]}
          >
            <Text style={{ fontWeight: section === s.key ? '800' : '600', fontSize: 12 }}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {section === 'chat' ? <ChatView /> : section === 'activity' ? <ActivityFeed /> : <SharedDecisions />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
    backgroundColor: colors.card,
  },
  active: { backgroundColor: colors.btnPeach },
});
