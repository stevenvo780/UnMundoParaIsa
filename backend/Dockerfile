FROM node:20-alpine

WORKDIR /app

# Copiar package.json e instalar dependencias (tsx ahora está en dependencies)
COPY backend/package*.json ./
RUN npm ci

# Copiar shared types
COPY shared ../shared

# Copiar código fuente TypeScript
COPY backend/src ./src
COPY backend/tsconfig.json ./

EXPOSE 3001 9090

CMD ["npx", "tsx", "src/server.ts"]
