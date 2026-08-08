import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { Plus, Layout, Moon, Sun, Menu, LogOut, Folder, Share2, Trash2, RotateCcw } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';

const Sidebar = ({ onSelectBoard, currentBoardId, user, onAdminClick }) => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { logout } = useContext(AuthContext);
  const { showConfirm } = useModal();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [boards, setBoards] = useState({ owned: [], shared: [], archived: [] });
  const [newBoardName, setNewBoardName] = useState('');

  const fetchBoards = async () => {
    try {
      const res = await axios.get('/api/boards');
      setBoards(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;
    try {
      const res = await axios.post('/api/boards', { name: newBoardName });
      setNewBoardName('');
      fetchBoards();
      onSelectBoard(res.data.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBoard = async (e, id) => {
    e.stopPropagation();
    const confirmed = await showConfirm('Mover a Papelera', '¿Mover este tablero a la papelera?', 'warning');
    if (confirmed) {
      try {
        await axios.delete(`/api/boards/${id}`);
        fetchBoards();
        if (currentBoardId === id) {
          onSelectBoard(null);
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleRestoreBoard = async (e, id) => {
    e.stopPropagation();
    try {
      await axios.patch(`/api/boards/${id}/restore`);
      fetchBoards();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePermanentDeleteBoard = async (e, id) => {
    e.stopPropagation();
    const confirmed = await showConfirm('Eliminación Permanente', '¿Estás seguro? Esta acción no se puede deshacer.', 'danger');
    if (confirmed) {
      try {
        await axios.delete(`/api/boards/${id}/permanent`);
        fetchBoards();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleLogout = async () => {
    const confirmed = await showConfirm('Cerrar sesión', '¿Estás seguro de que quieres cerrar la sesión?', 'warning');
    if (confirmed) {
      logout();
    }
  };

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    // Disparar evento de redimensionamiento para que react-beautiful-dnd actualice sus zonas
    // al instante y después de la animación CSS (300ms)
    window.dispatchEvent(new Event('resize'));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
  };

  return (
    <div className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} style={{ width: isCollapsed ? '72px' : '280px', transition: 'width 0.3s', background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px', marginBottom: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', borderBottom: '1px solid transparent' }}>
        <button className="btn btn-text" style={{ position: 'absolute', top: '12px', right: isCollapsed ? 'auto' : '12px', padding: '4px', color: 'var(--text-secondary)' }} onClick={handleToggleCollapse}>
          <Menu size={20} />
        </button>
        {!isCollapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '24px' }}>
            <img src="/logo.jpg" alt="Deer Kanban" style={{ width: '56px', height: '56px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }} />
            <h2 style={{ fontSize: '20px', margin: '12px 0 0 0', fontWeight: 700, letterSpacing: '-0.5px' }}>Deer Kanban</h2>
          </div>
        ) : (
          <img src="/logo.jpg" alt="Deer Kanban" style={{ width: '44px', height: '44px', borderRadius: '10px', marginTop: '36px', display: 'block', boxShadow: 'var(--shadow-sm)' }} title="Deer Kanban" />
        )}
      </div>

      <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: isCollapsed ? '0' : '0 12px', display: 'flex', flexDirection: 'column', alignItems: isCollapsed ? 'center' : 'stretch', width: '100%' }}>
        <div style={{ marginBottom: '24px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: isCollapsed ? 'center' : 'stretch' }}>
          {!isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px', marginBottom: '8px' }}>
              <Folder size={14} color="var(--text-secondary)" />
              <p style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: 0 }}>Mis Tableros</p>
            </div>
          )}
          
          {!isCollapsed ? (
            <form onSubmit={handleCreateBoard} style={{ display: 'flex', marginBottom: '12px', gap: '4px', padding: '0 4px' }}>
              <input 
                type="text" 
                className="input" 
                placeholder="Nuevo tablero..." 
                value={newBoardName} 
                onChange={(e) => setNewBoardName(e.target.value)} 
                style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px dashed var(--border-color)', background: 'transparent' }}
              />
              <button type="submit" className="btn btn-text" style={{ padding: '8px', color: 'var(--accent-blue)' }}><Plus size={18}/></button>
            </form>
          ) : (
            <button className="btn btn-text" style={{ width: '40px', height: '40px', minHeight: '40px', minWidth: '40px', margin: '0 0 12px 0', padding: '0', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: '1px dashed var(--border-color)' }} title="Nuevo tablero" onClick={() => setIsCollapsed(false)}>
              <Plus size={20}/>
            </button>
          )}

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%' }}>
            {boards.owned.map(b => (
              <li key={b.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', width: '100%' }}>
                  <button 
                    className="btn btn-text" 
                    style={{ 
                      width: isCollapsed ? '40px' : '100%', 
                      height: isCollapsed ? '40px' : 'auto',
                      minWidth: isCollapsed ? '40px' : 'auto',
                      minHeight: isCollapsed ? '40px' : 'auto',
                      maxWidth: isCollapsed ? '40px' : 'none',
                      maxHeight: isCollapsed ? '40px' : 'none',
                      margin: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'flex-start', 
                      padding: isCollapsed ? '0' : '8px 12px',
                      borderRadius: '8px',
                      fontWeight: currentBoardId === b.id ? 600 : 500,
                      background: currentBoardId === b.id ? 'var(--accent-blue)' : 'transparent', 
                      color: currentBoardId === b.id ? '#fff' : 'var(--text-primary)',
                      textAlign: 'left',
                      overflow: 'hidden'
                    }}
                    onClick={() => onSelectBoard(b.id)}
                    title={isCollapsed ? b.name : undefined}
                  >
                    {isCollapsed ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: currentBoardId === b.id ? 'transparent' : 'var(--bg-hover)', color: currentBoardId === b.id ? '#fff' : 'var(--text-primary)', fontSize: '15px', fontWeight: 'bold' }}>
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                    ) : b.name}
                  </button>
                {!isCollapsed && (
                  <button 
                    className="btn btn-text" 
                    style={{ padding: '6px', color: 'var(--text-secondary)' }}
                    onClick={(e) => handleDeleteBoard(e, b.id)}
                    title="Eliminar tablero"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>

        {boards.shared.length > 0 && (
          <div style={{ marginBottom: '24px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: isCollapsed ? 'center' : 'stretch' }}>
            {!isCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px', marginBottom: '8px' }}>
                <Share2 size={14} color="var(--text-secondary)" />
                <p style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: 0 }}>Compartidos</p>
              </div>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%' }}>
              {boards.shared.map(b => (
                <li key={b.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', width: '100%' }}>
                  <button 
                    className="btn btn-text" 
                    style={{ 
                      width: isCollapsed ? '40px' : '100%', 
                      height: isCollapsed ? '40px' : 'auto',
                      minWidth: isCollapsed ? '40px' : 'auto',
                      minHeight: isCollapsed ? '40px' : 'auto',
                      maxWidth: isCollapsed ? '40px' : 'none',
                      maxHeight: isCollapsed ? '40px' : 'none',
                      margin: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'flex-start', 
                      padding: isCollapsed ? '0' : '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: currentBoardId === b.id ? 600 : 500,
                      background: currentBoardId === b.id ? 'var(--accent-blue)' : 'transparent', 
                      color: currentBoardId === b.id ? '#fff' : 'var(--text-primary)',
                      overflow: 'hidden' 
                    }}
                    onClick={() => onSelectBoard(b.id)}
                    title={isCollapsed ? `${b.owner.username} - ${b.name}` : undefined}
                  >
                    {isCollapsed ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: currentBoardId === b.id ? 'none' : '1px dashed var(--border-color)', color: currentBoardId === b.id ? '#fff' : 'var(--text-primary)', fontSize: '15px', fontWeight: 'bold' }}>
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                    ) : `${b.owner.username} - ${b.name}`}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {boards.archived && boards.archived.length > 0 && (
          <div style={{ marginBottom: '24px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: isCollapsed ? 'center' : 'stretch' }}>
            {!isCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 8px', marginBottom: '8px' }}>
                <Trash2 size={14} color="var(--text-secondary)" />
                <p style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: 0 }}>Papelera</p>
              </div>
            )}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, width: '100%' }}>
              {boards.archived.map(b => (
                <li key={b.id} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-start', width: '100%' }}>
                  <button 
                    className="btn btn-text" 
                    style={{ 
                      width: isCollapsed ? '40px' : '100%', 
                      height: isCollapsed ? '40px' : 'auto',
                      minWidth: isCollapsed ? '40px' : 'auto',
                      minHeight: isCollapsed ? '40px' : 'auto',
                      maxWidth: isCollapsed ? '40px' : 'none',
                      maxHeight: isCollapsed ? '40px' : 'none',
                      margin: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'flex-start', 
                      padding: isCollapsed ? '0' : '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500,
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textDecoration: 'line-through'
                    }}
                    title={isCollapsed ? `${b.name} (Eliminado)` : undefined}
                    disabled
                  >
                    {isCollapsed ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 'bold' }}>
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                    ) : b.name}
                  </button>
                  {!isCollapsed && (
                    <div style={{ display: 'flex' }}>
                      <button 
                        className="btn btn-text" 
                        style={{ padding: '6px', color: 'var(--accent-blue)' }}
                        onClick={(e) => handleRestoreBoard(e, b.id)}
                        title="Restaurar tablero"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button 
                        className="btn btn-text" 
                        style={{ padding: '6px', color: '#ef4444' }}
                        onClick={(e) => handlePermanentDeleteBoard(e, b.id)}
                        title="Eliminar permanentemente"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', padding: isCollapsed ? '16px 0' : '16px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        <button className="btn btn-text" style={{ width: isCollapsed ? 'auto' : '100%', justifyContent: isCollapsed ? 'center' : 'flex-start', marginBottom: '12px', padding: '8px', borderRadius: '8px' }} onClick={toggleTheme} title="Cambiar tema">
          {theme === 'light' ? <Moon size={18} style={{ marginRight: isCollapsed ? 0 : '8px' }} /> : <Sun size={18} style={{ marginRight: isCollapsed ? 0 : '8px' }} />}
          {!isCollapsed && (theme === 'light' ? 'Modo oscuro' : 'Modo claro')}
        </button>

        {!isCollapsed && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px 0', width: '100%', textAlign: 'left', fontWeight: 500 }}>Sesión: <strong style={{color: 'var(--text-primary)'}}>{user.username}</strong></p>}
        
        {user.role === 'ADMIN' && (
          <button className="btn btn-text" style={{ width: isCollapsed ? 'auto' : '100%', justifyContent: isCollapsed ? 'center' : 'flex-start', marginBottom: '4px', padding: '8px', borderRadius: '8px' }} onClick={onAdminClick} title="Panel Admin">
            <Layout size={18} style={{ marginRight: isCollapsed ? 0 : '8px' }} /> {!isCollapsed && 'Panel Admin'}
          </button>
        )}
        <button className="btn btn-text" style={{ width: isCollapsed ? 'auto' : '100%', justifyContent: isCollapsed ? 'center' : 'flex-start', color: '#ef4444', padding: '8px', borderRadius: '8px' }} onClick={handleLogout} title="Cerrar sesión">
          <LogOut size={18} style={{ marginRight: isCollapsed ? 0 : '8px' }}/>
          {!isCollapsed && 'Cerrar Sesión'}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
