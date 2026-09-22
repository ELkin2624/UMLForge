import { useEffect } from 'react';
import { useAuthStore, getUserFallbackFromToken } from '../store';
import { request } from '../../../api/client';
import { LogOut } from 'lucide-react';
import './UserMenu.css';

export function UserMenu() {
  const user = useAuthStore(s => s.user);
  const token = useAuthStore(s => s.token);
  const clearAuth = useAuthStore(s => s.clearAuth);
  const setUser = useAuthStore(s => s.setUser);

  // Si existe token pero aún no tenemos el perfil completo del usuario,
  // consultar /auth/me en segundo plano para sincronizarlo.
  useEffect(() => {
    if (token && (!user || !user.email)) {
      let isMounted = true;
      request<any>('/auth/me')
        .then((userData) => {
          if (isMounted && userData && userData.id) {
            setUser(userData);
          }
        })
        .catch((err) => {
          console.warn('[UserMenu] No se pudo obtener perfil de usuario:', err);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [token, user, setUser]);

  const handleLogout = async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('[UserMenu] Error al cerrar sesión:', e);
    } finally {
      clearAuth();
    }
  };

  if (!token && !user) {
    return null;
  }

  // Si user está cargando o es null, usar fallback decodificado directamente del token JWT
  const fallbackUser = token ? getUserFallbackFromToken(token) : null;
  const effectiveUser = user || fallbackUser;

  const displayName = effectiveUser?.display_name || effectiveUser?.username || 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="user-menu-container">
      <div className="user-info">
        <div className="user-avatar-circle" title={effectiveUser?.email || displayName}>
          <span>{initial}</span>
        </div>
        <span className="user-display-name" title={displayName}>{displayName}</span>
      </div>
      <button 
        className="logout-btn" 
        onClick={handleLogout} 
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
