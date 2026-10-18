# keys-door, the keyless keychain edge for keys.skaists.dev (keychain release + edge contract,
# 2026-10-12, §4 and §6). Build from the repository root:
#
#   docker build -f ops/keys-edge/Dockerfile \
#     --build-arg RUST_VERSION=<channel in rust-toolchain.toml> \
#     --build-arg RUST_IMAGE_DIGEST=<registry digest of rust:RUST_VERSION-slim-DEBIAN_SUITE> \
#     --build-arg RUNTIME_IMAGE_DIGEST=<registry digest of debian:DEBIAN_SUITE-slim> \
#     --build-arg KEYS_DOOR_COMMIT=<40-hex commit> \
#     --build-arg BSIGNER_SHA256=<base64url SHA-256 of the built bsigner> -t keys-door:<commit> .
#
# BSIGNER_SHA256 is the edge's bsigner pin (edge.toml bsigner_sha256). Take it from the builder
# stage first (`docker build ... --target builder -t keys-door-builder .`, then the SHA-256 of
# /src/target/release/bsigner in it, base64url without padding), as lab.sh step a does. The
# final stage hashes the binary it copies and refuses to build unless it is that value, then
# records it in /usr/local/share/keys-door/bsigner.sha256 and the image label
# org.beehive-nature.bsigner.sha256. A build that is refused prints the value it found.
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
# The bsigner pin: the copied binary must hash to BSIGNER_SHA256 (base64url SHA-256, no padding);
# the value is kept beside it for edge.toml, and as a label.
ARG BSIGNER_SHA256
RUN got=$(sha256sum /usr/local/bin/bsigner | cut -c1-64 | sed 's/../\\x&/g' | tr -d '\n' | xargs -0 bash -c 'printf "$0"' | base64 -w0 | tr '+/' '-_' | tr -d '=') \
 && printf '%s' "$got" | grep -Eqx '[A-Za-z0-9_-]{43}' \
 && { [ "$got" = "${BSIGNER_SHA256}" ] \
      || { echo "the built bsigner hashes to $got; BSIGNER_SHA256 is '${BSIGNER_SHA256}' (pass --build-arg BSIGNER_SHA256=$got after checking it)" >&2; exit 1; }; } \
 && install -d -m 0755 /usr/local/share/keys-door \
 && printf '%s\n' "$got" > /usr/local/share/keys-door/bsigner.sha256 \
 && chmod 0444 /usr/local/share/keys-door/bsigner.sha256
# The commit is a label for whoever inspects the image; keys-door itself does not read it.
LABEL org.beehive-nature.bsigner.sha256="${BSIGNER_SHA256}" \
      org.opencontainers.image.revision="${KEYS_DOOR_COMMIT}" \
      org.opencontainers.image.source="https://github.com/beehive-nature/beehive-nature" \
      org.opencontainers.image.title="keys-door"
USER 10096:10096
ENTRYPOINT ["/usr/local/bin/keys-door", "serve", "--config", "/etc/keys-door/edge.toml"]
