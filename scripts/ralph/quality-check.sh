#!/usr/bin/env bash
# Quality gate for ralph: typecheck + build inside site/
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT/site"

echo "▶ typecheck"
npx tsc --noEmit

echo "▶ build"
npm run build

echo "✓ quality checks passed"
