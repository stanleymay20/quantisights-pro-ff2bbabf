#!/bin/bash
set -e

# Production deployment script for Quantivis
# Usage: ./deploy.sh [staging|production] [version]

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
  echo "❌ Invalid environment. Use 'staging' or 'production'"
  exit 1
fi

echo "🚀 Deploying Quantivis ($VERSION) to $ENVIRONMENT..."

# 1. Pre-deployment checks
echo "📋 Running pre-deployment checks..."

if [ ! -f ".env.${ENVIRONMENT}" ]; then
  echo "❌ Missing .env.${ENVIRONMENT} file"
  exit 1
fi

if ! command -v docker &> /dev/null; then
  echo "❌ Docker not installed"
  exit 1
fi

# 2. Load environment
echo "📝 Loading environment..."
export $(cat ".env.${ENVIRONMENT}" | xargs)

# 3. Run tests
echo "🧪 Running critical path tests..."
bun test -- src/test/critical-path.test.ts
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Aborting deployment."
  exit 1
fi

# 4. Build Docker image
echo "🔨 Building Docker image..."
docker build -f Dockerfile.prod -t quantivis:${VERSION} .
if [ $? -ne 0 ]; then
  echo "❌ Build failed"
  exit 1
fi

# 5. Tag for registry
echo "🏷️  Tagging image..."
docker tag quantivis:${VERSION} quantivis-registry.azurecr.io/quantivis:${VERSION}
docker tag quantivis:${VERSION} quantivis-registry.azurecr.io/quantivis:latest

# 6. Push to registry
echo "📤 Pushing to container registry..."
docker push quantivis-registry.azurecr.io/quantivis:${VERSION}
docker push quantivis-registry.azurecr.io/quantivis:latest

# 7. Create backup (pre-deployment)
if [ "$ENVIRONMENT" = "production" ]; then
  echo "💾 Creating backup..."
  ./scripts/backup-database.sh "$ENVIRONMENT"
fi

# 8. Update or create deployment
echo "⚡ Updating deployment in Kubernetes..."
kubectl set image deployment/quantivis-${ENVIRONMENT} \
  quantivis=quantivis-registry.azurecr.io/quantivis:${VERSION} \
  -n quantivis-${ENVIRONMENT}

# 9. Wait for rollout
echo "⏳ Waiting for deployment to complete..."
kubectl rollout status deployment/quantivis-${ENVIRONMENT} \
  -n quantivis-${ENVIRONMENT} \
  --timeout=5m

if [ $? -ne 0 ]; then
  echo "❌ Deployment rollout failed. Check status with:"
  echo "   kubectl rollout history deployment/quantivis-${ENVIRONMENT} -n quantivis-${ENVIRONMENT}"
  
  # Auto-rollback
  if [ "$ENVIRONMENT" = "production" ]; then
    echo "🔄 Auto-rolling back..."
    kubectl rollout undo deployment/quantivis-${ENVIRONMENT} -n quantivis-${ENVIRONMENT}
  fi
  exit 1
fi

# 10. Verify deployment
echo "🔍 Verifying deployment..."
REPLICAS=$(kubectl get deployment quantivis-${ENVIRONMENT} -n quantivis-${ENVIRONMENT} \
  -o jsonpath='{.status.readyReplicas}')
DESIRED=$(kubectl get deployment quantivis-${ENVIRONMENT} -n quantivis-${ENVIRONMENT} \
  -o jsonpath='{.spec.replicas}')

if [ "$REPLICAS" != "$DESIRED" ]; then
  echo "❌ Deployment verification failed: $REPLICAS/$DESIRED replicas ready"
  exit 1
fi

# 11. Health check
echo "🏥 Running health checks..."
ENDPOINT=$(kubectl get ingress quantivis-${ENVIRONMENT} -n quantivis-${ENVIRONMENT} \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

sleep 5  # Wait for load balancer

for i in {1..5}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://${ENDPOINT}/health)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Health check passed"
    break
  fi
  if [ $i -lt 5 ]; then
    echo "⏳ Health check attempt $i/5... (HTTP $HTTP_CODE)"
    sleep 10
  else
    echo "❌ Health check failed after 5 attempts"
    exit 1
  fi
done

# 12. Notify monitoring
echo "📊 Notifying monitoring systems..."
curl -X POST https://api.sentry.io/api/0/organizations/quantivis/releases/ \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"version\": \"${VERSION}\",
    \"projects\": [\"quantivis\"],
    \"dateReleased\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }"

echo "✅ Deployment to $ENVIRONMENT complete!"
echo "📍 Endpoint: https://${ENDPOINT}"
echo "📊 Monitoring: https://sentry.io/organizations/quantivis"
echo "📋 Logs: kubectl logs -f deployment/quantivis-${ENVIRONMENT} -n quantivis-${ENVIRONMENT}"
