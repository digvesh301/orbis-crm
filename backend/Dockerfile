# /home/digvesh-dadhaniya/Desktop/orbis-crm/backend/Dockerfile
FROM rust:1.85-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev

WORKDIR /app

# Cache dependencies by building a dummy app first
COPY Cargo.toml Cargo.lock* ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release || true
RUN rm -rf src

# Now copy actual source code
COPY . .
# We must use offline mode for SQLx during Docker build
ENV SQLX_OFFLINE=true
RUN cargo build --release --bin orbis

# Final runtime image
FROM debian:bookworm-slim
# Install runtime dependencies (like ca-certificates for external API calls, if any)
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/orbis /usr/local/bin/orbis

# Expose port (can be overridden via ENV)
ENV PORT=8000
EXPOSE 8000

# Start command
CMD ["orbis"]
