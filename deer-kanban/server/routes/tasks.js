const express = require('express');
const router = express.Router();
const prisma = require('../prisma/db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Funcionalidad auxiliar para validar acceso vía listId
const verifyListAccess = async (listId, userId, role) => {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: { board: { include: { members: true } } }
  });
  if (!list) return false;
  
  const board = list.board;
  const isOwner = board.ownerId === userId;
  const isMember = board.members.some(m => m.userId === userId);
  return isOwner || isMember || role === 'ADMIN';
};

// POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const { title, description, dueDate, listId, assigneeId } = req.body;
    
    if (!(await verifyListAccess(listId, req.user.userId, req.user.role))) {
      return res.status(403).json({ error: 'Acceso denegado a esta lista' });
    }

    const maxOrderTask = await prisma.task.findFirst({
      where: { listId },
      orderBy: { order: 'desc' }
    });
    const newOrder = maxOrderTask ? maxOrderTask.order + 1024 : 1024;

    const task = await prisma.task.create({
      data: { title, description, dueDate, listId, assigneeId, order: newOrder },
      include: { assignee: { select: { username: true } }, subtasks: true, comments: true }
    });

    const listInfo = await prisma.list.findUnique({ where: { id: listId } });
    if (listInfo) {
      await prisma.activity.create({
        data: { boardId: listInfo.boardId, userId: req.user.userId, action: 'creó la tarea', details: `"${title}" en ${listInfo.name}` }
      }).catch(err => console.error(err));
    }

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear tarea' });
  }
});

// PATCH /api/tasks/:id (Editar, mover drag&drop)
router.patch('/:id', async (req, res) => {
  try {
    const { title, description, dueDate, listId, assigneeId, order, isCompleted, color, labels, isArchived } = req.body;
    
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { list: true } });
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });

    if (!(await verifyListAccess(task.listId, req.user.userId, req.user.role))) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Si se mueve a otra lista, verificar acceso a la nueva lista
    if (listId && listId !== task.listId) {
      if (!(await verifyListAccess(listId, req.user.userId, req.user.role))) {
        return res.status(403).json({ error: 'Acceso denegado a la lista destino' });
      }
    }

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate }),
        ...(listId && { listId }),
        ...(assigneeId !== undefined && { assigneeId }),
        ...(order !== undefined && { order }),
        ...(isCompleted !== undefined && { isCompleted }),
        ...(color !== undefined && { color }),
        ...(labels !== undefined && { labels }),
        ...(isArchived !== undefined && { isArchived }),
      },
      include: { assignee: { select: { username: true } }, subtasks: true, comments: true }
    });

    // Log Activity for significant updates
    if (isCompleted !== undefined && isCompleted !== task.isCompleted) {
      await prisma.activity.create({
        data: { boardId: task.list.boardId, userId: req.user.userId, action: isCompleted ? 'completó la tarea' : 'reabrió la tarea', details: `"${updated.title}"` }
      }).catch(() => {});
    } else if (isArchived === false && task.isArchived === true) {
      await prisma.activity.create({
        data: { boardId: task.list.boardId, userId: req.user.userId, action: 'restauró de papelera', details: `"${updated.title}"` }
      }).catch(() => {});
    } else if (listId !== undefined && listId !== task.listId) {
      const newList = await prisma.list.findUnique({ where: { id: listId } });
      if (newList) {
        await prisma.activity.create({
          data: { boardId: task.list.boardId, userId: req.user.userId, action: 'movió la tarea', details: `"${updated.title}" a ${newList.name}` }
        }).catch(() => {});
      }
    } else {
      // General edits
      const actions = [];
      if (title && title !== task.title) actions.push('renombró');
      if (description !== undefined && description !== task.description) actions.push('editó la nota');
      if (dueDate !== undefined && (new Date(dueDate).getTime() !== new Date(task.dueDate).getTime())) actions.push('cambió la fecha');
      if (assigneeId !== undefined && assigneeId !== task.assigneeId) actions.push('reasignó');
      if ((color !== undefined && color !== task.color) || (labels !== undefined && labels !== task.labels)) actions.push('actualizó etiquetas');

      if (actions.length > 0) {
        await prisma.activity.create({
          data: { boardId: task.list.boardId, userId: req.user.userId, action: actions.join(', '), details: `en "${updated.title}"` }
        }).catch(() => {});
      }
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar tarea' });
  }
});

