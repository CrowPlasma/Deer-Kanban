const express = require('express');
const router = express.Router();
const prisma = require('../prisma/db');
const { authenticateToken } = require('../middleware/auth');

// ──────────────────────────────────────────────────────────────────
// Presence tracking (in-memory, resets on server restart)
// Map: boardId → Map(userId → { username, lastSeen })
// ──────────────────────────────────────────────────────────────────
const presenceMap = new Map();
const PRESENCE_TIMEOUT_MS = 30 * 1000; // 30 seconds

router.use(authenticateToken);

// POST /api/boards/:id/presence  — ping "I'm here"
router.post('/:id/presence', (req, res) => {
  const boardId = req.params.id;
  if (!presenceMap.has(boardId)) presenceMap.set(boardId, new Map());
  presenceMap.get(boardId).set(req.user.userId, {
    username: req.user.username,
    lastSeen: Date.now()
  });
  res.json({ ok: true });
});

// GET /api/boards/:id/presence  — list active users
router.get('/:id/presence', (req, res) => {
  const boardId = req.params.id;
  const now = Date.now();
  const active = [];
  if (presenceMap.has(boardId)) {
    for (const [uid, info] of presenceMap.get(boardId)) {
      if (now - info.lastSeen < PRESENCE_TIMEOUT_MS) {
        active.push({ userId: uid, username: info.username, lastSeen: info.lastSeen });
      } else {
        presenceMap.get(boardId).delete(uid); // cleanup stale
      }
    }
  }
  res.json(active);
});

// GET /api/boards/:id/pulse  — latest activity timestamp for change detection
router.get('/:id/pulse', async (req, res) => {
  try {
    const latest = await prisma.activity.findFirst({
      where: { boardId: req.params.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, id: true }
    });
    res.json({ lastActivityAt: latest?.createdAt || null, lastActivityId: latest?.id || null });
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});



// GET /api/boards (Tableros propios y compartidos)
router.get('/', async (req, res) => {
  try {
    const ownedBoards = await prisma.board.findMany({
      where: { ownerId: req.user.userId, isArchived: false },
      include: { owner: { select: { username: true } } }
    });

    const sharedBoards = await prisma.board.findMany({
      where: {
        isArchived: false,
        members: {
          some: { userId: req.user.userId }
        }
      },
      include: { owner: { select: { username: true } } }
    });

    const archivedBoards = await prisma.board.findMany({
      where: { ownerId: req.user.userId, isArchived: true },
      include: { owner: { select: { username: true } } }
    });

    res.json({ owned: ownedBoards, shared: sharedBoards, archived: archivedBoards });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tableros' });
  }
});

// GET /api/boards/:id
router.get('/:id', async (req, res) => {
  try {
    const board = await prisma.board.findUnique({
      where: { id: req.params.id },
      include: {
        lists: {
          orderBy: { order: 'asc' },
          include: {
            tasks: {
              where: { isArchived: false },
              orderBy: { order: 'asc' },
              include: {
                assignee: { select: { username: true } },
                subtasks: true,
                comments: { include: { user: { select: { username: true } } } }
              }
            }
          }
        },
        members: { include: { user: { select: { username: true } } } },
        owner: { select: { username: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { user: { select: { username: true } } }
        }
      }
    });

    if (!board) return res.status(404).json({ error: 'Tablero no encontrado' });

    // Verificar si es dueño o miembro
    const isOwner = board.ownerId === req.user.userId;
    const isMember = board.members.some(m => m.userId === req.user.userId);
    if (!isOwner && !isMember && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    res.json(board);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el tablero' });
  }
});

// POST /api/boards
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const board = await prisma.board.create({
      data: {
        name,
        ownerId: req.user.userId
      }
    });
    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear tablero' });
  }
});

// PATCH /api/boards/:id (Renombrar)
router.patch('/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    
    if (board.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el dueño puede editar el nombre' });
    }

    const updated = await prisma.board.update({
      where: { id: req.params.id },
      data: { name }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar tablero' });
  }
});

