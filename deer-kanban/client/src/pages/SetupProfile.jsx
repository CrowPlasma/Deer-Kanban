import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { ShieldAlert } from 'lucide-react';

const SetupProfile = () => {
  const { user, setUser } = useContext(AuthContext);
  const [newPassword, setNewPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!email.includes('@')) {
      setError('Correo electrónico inválido');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/api/auth/setup', { newPassword, email });
      // Update the user context to remove the forcePasswordChange flag
      setUser(res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al configurar el perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--bg-main)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <ShieldAlert size={48} color="var(--accent-blue)" style={{ margin: '0 auto 16px auto', display: 'block' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Configuración Inicial</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Hola {user?.username}. Por seguridad, debes cambiar tu contraseña predeterminada y completar tu perfil antes de continuar.
          </p>
        </div>

        {error && <div style={{ color: 'red', fontSize: '14px', marginBottom: '16px', textAlign: 'center' }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Nueva Contraseña (Obligatorio)
            </label>
            <input 
              type="password" 
              className="input" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              placeholder="Mínimo 6 caracteres"
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              Correo Electrónico (Obligatorio)
            </label>
            <input 
              type="email" 
              className="input" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="tu@correo.com"
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', padding: '12px', fontWeight: 600 }} disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar y Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupProfile;
