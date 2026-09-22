import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, getUserFallbackFromToken } from './store';
import { isTokenExpired } from '../../api/client';

describe('Auth Feature & API Client', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('extracts user fallback from a valid JWT token payload', () => {
    // Header: {"alg":"HS256","typ":"JWT"} -> eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
    // Payload: {"sub":"42","username":"tester"} -> eyJzdWIiOiI0MiIsInVzZXJuYW1lIjoidGVzdGVyIn0
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsInVzZXJuYW1lIjoidGVzdGVyIn0.signature';
    const fallback = getUserFallbackFromToken(fakeToken);

    expect(fallback).not.toBeNull();
    expect(fallback?.id).toBe(42);
    expect(fallback?.username).toBe('tester');
    expect(fallback?.display_name).toBe('tester');
  });

  it('returns null for malformed or empty token in getUserFallbackFromToken', () => {
    expect(getUserFallbackFromToken(null)).toBeNull();
    expect(getUserFallbackFromToken('')).toBeNull();
    expect(getUserFallbackFromToken('invalid-token')).toBeNull();
  });

  it('checks expiration correctly with isTokenExpired', () => {
    const expiredExp = Math.floor(Date.now() / 1000) - 60; // 60s in the past
    const base64ExpiredPayload = btoa(JSON.stringify({ sub: '1', exp: expiredExp }));
    const expiredToken = `header.${base64ExpiredPayload}.sig`;
    expect(isTokenExpired(expiredToken)).toBe(true);

    const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
    const base64FuturePayload = btoa(JSON.stringify({ sub: '1', exp: futureExp }));
    const validToken = `header.${base64FuturePayload}.sig`;
    expect(isTokenExpired(validToken)).toBe(false);

    expect(isTokenExpired('garbage-token')).toBe(true);
  });

  it('sets auth and retains fallback user if user is null', () => {
    const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MiIsInVzZXJuYW1lIjoidGVzdGVyIn0.signature';
    
    useAuthStore.getState().setAuth(fakeToken, null);

    const state = useAuthStore.getState();
    expect(state.token).toBe(fakeToken);
    expect(state.user).not.toBeNull();
    expect(state.user?.username).toBe('tester');

    // Updating user directly
    useAuthStore.getState().setUser({
      id: 42,
      username: 'tester',
      email: 'tester@example.com',
      display_name: 'Full Tester',
    });

    expect(useAuthStore.getState().user?.display_name).toBe('Full Tester');

    // Clearing auth resets both token and user
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
