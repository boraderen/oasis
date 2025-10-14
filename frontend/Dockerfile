# Use Node.js 20 alpine image as base
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose port 5173 (Vite default)
EXPOSE 5173

# Command to run the development server
# Use --host to make it accessible from outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

