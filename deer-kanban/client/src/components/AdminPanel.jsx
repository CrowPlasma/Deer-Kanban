import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Users, UserPlus, Shield, XCircle, RefreshCw, Edit2, Settings as SettingsIcon, Image as ImageIcon, Download, Database, Upload } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import { SettingsContext } from '../context/SettingsContext';

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const { showAlert, showConfirm } = useModal();
  const [newUsername, setNewUsername] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('users'); // users, settings
  const { settings, fetchSettings } = useContext(SettingsContext);
  const [bgFile, setBgFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/users', { username: newUsername });
      setNewUsername('');
      fetchUsers();
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Error al crear usuario', 'danger');
    }
  };

  const toggleUserStatus = async (id, currentStatus) => {
    try {
      await axios.patch(`/api/users/${id}/status`, { isActive: !currentStatus });
      fetchUsers();
    } catch (e) {
      showAlert('Error', 'Error al actualizar estado', 'danger');
    }
  };

  const deleteUser = async (id) => {
    const confirmed = await showConfirm('Eliminar usuario', '¿Eliminar usuario permanentemente?', 'danger');
    if (confirmed) {
      try {
        await axios.delete(`/api/users/${id}`);
        fetchUsers();
      } catch (e) {
        showAlert('Error', e.response?.data?.error || 'Error al eliminar', 'danger');
      }
    }
  };

  const changeUserRole = async (id, newRole) => {
    const confirmed = await showConfirm('Cambiar rol', `¿Cambiar rol a ${newRole}?`, 'warning');
    if (confirmed) {
      try {
        await axios.patch(`/api/users/${id}/role`, { role: newRole });
        fetchUsers();
      } catch (e) {
        showAlert('Error', e.response?.data?.error || 'Error al actualizar rol', 'danger');
      }
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`/api/users/${editingUser.id}`, { 
        username: editingUser.username,
        resetPassword: editingUser.resetPassword
      });
      setEditingUser(null);
      fetchUsers();
      showAlert('Usuario actualizado', 'Si reseteaste la clave, ahora es 1234567890', 'success');
    } catch (e) {
      showAlert('Error', e.response?.data?.error || 'Error al actualizar usuario', 'danger');
    }
  };

  const handleUpdateSettings = async (updates) => {
    try {
      await axios.patch('/api/settings', updates);
      fetchSettings();
      showAlert('Éxito', 'Configuración actualizada', 'success');
    } catch (e) {
      showAlert('Error', 'Error al actualizar configuración', 'danger');
    }
  };

  const handleUploadInstitutionalBg = async (e) => {
    e.preventDefault();
    if (!bgFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('image', bgFile);
    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await handleUpdateSettings({ institutionalBackgroundUrl: res.data.url });
      setBgFile(null);
    } catch (err) {
      showAlert('Error', 'Error al subir la imagen', 'danger');
    } finally {
      setUploading(false);
    }
  };

  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);

  const handleRestoreBackup = async (e) => {
    e.preventDefault();
    if (!restoreFile) return;
    
    const confirmed = await showConfirm(
      '⚠ Restaurar Respaldo', 
      'Esto sobrescribirá TODOS los tableros, tareas y usuarios actuales con los del archivo ZIP. ¿Estás seguro de que quieres continuar?', 
      'danger'
    );
    if (!confirmed) return;

    setRestoring(true);
    const formData = new FormData();
    formData.append('backup', restoreFile);
    
    try {
      const res = await axios.post('/api/settings/restore', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      showAlert('¡Restauración Exitosa!', 'El respaldo se restauró correctamente. La página se recargará para aplicar los cambios.', 'success');
      setTimeout(() => {
        window.location.href = '/';
      }, 3000);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'Error al restaurar el respaldo', 'danger');
    } finally {
      setRestoring(false);
      setRestoreFile(null);
    }
  };

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <Shield size={32} color="var(--accent-blue)" />
        <h1 style={{ margin: 0, fontSize: '24px' }}>Panel de Administración</h1>
      </div>

      <div style={{ display: 'flex', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '24px' }}>
        <button className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-text'}`} onClick={() => setActiveTab('users')}>
          <Users size={16} style={{ marginRight: '8px' }} /> Usuarios
        </button>
        <button className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-text'}`} onClick={() => setActiveTab('settings')}>
          <SettingsIcon size={16} style={{ marginRight: '8px' }} /> Configuración Global
        </button>
      </div>

      {activeTab === 'users' && (
        <>
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ marginBottom: '16px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={18}/> Crear Nuevo Usuario
            </h3>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nombre de Usuario (Contraseña inicial: 1234567890)</label>
                <input type="text" className="input" value={newUsername} onChange={e => setNewUsername(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary">Crear</button>
            </form>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Users size={18}/> Usuarios del Sistema
              </h3>
              <input 
                type="text" 
                className="input" 
                placeholder="Buscar usuario..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ width: '250px' }}
              />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 0' }}>Usuario</th>
                  <th style={{ padding: '8px 0' }}>Contacto</th>
                  <th style={{ padding: '8px 0' }}>Rol</th>
                  <th style={{ padding: '8px 0' }}>Estado</th>
                  <th style={{ padding: '8px 0', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 0' }}>{u.username}</td>
                    <td style={{ padding: '12px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <div>{u.email || 'Sin correo'}</div>
                    </td>
                    <td style={{ padding: '12px 0' }}>
                      <select 
                        className="input" 
                        style={{ padding: '4px', width: 'auto' }}
                        value={u.role}
                        onChange={(e) => changeUserRole(u.id, e.target.value)}
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 0' }}>
                      <span style={{ color: u.isActive ? 'green' : 'red', fontWeight: 500 }}>
                        {u.isActive ? 'Activo' : 'Suspendido'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 0', textAlign: 'right' }}>
                      <button className="btn btn-text" onClick={() => setEditingUser({ ...u, resetPassword: false })} style={{ padding: '4px 8px', color: 'var(--accent-blue)' }} title="Editar usuario">
                        <Edit2 size={16} />
                      </button>
                      <button className="btn btn-text" onClick={() => toggleUserStatus(u.id, u.isActive)} style={{ padding: '4px 8px' }} title="Suspender/Activar">
                        <RefreshCw size={16} />
                      </button>
                      <button className="btn btn-text" onClick={() => deleteUser(u.id)} style={{ padding: '4px 8px', color: 'red' }} title="Eliminar">
                        <XCircle size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal de edición */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3>Editar Usuario</h3>
            <form onSubmit={handleUpdateUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Nombre de Usuario</label>
                <input 
                  type="text" 
                  className="input" 
                  value={editingUser.username} 
                  onChange={e => setEditingUser({...editingUser, username: e.target.value})} 
                  required 
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="checkbox" 
                  id="resetPwd"
                  checked={editingUser.resetPassword} 
                  onChange={e => setEditingUser({...editingUser, resetPassword: e.target.checked})} 
                />
                <label htmlFor="resetPwd" style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                  Resetear contraseña (1234567890) y forzar configuración
                </label>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn btn-text" onClick={() => setEditingUser(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="card" style={{ maxWidth: '600px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '24px' }}>Configuración del Sistema</h2>
          
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Permisos de Usuarios</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={settings?.allowCustomBackgrounds} 
                onChange={(e) => handleUpdateSettings({ allowCustomBackgrounds: e.target.checked })} 
              />
              Permitir a los usuarios usar fondos de tablero personalizados
            </label>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} /> Respaldo y Migración
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Descarga un archivo ZIP con la base de datos completa y todas las imágenes de los tableros. Ideal para migrar el sistema a otro servidor (VPS) sin perder información.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
              <button 
                onClick={async () => {
                  try {
                    const res = await axios.get('/api/settings/backup', { responseType: 'blob' });
                    const url = window.URL.createObjectURL(new Blob([res.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    const dateStr = new Date().toISOString().slice(0, 10);
                    link.setAttribute('download', `deer-kanban-backup-${dateStr}.zip`);
                    document.body.appendChild(link);
                    link.click();
                    link.parentNode.removeChild(link);
                  } catch (error) {
                    showAlert('Error', 'No se pudo descargar el respaldo. Verifica tus permisos.', 'danger');
                  }
                }}
                className="btn btn-primary" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', textDecoration: 'none' }}
              >
                <Download size={18} />
                Generar y Descargar Backup
              </button>
              
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px', fontWeight: 500 }}>
                  Restaurar desde un ZIP:
                </p>
                <form onSubmit={handleRestoreBackup} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input 
                    type="file" 
                    accept=".zip" 
                    onChange={(e) => setRestoreFile(e.target.files[0])} 
                    className="input" 
                    style={{ padding: '6px' }}
                  />
                  <button 
                    type="submit" 
                    className="btn" 
                    disabled={!restoreFile || restoring}
                    style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '6px', 
                      background: restoreFile ? 'var(--accent-blue)' : 'var(--bg-hover)', 
                      color: restoreFile ? '#fff' : 'var(--text-secondary)' 
                    }}
                  >
                    <Upload size={16} />
                    {restoring ? 'Restaurando...' : 'Restaurar'}
                  </button>
                </form>
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '24px 0' }} />

          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Fondo Institucional por Defecto</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Si un tablero no tiene fondo o si desactivaste los fondos personalizados, se mostrará esta imagen.
            </p>
            <form onSubmit={handleUploadInstitutionalBg} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="file" accept="image/*" onChange={(e) => setBgFile(e.target.files[0])} className="input" />
              <button type="submit" className="btn btn-primary" disabled={!bgFile || uploading}>
                {uploading ? 'Subiendo...' : 'Actualizar Fondo Institucional'}
              </button>
            </form>

            {settings?.institutionalBackgroundUrl && (
              <div style={{ marginTop: '16px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Fondo institucional actual:</p>
                <div style={{ position: 'relative', width: '100%', height: '150px', marginTop: '8px' }}>
                  <img src={settings.institutionalBackgroundUrl} alt="Institucional" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                  <button 
                    className="btn btn-text" 
                    style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(255,255,255,0.8)', color: 'red', padding: '4px' }}
                    onClick={() => handleUpdateSettings({ institutionalBackgroundUrl: null })}
                    title="Eliminar fondo institucional"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
