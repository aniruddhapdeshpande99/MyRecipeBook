FROM node:24-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN mkdir -p /app/data /app/backups

ENV HOST=0.0.0.0
ENV PORT=4321

EXPOSE 4321
CMD ["node", "./dist/server/entry.mjs"]
