FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
ARG CACHEBUST=1
COPY . .
RUN npm run build:css
RUN npm prune --production
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["node", "server.js"]
