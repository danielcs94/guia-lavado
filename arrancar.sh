#!/bin/bash
# Arranca la app y el intermediario en local para programar. Ctrl+C los para.
# (La versión de verdad está en GitHub Pages y no necesita el Mac.)
cd "$(dirname "$0")"

source ~/.nvm/nvm.sh
nvm use 22 >/dev/null

if [ ! -f lector/.dev.vars ]; then
  echo "Falta lector/.dev.vars: cópialo de lector/.dev.vars.example y pon tu clave y un código."
  exit 1
fi

pids=()
trap 'kill "${pids[@]}" 2>/dev/null; exit' INT TERM

(cd lector && npm run dev >/dev/null 2>&1) &
pids+=($!)

(cd frontend && npx ng serve >/dev/null 2>&1) &
pids+=($!)

ip=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
echo "Arrancando… en unos segundos:"
echo "  En el Mac:    http://localhost:4300"
echo "  En el iPhone: http://${ip}:4300  (misma wifi)"
echo "Ctrl+C para pararlo todo."
wait
