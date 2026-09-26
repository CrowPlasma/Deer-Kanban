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

const multer = require('multer');
const AdmZip = require('adm-zip');
const upload = multer({ dest: path.join(__dirname, '../temp/') });

// POST /api/settings/restore (Requiere Admin)
router.post('/restore', requireAdmin, upload.single('backup'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }

  try {
    const zip = new AdmZip(req.file.path);
    const zipEntries = zip.getEntries();
    
    // Validate backup contents
    const hasDb = zipEntries.some(e => e.entryName === 'dev.db');
    if (!hasDb) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'El archivo ZIP no es válido. Falta dev.db.' });
    }

    // Disconnect Prisma to release lock on dev.db
    await prisma.$disconnect();

    // Extract files
    zipEntries.forEach((zipEntry) => {
      if (zipEntry.entryName === 'dev.db') {
         zip.extractEntryTo(zipEntry, path.join(__dirname, '../prisma'), false, true);
      } else if (zipEntry.entryName.startsWith('uploads/')) {
         zip.extractEntryTo(zipEntry, path.join(__dirname, '../public'), true, true);
      }
    });

    // Cleanup uploaded zip
    fs.unlinkSync(req.file.path);

    res.json({ message: 'Respaldo restaurado con éxito. Por favor recarga la página.' });
  } catch (error) {
    console.error('Error al restaurar backup:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Error al restaurar el respaldo. ' + error.message });
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
