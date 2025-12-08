FROM node:20-alpine AS builder

WORKDIR /app

# Copiar todo
COPY frontend/package*.json ./frontend/
COPY shared/ ./shared/

WORKDIR /app/frontend
RUN npm install

COPY frontend/ ./

RUN npm run build

# Producción con nginx
FROM nginx:alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
