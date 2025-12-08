FROM node:20-alpine

WORKDIR /app

# Copiar package.json y shared
COPY backend/package*.json ./backend/
COPY shared/ ./shared/

# Instalar dependencias
WORKDIR /app/backend
RUN npm install

# Copiar código fuente
COPY backend/ ./

# Build
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
