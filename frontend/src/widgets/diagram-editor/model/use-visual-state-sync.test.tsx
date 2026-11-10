import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ApollonEditor } from '@tumaet/apollon';
import { useVisualStateSync } from './use-visual-state-sync';
import type { VisualStateMap } from './types';

describe('useVisualStateSync', () => {
  it('conserva el arrastre local del mismo nodo y aplica otros movimientos remotos', () => {
    let receiveRemote: ((state: VisualStateMap) => void) | undefined;
    const editor = {
      model: {
        nodes: [
          { id: 'a', position: { x: 10, y: 20 } },
          { id: 'b', position: { x: 30, y: 40 } },
        ],
      },
    } as unknown as ApollonEditor;
    const { result } = renderHook(() => useVisualStateSync({
      updateVisualStateNode: vi.fn(),
      removeVisualStateNode: vi.fn(),
      subscribeToVisualState: (callback) => { receiveRemote = callback; return () => {}; },
      setAwarenessState: vi.fn(),
    }));

    act(() => {
      result.current.lastVisualStateRef.current = {
        a: { x: 0, y: 20 }, b: { x: 30, y: 40 },
      };
      result.current.processLocalVisualState(editor.model);
    });
    result.current.subscribeToRemoteVisual(editor, () => false, vi.fn());

    act(() => receiveRemote?.({ a: { x: 99, y: 99 }, b: { x: 35, y: 40 } }));
    expect(editor.model.nodes.find((node) => node.id === 'a')?.position).toEqual({ x: 10, y: 20 });
    expect(editor.model.nodes.find((node) => node.id === 'b')?.position).toEqual({ x: 35, y: 40 });
  });
});
