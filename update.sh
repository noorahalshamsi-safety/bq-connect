#!/usr/bin/env bash
# Pulls the latest version from GitHub. Keeps this Repl's own App Storage link in .replit
# (Replit adds it when the bucket is created) and never touches data/ or backups/.
set -e
cp .replit /tmp/bq-replit.keep
git fetch origin
git reset --hard origin/main
if grep -q '^\[objectStorage\]' /tmp/bq-replit.keep && ! grep -q '^\[objectStorage\]' .replit; then
  printf '\n' >> .replit
  awk '/^\[objectStorage\]/{on=1; print; next} /^\[/{on=0} on' /tmp/bq-replit.keep >> .replit
fi
if grep -q 'defaultBucketID' .replit; then
  echo "App Storage link: OK"
else
  echo "App Storage link: MISSING - open the App Storage tool and link the bucket before you republish"
fi
git log --oneline -1
