const express = require('express');
const router = express.Router();
const prisma = require('../prisma/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Credenciales inválidas o cuenta suspendida' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role, forcePasswordChange: user.forcePasswordChange },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, forcePasswordChange: user.forcePasswordChange }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me
const { authenticateToken } = require('../middleware/auth');
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, username: true, role: true, isActive: true, forcePasswordChange: true }
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/auth/setup
router.post('/setup', authenticateToken, async (req, res) => {
  try {
    const { newPassword, email } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Debe proporcionar un correo electrónico válido' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        passwordHash,
        email,
        forcePasswordChange: false
      },
      select: { id: true, username: true, role: true, isActive: true, forcePasswordChange: true }
    });

    res.json({ user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al configurar la cuenta' });
  }
});

module.exports = router;
