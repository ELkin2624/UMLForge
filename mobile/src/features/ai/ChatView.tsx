import { Send } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useAuthStore } from '@/features/auth/store';
import { useProject } from '@/features/projects/ProjectContext';
import { useAsync } from '@/shared/useAsync';
import { border, colors, MIN_TOUCH, radius, spacing } from '@/shared/theme/tokens';
import { Chip, EmptyState, ErrorBox, Loading, Text } from '@/shared/ui';
import type { AIPatch, ChatMessage } from '@/types/api';

import { askAI, fetchPrivateHistory } from './api';

const opLabel: Record<AIPatch['operation'], string> = {
  ADD_CLASS: 'Añadir clase',
  UPDATE_CLASS: 'Modificar clase',
  DELETE_CLASS: 'Eliminar clase',
  ADD_RELATION: 'Añadir relación',
  DELETE_RELATION: 'Eliminar relación',
};

function PatchCard({ p }: { p: AIPatch }) {
  return (
    <View style={styles.patch}>
      <Text style={{ fontWeight: '700' }}>
        {opLabel[p.operation] ?? p.operation}: {p.target}
      </Text>
      <Text variant="caption">{p.reason}</Text>
    </View>
  );
}

export function ChatView() {
  const { id, data } = useProject();
  const user = useAuthStore((s) => s.user);
  const userId = String(user?.id ?? '');
  const userName = user?.display_name || user?.username || 'Usuario';
  const history = useAsync(() => fetchPrivateHistory(id, userId), [id, userId]);
  const [added, setAdded] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);

  const messages = [...(history.data ?? []), ...added];

  async function send() {
    const prompt = text.trim();
    if (!prompt || sending) return;
    setText('');
    setSending(true);
    setError(null);
    setAdded((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: prompt }]);
    try {
      const res = await askAI({
        diagramId: id,
        userId,
        userName,
        prompt,
        snapshot: (data?.data ?? {}) as unknown as Record<string, unknown>,
      });
      // Los parches se muestran como sugerencias: el móvil nunca modifica el diagrama.
      setAdded((m) => [
        ...m,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          content: res.reply,
          patches: res.patches,
          simulated: res.simulated,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La IA no pudo responder');
    } finally {
      setSending(false);
    }
  }

  if (history.loading && !history.data) return <Loading label="Cargando conversación…" />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <EmptyState title="Pregunta a la IA" hint="Consulta sobre el diseño de este diagrama: relaciones, mejoras, normalización… Es una conversación privada." />
        }
        renderItem={({ item }) => {
          const mine = item.role === 'user';
          return (
            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: spacing.sm }}>
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text>{item.content}</Text>
              </View>
              {item.simulated ? <Chip label="Respuesta simulada: revisa Ollama" tone="peach" /> : null}
              {item.patches && item.patches.length > 0 ? (
                <View style={{ gap: spacing.sm, alignSelf: 'stretch' }}>
                  <Chip label="Sugerencias de la IA · no se aplican en móvil" tone="lilac" />
                  {item.patches.map((p, i) => (
                    <PatchCard key={p.patch_id ?? i} p={p} />
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={{ gap: spacing.md }}>
            {sending ? <Text variant="caption">La IA está pensando…</Text> : null}
            {error || history.error ? <ErrorBox message={(error ?? history.error)!} /> : null}
          </View>
        }
      />
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Mensaje para la IA"
          placeholder="Pregunta algo sobre este diagrama"
          placeholderTextColor={colors.gray}
          value={text}
          onChangeText={setText}
          multiline
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          disabled={sending || !text.trim()}
          onPress={() => void send()}
          style={[styles.send, (sending || !text.trim()) && { opacity: 0.5 }]}
        >
          <Send size={18} color={colors.ink} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: {
    maxWidth: '88%',
    padding: spacing.md,
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.lg,
  },
  mine: { backgroundColor: colors.btnPeach },
  theirs: { backgroundColor: colors.card },
  patch: {
    padding: spacing.md,
    gap: 2,
    backgroundColor: colors.lilac,
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: border.thick,
    borderColor: colors.ink,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    minHeight: MIN_TOUCH,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.cream,
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
  send: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.btnPeach,
    borderWidth: border.thin,
    borderColor: colors.ink,
    borderRadius: radius.md,
  },
});
