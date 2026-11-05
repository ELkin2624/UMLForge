import { create } from 'zustand';

export type Screen = 'dashboard' | 'editor';

interface DashboardStore {
  screen: Screen;
  showDashboard: () => void;
  showEditor: () => void;
}

/** Con `?diagram=` en la URL (recarga dentro del editor) se arranca en el editor. */
function initialScreen(): Screen {
  try {
    return new URLSearchParams(window.location.search).has('diagram') ? 'editor' : 'dashboard';
  } catch {
    return 'dashboard';
  }
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  screen: initialScreen(),
  showDashboard: () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('diagram');
      window.history.replaceState({}, '', url.toString());
    } catch {
      /* sin history API la pantalla igual cambia */
    }
    set({ screen: 'dashboard' });
  },
  showEditor: () => set({ screen: 'editor' }),
}));
