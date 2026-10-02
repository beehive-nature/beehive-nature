#!/usr/bin/env bash
# Deterministic public-genealogy tar builder. Run under GNU tar (the verified
# Windows path uses WSL) so the archive format and metadata rules are explicit.
set -euo pipefail

build_eternalization_tar() {
  local source_dir="$1"
  local output_tar="$2"
  local temp_tar="${output_tar}.tmp-$$-${RANDOM}"
  local file_list="${output_tar}.files-$$-${RANDOM}"
  if ! python3 - "$source_dir" "$file_list" <<'PY'
import json
import hashlib
import pathlib
import sys

root = pathlib.Path(sys.argv[1]).resolve()
manifest_path = root / "manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
files = manifest.get("files")
if not isinstance(files, dict):
    raise SystemExit("FAILED: manifest files must be an object")
declared_total = 0
for rel, meta in files.items():
    if not isinstance(meta, dict) or type(meta.get("bytes")) is not int or meta["bytes"] < 0:
        raise SystemExit("FAILED: invalid declared byte size: " + rel)
    declared_total += meta["bytes"]
if manifest.get("totalBytes") != declared_total:
    raise SystemExit("FAILED: manifest totalBytes does not match declared file sizes")
files_json = json.dumps(files, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
files_digest = hashlib.sha256(files_json).hexdigest()
if manifest.get("manifestSha256") != files_digest:
    raise SystemExit("FAILED: manifestSha256 does not match manifest files")
declared = set(files.keys())
expected = declared | {"manifest.json"}
actual = set()
for path in root.rglob("*"):
    rel = path.relative_to(root).as_posix()
    if path.is_symlink():
        raise SystemExit("FAILED: symlink in prepared package: " + rel)
    if path.is_file():
        actual.add(rel)
missing = sorted(expected - actual)
extras = sorted(actual - expected)
if missing or extras:
    if missing:
        print("FAILED: manifest files missing: " + ", ".join(missing[:10]), file=sys.stderr)
    if extras:
        print("FAILED: undeclared files present: " + ", ".join(extras[:10]), file=sys.stderr)
    raise SystemExit(1)
bad = []
for rel, meta in files.items():
    path = root / rel
    size = path.stat().st_size
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    if size != meta.get("bytes") or digest.hexdigest() != meta.get("sha256"):
        bad.append(rel)
if bad:
    print("FAILED: manifest content mismatch: " + ", ".join(sorted(bad)[:10]), file=sys.stderr)
    raise SystemExit(1)
with open(sys.argv[2], "wb") as out:
    for rel in sorted(expected):
        out.write(rel.encode("utf-8") + b"\0")
PY
  then
    rm -f "$file_list"
    return 1
  fi
  if ! tar \
    --sort=name \
    --mtime='2026-10-02T00:00:00Z' \
    --owner=0 \
    --group=0 \
    --numeric-owner \
    --mode='0644' \
    --format=posix \
    --pax-option=delete=atime,delete=ctime \
    -C "$source_dir" \
    --no-recursion \
    --null \
    --files-from="$file_list" \
    -cf "$temp_tar" \
    ; then
    rm -f "$temp_tar" "$file_list"
    return 1
  fi
  rm -f "$file_list"
  mv -f "$temp_tar" "$output_tar"
}

verify_reproducible_eternalization_tar() {
  local source_dir="$1"
  local output_tar="$2"
  local first_tar="${output_tar}.candidate-a-$$"
  local repeat_tar="${output_tar}.candidate-b-$$"
  local snapshot
  snapshot="$(mktemp -d "${TMPDIR:-/tmp}/genealogy-eternalization-snapshot-XXXXXX")"

  # Copy once into a private directory, then validate and archive only that
  # stable snapshot. A writer racing the source copy can at worst make the
  # snapshot fail its manifest checks; it cannot alter bytes between
  # validation and tar reads.
  # Copy only the source directory's entries, not its root metadata: copying
  # `source/.` with cp -a would replace mktemp's 0700 mode with a commonly
  # world-readable 0755/0777 mode while undeclared entries are being checked.
  if ! (
    umask 077
    shopt -s dotglob nullglob
    entries=("$source_dir"/*)
    ((${#entries[@]} > 0)) || exit 1
    cp -a -- "${entries[@]}" "$snapshot/"
  ); then
    rm -rf "$snapshot"
    return 1
  fi
  if ! build_eternalization_tar "$snapshot" "$first_tar" ||
     ! build_eternalization_tar "$snapshot" "$repeat_tar"; then
    rm -rf "$snapshot"
    rm -f "$first_tar" "$repeat_tar"
    return 1
  fi
  cmp --silent "$first_tar" "$repeat_tar" || {
    rm -rf "$snapshot"
    rm -f "$first_tar" "$repeat_tar"
    echo "FAILED: independent tar constructions differ" >&2
    return 1
  }

  local sha bytes
  sha="$(sha256sum "$first_tar" | awk '{print $1}')"
  bytes="$(stat -c '%s' "$first_tar")"
  rm -rf "$snapshot"
  rm -f "$repeat_tar"
  mv -f "$first_tar" "$output_tar"
  printf '{"tar":"%s","bytes":%s,"sha256":"%s","reproduced":true}\n' "$output_tar" "$bytes" "$sha"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  if [[ "$#" -ne 2 ]]; then
    echo "usage: build-eternalization-tar.sh <prepared-package-dir> <output.tar>" >&2
    exit 2
  fi
  verify_reproducible_eternalization_tar "$1" "$2"
fi
