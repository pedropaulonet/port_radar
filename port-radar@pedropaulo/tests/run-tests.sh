#!/usr/bin/env bash
set -euo pipefail
project_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
cd -- "$project_root"
for test in port-radar@pedropaulo/tests/*-tests.js; do
    cjs "$test"
done
bash -n install.sh
bash -n port-radar@pedropaulo/tests/run-tests.sh
for catalog in port-radar@pedropaulo/po/*.po; do
    msgfmt --check --check-format "$catalog" -o /dev/null
done
printf '%s\n' 'All tests, shell syntax and translation checks passed.'
