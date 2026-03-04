FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/api/package.json services/api/package.json

RUN npm ci --workspace api

COPY services/api ./services/api

RUN npm run prisma:generate --workspace api

EXPOSE 3001

CMD ["npm", "run", "start", "--workspace", "api"]
