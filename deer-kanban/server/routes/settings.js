const express = require('express');
const router = express.Router();
const prisma = require('../prisma/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

router.use(authenticateToken);

const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

// GET /api/settings/backup (Requiere Admin)
router.get('/backup', requireAdmin, async (req, res) => {
  try {
    const backupName = `deer-kanban-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    
    res.attachment(backupName);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error al generar el backup' });
      }
    });

    archive.pipe(res);

    // Añadir dev.db
    const dbPath = path.join(__dirname, '../prisma/dev.db');
    if (fs.existsSync(dbPath)) {
      archive.file(dbPath, { name: 'dev.db' });
    }

    // Añadir carpeta de uploads (imágenes)
    const uploadsPath = path.join(__dirname, '../public/uploads');
    if (fs.existsSync(uploadsPath)) {
      archive.directory(uploadsPath, 'uploads');
    }

    await archive.finalize();
  } catch (error) {
    console.error('Error al generar backup:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor al generar el backup' });
    }
  }
});

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
