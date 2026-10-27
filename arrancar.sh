#!/bin/bash
# Arranca Ollama, el backend y el frontend. Ctrl+C los para todos.
cd "$(dirname "$0")"

source ~/.nvm/nvm.sh
nvm use 22 >/dev/null

pids=()
trap 'kill "${pids[@]}" 2>/dev/null; exit' INT TERM

if ! curl -s http://localhost:11434 >/dev/null; then
  ollama serve >/dev/null 2>&1 &
  pids+=($!)
fi

php backend/artisan serve --host=0.0.0.0 --port=8001 >/dev/null 2>&1 &
pids+=($!)

(cd frontend && npx ng serve >/dev/null 2>&1) &
pids+=($!)

ip=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
echo "Arrancando… en unos segundos:"
echo "  En el Mac:    http://localhost:4300"
echo "  En el iPhone: http://${ip}:4300  (misma wifi)"
echo "Ctrl+C para pararlo todo."
wait
