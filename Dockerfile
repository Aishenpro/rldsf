FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN mkdir -p /data /app/uploads && chown -R node:node /app /data
USER node
ENV DATABASE_PATH=/data/foundation.sqlite UPLOAD_DIR=/app/uploads
EXPOSE 3000
CMD ["node","src/server.js"]
