#!/usr/bin/env bash
# Starts the production image and walks the main user flow against it:
# health, server-rendered home page, upload, pattern generation, PDF guide.
# Usage: scripts/smoke-test.sh <image-tag>
set -euo pipefail
IMAGE="${1:-sba:ci}"
PORT="${PORT:-3999}"
TMP="$(mktemp -d)"
NAME="sba-smoke-$$"

cleanup() {
  echo "--- container logs ---"
  docker logs "$NAME" 2>&1 | tail -80 || true
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

docker run -d --name "$NAME" -p "$PORT:3000" -e COOKIE_SECRET=smoke "$IMAGE" >/dev/null

echo "waiting for health"
for i in $(seq 1 60); do
  if curl -sf "http://localhost:$PORT/api/health" >/dev/null; then break; fi
  sleep 1
  if [ "$i" = 60 ]; then echo "server never became healthy"; exit 1; fi
done

check() { # label expected-status url [curl args...]
  local label="$1" want="$2" url="$3"; shift 3
  local got
  got="$(curl -s -o "$TMP/body" -w '%{http_code}' "$@" "$url")"
  if [ "$got" != "$want" ]; then
    echo "FAIL $label: expected $want got $got"
    head -c 600 "$TMP/body"; echo
    exit 1
  fi
  echo "ok   $label ($got)"
}

check "health"      200 "http://localhost:$PORT/api/health"
check "home (SSR)"  200 "http://localhost:$PORT/"
grep -q 'Turn a photo into a seed bead pattern' "$TMP/body" || { echo "FAIL home page did not render"; exit 1; }
check "404 page"    404 "http://localhost:$PORT/projects/does-not-exist"

# a small synthetic photo, made with the sharp already inside the image
docker exec "$NAME" node -e "
const sharp=require('sharp');const w=240,h=160,b=Buffer.alloc(w*h*3);
for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*3;b[o]=x<w/2?200:30;b[o+1]=40;b[o+2]=x<w/2?40:120;}
sharp(b,{raw:{width:w,height:h,channels:3}}).jpeg().toBuffer().then(j=>process.stdout.write(j));
" > "$TMP/photo.jpg"
[ -s "$TMP/photo.jpg" ] || { echo "FAIL could not create fixture"; exit 1; }

check "upload"      201 "http://localhost:$PORT/api/projects" -c "$TMP/jar" -F "image=@$TMP/photo.jpg" -F "title=Smoke"
PROJECT=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$TMP/body','utf8')).project.id)")
check "project page" 200 "http://localhost:$PORT/projects/$PROJECT" -b "$TMP/jar"
check "generate"    201 "http://localhost:$PORT/api/projects/$PROJECT/patterns" -b "$TMP/jar" -X POST
PATTERN=$(node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('$TMP/body','utf8')).pattern.id)")
check "pattern json" 200 "http://localhost:$PORT/api/patterns/$PATTERN"
check "preview png" 200 "http://localhost:$PORT/api/patterns/$PATTERN/preview.png"
check "guide pdf"   200 "http://localhost:$PORT/api/patterns/$PATTERN/guide.pdf"
head -c 5 "$TMP/body" | grep -q '%PDF-' || { echo "FAIL guide is not a PDF"; exit 1; }
check "other browser cannot edit" 403 "http://localhost:$PORT/api/projects/$PROJECT/patterns" -X POST
echo "smoke test passed"
