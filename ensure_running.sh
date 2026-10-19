#!/usr/bin/env bash
# Idempotent "make sure Natalie's Tarot is up": starts the keepalive loop if it isn't running, then health-checks.
#   ./ensure_running.sh            -> prints OK (exit 0) or what's down (exit 1)
# Safe to run any number of times: it never starts a second keepalive (pid check + the keepalive's own flock),
# and the keepalive never starts a second ngrok.
set -u
APP=/workspace/tarot-app
RUN=/tmp/tarot-public
mkdir -p "$RUN"
# Tailscale Funnel (steady phone link https://<tailnet-host>) - start daemon after a box restart
if ! pgrep -x tailscaled >/dev/null; then sudo mkdir -p /run/tailscale; (sudo nohup tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/run/tailscale/tailscaled.sock >> /tmp/tailscaled.log 2>&1 &); sleep 5; sudo tailscale funnel --bg 8091 >/dev/null 2>&1; echo "started tailscaled"; fi

loop_pid() {
  local pid; pid=$(cat "$RUN/keepalive.pid" 2>/dev/null)
  if [[ -n $pid ]] && kill -0 "$pid" 2>/dev/null && grep -q public_keepalive.sh "/proc/$pid/cmdline" 2>/dev/null; then
    echo "$pid"; return 0
  fi
  return 1
}

started=0
if pid=$(loop_pid); then
  echo "keepalive already running (pid $pid)"
else
  echo "keepalive not running -> starting it"
  (cd "$APP" && nohup setsid ./public_keepalive.sh >> "$RUN/keepalive.log" 2>&1 < /dev/null &)
  started=1
  sleep 2
  pid=$(loop_pid) || { echo "WARN: keepalive did not start (lock held?) - see $RUN/keepalive.log"; tail -3 "$RUN/keepalive.log"; }
fi

code() { curl -s -o /dev/null -m "${2:-10}" -H 'ngrok-skip-browser-warning: 1' -w '%{http_code}' "$1" 2>/dev/null; }
PUBLIC=$(head -1 "$APP/data/public-url.txt" 2>/dev/null)

# after a fresh start give the app/gate/tunnel up to ~60 s to come up
tries=1; (( started )) && tries=12
for ((i=1; i<=tries; i++)); do
  down=()
  [[ $(code http://127.0.0.1:8090/ 5) == 200 ]]       || down+=("app :8090")
  [[ $(code http://127.0.0.1:8091/login 5) == 200 ]]  || down+=("password gate :8091")
  if [[ -z $PUBLIC ]]; then down+=("public URL unknown (data/public-url.txt empty)")
  else [[ $(code "$PUBLIC/login" 15) == 200 ]]         || down+=("public link $PUBLIC/login"); fi
  (( ${#down[@]} == 0 )) && break
  (( i < tries )) && sleep 5
done

if (( ${#down[@]} == 0 )); then
  echo "OK: app :8090, gate :8091 and $PUBLIC are up"
  exit 0
fi
printf 'DOWN: %s\n' "${down[@]}"
echo "logs: $RUN/keepalive.log $RUN/tunnel.log /tmp/tarot-app.log /tmp/tarot-proxy.log"
exit 1
