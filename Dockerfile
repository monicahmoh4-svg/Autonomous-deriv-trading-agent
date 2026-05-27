FROM node:20-alpine
LABEL description="NEXUS TRADER — Autonomous AI Deriv Trading Platform"
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN mkdir -p logs public
RUN addgroup -g 1001 -S nexus && adduser -S nexus -u 1001
RUN chown -R nexus:nexus /app
USER nexus
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1
CMD ["node", "src/server.js"]
