FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Instalar tsx globalmente para ejecutar TypeScript directamente
RUN npm install -g tsx

# Copiar código fuente TypeScript
COPY backend/src ./src
COPY backend/tsconfig.json ./

EXPOSE 3001 9090

CMD ["tsx", "src/server.ts"]