// DELETE /api/tasks/:id (Soft Delete -> Papelera)
router.delete('/:id', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { list: true } });
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });

    if (!(await verifyListAccess(task.listId, req.user.userId, req.user.role))) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    await prisma.task.update({ where: { id: req.params.id }, data: { isArchived: true } });

    await prisma.activity.create({
      data: { boardId: task.list.boardId, userId: req.user.userId, action: 'envió a papelera', details: `"${task.title}"` }
    }).catch(() => {});

    res.json({ message: 'Tarea enviada a la papelera' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar tarea' });
  }
});

// DELETE /api/tasks/:id/permanent
router.delete('/:id/permanent', async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!(await verifyListAccess(task.listId, req.user.userId, req.user.role))) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ message: 'Tarea eliminada de forma permanente' });
  } catch (error) {
    res.status(500).json({ error: 'Error permanente' });
  }
});

const { sendMail } = require('../services/emailService');

// POST /api/tasks/:id/email
router.post('/:id/email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'El correo es requerido' });

    const task = await prisma.task.findUnique({ 
      where: { id: req.params.id },
      include: {
        list: { include: { board: true } },
        assignee: true,
        subtasks: { orderBy: { createdAt: 'asc' } },
        comments: { include: { user: true }, orderBy: { createdAt: 'asc' } }
      }
    });

    if (!task) return res.status(404).json({ error: 'Tarea no encontrada' });

    if (!(await verifyListAccess(task.listId, req.user.userId, req.user.role))) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const completedSubtasks = task.subtasks.filter(st => st.isCompleted).length;
    const totalSubtasks = task.subtasks.length;
    const progressText = totalSubtasks > 0
      ? `${completedSubtasks}/${totalSubtasks} (${Math.round((completedSubtasks / totalSubtasks) * 100)}%)`
      : (task.isCompleted ? '100%' : '0%');

    const labelsList = task.labels && task.labels.trim() !== '' 
      ? task.labels.split(',').filter(l => l.trim()).map(l => `<span style="background: #e2e8f0; color: #334155; padding: 3px 8px; border-radius: 12px; font-size: 12px; margin-right: 6px; display: inline-block;">${l.trim()}</span>`).join('')
      : '<em style="color: #94a3b8; font-size: 13px;">Sin etiquetas</em>';

    const labelsHtml = `
      <div style="margin: 8px 0;"><strong>🏷️ Etiquetas:</strong>
        <div style="margin-top: 6px;">${labelsList}</div>
      </div>
    `;

    const colorHtml = task.color ? `
      <p style="margin: 8px 0;"><strong>🎨 Color:</strong> <span style="display: inline-block; width: 14px; height: 14px; background-color: ${task.color}; border-radius: 50%; vertical-align: middle; border: 1px solid #ccc; margin-left: 4px;"></span></p>
    ` : `
      <p style="margin: 8px 0;"><strong>🎨 Color:</strong> <em style="color: #94a3b8; font-size: 13px;">Ninguno</em></p>
    `;

    const commentsHtml = task.comments && task.comments.length > 0 ? `
      <h3 style="margin-top: 24px; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 4px;">💬 Comentarios (${task.comments.length})</h3>
      <div style="border-left: 3px solid #cbd5e1; padding-left: 12px; margin-top: 12px; color: #475569;">
        ${task.comments.map(c => `
          <div style="margin-bottom: 12px; background: #f8fafc; padding: 10px; border-radius: 6px;">
            <strong style="color: #0f172a;">${c.user?.username || 'Usuario'}</strong>
            <span style="font-size: 11px; color: #94a3b8; margin-left: 8px;">${new Date(c.createdAt).toLocaleString()}</span>
            <p style="margin: 6px 0 0 0; font-size: 14px;">${c.content}</p>
          </div>
        `).join('')}
      </div>
    ` : '';

    // Función para calcular si el texto debe ser oscuro o claro basado en el fondo
    const getTextColor = (hexColor) => {
      if (!hexColor) return '#ffffff'; // Default text color for default blue bg
      let hex = hexColor.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return (yiq >= 128) ? '#0f172a' : '#ffffff'; // Oscuro si el fondo es claro, blanco si es oscuro
    };

    const headerTextColor = getTextColor(task.color);
    const headerTextShadow = headerTextColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.2)' : 'none';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        
        <div style="background-color: ${task.color || '#3b82f6'}; padding: 16px; color: ${headerTextColor}; text-shadow: ${headerTextShadow};">
          <h2 style="margin: 0; font-size: 20px;">${task.title}</h2>
          <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.85;">
            📁 <strong>${task.list.board.name}</strong> &nbsp;❯&nbsp; 📋 <strong>${task.list.name}</strong>
          </p>
        </div>
        
        <div style="padding: 24px;">
          <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; display: grid; gap: 8px;">
            <p style="margin: 0;"><strong>👤 Asignado a:</strong> ${task.assignee ? task.assignee.username : 'Sin asignar'}</p>
            <p style="margin: 8px 0 0 0;"><strong>📅 Vencimiento:</strong> ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'Sin fecha'}</p>
            <p style="margin: 8px 0 0 0;">
              <strong>📌 Estado:</strong> ${task.isCompleted ? 'Completada ✅' : 'Pendiente ⏳'} &nbsp;|&nbsp; 
              <strong>📊 Progreso:</strong> ${progressText}
            </p>
            ${colorHtml}
            ${labelsHtml}
          </div>

          <h3 style="font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 12px;">📝 Descripción</h3>
          <div style="white-space: pre-wrap; background: #fff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 6px; font-size: 14px; line-height: 1.5;">${task.description || '<em style="color: #94a3b8;">Sin descripción proporcionada.</em>'}</div>

          ${task.subtasks.length > 0 ? `
            <h3 style="margin-top: 24px; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 4px;">✅ Subtareas (${progressText})</h3>
            <ul style="list-style-type: none; padding: 0; margin-top: 12px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
              ${task.subtasks.map((st, i) => `
                <li style="padding: 10px 14px; font-size: 14px; display: flex; align-items: center; border-bottom: ${i < task.subtasks.length - 1 ? '1px solid #e2e8f0' : 'none'}; background: ${st.isCompleted ? '#f8fafc' : '#fff'};">
                  <span style="margin-right: 12px; font-size: 16px;">${st.isCompleted ? '✅' : '⏳'}</span>
                  <span style="${st.isCompleted ? 'text-decoration: line-through; color: #94a3b8;' : 'color: #334155;'}">${st.title}</span>
                </li>
              `).join('')}
            </ul>
          ` : ''}

          ${commentsHtml}
          
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
            Enviado desde Deer Kanban
          </div>
        </div>
      </div>
    `;

    await sendMail(email, `Información de Tarea: ${task.title}`, htmlContent);
    res.json({ message: 'Correo enviado correctamente' });
  } catch (error) {
    console.error('Error enviando correo de la tarea:', error);
    res.status(500).json({ error: error.message || 'Error al enviar el correo' });
  }
});

// SUBTASKS
router.post('/:id/subtasks', async (req, res) => {
  try {
    const { title } = req.body;
    const subtask = await prisma.subtask.create({
      data: { title, taskId: req.params.id }
    });
    
    // Log activity
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: { list: true } });
    if (task) {
      await prisma.activity.create({
        data: { boardId: task.list.boardId, userId: req.user.userId, action: 'añadió una subtarea', details: `en "${task.title}"` }
      }).catch(() => {});
    }

    res.status(201).json(subtask);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.patch('/subtasks/:subtaskId', async (req, res) => {
  try {
    const { title, isCompleted } = req.body;
    const existing = await prisma.subtask.findUnique({ where: { id: req.params.subtaskId }, include: { task: { include: { list: true } } } });

    const subtask = await prisma.subtask.update({
      where: { id: req.params.subtaskId },
      data: { ...(title && { title }), ...(isCompleted !== undefined && { isCompleted }) }
    });

    if (existing && isCompleted !== undefined && isCompleted !== existing.isCompleted) {
      await prisma.activity.create({
        data: { boardId: existing.task.list.boardId, userId: req.user.userId, action: isCompleted ? 'completó una subtarea' : 'desmarcó una subtarea', details: `en "${existing.task.title}"` }
      }).catch(() => {});
    }

    res.json(subtask);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/subtasks/:subtaskId', async (req, res) => {
  try {
    await prisma.subtask.delete({ where: { id: req.params.subtaskId } });
    res.json({ message: 'Subtarea eliminada' });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// COMMENTS
router.post('/:id/comments', async (req, res) => {
  try {
    const { content } = req.body;
    const comment = await prisma.comment.create({
      data: { content, taskId: req.params.id, userId: req.user.userId },
      include: { user: { select: { username: true } } }
    });
    res.status(201).json(comment);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

router.delete('/comments/:commentId', async (req, res) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
    if (comment.userId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    await prisma.comment.delete({ where: { id: req.params.commentId } });
    res.json({ message: 'Comentario eliminado' });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
