# Use Node.js base image
FROM node:latest
# Install pnpm
RUN npm install -g pnpm

# Install ts-node
RUN npm install -g ts-node

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package.json pnpm-lock.yaml ./
RUN pnpm i

# Copy the rest of the application code
COPY ./scripts /app/scripts


CMD ["npx", "ts-node", "scripts/pull.ts"]

