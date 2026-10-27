#!/bin/bash
# Arranca Ollama, el backend y el frontend. Ctrl+C los para todos.
# Con --fuera abre además un túnel gratis de Cloudflare para usarla desde fuera de casa.
cd "$(dirname "$0")"

source ~/.nvm/nvm.sh
nvm use 22 >/dev/null

pids=()
trap 'kill "${pids[@]}" 2>/dev/null; exit' INT TERM

if ! curl -s http://localhost:11434 >/dev/null; then
  ollama serve >/dev/null 2>&1 &
  pids+=($!)
fi

# Varios procesos para que una foto leyéndose no bloquee al resto de peticiones.
PHP_CLI_SERVER_WORKERS=4 php backend/artisan serve --host=0.0.0.0 --port=8001 >/dev/null 2>&1 &
pids+=($!)

(cd frontend && npx ng serve >/dev/null 2>&1) &
pids+=($!)

ip=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
echo "Arrancando… en unos segundos:"
echo "  En el Mac:    http://localhost:4300"
echo "  En el iPhone: http://${ip}:4300  (misma wifi)"

if [ "$1" = "--fuera" ]; then
  log=$(mktemp)
  cloudflared tunnel --no-autoupdate --url http://localhost:4300 >"$log" 2>&1 &
  pids+=($!)
  url=""
  for _ in $(seq 30); do
    url=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$log" | head -1)
    [ -n "$url" ] && break
    sleep 1
  done
  if [ -n "$url" ]; then
    echo "  Desde fuera:  $url"
    echo "  (cambia cada vez que lo arrancas; el Mac tiene que seguir encendido)"
  else
    echo "  No se ha podido abrir el túnel. Mira $log"
  fi
fi

echo "Ctrl+C para pararlo todo."
wait
