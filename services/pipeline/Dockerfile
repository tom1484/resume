FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY migrations ./migrations
COPY src ./src
CMD ["node", "src/poller.js"]
