#!/usr/bin/env bash
# Keeps phone access alive: tarot app (:8090), password gate (:8091) and the public tunnel.
#
#   public_keepalive.sh          loop forever (every $KEEPALIVE_INTERVAL s, default 60); single instance via flock
#   public_keepalive.sh --once   one check/repair pass, then exit
#
# Tunnel choice:
#   * default: Cloudflare quick tunnel (no account). URL is random *.trycloudflare.com and CHANGES whenever
#     cloudflared restarts; the current URL is always written to data/public-url.txt.
#   * stable:  if NGROK_DOMAIN is set (in the environment, or in data/public-tunnel.env, chmod 600) AND ngrok has
#     an authtoken (NGROK_AUTHTOKEN non-empty, or saved in ngrok's own config so `ngrok config check` passes),
#     ngrok is used with that static domain instead (binary auto-downloaded into bin/).
set -u
APP=/workspace/tarot-app
DATA=$APP/data
RUN=/tmp/tarot-public
URL_FILE=$DATA/public-url.txt
INTERVAL=${KEEPALIVE_INTERVAL:-60}
CLOUDFLARED=${CLOUDFLARED:-$APP/bin/cloudflared}
NGROK=${NGROK:-$APP/bin/ngrok}
mkdir -p "$RUN" "$APP/bin"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
# the skip header stops ngrok's free-plan browser-warning page from being served instead of the real page
http_ok() { local c; c=$(curl -s -o /dev/null -m "${2:-8}" -H 'ngrok-skip-browser-warning: 1' -w '%{http_code}' "$1" 2>/dev/null); [[ $c =~ ^[23] ]]; }
listening() { ss -ltn 2>/dev/null | grep -q "[:.]$1 "; }
listener_pid() { ss -ltnp 2>/dev/null | grep "[:.]$1 " | grep -oP 'pid=\K[0-9]+' | head -1; }
count() { local f=$RUN/$1.fails n; n=$(( $(cat "$f" 2>/dev/null || echo 0) + 1 )); echo $n > "$f"; echo $n; }
reset_count() { rm -f "$RUN/$1.fails"; }

tunnel_mode() {
  [[ -f $DATA/public-tunnel.env ]] && . "$DATA/public-tunnel.env"
  if [[ -n ${NGROK_DOMAIN:-} ]] && { [[ -n ${NGROK_AUTHTOKEN:-} ]] || { [[ -x $NGROK ]] && "$NGROK" config check >/dev/null 2>&1; }; }; then
    echo ngrok
  else
    echo cloudflared
  fi
}

write_url() {
  local url=$1
  [[ -z $url ]] && return
  if [[ "$(cat "$URL_FILE" 2>/dev/null)" != "$url" ]]; then
    printf '%s\n' "$url" > "$URL_FILE.tmp" && mv -f "$URL_FILE.tmp" "$URL_FILE"
    log "public URL is now $url (saved to $URL_FILE)"
  fi
}

# ---- 1. tarot app on :8090 (never touched if it is listening) ----
check_app() {
  if http_ok http://127.0.0.1:8090/api/today 5; then reset_count app; return; fi
  if listening 8090; then
    log "WARN: :8090 is listening but not answering (fail #$(count app)); leaving it alone"
    return
  fi
  log "tarot app down -> starting"
  # 9>&- on the whole subshell: the backgrounded "cd && ..." list runs in its own bash that waits on the
  # child, so it must not inherit the flock fd (it would hold the keepalive lock as long as the child lives)
  (cd "$APP" && nohup setsid python3 server.py >> /tmp/tarot-app.log 2>&1 < /dev/null &) 9>&-
  sleep 2
}

# ---- 2. password gate on :8091 ----
check_proxy() {
  if http_ok http://127.0.0.1:8091/login 5; then reset_count proxy; return; fi
  if listening 8091; then
    local n; n=$(count proxy)
    log "WARN: proxy on :8091 not answering (fail #$n)"
    (( n < 3 )) && return
    local pid; pid=$(listener_pid 8091)
    [[ -n $pid ]] && grep -q public_proxy.py /proc/$pid/cmdline 2>/dev/null && kill "$pid" && sleep 1
  fi
  log "proxy down -> starting"
  (cd "$APP" && nohup setsid python3 public_proxy.py >> /tmp/tarot-proxy.log 2>&1 < /dev/null &) 9>&-
  reset_count proxy
  sleep 1
}

# ---- 3. tunnel ----
tunnel_alive() {
  local pid; pid=$(cat "$RUN/tunnel.pid" 2>/dev/null) || return 1
  [[ -n $pid ]] && kill -0 "$pid" 2>/dev/null && grep -qE 'cloudflared|ngrok' /proc/$pid/cmdline 2>/dev/null
}

stop_tunnel() {
  local pid; pid=$(cat "$RUN/tunnel.pid" 2>/dev/null)
  if [[ -n $pid ]] && kill -0 "$pid" 2>/dev/null && grep -qE 'cloudflared|ngrok' /proc/$pid/cmdline 2>/dev/null; then
    log "stopping tunnel pid $pid"; kill "$pid"; sleep 2
  fi
  rm -f "$RUN/tunnel.pid"
}

