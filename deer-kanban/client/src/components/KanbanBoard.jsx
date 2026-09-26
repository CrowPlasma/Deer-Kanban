import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, X, Settings, Search, User, FileText, History, RefreshCw } from 'lucide-react';
import TaskCard from './TaskCard';
import BoardSettingsModal from './BoardSettingsModal';
import { useModal } from '../context/ModalContext';
import { SettingsContext } from '../context/SettingsContext';

// Palette for active user avatars
const AVATAR_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
function avatarColor(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const KanbanBoard = ({ boardId, user }) => {
  const [board, setBoard] = useState(null);
  const [newList, setNewList] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastActivityIdRef = useRef(null);
  const { showConfirm } = useModal();
  const { settings } = useContext(SettingsContext);

  useEffect(() => {
    if (boardId) fetchBoard();
  }, [boardId]);

  // ── Presence: ping every 30s so others see us online ─────────────
  useEffect(() => {
    if (!boardId) return;
    const ping = () => axios.post(`/api/boards/${boardId}/presence`).catch(() => {});
    ping();
    const id = setInterval(ping, 10_000);
    return () => clearInterval(id);
  }, [boardId]);

  // ── Presence: fetch active users every 30s ────────────────────────
  useEffect(() => {
    if (!boardId) return;
    const fetchPresence = async () => {
      try {
        const res = await axios.get(`/api/boards/${boardId}/presence`);
        setActiveUsers(res.data.filter(u => u.userId !== user.id));
      } catch {}
    };
    fetchPresence();
    const id = setInterval(fetchPresence, 10_000);
    return () => clearInterval(id);
  }, [boardId, user.id]);

  // ── Pulse: detect external changes every 30s ──────────────────────
  useEffect(() => {
    if (!boardId) return;
    const checkPulse = async () => {
      try {
        const res = await axios.get(`/api/boards/${boardId}/pulse`);
        const newId = res.data.lastActivityId;
        if (lastActivityIdRef.current !== null && newId !== lastActivityIdRef.current) {
          setHasChanges(true);
        }
        // Only update the ref, don't auto-reload — let the user decide
        if (lastActivityIdRef.current === null) lastActivityIdRef.current = newId;
      } catch {}
    };
    checkPulse();
    const id = setInterval(checkPulse, 10_000);
    return () => clearInterval(id);
  }, [boardId]);

  const fetchBoard = async () => {
    try {
      const res = await axios.get(`/api/boards/${boardId}`);
      setBoard(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setHasChanges(false);
    await fetchBoard();
    // Refresh pulse baseline too
    try {
      const res = await axios.get(`/api/boards/${boardId}/pulse`);
      lastActivityIdRef.current = res.data.lastActivityId;
    } catch {}
    setTimeout(() => setIsRefreshing(false), 600);
  }, [boardId]);

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId, type } = result;

    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (type === 'list') {
      const newLists = Array.from(board.lists);
      const [removed] = newLists.splice(source.index, 1);
      newLists.splice(destination.index, 0, removed);

      // Update locally first for instant UI feedback
      setBoard({ ...board, lists: newLists });

      // Update ALL lists with clean sequential orders to prevent duplicates on reload
      await Promise.all(
        newLists.map((list, idx) =>
          axios.patch(`/api/lists/${list.id}`, { order: (idx + 1) * 1024 })
        )
      );
      return;
    }

    if (type === 'task') {
      const sourceList = board.lists.find(l => l.id === source.droppableId);
      const destList = board.lists.find(l => l.id === destination.droppableId);

      const sourceTasks = Array.from(sourceList.tasks);
      const destTasks = source.droppableId === destination.droppableId ? sourceTasks : Array.from(destList.tasks);

      const realSourceIndex = sourceTasks.findIndex(t => t.id === draggableId);
      if (realSourceIndex === -1) return;

      const [removed] = sourceTasks.splice(realSourceIndex, 1);

      if (searchQuery) {
        destTasks.push(removed);
      } else {
        destTasks.splice(destination.index, 0, removed);
      }

      const newLists = board.lists.map(l => {
        if (l.id === source.droppableId) return { ...l, tasks: sourceTasks };
        if (l.id === destination.droppableId) return { ...l, tasks: destTasks };
        return l;
      });

      setBoard({ ...board, lists: newLists });

      // Update ALL tasks in destination list with clean sequential orders
      await Promise.all(
        destTasks.map((task, idx) =>
          axios.patch(`/api/tasks/${task.id}`, {
            listId: destList.id,
            order: (idx + 1) * 1024
          })
        )
      );

      // If moved between lists, also reorder source list tasks
      if (source.droppableId !== destination.droppableId) {
        await Promise.all(
          sourceTasks.map((task, idx) =>
            axios.patch(`/api/tasks/${task.id}`, { order: (idx + 1) * 1024 })
          )
        );
      }
    }
  };

  const handleAddList = async (e) => {
    e.preventDefault();
    if (!newList.trim()) return;
    await axios.post('/api/lists', { name: newList, boardId });
    setNewList('');
    fetchBoard();
  };

  const handleAddTask = async (listId) => {
    const title = newTaskTitle[listId];
    if (!title?.trim()) return;
    await axios.post('/api/tasks', { title, listId });
    setNewTaskTitle({ ...newTaskTitle, [listId]: '' });
    fetchBoard();
  };

  const handleDeleteList = async (listId) => {
    const confirmed = await showConfirm('Eliminar lista', '¿Eliminar esta lista permanentemente?', 'danger');
    if(confirmed) {
      await axios.delete(`/api/lists/${listId}`);
      fetchBoard();
    }
  };

  const handleExportReport = () => {
    // Definir los encabezados del CSV
    const headers = [
      'Lista',
      'Tarea',
      'Estado',
      'Asignado',
      'Fecha Límite',
      'Etiquetas',
      'Descripción',
      'Progreso Subtareas',
      'Detalle de Subtareas'
    ];
    
    // Función auxiliar para escapar textos en CSV (comillas, saltos de línea, comas)
    const escapeCSV = (str) => {
      if (str === null || str === undefined) return '""';
      const cleanStr = String(str).replace(/"/g, '""');
      return `"${cleanStr}"`;
    };

    let csvContent = headers.map(escapeCSV).join(',') + '\n';

    board.lists.forEach(list => {
      const listName = list.name;
      list.tasks.forEach(task => {
        const title = task.title;
        const status = task.isCompleted ? 'Completado' : 'Pendiente';
        const assigneeName = task.assignee ? task.assignee.username : 'Sin asignar';
        // Ajuste de fecha respetando zona horaria local si existe
        const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Sin fecha';
        const tags = task.labels || '';
        const desc = task.description || '';
        
        let subtasksProgress = '0/0';
        let subtasksDetail = '';
        
        if (task.subtasks && task.subtasks.length > 0) {
          const subDone = task.subtasks.filter(s => s.isCompleted).length;
          subtasksProgress = `${subDone}/${task.subtasks.length} (${Math.round((subDone/task.subtasks.length)*100)}%)`;
          // Concatenar subtareas con saltos de línea para que se vean en una celda
          subtasksDetail = task.subtasks.map(s => `[${s.isCompleted ? 'x' : ' '}] ${s.title}`).join('\n');
        }

        const row = [
          listName,
          title,
          status,
          assigneeName,
          due,
          tags,
          desc,
          subtasksProgress,
          subtasksDetail
        ];

        csvContent += row.map(escapeCSV).join(',') + '\n';
      });
    });

    // Añadir BOM (Byte Order Mark) para que Excel reconozca los acentos y caracteres UTF-8
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Reporte_${board.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!board) return <div style={{ padding: '24px' }}>Cargando tablero...</div>;

  const isOwnerOrAdmin = board.ownerId === user.id || user.role === 'ADMIN';

  let bgUrl = null;
  if (settings) {
    if (settings.allowCustomBackgrounds && board.backgroundUrl) {
      bgUrl = board.backgroundUrl;
    } else if (settings.institutionalBackgroundUrl) {
      bgUrl = settings.institutionalBackgroundUrl;
    }
  }

  const bgStyle = bgUrl ? {
    backgroundImage: `url(${bgUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  } : {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', isolation: 'isolate', ...bgStyle }}>
      <div className="board-header">
        <h1 style={{ fontSize: '20px' }}>{board.name}</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>

          {/* Active user avatars */}
          {activeUsers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} title="Usuarios viendo este tablero">
              {activeUsers.slice(0, 5).map(u => (
                <div
                  key={u.userId}
                  title={`@${u.username} está en línea`}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: avatarColor(u.username),
                    color: '#fff', fontWeight: 700, fontSize: '12px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--bg-card)',
                    marginLeft: '-6px',
                    boxShadow: '0 0 0 2px rgba(99,102,241,0.4)',
                    cursor: 'default',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2) translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  {u.username[0].toUpperCase()}
                </div>
              ))}
              {activeUsers.length > 5 && (
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-hover)', border: '2px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, marginLeft: '-6px' }}>
                  +{activeUsers.length - 5}
                </div>
              )}
            </div>
          )}

          {/* Search bar + Refresh button */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '12px' }} />
              <input 
                type="text"
                placeholder="Buscar tareas..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ 
                  padding: '8px 12px 8px 36px', 
                  fontSize: '13px', 
                  borderRadius: '20px', 
                  border: '1px solid var(--border-color)', 
                  background: 'var(--bg-card)', 
                  color: 'var(--text-primary)',
                  width: '220px',
                  outline: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              />
            </div>

            {/* Refresh button with change-notification dot */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={handleRefresh}
                title={hasChanges ? 'Hay cambios nuevos — clic para actualizar' : 'Actualizar tablero'}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '36px', height: '36px', borderRadius: '50%',
                  border: hasChanges ? '2px solid #ef4444' : '1px solid var(--border-color)',
                  background: hasChanges ? 'rgba(239,68,68,0.08)' : 'var(--bg-card)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: hasChanges ? '0 0 8px rgba(239,68,68,0.35)' : 'none',
                }}
              >
                <RefreshCw
                  size={15}
                  color={hasChanges ? '#ef4444' : 'var(--text-secondary)'}
                  style={{ transition: 'transform 0.6s', transform: isRefreshing ? 'rotate(360deg)' : 'rotate(0deg)' }}
                />
              </button>
              {hasChanges && (
                <span style={{
                  position: 'absolute', top: '-3px', right: '-3px',
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: '#ef4444',
                  border: '2px solid var(--bg-card)',
                  boxShadow: '0 0 6px rgba(239,68,68,0.7)',
                  animation: 'pulse-dot 1.5s ease-in-out infinite',
                }} />
              )}
            </div>
          </div>

          <button 
            className="btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              borderRadius: '20px',
              border: showActivity ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
              background: showActivity ? 'var(--accent-blue)' : 'var(--bg-card)',
              color: showActivity ? '#fff' : 'var(--text-primary)',
              fontWeight: 500,
              fontSize: '13px',
              transition: 'all 0.2s'
            }}
            onClick={() => setShowActivity(!showActivity)}
            title="Ver Bitácora en Vivo del Equipo"
          >
            <History size={16} color={showActivity ? '#fff' : 'var(--accent-blue)'} />
            Bitácora
          </button>

          <button 
            className="btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontWeight: 500,
              fontSize: '13px',
              transition: 'all 0.2s'
            }}
            onClick={handleExportReport}
            title="Exportar a CSV"
          >
            <FileText size={16} color="var(--accent-blue)" />
            Exportar CSV
          </button>

          <button 
            className="btn"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              padding: '8px 16px', 
              borderRadius: '20px',
              border: showOnlyMine ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
              background: showOnlyMine ? 'var(--accent-blue)' : 'var(--bg-card)',
              color: showOnlyMine ? '#fff' : 'var(--text-primary)',
              fontWeight: 500,
              fontSize: '13px',
              transition: 'all 0.2s'
            }}
            onClick={() => setShowOnlyMine(!showOnlyMine)}
          >
            <User size={16} />
            Mis Tareas
          </button>

          {isOwnerOrAdmin && (
            <button className="btn btn-text" onClick={() => setShowSettings(true)}>
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>
      
      <div className="board-canvas">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="board" type="list" direction="horizontal">
            {(provided) => (
              <div 
                ref={provided.innerRef} 
                {...provided.droppableProps}
                style={{ display: 'flex', gap: '16px', height: '100%', alignItems: 'flex-start' }}
              >
                {board.lists.map((list, index) => (
                  <Draggable key={list.id} draggableId={list.id} index={index}>
                    {(provided) => (
                      <div 
                        className="list-column"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={provided.draggableProps.style}
                      >
                        <div className="list-header" {...provided.dragHandleProps}>
                          <span>{list.name}</span>
                          {isOwnerOrAdmin && (
                            <button 
                              className="btn btn-text" 
                              style={{ padding: '4px' }} 
                              onPointerDown={e => e.stopPropagation()}
                              onMouseDown={e => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteList(list.id);
                              }}
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                        
                        <Droppable droppableId={list.id} type="task">
                          {(provided) => (
                            <div 
                              className="task-list"
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                            >
                              {list.tasks.filter(task => {
                                if (showOnlyMine && task.assigneeId !== user.id) return false;
                                
                                if (searchQuery.trim()) {
                                  const q = searchQuery.toLowerCase();
                                  const titleMatch = task.title && task.title.toLowerCase().includes(q);
                                  const labelsMatch = task.labels && task.labels.toLowerCase().includes(q);
                                  const descMatch = task.description && task.description.toLowerCase().includes(q);
                                  const assigneeMember = board.members.find(m => (m.userId || m.user?.id) === task.assigneeId) || (board.ownerId === task.assigneeId ? { user: board.owner } : null);
                                  const userMatch = assigneeMember && (assigneeMember.user?.username || assigneeMember.username)?.toLowerCase().includes(q);
                                  
                                  if (!(titleMatch || labelsMatch || descMatch || userMatch)) {
                                    return false; // Filtra la tarea si no coincide con la búsqueda
                                  }
                                }
                                return true;
                              }).map((task, tIndex) => {
                                return (
                                  <Draggable key={task.id} draggableId={task.id} index={tIndex}>
                                    {(provided, snapshot) => (
                                      <TaskCard 
                                        task={task}
                                        boardMembers={[{ user: board.owner, userId: board.ownerId }, ...board.members]}
                                        onUpdate={fetchBoard}
                                        provided={provided}
                                        snapshot={snapshot}
                                        isSpotlightMatched={true} // Siempre true porque ya están filtradas
                                        hasActiveSearch={Boolean(searchQuery.trim())}
                                      />
                                    )}
                                  </Draggable>
                                );
                              })}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                        
                        <div style={{ padding: '8px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input 
                              type="text" 
                              className="input" 
                              placeholder="Nueva tarea..." 
                              value={newTaskTitle[list.id] || ''}
                              onChange={(e) => setNewTaskTitle({ ...newTaskTitle, [list.id]: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddTask(list.id)}
                            />
                            <button className="btn btn-text" onClick={() => handleAddTask(list.id)}><Plus size={18}/></button>
                          </div>
                        </div>

                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                
                {/* Añadir nueva lista */}
                <form onSubmit={handleAddList} style={{ display: 'flex', gap: '4px', minWidth: '280px' }}>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Nueva lista..." 
                    value={newList}
                    onChange={(e) => setNewList(e.target.value)}
                    style={{ background: 'var(--bg-hover)', border: 'none' }}
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px' }}><Plus size={18}/></button>
                </form>
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
      
      {showSettings && (
        <BoardSettingsModal 
          board={board} 
          onClose={() => setShowSettings(false)}
          onUpdate={fetchBoard}
          onDelete={() => { setShowSettings(false); window.location.href = '/'; }}
        />
      )}

      {/* Bitácora de Actividad - Panel lateral */}
      {showActivity && (
        <div style={{ position: 'absolute', top: '60px', right: 0, bottom: 0, width: '320px', background: 'var(--bg-card)', borderLeft: '1px solid var(--border-color)', boxShadow: '-4px 0 15px rgba(0,0,0,0.15)', zIndex: 100, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-in' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
              <History size={18} color="var(--accent-blue)" /> Bitácora de Actividad
            </div>
            <button className="btn btn-text" onClick={() => setShowActivity(false)}><X size={18} /></button>
          </div>
          <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {(!board.activities || board.activities.length === 0) ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', padding: '30px 10px' }}>
                🌾 No hay movimientos recientes registrados aún en este tablero.
              </div>
            ) : (
              board.activities.map(act => (
                <div key={act.id} style={{ display: 'flex', gap: '10px', fontSize: '13px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px', flexShrink: 0 }}>
                    {act.user?.username ? act.user.username[0].toUpperCase() : 'U'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ lineHeight: 1.3 }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{act.user?.username || 'Usuario'}</strong>{' '}
                      <span style={{ color: 'var(--text-secondary)' }}>{act.action}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 500, marginTop: '2px' }}>
                      {act.details}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {new Date(act.createdAt).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KanbanBoard;
