import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { buildJoinUrl, parseInviteFromUrl, clearInviteParamsFromUrl } from './invite-utils';
import { useShareLink } from './use-share-link';
import * as api from '../api/share-link-api';

describe('enlace de acceso general · URL', () => {
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('buildJoinUrl usa ?join= y no incluye room ni role', () => {
    const url = new URL(buildJoinUrl('tok_123', 'http://localhost:5173/'));
    expect(url.searchParams.get('join')).toBe('tok_123');
    expect(url.searchParams.has('room')).toBe(false);
    expect(url.searchParams.has('role')).toBe(false);
  });

  it('el token se codifica de forma segura en la URL', () => {
    const url = buildJoinUrl('a/b+c=d', 'http://localhost:5173/');
    expect(new URL(url).searchParams.get('join')).toBe('a/b+c=d');
  });

  it('parseInviteFromUrl reconoce ?join= y lo prioriza', () => {
    window.history.replaceState({}, '', '/?join=abc&room=1&token=zzz');
    expect(parseInviteFromUrl()).toEqual({ roomId: '', token: '', joinToken: 'abc' });
  });

  it('el formato antiguo ?room=&token= sigue pudiendo leerse (para avisar que ya no sirve)', () => {
    window.history.replaceState({}, '', '/?room=1&token=zzz&role=EDITOR');
    const parsed = parseInviteFromUrl();
    expect(parsed?.roomId).toBe('1');
    expect(parsed?.joinToken).toBeUndefined();
  });

  it('clearInviteParamsFromUrl quita join y conserva el resto', () => {
    window.history.replaceState({}, '', '/?join=abc&diagram=2');
    clearInviteParamsFromUrl();
    expect(window.location.search).toBe('?diagram=2');
  });
});

describe('useShareLink', () => {
  const link = { enabled: true, role: 'READER' as const, token: 'secreto' };
  let get: ReturnType<typeof vi.spyOn>;
  let put: ReturnType<typeof vi.spyOn>;
  let regen: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    get = vi.spyOn(api, 'getShareLink').mockResolvedValue(link);
    put = vi.spyOn(api, 'updateShareLink').mockResolvedValue({ ...link, role: 'EDITOR' });
    regen = vi.spyOn(api, 'regenerateShareLink').mockResolvedValue({ ...link, token: 'nuevo' });
  });
  afterEach(() => vi.restoreAllMocks());

  it('carga el enlace al abrir el diálogo si es propietario', async () => {
    const { result } = renderHook(() => useShareLink('7', true, true));
    await waitFor(() => expect(result.current.link.token).toBe('secreto'));
    expect(get).toHaveBeenCalledWith('7');
  });

  it('no consulta el enlace si no es propietario (el token es secreto)', async () => {
    renderHook(() => useShareLink('7', true, false));
    await Promise.resolve();
    expect(get).not.toHaveBeenCalled();
  });

  it('no consulta con el diálogo cerrado ni sin diagrama', async () => {
    renderHook(() => useShareLink('7', false, true));
    renderHook(() => useShareLink(null, true, true));
    await Promise.resolve();
    expect(get).not.toHaveBeenCalled();
  });

  it('update envía enabled y rol, y refleja la respuesta', async () => {
    const { result } = renderHook(() => useShareLink('7', true, true));
    await waitFor(() => expect(result.current.link.token).toBe('secreto'));
    await act(async () => { await result.current.update(true, 'EDITOR'); });
    expect(put).toHaveBeenCalledWith('7', { enabled: true, role: 'EDITOR' });
    expect(result.current.link.role).toBe('EDITOR');
  });

  it('regenerate reemplaza el token', async () => {
    const { result } = renderHook(() => useShareLink('7', true, true));
    await waitFor(() => expect(result.current.link.token).toBe('secreto'));
    await act(async () => { await result.current.regenerate(); });
    expect(regen).toHaveBeenCalledWith('7');
    expect(result.current.link.token).toBe('nuevo');
  });

  it('expone el error si el backend falla', async () => {
    get.mockRejectedValueOnce(new Error('403'));
    const { result } = renderHook(() => useShareLink('7', true, true));
    await waitFor(() => expect(result.current.error).toBe('403'));
    expect(result.current.link.enabled).toBe(false);
  });
});
