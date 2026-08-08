# Etapa 1: Construcción del Frontend (React)
FROM node:22-alpine as client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Etapa 2: Configuración del Backend (Express)
FROM node:22-alpine
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npx prisma generate
# Copiar los archivos estáticos de React a una carpeta "public" en el servidor
COPY --from=client-builder /app/client/dist ./public

# Exponer el puerto solicitado por el usuario
EXPOSE 3025

# Iniciar el servidor
CMD ["npm", "start"]
