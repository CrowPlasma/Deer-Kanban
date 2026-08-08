const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3025;

app.use(cors());
app.use(express.json());

// Import Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const boardsRoutes = require('./routes/boards');
const listsRoutes = require('./routes/lists');
const tasksRoutes = require('./routes/tasks');
const uploadRoutes = require('./routes/upload');
const settingsRoutes = require('./routes/settings');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/boards', boardsRoutes);
app.use('/api/lists', listsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/settings', settingsRoutes);

// Servir estáticos en producción/docker
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// Rutas de fallback para React
app.use((req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
