FROM node:22-alpine

WORKDIR /app

# Copy repo configuration and packages
COPY package.json package-lock.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/demo-workload/checkout-api/ ./apps/demo-workload/checkout-api/

# Install root dependencies including tsx
RUN npm install

ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npx", "tsx", "apps/demo-workload/checkout-api/src/server.ts"]
