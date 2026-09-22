import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTopMenuState } from './use-top-menu-state';

describe('useTopMenuState', () => {
  it('initializes with no active menu and closed mobile drawer', () => {
    const { result } = renderHook(() => useTopMenuState());
    expect(result.current.activeMenu).toBeNull();
    expect(result.current.mobileMenuOpen).toBe(false);
  });

  it('toggles desktop menus correctly', () => {
    const { result } = renderHook(() => useTopMenuState());

    act(() => {
      result.current.toggleMenu('file');
    });
    expect(result.current.activeMenu).toBe('file');

    act(() => {
      result.current.toggleMenu('file');
    });
    expect(result.current.activeMenu).toBeNull();

    act(() => {
      result.current.toggleMenu('validate');
    });
    expect(result.current.activeMenu).toBe('validate');

    act(() => {
      result.current.closeMenu();
    });
    expect(result.current.activeMenu).toBeNull();
  });

  it('toggles and closes mobile menu drawer correctly', () => {
    const { result } = renderHook(() => useTopMenuState());

    act(() => {
      result.current.toggleMobileMenu();
    });
    expect(result.current.mobileMenuOpen).toBe(true);

    act(() => {
      result.current.closeMobileMenu();
    });
    expect(result.current.mobileMenuOpen).toBe(false);
  });

  it('closes active menu on click outside .top-menu-item-container', () => {
    const { result } = renderHook(() => useTopMenuState());

    act(() => {
      result.current.toggleMenu('file');
    });
    expect(result.current.activeMenu).toBe('file');

    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);

    act(() => {
      const event = new MouseEvent('mousedown', { bubbles: true });
      outsideElement.dispatchEvent(event);
    });

    expect(result.current.activeMenu).toBeNull();
    document.body.removeChild(outsideElement);
  });
});
