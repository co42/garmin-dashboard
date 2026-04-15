# Stage 1: Build
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:24-alpine
RUN apk add --no-cache ca-certificates curl

# Install garmin CLI (musl, statically linked)
ARG GARMIN_CLI_VERSION=1.11.0
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      echo "No linux arm64 garmin-cli build available yet — sync will not work"; \
    else \
      curl -fsSL "https://github.com/co42/garmin-cli/releases/download/v${GARMIN_CLI_VERSION}/garmin-v${GARMIN_CLI_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
        | tar -xz -C /usr/local/bin; \
    fi

WORKDIR /app

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

RUN mkdir -p data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "build"]
