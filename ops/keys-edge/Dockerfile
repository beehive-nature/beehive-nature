# keys-door, the keyless keychain edge for keys.skaists.dev (keychain release + edge contract,
# 2026-10-12, §4 and §6). Build from the repository root:
#
#   docker build -f ops/keys-edge/Dockerfile \
#     --build-arg RUST_VERSION=<channel in rust-toolchain.toml> \
#     --build-arg RUST_IMAGE_DIGEST=<registry digest of rust:RUST_VERSION-slim-DEBIAN_SUITE> \
#     --build-arg RUNTIME_IMAGE_DIGEST=<registry digest of debian:DEBIAN_SUITE-slim> \
#     --build-arg KEYS_DOOR_COMMIT=<40-hex commit> -t keys-door:<commit> .
#
# No digest is written here: one copied by hand is one nobody checked. The lab
# (ops/keys-edge/lab/lab.sh, step a) reads each from the registry, prints it and builds with it;
# a host build takes the digests that lab run printed. An empty digest is an invalid image
# reference, so the build stops instead of floating on a tag. Builder and runtime share
# DEBIAN_SUITE, so the binaries run on the glibc they were linked against.
ARG RUST_VERSION
ARG DEBIAN_SUITE=bookworm
ARG RUST_IMAGE_DIGEST
ARG RUNTIME_IMAGE_DIGEST

FROM rust:${RUST_VERSION}-slim-${DEBIAN_SUITE}@${RUST_IMAGE_DIGEST} AS builder
ARG RUST_VERSION
# The toolchain the image ships, never rust-toolchain.toml's component list (no rustup download).
ENV RUSTUP_TOOLCHAIN=${RUST_VERSION} CARGO_TERM_COLOR=never
WORKDIR /src
COPY . .
RUN rustc --version && cargo --version \
 && case "$(rustc --version)" in "rustc ${RUST_VERSION} "*) ;; *) echo "builder rustc is not ${RUST_VERSION}" >&2; exit 1 ;; esac \
 && cargo build -p bsigner --release --locked \
 && cargo build --release --locked --manifest-path ops/keys-door/Cargo.toml

FROM debian:${DEBIAN_SUITE}-slim@${RUNTIME_IMAGE_DIGEST}
ARG KEYS_DOOR_COMMIT
RUN printf '%s' "${KEYS_DOOR_COMMIT}" | grep -Eqx '[0-9a-f]{40}' \
      || { echo "KEYS_DOOR_COMMIT must be the 40-hex commit this image is built from" >&2; exit 1; } \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd --system --gid 10096 keysdoor \
 && useradd --system --uid 10096 --gid 10096 --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin keysdoor \
 && install -d -o 10096 -g 10096 -m 0700 /var/lib/keys-door/state \
 && install -d -o 10096 -g 10096 -m 0755 /var/lib/keys-door/inbox \
 && install -d -m 0755 /etc/keys-door
# The only two binaries this image adds: the edge, and rule 2's second verifier (edge.toml
# bsigner_path = "/usr/local/bin/bsigner"). Root-owned, so the edge cannot rewrite either.
COPY --from=builder /src/ops/keys-door/target/release/keys-door /usr/local/bin/keys-door
COPY --from=builder /src/target/release/bsigner /usr/local/bin/bsigner
# The commit is a label for whoever inspects the image; keys-door itself does not read it.
LABEL org.opencontainers.image.revision="${KEYS_DOOR_COMMIT}" \
      org.opencontainers.image.source="https://github.com/beehive-nature/beehive-nature" \
      org.opencontainers.image.title="keys-door"
USER 10096:10096
ENTRYPOINT ["/usr/local/bin/keys-door", "serve", "--config", "/etc/keys-door/edge.toml"]
