import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-background"></div>
      <div className="login-card">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <img 
            src="/logo.jpg" 
            alt="Deer Kanban Logo" 
            style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: '20px', 
              marginBottom: '16px', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
            }} 
          />
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Deer Kanban</h1>
          <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>Sistema de Gestión Premium</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px', color: 'var(--text-primary)' }}>Usuario</label>
            <input
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ingresa tu usuario"
              required
              style={{ padding: '12px 16px', fontSize: '15px' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label style={{ fontWeight: '500', display: 'block', marginBottom: '8px', color: 'var(--text-primary)' }}>Contraseña</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{ padding: '12px 16px', fontSize: '15px' }}
            />
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '20px', fontWeight: '500', textAlign: 'center' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: '600', borderRadius: '8px' }}>
            Entrar al Sistema
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
