FROM rust:1.85-slim-bookworm AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Layer 1: cache dependency compilation ─────────────────────────────────────
# Copy manifests and lock file only — so this layer is cached unless deps change
COPY Cargo.toml Cargo.lock ./

# Create a fake binary so cargo can compile all deps without the real source
RUN mkdir -p src && echo 'fn main() { println!("stub"); }' > src/main.rs

# Compile deps only — the || true lets it "fail" on linking (expected), but deps are cached
RUN cargo build --release; rm -rf src target/release/orbis target/release/deps/orbis*

# ── Layer 2: compile the real application ─────────────────────────────────────
# Copy the actual source (touching main.rs forces a full recompile of our code only)
COPY src ./src
COPY migrations ./migrations
COPY .sqlx ./.sqlx

# Use offline mode for SQLx during Docker build (pre-built query cache is in .sqlx/)
ENV SQLX_OFFLINE=true

RUN cargo build --release --bin orbis

# ── Final runtime image ───────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/orbis /usr/local/bin/orbis

ENV PORT=8000
EXPOSE 8000

CMD ["orbis"]
