const express = require('express');
const router = express.Router({ mergeParams: true }); // Para acceder a :boardId si se anida, aunque lo usaré directo
const prisma = require('../prisma/db');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Middleware para verificar permisos en la lista o en el tablero
const checkBoardAccess = async (req, res, next) => {
  const boardId = req.body?.boardId || req.list?.boardId;
  if (!boardId) return res.status(400).json({ error: 'boardId requerido' });

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { members: true }
  });

  if (!board) return res.status(404).json({ error: 'Tablero no encontrado' });

  const isOwner = board.ownerId === req.user.userId;
  const isMember = board.members.some(m => m.userId === req.user.userId);

  if (!isOwner && !isMember && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Acceso denegado al tablero' });
  }

  req.board = board;
  req.isOwner = isOwner;
  next();
};

// POST /api/lists
router.post('/', checkBoardAccess, async (req, res) => {
  try {
    const { name, boardId } = req.body;
    
    // Obtener el orden máximo actual
    const maxOrderList = await prisma.list.findFirst({
      where: { boardId },
      orderBy: { order: 'desc' }
    });
    const newOrder = maxOrderList ? maxOrderList.order + 1024 : 1024;

    const list = await prisma.list.create({
      data: { name, boardId, order: newOrder },
      include: { tasks: true }
    });
    res.status(201).json(list);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear lista' });
  }
});

// PATCH /api/lists/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const list = await prisma.list.findUnique({ where: { id: req.params.id } });
    if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
    
    req.list = list;
    next();
  } catch(e) { res.status(500).json({error: 'Error interno'}); }
}, checkBoardAccess, async (req, res) => {
  try {
    const { name, order } = req.body;
    const updated = await prisma.list.update({
      where: { id: req.params.id },
      data: { name, ...(order !== undefined && { order }) }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar lista' });
  }
});

// DELETE /api/lists/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const list = await prisma.list.findUnique({ 
      where: { id: req.params.id },
      include: { tasks: true }
    });
    if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
    req.list = list;
    next();
  } catch(e) { res.status(500).json({error: 'Error interno'}); }
}, checkBoardAccess, async (req, res) => {
  try {
    if (!req.isOwner && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el dueño del tablero puede eliminar listas' });
    }

    if (req.list.tasks.length > 0) {
      // Find another list in the board to host the archived tasks
      let fallbackList = await prisma.list.findFirst({
        where: { boardId: req.list.boardId, id: { not: req.params.id } },
        orderBy: { order: 'asc' }
      });

      // If no other list exists, create a recovery list
      if (!fallbackList) {
        fallbackList = await prisma.list.create({
          data: {
            name: 'Lista de Recuperación',
            boardId: req.list.boardId,
            order: 0
          }
        });
      }

      // Move tasks to fallback list and mark them as archived (trash)
      await prisma.task.updateMany({
        where: { listId: req.params.id },
        data: {
          listId: fallbackList.id,
          isArchived: true
        }
      });
    }

    // Now safely delete the list
    await prisma.list.delete({ where: { id: req.params.id } });
    res.json({ message: 'Lista eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar lista' });
  }
});

module.exports = router;