// DELETE /api/boards/:id (Soft Delete)
router.delete('/:id', async (req, res) => {
  try {
    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    if (!board) return res.status(404).json({ error: 'Tablero no encontrado' });
    if (board.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el dueño puede eliminar el tablero' });
    }
    await prisma.board.update({ where: { id: req.params.id }, data: { isArchived: true } });
    res.json({ message: 'Tablero enviado a la papelera' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar tablero' });
  }
});

// PATCH /api/boards/:id/restore
router.patch('/:id/restore', async (req, res) => {
  try {
    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    if (!board) return res.status(404).json({ error: 'Tablero no encontrado' });
    if (board.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el dueño puede restaurar el tablero' });
    }
    await prisma.board.update({ where: { id: req.params.id }, data: { isArchived: false } });
    res.json({ message: 'Tablero restaurado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al restaurar tablero' });
  }
});

// DELETE /api/boards/:id/permanent
router.delete('/:id/permanent', async (req, res) => {
  try {
    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    if (!board) return res.status(404).json({ error: 'Tablero no encontrado' });
    if (board.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el dueño puede eliminar permanentemente el tablero' });
    }
    await prisma.board.delete({ where: { id: req.params.id } });
    res.json({ message: 'Tablero eliminado de forma permanente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar tablero' });
  }
});

// PATCH /api/boards/:id/background
router.patch('/:id/background', async (req, res) => {
  try {
    const { backgroundUrl } = req.body;
    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    
    // Solo dueño o miembros pueden cambiar fondo (si lo permitimos). Por ahora solo el dueño o ADMIN.
    if (board.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el dueño puede editar el fondo' });
    }

    const updated = await prisma.board.update({
      where: { id: req.params.id },
      data: { backgroundUrl }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar fondo del tablero' });
  }
});

// POST /api/boards/:id/members (Invitar)
router.post('/:id/members', async (req, res) => {
  try {
    const { username } = req.body;
    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    
    if (board.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el dueño puede invitar' });
    }

    const userToInvite = await prisma.user.findUnique({ where: { username } });
    if (!userToInvite) return res.status(404).json({ error: 'Usuario no encontrado' });

    const member = await prisma.boardMember.create({
      data: {
        boardId: req.params.id,
        userId: userToInvite.id
      },
      include: { user: { select: { username: true } } }
    });
    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ error: 'Error al invitar usuario (posible duplicado)' });
  }
});

// DELETE /api/boards/:id/members/:memberId (Quitar invitado)
router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    
    if (board.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el dueño puede remover invitados' });
    }

    await prisma.boardMember.deleteMany({
      where: {
        boardId: req.params.id,
        userId: req.params.memberId
      }
    });
    res.json({ message: 'Invitado removido' });
  } catch (error) {
    res.status(500).json({ error: 'Error al remover invitado' });
  }
});

// GET /api/boards/:id/trash (Ver papelera)
router.get('/:id/trash', async (req, res) => {
  try {
    const archivedTasks = await prisma.task.findMany({
      where: {
        list: { boardId: req.params.id },
        isArchived: true
      },
      include: {
        list: { select: { name: true } },
        assignee: { select: { username: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(archivedTasks);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener papelera' });
  }
});

// DELETE /api/boards/:id/trash (Vaciar papelera)
router.delete('/:id/trash', async (req, res) => {
  try {
    const board = await prisma.board.findUnique({ where: { id: req.params.id } });
    if (board.ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Solo el dueño puede vaciar la papelera' });
    }
    await prisma.task.deleteMany({
      where: {
        list: { boardId: req.params.id },
        isArchived: true
      }
    });
    res.json({ message: 'Papelera vaciada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al vaciar papelera' });
  }
});

// POST /api/boards/:id/clone (Clonar tablero)
router.post('/:id/clone', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es obligatorio para clonar' });

    // 1. Obtener tablero original y todas sus dependencias activas
    const originalBoard = await prisma.board.findUnique({
      where: { id: req.params.id },
      include: {
        lists: {
          include: {
            tasks: {
              where: { isArchived: false },
              include: { subtasks: true }
            }
          }
        }
      }
    });

    if (!originalBoard) return res.status(404).json({ error: 'Tablero no encontrado' });

    // 2. Crear nuevo tablero (el clonador se vuelve dueño exclusivo inicial)
    const newBoard = await prisma.board.create({
      data: {
        name,
        ownerId: req.user.userId,
        backgroundUrl: originalBoard.backgroundUrl
      }
    });

    // 3. Crear listas, tareas y subtareas para el nuevo tablero
    for (const list of originalBoard.lists) {
      const newList = await prisma.list.create({
        data: { name: list.name, order: list.order, boardId: newBoard.id }
      });

      for (const task of list.tasks) {
        const newTask = await prisma.task.create({
          data: {
            title: task.title,
            description: task.description,
            dueDate: task.dueDate,
            color: task.color,
            labels: task.labels,
            isCompleted: task.isCompleted,
            order: task.order,
            listId: newList.id,
            assigneeId: null // Reset assignee since members are not cloned automatically
          }
        });

        if (task.subtasks && task.subtasks.length > 0) {
          const subtaskData = task.subtasks.map(st => ({
            title: st.title,
            isCompleted: st.isCompleted,
            taskId: newTask.id
          }));
          await prisma.subtask.createMany({ data: subtaskData });
        }
      }
    }

    // 4. Registrar la actividad inicial
    await prisma.activity.create({
      data: {
        boardId: newBoard.id,
        userId: req.user.userId,
        action: 'clonó la estructura de un tablero',
        details: `Clonado desde un tablero anterior con éxito.`
      }
    });

    res.status(201).json(newBoard);
  } catch (error) {
    console.error('Error clonando tablero:', error);
    res.status(500).json({ error: 'Error interno al intentar clonar el tablero' });
  }
});

module.exports = router;

