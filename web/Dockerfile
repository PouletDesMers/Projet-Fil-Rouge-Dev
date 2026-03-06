FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Use npm install to handle package.json changes without requiring an up-to-date lock file
RUN npm install --only=production

# Copy rest of the app
COPY . .

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
