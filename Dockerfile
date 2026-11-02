# Multi-stage Dockerfile for Headless MCP Gateway Core
FROM rust:1.85-bullseye AS builder

WORKDIR /app
COPY Cargo.toml ./
COPY src-tauri ./src-tauri
COPY cli ./cli

RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl-dev \
    pkg-config \
    libwebkit2gtk-4.1-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

RUN cargo build --release -p mcp-gateway-cli

# Runtime image
FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl1.1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Run as nonroot user for security
RUN useradd -m -u 1000 -s /bin/bash gatewayuser
USER gatewayuser
WORKDIR /home/gatewayuser

COPY --from=builder /app/target/release/mcp-gateway-cli /usr/local/bin/mcp-gateway-cli

ENV MCP_GATEWAY_PORT=8080
ENV MCP_GATEWAY_HOST=0.0.0.0

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["mcp-gateway-cli"]
CMD ["--port", "8080", "--host", "0.0.0.0"]

