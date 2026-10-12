FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY config ./config
COPY backend ./backend
COPY frontend ./frontend
COPY admin ./admin
COPY database/migrations ./database/migrations
COPY assets ./assets
RUN mkdir -p uploads logs database/data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "backend/server.js"]
