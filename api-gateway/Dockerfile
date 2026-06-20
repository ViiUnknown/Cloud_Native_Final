# api-gateway/Dockerfile
FROM node:24-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package*.json ./
RUN npm install --production

# Copy source.
COPY . .

# Run as the built-in non-root "node" user.
RUN chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "server.js"]
