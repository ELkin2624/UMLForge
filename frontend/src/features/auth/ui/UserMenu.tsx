import { useAuthStore } from '../store';
import { request } from '../../../api/client';
import { LogOut, User } from 'lucide-react';
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

  return (
    <div className="user-menu-container">
      <div className="user-info">
        <User size={16} />
        <span>{user.display_name || user.username}</span>
      </div>
      <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión">
        <LogOut size={16} />
      </button>
    </div>
  );
}
