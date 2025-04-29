FROM oven/bun:1.2-alpine

WORKDIR /app
COPY . /app
RUN bun install

CMD ["bun", "run", "index.ts"]