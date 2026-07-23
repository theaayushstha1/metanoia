#!/usr/bin/env bash
# Tear down ALL Metanoia GCP resources so nothing keeps billing.
# Cloud SQL is the only meaningful ongoing cost; delete it first if in a hurry.
#   bash scripts/cleanup-gcp.sh
set -uo pipefail
P=metanoia-agent-17047
A=comeoverwhenyouaresoberr@gmail.com
SA="metanoia-run@${P}.iam.gserviceaccount.com"

echo "== deleting Cloud SQL instance metanoia-db (the main cost) =="
gcloud sql instances delete metanoia-db --project="$P" --account="$A" --quiet

echo "== deleting Cloud Run service metanoia =="
gcloud run services delete metanoia --region=us-east1 --project="$P" --account="$A" --quiet

echo "== deleting webhook relay function =="
gcloud functions delete metanoia-webhook-relay --gen2 --region=us-east1 --project="$P" --account="$A" --quiet

echo "== deleting Artifact Registry repo metanoia (built images) =="
gcloud artifacts repositories delete metanoia --location=us-east1 --project="$P" --account="$A" --quiet

echo "== deleting Secret Manager secrets =="
for s in hyperswitch-secret-key hyperswitch-hash-key cloud-sql-password; do
  gcloud secrets delete "$s" --project="$P" --account="$A" --quiet
done

echo "== deleting runtime service account =="
gcloud iam service-accounts delete "$SA" --project="$P" --account="$A" --quiet

echo "CLEANUP_DONE — verify nothing remains:"
echo "  gcloud sql instances list --project=$P --account=$A"
echo "  gcloud run services list --project=$P --account=$A"
echo "The Vercel project metanoia-webhook-relay is separate; remove it with:"
echo "  vercel project rm metanoia-webhook-relay --yes"
