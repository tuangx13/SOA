FROM node:18-alpine

WORKDIR /app

# Copy và install dependencies
ARG SERVICE_DIR
COPY ${SERVICE_DIR}/package.json ./package.json
RUN npm install --production

# Copy shared tracing config
COPY shared/ ./shared/

# Copy dashboard (for order-service static serving)
COPY dashboard/ ./dashboard/

# Copy service entry point
COPY ${SERVICE_DIR}/index.js ./index.js

CMD ["node", "index.js"]
