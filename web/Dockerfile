FROM node:18-alpine

WORKDIR /app

# Copy lockfile first for deterministic installs and leverage Docker cache
COPY package*.json ./

# Use `npm ci` for reproducible, faster installs in CI/containers
RUN npm ci --only=production

# Copy rest of the app
COPY . .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
