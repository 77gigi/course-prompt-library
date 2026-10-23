#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if curl -fsS "http://127.0.0.1:8765/index.html" >/dev/null 2>&1; then
  open "http://127.0.0.1:8765/index.html"
  exit 0
fi
python3 -m http.server 8765 --bind 127.0.0.1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null' EXIT
sleep 1
open "http://127.0.0.1:8765/index.html"
wait "$server_pid"
