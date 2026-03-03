FROM node:22-alpine AS build

WORKDIR /app

ARG VITE_API_URL=http://localhost:3001
ARG VITE_WS_URL=ws://localhost:3001/ws

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json

RUN npm ci --workspace web

COPY apps/web ./apps/web

RUN npm run build --workspace web

FROM nginx:1.27-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
