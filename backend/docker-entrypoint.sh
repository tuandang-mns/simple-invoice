#!/bin/sh
# Container start: apply migrations → seed (idempotent) → start API.
# In a real pipeline, migrations run as a separate one-off job before rollout (see docs/ARCHITECTURE.md §9).
set -e

echo "▶ applying database migrations"
npx prisma migrate deploy

echo "▶ seeding (idempotent)"
node dist/database/seed/seed.js

echo "▶ starting API"
exec node dist/main.js
