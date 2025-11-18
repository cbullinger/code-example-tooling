# Quick Start: Test Server Deployment

**Goal**: Deploy a test HTTP server to verify Kubernetes secrets are working before running the cron job.

## Why?

Similar to the Flask app in the Kanopy tutorial, this test server:
- Runs continuously on port 8080 (instead of running once like a cron job)
- Has a `/secrets` endpoint to verify environment variables are loaded
- Lets you debug the setup before deploying the actual cron job

## Quick Steps

### 1. Switch to Test Mode
```bash
cp .drone.yml .drone.yml.backup
cp .drone.test.yml .drone.yml
```

### 2. Deploy
```bash
git add .
git commit -m "Deploy test server"
git push origin main
```

### 3. Wait for Drone Pipeline
Watch your Drone UI for the build to complete.

### 4. Check the Secrets

**If you have kubectl access:**
```bash
kubectl port-forward -n docs deployment/github-metrics-test 8080:8080
# Then visit: http://localhost:8080/secrets
```

**If you DON'T have kubectl access:**

Ask your DevOps team to run:
```bash
POD=$(kubectl get pods -n docs -l app=github-metrics-test -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n docs $POD -- wget -qO- http://localhost:8080/secrets
```

### 5. Verify Output

You should see:
```json
{
  "environment": {
    "ATLAS_CONNECTION_STRING": {
      "exists": true,
      "preview": "mongodb+srv://cory:m..."
    },
    "GITHUB_TOKEN": {
      "exists": true,
      "preview": "ghp_W2wUDR..."
    }
  }
}
```

✅ If both show `"exists": true` → **Secrets are working!**

❌ If either shows `"exists": false` → **Secrets not loaded** (see troubleshooting in TESTING.md)

### 6. Switch Back to CronJob

Once verified:
```bash
cp .drone.yml.backup .drone.yml
git add .drone.yml
git commit -m "Switch to CronJob - secrets verified"
git push origin main
```

## What Was Created?

- `github-metrics/test-server.js` - Simple HTTP server with `/health` and `/secrets` endpoints
- `github-metrics/Dockerfile.test` - Dockerfile that runs the test server
- `charts/test-server/` - Helm chart for deploying as a Deployment (not CronJob)
- `.drone.test.yml` - Drone pipeline that uses the test setup
- `TESTING.md` - Detailed testing guide

## Files Overview

```
.
├── .drone.yml              # Original (CronJob deployment)
├── .drone.yml.backup       # Backup of original
├── .drone.test.yml         # Test mode (HTTP server deployment)
├── github-metrics/
│   ├── Dockerfile          # Original (runs cron job once)
│   ├── Dockerfile.test     # Test (runs HTTP server)
│   └── test-server.js      # HTTP server code
└── charts/
    ├── tool-cron/          # Original (CronJob chart)
    └── test-server/        # Test (Deployment chart)
```

## Next Steps

1. **First time setup**: Use test mode to verify secrets
2. **Secrets verified**: Switch to CronJob mode
3. **Future changes**: Use test mode again if you need to debug

See **TESTING.md** for detailed instructions and troubleshooting!

