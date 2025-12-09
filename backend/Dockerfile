FROM node:20-alpine

WORKDIR /app

# Copiar package.json
COPY backend/package*.json ./

# Copiar código ya compilado localmente
COPY backend/dist ./dist

# Copiar node_modules compilados localmente (evita npm install en container)
COPY backend/node_modules ./node_modules

EXPOSE 3001 9090

CMD ["npm", "start"]
