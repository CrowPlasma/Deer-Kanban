const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sendMail(to, subject, html) {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } });
  
  if (!settings || !settings.smtpEmail || !settings.smtpPassword) {
    throw new Error('La configuración de correo no está establecida. Ve a Ajustes -> Configuración Correo.');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // true for 465
    auth: {
      user: settings.smtpEmail,
      pass: settings.smtpPassword
    }
  });

  await transporter.sendMail({
    from: `"Deer Kanban" <${settings.smtpEmail}>`,
    to,
    subject,
    html
  });
}

module.exports = { sendMail };
