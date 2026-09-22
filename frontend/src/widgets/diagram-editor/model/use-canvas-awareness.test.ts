import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasAwareness } from './use-canvas-awareness';

describe('useCanvasAwareness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not emit awareness if collaboration status is disconnected', () => {
    const setAwarenessStateMock = vi.fn();
    const editorRef = {
      current: {
        screenToFlowPosition: vi.fn().mockReturnValue({ x: 100, y: 150 }),
      } as any,
    };

    const { result } = renderHook(() =>
      useCanvasAwareness({
        editorRef,
        status: 'disconnected',
        setAwarenessState: setAwarenessStateMock,
      })
    );

    act(() => {
      result.current.handleMouseMove({ clientX: 200, clientY: 250 } as any);
    });

    expect(setAwarenessStateMock).not.toHaveBeenCalled();
  });

  it('emits cursor position when connected and editor is ready', () => {
    const setAwarenessStateMock = vi.fn();
    const editorRef = {
      current: {
        screenToFlowPosition: vi.fn().mockReturnValue({ x: 120.4, y: 340.6 }),
      } as any,
    };

    const { result } = renderHook(() =>
      useCanvasAwareness({
        editorRef,
        status: 'connected',
        setAwarenessState: setAwarenessStateMock,
      })
    );

    act(() => {
      vi.advanceTimersByTime(50);
      result.current.handleMouseMove({ clientX: 300, clientY: 400 } as any);
    });

    expect(setAwarenessStateMock).toHaveBeenCalledWith('cursor', { x: 120, y: 341 });
  });

  it('clears cursor on mouse leave after timeout', () => {
    const setAwarenessStateMock = vi.fn();
    const editorRef = { current: null };

    const { result } = renderHook(() =>
      useCanvasAwareness({
        editorRef,
        status: 'connected',
        setAwarenessState: setAwarenessStateMock,
      })
    );

    const mockDiv = document.createElement('div');
    const outsideElement = document.createElement('span');

    act(() => {
      result.current.handleMouseLeave({
        currentTarget: mockDiv,
        relatedTarget: outsideElement,
      } as any);
    });

    expect(setAwarenessStateMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(160);
    });

    expect(setAwarenessStateMock).toHaveBeenCalledWith('cursor', null);
  });
});
