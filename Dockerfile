# devenv-ops dashboard — lightweight Node 22 alpine image
FROM node:22-alpine

WORKDIR /app

# Only production files needed — no build step required
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 8090

CMD ["node", "scripts/dashboard-server.js"]
