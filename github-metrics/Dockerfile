# github-metrics/Dockerfile

FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY github-metrics/package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the app
COPY github-metrics .

# Adjust this if your entrypoint file is different
CMD ["node", "src/index.js"]
