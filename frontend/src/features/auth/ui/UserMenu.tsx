import { useAuthStore } from '../store';
import { request } from '../../../api/client';
import { LogOut } from 'lucide-react';
import './UserMenu.css';

export function UserMenu() {
  const user = useAuthStore(s => s.user);
  const clearAuth = useAuthStore(s => s.clearAuth);

  const handleLogout = async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      clearAuth();
    }
  };

  if (!user) return null;

  const displayName = user.display_name || user.username || 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="user-menu-container">
      <div className="user-info">
        <div className="user-avatar-circle">
          <span>{initial}</span>
        </div>
        <span className="user-display-name">{displayName}</span>
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

