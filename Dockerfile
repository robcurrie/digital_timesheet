# Stage 1: Build the React Application
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the frontend app for production
RUN npm run build

# Expose the Node server port
EXPOSE 3001

# Start the Node.js Express server
CMD ["node", "server.js"]
