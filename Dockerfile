FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache \
    postgresql-client \
    redis \
    curl

COPY package*.json ./

# Install dependencies with multiple fallback options
RUN npm install --omit=dev --no-audit --no-fund && \
    npm cache clean --force

COPY . .

RUN mkdir -p logs

RUN addgroup -g 1001 -S nodejs && \
    adduser -S sentra -u 1001

RUN chown -R sentra:nodejs /app

USER sentra

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "src/app.js"]