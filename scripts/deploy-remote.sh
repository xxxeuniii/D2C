#!/usr/bin/env bash
set -Eeuo pipefail

sha="${1:?commit SHA is required}"
if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid commit SHA: $sha" >&2
  exit 1
fi

app_root="/opt/d2c"
release="$app_root/releases/$sha"
archive="/tmp/d2c-$sha.tar.gz"
current="$app_root/current"
shared="$app_root/shared"
previous=""
switched=0

rollback() {
  status=$?
  if [[ $status -ne 0 && $switched -eq 1 && -n "$previous" && -d "$previous" ]]; then
    echo "Deployment failed; rolling back to $previous"
    ln -sfn "$previous" "$current"
    sudo systemctl restart d2c-backend d2c-web
  fi
  if [[ $status -ne 0 && "$release" != "$previous" ]]; then
    rm -rf "$release"
  fi
  rm -f "$archive"
  trap - EXIT
  exit "$status"
}
trap rollback EXIT

if [[ -L "$current" ]]; then
  previous="$(readlink -f "$current")"
fi

mkdir -p \
  "$app_root/releases" \
  "$shared/chroma_data" \
  "$shared/output" \
  "$shared/pip-cache" \
  "$shared/npm-cache" \
  "$shared/venvs"
rm -rf "$release"
mkdir -p "$release"
tar -xzf "$archive" -C "$release"

if [[ ! -f "$shared/server.env" ]]; then
  echo "Missing $shared/server.env" >&2
  exit 1
fi

ln -sfn "$shared/server.env" "$release/apps/server/.env"
if [[ -f "$shared/root.env" ]]; then
  ln -sfn "$shared/root.env" "$release/.env"
fi
rm -rf "$release/apps/server/chroma_data"
ln -sfn "$shared/chroma_data" "$release/apps/server/chroma_data"
rm -rf "$release/output"
ln -sfn "$shared/output" "$release/output"

cd "$release/apps/server"
requirements_hash="$(sha256sum requirements.txt | awk '{print $1}')"
shared_venv="$shared/venvs/$requirements_hash"
if [[ ! -f "$shared_venv/.complete" ]]; then
  rm -rf "$shared_venv"
  python3 -m venv "$shared_venv"
  PIP_CACHE_DIR="$shared/pip-cache" "$shared_venv/bin/pip" install --retries 10 --timeout 120 --upgrade pip
  PIP_CACHE_DIR="$shared/pip-cache" "$shared_venv/bin/pip" install --retries 10 --timeout 120 -r requirements.txt
  touch "$shared_venv/.complete"
fi
rm -rf venv
ln -sfn "$shared_venv" venv
venv/bin/python -m compileall -q .

cd "$release/apps/web"
npm ci --cache "$shared/npm-cache" --prefer-offline
NEXT_PUBLIC_BASE_PATH=/d2c \
NEXT_PUBLIC_API_BASE_URL=/d2c/api \
BACKEND_API_URL=http://127.0.0.1:8082 \
RAG_BACKEND_URL=http://127.0.0.1:8082 \
npm run build

ln -sfn "$release" "$current"
switched=1
sudo systemctl restart d2c-backend d2c-web

for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:8082/health >/dev/null \
    && curl -fsS http://127.0.0.1:3001/d2c/figma2code >/dev/null; then
    break
  fi
  sleep 2
done

curl -fsS http://127.0.0.1:8082/health >/dev/null
curl -fsS http://127.0.0.1:3001/d2c/figma2code >/dev/null

find "$app_root/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | tail -n +6 \
  | cut -d' ' -f2- \
  | while IFS= read -r old_release; do
      [[ "$old_release" == "$(readlink -f "$current")" ]] || rm -rf "$old_release"
    done

rm -f "$archive"
trap - EXIT
echo "Deployed $sha successfully"
