const express = require('express');
const router = express.Router();
const prisma = require('../prisma/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' }
    });
    
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: { id: 'singleton' }
      });
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// PATCH /api/settings (Requiere Admin)
router.patch('/', requireAdmin, async (req, res) => {
  try {
    const { institutionalBackgroundUrl, allowCustomBackgrounds } = req.body;
    
    const settings = await prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      update: {
        ...(institutionalBackgroundUrl !== undefined && { institutionalBackgroundUrl }),
        ...(allowCustomBackgrounds !== undefined && { allowCustomBackgrounds })
      },
      create: {
        id: 'singleton',
        institutionalBackgroundUrl,
        allowCustomBackgrounds: allowCustomBackgrounds !== undefined ? allowCustomBackgrounds : true
      }
    });
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar configuración' });
  }
});

module.exports = router;
