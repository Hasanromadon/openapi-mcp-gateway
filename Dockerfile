FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY samples/ ./samples

EXPOSE 3000

ENV PORT=3000
ENV SPEC=samples/bi-snap-banking.yaml

ENTRYPOINT ["node", "dist/index.js"]
CMD ["--spec", "samples/bi-snap-banking.yaml", "--port", "3000", "--mock"]
