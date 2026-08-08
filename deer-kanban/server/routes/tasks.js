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
