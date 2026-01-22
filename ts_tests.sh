#!/bin/bash
set -euo pipefail

run_tsc() {
  npx --package typescript -- tsc \
    --target es2018 \
    --lib es2018,dom \
    --moduleResolution node \
    --strict \
    --noEmit \
    "$@"
}

echo -n "Running tests ts_tests/*.success.ts"
if ! run_tsc ts_tests/*.success.ts; then
  echo " FAILED"
  exit 1
fi
echo " OK"

for file in ts_tests/*.fail.ts; do
  echo -n "Running test $file ..."
  if run_tsc "$file" &>/dev/null; then
    echo " FAILED (unexpected pass)"
    exit 1
  fi
  echo " OK"
done

echo "All tests passed."
