#!/usr/bin/env bash
set -euo pipefail

generated_dir=".generated/policy"
mkdir -p "$generated_dir"
conftest verify --policy policy/devcontainer
node scripts/node/bin/build-policy-input.js "$generated_dir/devcontainer.json" \
  .devcontainer/devcontainer.json .devcontainer/devcontainer-lock.json

conftest test --policy policy/devcontainer "$generated_dir/devcontainer.json"
conftest test --policy policy/workflows .github/workflows/*.yml
conftest test --policy policy/devcontainer policy/fixtures/devcontainer/valid.json
conftest test --policy policy/workflows policy/fixtures/workflows/valid.yml

if conftest test --policy policy/devcontainer policy/fixtures/devcontainer/invalid.json > /dev/null 2>&1; then
  echo "invalid Dev Container policy fixture unexpectedly passed" >&2
  exit 1
fi
if conftest test --policy policy/workflows policy/fixtures/workflows/invalid.yml > /dev/null 2>&1; then
  echo "invalid workflow policy fixture unexpectedly passed" >&2
  exit 1
fi
