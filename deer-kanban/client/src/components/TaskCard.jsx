import React, { useState } from 'react';
import axios from 'axios';
import { Calendar, UserPlus, X, Plus, Trash2, CheckCircle2, Circle, ChevronDown, ChevronUp, AlignLeft, CheckSquare, Tag, AlertTriangle, Clock, GripHorizontal, Mail } from 'lucide-react';
import Avatar from './Avatar';
import { useModal } from '../context/ModalContext';

const TaskCard = ({ task, boardMembers, onUpdate, provided, snapshot, isSpotlightMatched = true, hasActiveSearch = false }) => {
  const { showConfirm, showPrompt, showAlert } = useModal();
  const [description, setDescription] = useState(task.description || '');
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.split('T')[0] : '');
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || '');
  const [newSubtask, setNewSubtask] = useState('');
  const [isCompleted, setIsCompleted] = useState(task.isCompleted || false);
  const [color, setColor] = useState(task.color || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Tags
  const [labelsStr, setLabelsStr] = useState(task.labels || '');

  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);

  // Local state for immediate UI feedback before fetching
  const [localTask, setLocalTask] = useState(task);

  const predefinedColors = ['', '#ffcdd2', '#f8bbd0', '#e1bee7', '#d1c4e9', '#c5cae9', '#b3e5fc', '#b2dfdb', '#c8e6c9', '#fff9c4', '#ffe0b2'];

  const handleToggleComplete = async () => {
    const newVal = !isCompleted;
    setIsCompleted(newVal);
    if (newVal) setIsExpanded(false); // Auto-collapse when completed
    try {
      await axios.patch(`/api/tasks/${task.id}`, { isCompleted: newVal });
      onUpdate();
    } catch (e) {
      console.error(e);
      setIsCompleted(!newVal); // revert
    }
  };

  const handleColorChange = async (e) => {
    const newColor = e.target.value;
    setColor(newColor);
    try {
      await axios.patch(`/api/tasks/${task.id}`, { color: newColor });
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendEmail = async () => {
    // Buscar a los usuarios con acceso al tablero y mapear su estado de correo
    const memberOptions = boardMembers.map(m => {
      const email = m.user?.email || m.email;
      const username = m.user?.username || m.username;
      
      if (!email || email.trim() === '') {
        return { label: `👤 ${username} (Sin correo asignado)`, value: '', disabled: true };
      }
      return { label: `👤 ${username} (${email})`, value: email, disabled: false };
    });

    const email = await showPrompt('Enviar Tarea', 'Ingresa los correos a los que deseas enviar los detalles (separados por comas) o selecciona desde el directorio del tablero:', '', memberOptions);
    if (email && email.trim() !== '') {
      try {
        await axios.post(`/api/tasks/${task.id}/email`, { email: email.trim() });
        showAlert('Enviado', 'El correo ha sido enviado exitosamente.', 'success');
      } catch (e) {
        showAlert('Error', e.response?.data?.error || 'No se pudo enviar el correo. Verifica tu configuración SMTP.', 'danger');
      }
    }
  };

  const handleDeleteTask = async () => {
    const confirmed = await showConfirm('Eliminar tarea', '¿Eliminar esta tarea de forma permanente?', 'danger');
    if (confirmed) {
      try {
        await axios.delete(`/api/tasks/${task.id}`);
        onUpdate();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSaveDescription = async () => {
    if (description === task.description) return;
    try {
      await axios.patch(`/api/tasks/${task.id}`, { description });
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveTitle = async () => {
    setIsEditingTitle(false);
    if (editTitle.trim() === '' || editTitle === task.title) {
      setEditTitle(task.title); // revert
      return;
    }
    try {
      await axios.patch(`/api/tasks/${task.id}`, { title: editTitle });
      onUpdate();
    } catch (e) {
      console.error(e);
      setEditTitle(task.title); // revert on error
    }
  };

  const handleSaveLabels = async () => {
    if (labelsStr === task.labels) return;
    try {
      await axios.patch(`/api/tasks/${task.id}`, { labels: labelsStr });
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateDate = async (e) => {
    const val = e.target.value;
    setDueDate(val);
    try {
      await axios.patch(`/api/tasks/${task.id}`, { dueDate: val ? new Date(val).toISOString() : null });
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssign = async (e) => {
    const val = e.target.value;
    setAssigneeId(val);
    try {
      await axios.patch(`/api/tasks/${task.id}`, { assigneeId: val || null });
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSubtask = async (e) => {
    if (e.key === 'Enter' && newSubtask.trim()) {
      try {
        const res = await axios.post(`/api/tasks/${task.id}/subtasks`, { title: newSubtask });
        setLocalTask({ ...localTask, subtasks: [...(localTask.subtasks || []), res.data] });
        setNewSubtask('');
        onUpdate();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const toggleSubtask = async (subtaskId, isCompleted) => {
    try {
      await axios.patch(`/api/tasks/subtasks/${subtaskId}`, { isCompleted });
      const updated = localTask.subtasks.map(st => st.id === subtaskId ? { ...st, isCompleted } : st);
      setLocalTask({ ...localTask, subtasks: updated });
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSubtask = async (subtaskId) => {
    try {
      await axios.delete(`/api/tasks/subtasks/${subtaskId}`);
      const updated = localTask.subtasks.filter(st => st.id !== subtaskId);
      setLocalTask({ ...localTask, subtasks: updated });
      onUpdate();
    } catch (e) {
      console.error(e);
    }
  };

  const textColor = color ? '#111827' : 'var(--text-primary)';
  const textSecondary = color ? '#4b5563' : 'var(--text-secondary)';
  const inputBg = color ? 'rgba(255,255,255,0.4)' : 'var(--bg-hover)';

  const tags = labelsStr ? labelsStr.split(',').map(t => t.trim()).filter(Boolean) : [];

  const getTagColor = (tag) => {
    const t = tag.toLowerCase().trim();
    if (t.includes('urgent') || t.includes('bug') || t.includes('error') || t.includes('critico') || t.includes('crítico') || t.includes('alta')) return { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' };
    if (t.includes('feature') || t.includes('nueva') || t.includes('idea') || t.includes('ux') || t.includes('diseño') || t.includes('design')) return { bg: '#e0e7ff', text: '#4f46e5', border: '#c7d2fe' };
    if (t.includes('backend') || t.includes('server') || t.includes('db') || t.includes('base de datos') || t.includes('api') || t.includes('devops')) return { bg: '#f3e8ff', text: '#9333ea', border: '#e9d5ff' };
    if (t.includes('client') || t.includes('frontend') || t.includes('web') || t.includes('app') || t.includes('ui')) return { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' };
    
    const palette = [
      { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
      { bg: '#ffedd5', text: '#ea580c', border: '#fed7aa' },
      { bg: '#cffafe', text: '#0891b2', border: '#a5f3fc' },
      { bg: '#fce7f3', text: '#db2777', border: '#fbcfe8' },
      { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
    ];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  };
  
  // Get assignee name for avatar
  const assigneeMember = boardMembers.find(m => (m.userId || m.user?.id || m.id) === assigneeId);
  const assigneeName = assigneeMember ? (assigneeMember.user ? assigneeMember.user.username : assigneeMember.username) : null;

  const totalSubtasks = localTask.subtasks ? localTask.subtasks.length : 0;
  const completedSubtasks = localTask.subtasks ? localTask.subtasks.filter(s => s.isCompleted).length : 0;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  let dueStatus = 'normal';
  if (dueDate && !isCompleted) {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    if (dueDate < today) {
      dueStatus = 'overdue';
    } else if (dueDate === today || dueDate === tomorrow) {
      dueStatus = 'soon';
    }
  }

  const dueDateStyles = {
    overdue: { background: '#fee2e2', border: '1px solid #ef4444', color: '#b91c1c', fontWeight: 600 },
    soon: { background: '#fef3c7', border: '1px solid #f59e0b', color: '#b45309', fontWeight: 600 },
    normal: { background: inputBg, border: '1px solid transparent', color: dueDate ? textColor : textSecondary, fontWeight: 400 }
  }[dueStatus];

  return (
    <div 
      className="task-card"
      ref={provided.innerRef}
      {...provided.draggableProps}
      style={{
        ...provided.draggableProps.style,
        zIndex: snapshot?.isDragging ? 9999 : (provided.draggableProps.style?.zIndex || 'auto'),
        backgroundColor: color || 'var(--bg-card)',
        opacity: hasActiveSearch && !isSpotlightMatched ? 0.2 : (isCompleted ? 0.7 : (provided.draggableProps.style?.opacity || 1)),
        transform: hasActiveSearch && isSpotlightMatched ? `${provided.draggableProps.style?.transform || ''} scale(1.02)` : provided.draggableProps.style?.transform,
        boxShadow: hasActiveSearch && isSpotlightMatched ? '0 0 16px rgba(59, 130, 246, 0.5)' : 'var(--shadow-sm)',
        border: hasActiveSearch && isSpotlightMatched ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)',
        pointerEvents: (hasActiveSearch && !isSpotlightMatched) ? 'none' : provided.draggableProps.style?.pointerEvents,
        color: textColor,
        transition: `${provided.draggableProps.style?.transition || ''}${provided.draggableProps.style?.transition ? ', ' : ''}box-shadow 0.2s, border 0.2s, background-color 0.2s, opacity 0.2s`
      }}
    >
      {/* Drag Handle (Full top width) */}
      <div 
        {...provided.dragHandleProps}
        className="drag-handle"
        tabIndex={-1}
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          color: textSecondary, 
          background: color ? 'rgba(0,0,0,0.05)' : 'var(--bg-hover)',
          height: '24px',
          margin: '-12px -12px 12px -12px',
          borderRadius: '4px 4px 0 0',
          borderBottom: '1px solid var(--border-color)'
        }}
        title="Arrastra desde aquí"
      >
        <GripHorizontal size={14} style={{ opacity: 0.5 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <button className="btn btn-text" style={{ padding: '0', color: isCompleted ? 'var(--accent-blue)' : textSecondary, marginTop: '2px' }} onClick={handleToggleComplete}>
          {isCompleted ? <CheckCircle2 size={16} /> : <Circle size={16} />}
        </button>
        
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          {isEditingTitle ? (
            <input
              autoFocus
              type="text"
              className={color ? '' : 'input-inline'}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
              style={{ fontSize: '14px', fontWeight: 500, color: textColor, margin: 0, width: '100%', background: inputBg, padding: '2px 4px', borderRadius: '4px', border: '1px solid transparent', outline: 'none' }}
            />
          ) : (
            <p 
              onClick={() => setIsEditingTitle(true)}
              title="Haz clic para editar"
              style={{ fontSize: '14px', fontWeight: 500, color: textColor, margin: 0, textDecoration: isCompleted ? 'line-through' : 'none', cursor: 'text', wordBreak: 'break-word', lineHeight: '1.4' }}
            >
              {task.title}
            </p>
          )}
        </div>

        <button className="btn btn-text" style={{ padding: '0', color: textSecondary, flexShrink: 0, marginTop: '2px' }} onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Render Tags if any */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
          {tags.map((t, idx) => {
            const tagStyle = getTagColor(t);
            return (
              <span key={idx} style={{ background: tagStyle.bg, color: tagStyle.text, border: `1px solid ${tagStyle.border}`, fontSize: '10px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: tagStyle.text }}></span>
                {t}
              </span>
            );
          })}
        </div>
      )}

      {/* Progress Bar */}
      {totalSubtasks > 0 && (
        <div style={{ marginTop: '8px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: textSecondary, marginBottom: '2px' }}>
            <span>Checklist</span>
            <span>{progressPercent}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', background: color ? 'rgba(0,0,0,0.1)' : 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPercent}%`, background: progressPercent === 100 ? '#10b981' : (color ? 'rgba(0,0,0,0.4)' : 'var(--accent-blue)'), transition: 'width 0.3s ease' }}></div>
          </div>
        </div>
      )}

      {/* Row 2: Metadata (Date, Assignee, Color, Delete) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '12px', flexWrap: 'wrap' }}>
        {/* Due Date Traffic Light Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '6px', transition: 'all 0.2s', ...dueDateStyles }} title={dueStatus === 'overdue' ? '¡Tarea VENCIDA!' : dueStatus === 'soon' ? '¡Vence hoy o mañana!' : 'Fecha límite'}>
          {dueStatus === 'overdue' ? <AlertTriangle size={12} color={dueDateStyles.color} style={{ flexShrink: 0 }} /> : 
           dueStatus === 'soon' ? <Clock size={12} color={dueDateStyles.color} style={{ flexShrink: 0 }} /> :
           <Calendar size={12} color={dueDateStyles.color} style={{ flexShrink: 0 }} />}
          <input 
            type="date" 
            className={color ? '' : 'input-inline'}
            value={dueDate} 
            onChange={handleUpdateDate} 
            style={{ fontSize: '11px', padding: '0', border: 'none', background: 'transparent', color: 'inherit', fontWeight: 'inherit', cursor: 'pointer', outline: 'none', width: '95px' }}
          />
        </div>

        {/* Assignee standard dropdown */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: inputBg, padding: '2px 6px', borderRadius: '20px' }}>
            <UserPlus size={12} color={textSecondary} />
            <span style={{ fontSize: '11px', color: textColor, fontWeight: 500, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {assigneeName || 'Sin asignar'}
            </span>
          </div>
          <select 
            value={assigneeId} 
            onChange={handleAssign}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
            title="Cambiar asignación..."
          >
            <option value="">Sin asignar</option>
            {boardMembers.map(m => {
              const mId = m.userId || m.user?.id || m.id;
              return (
                <option key={mId} value={mId}>
                  {m.user ? m.user.username : m.username}
                </option>
              )
            })}
          </select>
        </div>

        {/* Content indicators when collapsed */}
        {!isExpanded && (
           <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
              {(task.description || description) && <AlignLeft size={12} color={textSecondary} title="Tiene notas" />}
              {localTask.subtasks && localTask.subtasks.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }} title="Tiene subtareas">
                  <CheckSquare size={12} color={textSecondary} />
                  <span style={{ fontSize: '10px', color: textSecondary }}>{localTask.subtasks.filter(s => s.isCompleted).length}/{localTask.subtasks.length}</span>
                </div>
              )}
           </div>
        )}

        {/* Color picker */}
        <select 
          className="input-inline"
          value={color}
          onChange={handleColorChange}
          style={{ width: '18px', height: '18px', padding: '0', borderRadius: '50%', backgroundColor: color || 'transparent', cursor: 'pointer', appearance: 'none', border: `1px solid ${textSecondary}`, color: 'transparent', flexShrink: 0 }}
          title="Color de tarea"
        >
          {predefinedColors.map(c => <option key={c} value={c} style={{ backgroundColor: c }}>{c ? '■' : 'Sin color'}</option>)}
        </select>

        <div style={{ flex: 1 }}></div>

        {/* Email Task */}
        <button className="btn btn-text" style={{ padding: '2px', color: 'var(--accent-blue)', flexShrink: 0, marginRight: '4px' }} onClick={handleSendEmail} title="Enviar por Correo">
          <Mail size={14} />
        </button>

        {/* Delete Task */}
        <button className="btn btn-text" style={{ padding: '2px', color: 'red', flexShrink: 0 }} onClick={handleDeleteTask} title="Eliminar Tarea">
          <Trash2 size={14} />
        </button>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '12px' }}>
          
          {/* Labels Editor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: inputBg, padding: '4px 6px', borderRadius: '4px', marginBottom: '8px' }}>
            <Tag size={12} color={textSecondary} />
            <input 
              type="text" 
              className={color ? '' : 'input-inline'}
              placeholder="Etiquetas (separadas por coma)..." 
              value={labelsStr}
              onChange={e => setLabelsStr(e.target.value)}
              onBlur={handleSaveLabels}
              onKeyDown={e => e.key === 'Enter' && handleSaveLabels()}
              style={{ fontSize: '11px', padding: '0', border: 'none', background: 'transparent', color: textColor, flex: 1, outline: 'none' }}
            />
          </div>

          <textarea 
            className={color ? '' : 'input-inline'}
            style={{ width: '100%', minHeight: '40px', fontSize: '12px', resize: 'vertical', background: inputBg, border: '1px solid transparent', padding: '6px', marginBottom: '8px', color: textColor, borderRadius: '4px', outline: 'none' }}
            placeholder="Añadir notas..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={handleSaveDescription}
          />

          {/* Subtasks Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none', marginBottom: '8px' }} onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: textSecondary }}>Subtareas ({localTask.subtasks ? localTask.subtasks.length : 0})</span>
            {isSubtasksExpanded ? <ChevronUp size={14} color={textSecondary} style={{ marginLeft: '4px' }}/> : <ChevronDown size={14} color={textSecondary} style={{ marginLeft: '4px' }}/>}
          </div>

          {/* Subtasks (Tree Style) */}
          {isSubtasksExpanded && (
            <div className="task-tree-container">
              {localTask.subtasks && localTask.subtasks.map((st, index) => (
                <div key={st.id} className="task-tree-node">
                  <div className="tree-line"></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                    <input type="checkbox" checked={st.isCompleted} onChange={(e) => toggleSubtask(st.id, e.target.checked)} />
                    <span style={{ fontSize: '12px', textDecoration: st.isCompleted ? 'line-through' : 'none', color: st.isCompleted ? textSecondary : textColor, flex: 1 }}>
                      {st.title}
                    </span>
                    <button className="btn btn-text" style={{ padding: '0', height: '16px', color: 'red' }} onClick={() => deleteSubtask(st.id)}><X size={12}/></button>
                  </div>
                </div>
              ))}
              
              {/* Add Subtask Input */}
              <div className="task-tree-node">
                <div className="tree-line"></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, background: inputBg, padding: '2px 6px', borderRadius: '4px' }}>
                  <Plus size={12} color={textSecondary} />
                  <input 
                    type="text" 
                    className={color ? '' : 'input-inline'}
                    placeholder="Nueva subtarea..." 
                    value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={handleAddSubtask}
                    style={{ fontSize: '12px', padding: '2px', border: 'none', background: 'transparent', color: textColor, flex: 1, outline: 'none' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default React.memo(TaskCard);
