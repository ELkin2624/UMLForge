import { useDashboardStore } from './dashboard-store';

describe('dashboard-store', () => {
  it('alterna entre pantalla de proyectos y editor, y limpia ?diagram= al volver', () => {
    window.history.replaceState({}, '', '/?diagram=7');
    useDashboardStore.getState().showEditor();
    expect(useDashboardStore.getState().screen).toBe('editor');

    useDashboardStore.getState().showDashboard();
    expect(useDashboardStore.getState().screen).toBe('dashboard');
    expect(window.location.search).toBe('');
  });
});
