#!/bin/sh
# Runtime verification for the flag-submit + progress slices.
# Builds, starts the server on a throwaway DB, exercises the HTTP surface,
# and reports pass/fail. Exits non-zero if any check fails.
#
# Usage:  sh scripts/verify.sh        (or: npm run verify)
# Env:    PORT=3997  (override the test port)

set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
API_DIR=$(dirname "$SCRIPT_DIR")
cd "$API_DIR" || exit 1

PORT="${PORT:-3997}"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/til-verify.XXXXXX") || exit 1
DB="$WORK/til.db"
LOG="$WORK/server.log"
BASE="http://localhost:$PORT"
SERVER_PID=""

PASS=0
FAIL=0

cleanup() {
    stop_server
    rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

stop_server() {
    if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" 2>/dev/null
        wait "$SERVER_PID" 2>/dev/null
    fi
    SERVER_PID=""
}

start_server() {
    DB_PATH="$DB" PORT="$PORT" node dist/index.js >"$LOG" 2>&1 &
    SERVER_PID=$!
    i=0
    while [ "$i" -lt 50 ]; do
        if curl -s -o /dev/null "$BASE/"; then
            return 0
        fi
        sleep 0.2
        i=$((i + 1))
    done
    echo "server failed to start; log:"
    cat "$LOG"
    return 1
}

check_eq() { # name expected actual
    if [ "$2" = "$3" ]; then
        printf 'ok   %s\n' "$1"
        PASS=$((PASS + 1))
    else
        printf 'FAIL %s\n     expected: %s\n     actual:   %s\n' "$1" "$2" "$3"
        FAIL=$((FAIL + 1))
    fi
}

check_has() { # name needle haystack
    case "$3" in
        *"$2"*)
            printf 'ok   %s\n' "$1"
            PASS=$((PASS + 1))
            ;;
        *)
            printf 'FAIL %s (missing: %s)\n' "$1" "$2"
            FAIL=$((FAIL + 1))
            ;;
    esac
}

check_lacks() { # name needle haystack
    case "$3" in
        *"$2"*)
            printf 'FAIL %s (unexpected: %s)\n' "$1" "$2"
            FAIL=$((FAIL + 1))
            ;;
        *)
            printf 'ok   %s\n' "$1"
            PASS=$((PASS + 1))
            ;;
    esac
}

count() { # needle haystack -> number of occurrences
    printf '%s' "$2" | grep -o "$1" | wc -l | tr -d ' '
}

echo "== build =="
if ! npm run build; then
    echo "build failed"
    exit 1
fi

start_server || exit 1

echo "== fresh state =="
HOME_HTML=$(curl -s "$BASE/")
check_has "fresh: overall 0 / 3" "Points: 0 / 3" "$HOME_HTML"
check_eq "fresh: no solved marks" "0" "$(count '✓ Solved' "$HOME_HTML")"

echo "== flag submit =="
check_has "wrong flag" "Wrong flag, try again" \
    "$(curl -s -X POST -d 'flag=TIL{nope}' "$BASE/challenges/hello-fix/flag")"
check_has "hello correct +1 point" "Correct! +1 point" \
    "$(curl -s -X POST -d 'flag=TIL{h3llo_c0mpiler}' "$BASE/challenges/hello-fix/flag")"
check_has "hello resubmit already solved" "Already solved" \
    "$(curl -s -X POST -d 'flag=TIL{h3llo_c0mpiler}' "$BASE/challenges/hello-fix/flag")"

HOME_HTML=$(curl -s "$BASE/")
check_has "after hello: 1 / 3" "Points: 1 / 3" "$HOME_HTML"
check_eq "after hello: one solved mark" "1" "$(count '✓ Solved' "$HOME_HTML")"
check_has "hello page solved badge" "✓ Solved (+1 pts)" \
    "$(curl -s "$BASE/challenges/hello-fix")"

check_has "sum correct +2 points" "Correct! +2 points" \
    "$(curl -s -X POST -d 'flag=TIL{sum_1_to_10}' "$BASE/challenges/sum-fix/flag")"
check_has "after sum: 3 / 3" "Points: 3 / 3" "$(curl -s "$BASE/")"

echo "== progress api =="
PROGRESS=$(curl -s "$BASE/api/progress")
check_eq "two progress rows" "2" "$(count '"challenge_id"' "$PROGRESS")"
check_has "hello points=1" '"challenge_id":"hello-fix","points":1' "$PROGRESS"
check_has "sum points=2" '"challenge_id":"sum-fix","points":2' "$PROGRESS"
check_has "solved_at is ISO" 'Z"' "$PROGRESS"

echo "== flag never leaks =="
check_lacks "no flag on /" "h3llo_c0mpiler" "$(curl -s "$BASE/")"
check_lacks "no flag on challenge page" "h3llo_c0mpiler" \
    "$(curl -s "$BASE/challenges/hello-fix")"

echo "== view answer =="
PAGE=$(curl -s "$BASE/challenges/hello-fix")
check_lacks "page hides guide" "terminating" "$PAGE"
check_has "page has answer target" 'id="answer"' "$PAGE"
check_has "page has view answer button" 'hx-get="/challenges/hello-fix/answer"' "$PAGE"
ANSWER=$(curl -s "$BASE/challenges/hello-fix/answer")
check_has "answer renders guide" "terminating" "$ANSWER"
check_has "answer wrapped in .answer" 'class="answer"' "$ANSWER"
check_eq "answer status 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/challenges/hello-fix/answer")"
check_has "unknown id message" "This challenge can&#39;t be checked" "$(curl -s "$BASE/challenges/nope/answer")"
check_eq "unknown id status 200" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/challenges/nope/answer")"
PROGRESS_BEFORE=$(curl -s "$BASE/api/progress")
curl -s -o /dev/null "$BASE/challenges/hello-fix/answer"
check_eq "progress unchanged by viewing" "$PROGRESS_BEFORE" "$(curl -s "$BASE/api/progress")"

echo "== orphan progress row tolerated =="
node -e "const D=require('better-sqlite3');const db=new D(process.argv[1]);db.prepare('insert or ignore into progress (challenge_id,points,solved_at) values (?,?,?)').run('ghost',99,new Date().toISOString());db.close();" "$DB"
check_has "orphan: still 3 / 3" "Points: 3 / 3" "$(curl -s "$BASE/")"
check_eq "orphan: page status 200" "200" \
    "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")"

echo "== persistence across restart =="
stop_server
start_server || exit 1
RESTARTED=$(curl -s "$BASE/api/progress")
check_has "restart: hello row survives" '"challenge_id":"hello-fix"' "$RESTARTED"
check_has "restart: sum row survives" '"challenge_id":"sum-fix"' "$RESTARTED"

echo
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ]
