const express = require('express');
const router = express.Router();
const prisma = require('../prisma/db');
const bcrypt = require('bcrypt');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Ensure user is logged in for all routes in this file
router.use(authenticateToken);

// Search endpoint (accessible to any authenticated user)
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const users = await prisma.user.findMany({
      where: {
        username: { contains: q } // SQLite is case insensitive by default for some collations, but contains works
      },
      select: { id: true, username: true },
      take: 10
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al buscar usuarios' });
  }
});

// All other user routes require admin
router.use(requireAdmin);

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, role: true, isActive: true, createdAt: true, email: true, phone: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { username, role } = req.body;
    
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) return res.status(400).json({ error: 'El usuario ya existe' });

    // Use default password for all new users
    const defaultPassword = '1234567890';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: role || 'USER',
        forcePasswordChange: true
      },
      select: { id: true, username: true, role: true, isActive: true, forcePasswordChange: true }
    });
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PATCH /api/users/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive },
      select: { id: true, username: true, isActive: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar estado del usuario' });
  }
});

// PATCH /api/users/:id/role
router.patch('/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (role !== 'ADMIN' && role !== 'USER') {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, username: true, role: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar rol del usuario' });
  }
});

// PATCH /api/users/:id (Editar usuario y/o resetear contraseña)
router.patch('/:id', async (req, res) => {
  try {
    const { username, resetPassword } = req.body;
    let dataToUpdate = {};

    if (username) {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing && existing.id !== req.params.id) {
        return res.status(400).json({ error: 'El nombre de usuario ya está en uso' });
      }
      dataToUpdate.username = username;
    }

    if (resetPassword) {
      const defaultPassword = '1234567890';
      dataToUpdate.passwordHash = await bcrypt.hash(defaultPassword, 10);
      dataToUpdate.forcePasswordChange = true;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: dataToUpdate,
      select: { id: true, username: true, email: true, phone: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al editar usuario' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    if (req.user.userId === req.params.id) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// POST /api/users/transfer-board
router.post('/transfer-board', async (req, res) => {
  try {
    const { boardId, newOwnerId } = req.body;
    const board = await prisma.board.update({
      where: { id: boardId },
      data: { ownerId: newOwnerId }
    });
    res.json(board);
  } catch (error) {
    res.status(500).json({ error: 'Error al transferir tablero' });
  }
});

module.exports = router;
