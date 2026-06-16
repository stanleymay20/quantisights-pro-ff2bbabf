#!/bin/bash
# Deploy all Quantivis enterprise edge functions to Supabase
# Run from repo root: bash scripts/deploy-edge-functions.sh
#
# Prerequisites:
#   npm install -g supabase
#   supabase login
#   supabase link --project-ref itpwpnwzzitkelffttyx

set -e
PROJECT="itpwpnwzzitkelffttyx"
echo "Deploying edge functions to $PROJECT..."

for fn in \
  connector-credential-store \
  connector-pull \
  connector-netsuite-pull \
  connector-dynamics-pull \
  connector-sheets-pull \
  connector-salesforce-pull \
  connector-hubspot-pull \
  connector-sap-pull \
  connector-scheduler \
  morning-brief \
  executive-brief-generator \
  auth-rate-limiter; do
  echo "  → $fn"
  supabase functions deploy $fn --project-ref $PROJECT
done

echo ""
echo "Done. Now push DB migration:"
echo "  supabase db push --project-ref $PROJECT"
