# The build stage has the TypeScript compiler. The final image keeps the compiled
# JavaScript and production dependencies only.
FROM node:22.17-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
# --ignore-scripts skips scripts/postinstall.js, which edits a local Claude Desktop config.
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22.17-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=build /app/build ./build

# The official image includes a non-root account named node (uid 1000).
USER node

EXPOSE 3000

CMD ["node", "build/index.js", "--http"]