get_ngrok() {
  [[ -x $NGROK ]] && return 0
  log "downloading ngrok into $APP/bin"
  curl -fsSL https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz | tar -xz -C "$APP/bin" ngrok && chmod +x "$NGROK"
}

start_tunnel() {
  local mode=$1 url=""
  if [[ $mode == ngrok ]]; then
    get_ngrok || { log "ERROR: could not download ngrok"; return 1; }
    log "starting ngrok tunnel on static domain $NGROK_DOMAIN"
    # never hand ngrok an empty NGROK_AUTHTOKEN (it would override the token saved in ngrok's own config)
    local envargs=(-u NGROK_AUTHTOKEN)
    [[ -n ${NGROK_AUTHTOKEN:-} ]] && envargs=("NGROK_AUTHTOKEN=$NGROK_AUTHTOKEN")
    env "${envargs[@]}" nohup setsid "$NGROK" http 127.0.0.1:8091 --url "https://$NGROK_DOMAIN" \
      --log stdout --log-format logfmt > "$RUN/tunnel.log" 2>&1 < /dev/null 9>&- &
    echo $! > "$RUN/tunnel.pid"
    url="https://$NGROK_DOMAIN"
    sleep 5
  else
    [[ -x $CLOUDFLARED ]] || {
      log "downloading cloudflared into $APP/bin"
      curl -fsSL -o "$CLOUDFLARED" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
        && chmod +x "$CLOUDFLARED" || { log "ERROR: could not download cloudflared"; return 1; }
    }
    log "starting Cloudflare quick tunnel (URL will be new)"
    nohup setsid "$CLOUDFLARED" tunnel --no-autoupdate --url http://127.0.0.1:8091 > "$RUN/tunnel.log" 2>&1 < /dev/null 9>&- &
    echo $! > "$RUN/tunnel.pid"
    for _ in $(seq 1 45); do
      url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$RUN/tunnel.log" | head -1)
      [[ -n $url ]] && break
      sleep 1
    done
  fi
  echo "$mode" > "$RUN/tunnel.mode"
  date +%s > "$RUN/tunnel.started"
  reset_count tunnel
  if [[ -n $url ]]; then write_url "$url"; else log "WARN: tunnel started but no URL found yet (see $RUN/tunnel.log)"; fi
}

current_tunnel_url() {
  if [[ $(cat "$RUN/tunnel.mode" 2>/dev/null) == ngrok ]]; then
    [[ -f $DATA/public-tunnel.env ]] && . "$DATA/public-tunnel.env"
    echo "https://${NGROK_DOMAIN:-}"
  else
    grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$RUN/tunnel.log" 2>/dev/null | head -1
  fi
}

check_tunnel() {
  local mode; mode=$(tunnel_mode)
  [[ -f $DATA/public-tunnel.env ]] && . "$DATA/public-tunnel.env"
  if tunnel_alive && [[ $(cat "$RUN/tunnel.mode" 2>/dev/null) != "$mode" ]]; then
    log "tunnel mode changed to $mode"; stop_tunnel
  fi
  if ! tunnel_alive; then start_tunnel "$mode"; return; fi
  local url; url=$(current_tunnel_url)
  write_url "$url"
  # public health check, with a grace period for DNS after a (re)start
  local started; started=$(cat "$RUN/tunnel.started" 2>/dev/null || echo 0)
  (( $(date +%s) - started < 120 )) && return
  if [[ -n $url ]] && http_ok "$url/login" 15; then reset_count tunnel; return; fi
  # one blip is normal (ngrok reconnects its session in ~1 s): re-check after 15 s before counting a failure
  sleep 15
  if [[ -n $url ]] && http_ok "$url/login" 15; then log "public URL blipped, back after retry"; reset_count tunnel; return; fi
  local n api; n=$(count tunnel)
  api=$(curl -s -m 3 http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -c '"public_url"')
  log "WARN: public URL $url not answering (fail #$n, ngrok local API tunnels: ${api:-0})"
  # never two ngroks: warn about any ngrok that is not ours
  local mine; mine=$(cat "$RUN/tunnel.pid" 2>/dev/null)
  for p in $(pgrep -x ngrok); do [[ $p != "$mine" ]] && log "WARN: extra ngrok pid $p (not ours) - killing"; [[ $p != "$mine" ]] && kill "$p"; done
  if (( n >= 5 )); then
    log "tunnel unhealthy for ~5 checks -> restarting it"
    stop_tunnel; start_tunnel "$mode"
  fi
}

pass() { check_app; check_proxy; check_tunnel; }

if [[ ${1:-} == --once ]]; then pass; exit 0; fi

exec 9> "$RUN/keepalive.lock"
if ! flock -n 9; then echo "keepalive already running"; exit 0; fi
echo $$ > "$RUN/keepalive.pid"
log "keepalive loop started (every ${INTERVAL}s, tunnel mode: $(tunnel_mode))"
while true; do
  pass
  sleep "$INTERVAL"
done
