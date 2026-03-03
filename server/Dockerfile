FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 4000

CMD ["node", "app.js"]
