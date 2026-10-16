#!/usr/bin/env bash
# 4 bounded batches of 50 checkpointed randomized journeys = exactly 200.
# Each batch: (name, seed, viewport) triple; every journey appended to a JSONL
# checkpoint as it finishes. Re-running this script resumes: a batch whose
# checkpoint already holds 50 journeys is skipped, a partial batch continues
# from its last completed journey index (live-suite --resume skips completed runs).
set -uo pipefail
cd "$(dirname "$0")"

BATCHES=(
  "b1 101 desktop"
  "b2 202 mobile"
  "b3 303 desktop"
  "b4 404 mobile"
)

overall=0
for spec in "${BATCHES[@]}"; do
  read -r name seed viewport <<< "$spec"
  ck="results/campaign-200-$name.jsonl"
  out="results/campaign-200-$name.json"
  done_n=0
  if [ -f "$ck" ]; then done_n=$(grep -c . "$ck" 2>/dev/null || echo 0); fi
  if [ "$done_n" -ge 50 ]; then
    echo "[campaign] $name complete ($done_n/50) — skipping"
    continue
  fi
  echo "[campaign] $name starting: $done_n/50 already checkpointed, seed=$seed viewport=$viewport"
  node live-suite.mjs --runs=50 --concurrency=4 --seed="$seed" --viewport="$viewport" \
    --checkpoint="$ck" --resume --out="$out" 2>&1 | tee "results/campaign-200-$name.log"
  rc=${PIPESTATUS[0]}
  if [ "$rc" -ne 0 ]; then
    echo "[campaign] $name exited $rc (failures are recorded; continuing to next batch)"
    overall=1
  fi
done

total=$(cat results/campaign-200-*.jsonl 2>/dev/null | grep -c . || echo 0)
echo "[campaign] all batches attempted; total checkpointed journeys: $total/200"
exit "$overall"
