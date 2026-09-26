import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { X, UserPlus, Search, Settings, Trash2, Image as ImageIcon, RotateCcw } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';

const BoardSettingsModal = ({ board: initialBoard, onClose, onUpdate, onDelete }) => {
  const [board, setBoard] = useState(initialBoard);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [inviteUsername, setInviteUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('members');
  const [bgFile, setBgFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const { user } = useContext(AuthContext);
  const { showConfirm, showAlert } = useModal();

  const isOwner = user?.id === board.ownerId;
  useEffect(() => {
    setBoard(initialBoard);
  }, [initialBoard]);
  useEffect(() => {
    const fetchUsers = async () => {
      if (!inviteUsername.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await axios.get(`/api/users/search?q=${inviteUsername}`);
        const existingIds = [board.ownerId, ...board.members.map(m => m.userId)];
        setSearchResults(res.data.filter(u => !existingIds.includes(u.id)));
      } catch (e) {
        console.error(e);
      }
    };
    
    const delayDebounce = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(delayDebounce);
  }, [inviteUsername, board]);

  const handleInvite = async (e, usernameToInvite = inviteUsername) => {
    if (e) e.preventDefault();
    if (!usernameToInvite.trim()) return;
    try {
      await axios.post(`/api/boards/${board.id}/members`, { username: usernameToInvite });
      setInviteUsername('');
      setShowResults(false);
      setError('');
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al invitar al usuario');
    }
  };

  const handleRemoveMember = async (memberId) => {
    const confirmed = await showConfirm('Quitar invitado', '¿Seguro que quieres quitar a este invitado del tablero?', 'danger');
    if (!confirmed) return;
    try {
      await axios.delete(`/api/boards/${board.id}/members/${memberId}`);
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Error al remover al usuario');
    }
  };

  const handleDeleteBoard = async () => {
    const confirmed = await showConfirm(
      'Eliminar Tablero',
      '¿ESTÁS SEGURO? Esta acción no se puede deshacer y eliminará todo el contenido del tablero.',
      'danger'
    );
    if (confirmed) {
      try {
        await axios.delete(`/api/boards/${board.id}`);
        if (onDelete) onDelete();
        onClose();
      } catch (err) {
        setError(err.response?.data?.error || 'Error al eliminar el tablero');
      }
    }
  };

  const handleCloneBoard = async (e) => {
    e.preventDefault();
    if (!cloneName.trim()) {
      setError('Debes ingresar un nombre para el nuevo tablero');
      return;
    }
    
    try {
      const res = await axios.post(`/api/boards/${board.id}/clone`, { name: cloneName.trim() });
      showAlert('Tablero Clonado', 'Se ha clonado la estructura con éxito', 'success');
      onClose();
      window.location.href = `/?boardId=${res.data.id}`; // Simple redirect to reload app state with new board
    } catch (err) {
      setError(err.response?.data?.error || 'Error al clonar el tablero');
    }
  };

  const handleUploadBg = async (e) => {
    e.preventDefault();
    if (!bgFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('image', bgFile);
    try {
      const res = await axios.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      await axios.patch(`/api/boards/${board.id}/background`, { backgroundUrl: res.data.url });
      setBoard({ ...board, backgroundUrl: res.data.url });
      if (onUpdate) onUpdate();
      showAlert('Éxito', 'Fondo actualizado', 'success');
    } catch (err) {
      setError('Error al subir la imagen');
    } finally {
      setUploading(false);
      setBgFile(null);
    }
  };

  const fetchTrash = async () => {
    try {
      const res = await axios.get(`/api/boards/${board.id}/trash`);
      setArchivedTasks(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestoreTask = async (taskId) => {
    try {
      await axios.patch(`/api/tasks/${taskId}`, { isArchived: false });
      setArchivedTasks(archivedTasks.filter(t => t.id !== taskId));
      onUpdate();
      showAlert('Restaurada', 'Tarea restaurada al tablero con éxito', 'success');
    } catch (e) {
      setError('Error al restaurar tarea');
    }
  };

  const handlePermanentDeleteTask = async (taskId) => {
    const confirmed = await showConfirm('Borrar definitivamente', '¿Estás seguro de eliminar esta tarea sin posibilidad de recuperación?', 'danger');
    if (!confirmed) return;
    try {
      await axios.delete(`/api/tasks/${taskId}/permanent`);
      setArchivedTasks(archivedTasks.filter(t => t.id !== taskId));
      onUpdate();
    } catch (e) {
      setError('Error al eliminar tarea permanentemente');
    }
  };

  const handleEmptyTrash = async () => {
    const confirmed = await showConfirm('Vaciar papelera', '¿Vaciar todas las tareas de la papelera del tablero permanentemente?', 'danger');
    if (!confirmed) return;
    try {
      await axios.delete(`/api/boards/${board.id}/trash`);
      setArchivedTasks([]);
      onUpdate();
      showAlert('Papelera limpia', 'Se ha vaciado la papelera', 'info');
    } catch (e) {
      setError('Error al vaciar papelera');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', margin: 0 }}>Ajustes del Tablero</h2>
          <button className="btn btn-text" onClick={onClose}><X size={20}/></button>
        </div>

        <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button className={`btn ${activeTab === 'members' ? 'btn-primary' : 'btn-text'}`} onClick={() => setActiveTab('members')}>Miembros</button>
          <button className={`btn ${activeTab === 'background' ? 'btn-primary' : 'btn-text'}`} onClick={() => setActiveTab('background')}><ImageIcon size={16} style={{ marginRight: '4px' }} /> Fondo</button>
          <button className={`btn ${activeTab === 'trash' ? 'btn-primary' : 'btn-text'}`} onClick={() => { setActiveTab('trash'); fetchTrash(); }}>♻️ Papelera</button>
          {(isOwner || user.role === 'ADMIN') && (
            <button className={`btn ${activeTab === 'admin' ? 'btn-primary' : 'btn-text'}`} style={{ color: 'var(--text-primary)' }} onClick={() => setActiveTab('admin')}><Settings size={16} style={{ marginRight: '4px' }} /> Avanzado</button>
          )}
        </div>

        {activeTab === 'members' && (
          <div>
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Miembros Actuales</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
                <li style={{ padding: '4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {board.owner.username} (Dueño)
                </li>
                {board.members.map(m => (
                  <li key={m.id} style={{ padding: '4px 0', fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><span style={{ color: 'var(--text-primary)' }}>{m.user.username}</span> (Invitado)</span>
                    <button type="button" className="btn btn-text" style={{ color: 'red', padding: '2px' }} onClick={() => handleRemoveMember(m.userId)} title="Quitar Invitado">
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={e => handleInvite(e)}>
              <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>Invitar Usuario</h3>
              <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Buscar por username..." 
                    value={inviteUsername}
                    onChange={e => { setInviteUsername(e.target.value); setShowResults(true); }}
                    onFocus={() => setShowResults(true)}
                    style={{ width: '100%' }}
                  />
                  {showResults && searchResults.length > 0 && (
                    <ul style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '4px', marginTop: '4px', listStyle: 'none', padding: 0, margin: '4px 0 0 0', maxHeight: '150px', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
                      {searchResults.map(u => (
                        <li key={u.id}>
                          <button type="button" className="btn btn-text" style={{ width: '100%', justifyContent: 'flex-start', padding: '8px 12px', fontSize: '13px' }} onClick={() => { setInviteUsername(u.username); setShowResults(false); }}>
                            <Search size={14} style={{ marginRight: '8px', color: 'var(--text-secondary)' }}/> {u.username}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px' }}><UserPlus size={18} /></button>
              </div>
              {error && <p style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>{error}</p>}
            </form>
          </div>
        )}

        {activeTab === 'background' && (
          <div>
            <h4 style={{ marginBottom: '6px', color: 'var(--text-primary)', fontSize: '15px' }}>🌿 Galería Naturaleza & Deer Kanban</h4>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>Selecciona uno de los fondos FHD curados para tu tablero:</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
              {[
                { name: '🌲 Bosque Místico', url: '/backgrounds/forest.jpg' },
                { name: '🏔️ Cordillera Crepuscle', url: '/backgrounds/mountain.jpg' },
                { name: '🌊 Lago Zen Alpino', url: '/backgrounds/lake.jpg' },
                { name: '💎 Obsidiana Oscura', url: '/backgrounds/obsidian.jpg' },
                { name: '🦌 Deer Poligonal', url: '/colorful_poly_deer.jpg' },
                { name: '❄️ Deer Invierno', url: '/backgrounds/deer_winter.jpg' },
                { name: '🌙 Deer Noche', url: '/backgrounds/deer_night.jpg' },
                { name: '☀️ Deer Día', url: '/backgrounds/deer_day.jpg' },
                { name: '🌅 Deer Atardecer', url: '/backgrounds/deer_sunset.jpg' },
              ].map(bg => (
                <div 
                  key={bg.url} 
                  onClick={async () => {
                    try {
                      await axios.patch(`/api/boards/${board.id}/background`, { backgroundUrl: bg.url });
                      setBoard({ ...board, backgroundUrl: bg.url });
                      if (onUpdate) onUpdate();
                      showAlert('Modo Naturaleza', `Fondo cambiado a: ${bg.name}`, 'success');
                    } catch (e) {
                      setError('Error al aplicar el fondo de la galería');
                    }
                  }}
                  style={{ 
                    position: 'relative', 
                    height: '65px', 
                    borderRadius: '8px', 
                    overflow: 'hidden', 
                    cursor: 'pointer', 
                    border: board.backgroundUrl === bg.url ? '3px solid var(--accent-blue)' : '1px solid var(--border-color)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'transform 0.15s ease'
                  }}
                  title={`Seleccionar ${bg.name}`}
                >
                  <img src={bg.url} alt={bg.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '11px', padding: '3px 6px', fontWeight: 500 }}>
                    {bg.name}
                  </div>
                </div>
              ))}
            </div>

            {board.backgroundUrl && (
              <button 
                type="button" 
                className="btn btn-text" 
                style={{ width: '100%', marginBottom: '16px', color: '#ef4444', border: '1px dashed #ef4444', padding: '6px' }} 
                onClick={async () => {
                  try {
                    await axios.patch(`/api/boards/${board.id}/background`, { backgroundUrl: '' });
                    setBoard({ ...board, backgroundUrl: '' });
                    if (onUpdate) onUpdate();
                    showAlert('Fondo removido', 'Se ha restablecido al tema limpio sin imagen', 'info');
                  } catch (e) {
                    console.error(e);
                  }
                }}
              >
                🚫 Quitar Fondo (Tema Limpio)
              </button>
            )}

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <h4 style={{ marginBottom: '8px', fontSize: '13px', color: 'var(--text-primary)' }}>📁 Subir tu propia imagen FHD</h4>
              <form onSubmit={handleUploadBg} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input type="file" accept="image/*" onChange={(e) => setBgFile(e.target.files[0])} className="input" style={{ fontSize: '13px' }} />
                <button type="submit" className="btn btn-primary" disabled={!bgFile || uploading}>
                  {uploading ? 'Subiendo imagen...' : 'Subir y Aplicar'}
                </button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'trash' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '15px', margin: 0, color: 'var(--text-primary)' }}>♻️ Papelera de Reciclaje</h3>
              {archivedTasks.length > 0 && (isOwner || user.role === 'ADMIN') && (
                <button className="btn btn-text" style={{ color: 'red', fontSize: '12px', border: '1px dashed red', padding: '4px 8px' }} onClick={handleEmptyTrash}>
                  Vaciar Papelera
                </button>
              )}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Aquí se guardan las tareas eliminadas para evitar accidentes. Puedes restaurarlas a sus listas originales o borrarlas para siempre.
            </p>

            {archivedTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '13px', background: 'var(--bg-hover)', borderRadius: '8px' }}>
                🌟 La papelera está completamente limpia
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {archivedTasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-hover)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)' }}>{t.title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Lista original: <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{t.list?.name || 'General'}</span> {t.assignee && ` | @${t.assignee.username}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-text" style={{ color: 'var(--accent-blue)', padding: '6px' }} title="Restaurar Tarea" onClick={() => handleRestoreTask(t.id)}>
                        <RotateCcw size={16} />
                      </button>
                      <button className="btn btn-text" style={{ color: 'red', padding: '6px' }} title="Borrar Definitivamente" onClick={() => handlePermanentDeleteTask(t.id)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div>
            <h3 style={{ fontSize: '15px', marginBottom: '8px', color: 'var(--text-primary)' }}>📑 Clonar Tablero</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              Duplica este tablero con todas sus listas, tareas (activas) y subtareas. 
              Ideal para crear plantillas y flujos repetitivos.
            </p>
            
            {isCloning ? (
              <form onSubmit={handleCloneBoard} style={{ background: 'var(--bg-hover)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>Nuevo nombre:</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    autoFocus
                    type="text" 
                    className="input" 
                    value={cloneName} 
                    onChange={e => setCloneName(e.target.value)} 
                    placeholder="Ej. Reporte Mensual (Noviembre)"
                    style={{ flex: 1, fontSize: '13px' }}
                  />
                  <button type="submit" className="btn btn-primary">Clonar</button>
                  <button type="button" className="btn btn-text" onClick={() => { setIsCloning(false); setCloneName(''); setError(''); }}>Cancelar</button>
                </div>
                {error && <div style={{ color: 'red', fontSize: '12px', marginTop: '6px' }}>{error}</div>}
              </form>
            ) : (
              <button 
                type="button"
                className="btn btn-primary" 
                style={{ width: '100%', justifyContent: 'center', marginBottom: '32px' }}
                onClick={() => { setIsCloning(true); setCloneName(`${board.name} (Copia)`); }}
              >
                Clonar este Tablero
              </button>
            )}

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', paddingBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', marginBottom: '8px', color: 'var(--text-primary)' }}>\ud83d\udcbe Respaldo Individual (Exportar)</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Descarga un archivo JSON con toda la configuraci\u00f3n y tareas de este tablero para tener una copia de seguridad local.
              </p>
              <button 
                type="button"
                className="btn btn-text" 
                style={{ width: '100%', justifyContent: 'center', border: '1px dashed var(--accent-blue)', color: 'var(--accent-blue)' }}
                onClick={async () => {
                  try {
                    const res = await axios.get(`/api/boards/${board.id}/export`);
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
                    const link = document.createElement('a');
                    link.setAttribute('href', dataStr);
                    link.setAttribute('download', `respaldo_tablero_${board.name}.json`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  } catch(e) {
                    showAlert('Error', 'No se pudo exportar el tablero.', 'danger');
                  }
                }}
              >
                Descargar Respaldo JSON
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
              <h3 style={{ fontSize: '14px', marginBottom: '8px', color: '#ef4444' }}>Zona de Peligro</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Una vez eliminado el tablero, todas sus listas, tareas y comentarios desaparecerán permanentemente.
              </p>
              <button 
                type="button"
                className="btn btn-text" 
                style={{ color: '#ef4444', border: '1px solid #ef4444', width: '100%', justifyContent: 'center' }}
                onClick={handleDeleteBoard}
              >
                <Trash2 size={16} style={{ marginRight: '6px' }} /> Eliminar Tablero Permanentemente
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default BoardSettingsModal;
