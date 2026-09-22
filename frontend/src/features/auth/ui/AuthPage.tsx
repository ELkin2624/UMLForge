import React, { useState } from 'react';
import { request } from '../../../api/client';
import { useAuthStore } from '../store';
import { Eye, EyeOff, Mail, User, Lock, CheckCircle2 } from 'lucide-react';
import './AuthPage.css';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (isLogin) {
        const tokenRes = await request<{ access_token: string; user?: any }>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ identifier, password }),
        });
        
        let userData = tokenRes.user;
        if (!userData) {
          try {
            userData = await request<any>('/auth/me');
          } catch {}
        }
        
        setAuth(tokenRes.access_token, userData);
      } else {
        await request('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, username, password }),
        });
        
        const registeredUser = username || email;
        setIsLogin(true);
        setIdentifier(registeredUser);
        setPassword('');
        setEmail('');
        setUsername('');
        setSuccess("¡Cuenta creada con éxito! Por favor inicia sesión.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      {/* Decorative background shapes */}
      <div className="bg-shape shape-yellow"></div>
      <div className="bg-shape shape-peach"></div>
      
      <div className="auth-header-logo">
        <h2>UMLForge</h2>
      </div>

      <div className="auth-card fade-in">
        <div className="auth-title">
          <h2>{isLogin ? 'Iniciar sesión' : 'Registrarse'}</h2>
          <p>{isLogin ? 'Ingresa tus detalles para acceder a tu cuenta' : 'Ingresa tus detalles para crear tu cuenta'}</p>
        </div>
        
        {error && <div className="auth-error slide-down">{error}</div>}
        {success && (
          <div className="auth-success slide-down">
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="auth-form">
          {isLogin ? (
            <div className="input-group">
              <span className="input-icon"><User size={18} /></span>
              <input 
                placeholder="Correo electrónico o nombre de usuario"
                value={identifier} 
                onChange={e => setIdentifier(e.target.value)} 
                required 
              />
            </div>
          ) : (
            <>
              <div className="input-group">
                <span className="input-icon"><Mail size={18} /></span>
                <input 
                  type="email" 
                  placeholder="Correo electrónico"
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="input-group">
                <span className="input-icon"><User size={18} /></span>
                <input 
                  placeholder="Nombre de usuario"
                  value={username} 
                  onChange={e => setUsername(e.target.value)} 
                  required 
                />
              </div>
            </>
          )}
          
          <div className="input-group password-group">
            <span className="input-icon"><Lock size={18} /></span>
            <input 
              type={showPassword ? 'text' : 'password'} 
              placeholder="Contraseña"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
            <button 
              type="button" 
              className="toggle-password" 
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          
          {isLogin && (
             <div className="auth-trouble">
               <span>¿Problemas para iniciar sesión?</span>
             </div>
          )}
          
          <button type="submit" className="auth-submit-btn">
            {isLogin ? 'Ingresar' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="auth-divider">
          <span>— O {isLogin ? 'ingresa' : 'regístrate'} con —</span>
        </div>

        <div className="social-login">
          <button type="button" className="social-btn"><b>G</b> Google</button>
        </div>

        <div className="auth-footer">
          {isLogin ? (
            <p>¿No tienes una cuenta?<button type="button" onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}>Regístrate</button></p>
          ) : (
            <p>¿Ya tienes una cuenta? <button type="button" onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}>Iniciar sesión</button></p>
          )}
        </div>
      </div>
    </div>
  );
}
