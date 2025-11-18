# Testing Guide: Verify Secrets in Kubernetes

This guide helps you verify that Kubernetes secrets are properly injected into your pods before deploying the actual cron job.

## Overview

Instead of deploying a CronJob that runs once a day, we'll temporarily deploy an HTTP server that:
- Runs continuously on port 8080
- Has endpoints to check if secrets are loaded
- Allows you to verify the setup before switching to the cron job

## Step 1: Switch to Test Mode

### Backup the original Drone config
```bash
cp .drone.yml .drone.yml.backup
```

### Use the test pipeline
```bash
cp .drone.test.yml .drone.yml
```

## Step 2: Deploy the Test Server

### Commit and push
```bash
git add .
git commit -m "Deploy test server to verify secrets"
git push origin main
```

### Monitor the Drone build
1. Go to your Drone UI
2. Watch the pipeline execute
3. Wait for both steps to complete:
   - ✅ `publish` - Builds and pushes the test Docker image
   - ✅ `deploy-staging` - Deploys the test server to Kubernetes

## Step 3: Access the Test Server

Once deployed, you need to access the test server. There are several ways:

### Option A: Port Forward (If you have kubectl access)

```bash
# Forward port 8080 from the pod to your local machine
kubectl port-forward -n docs deployment/github-metrics-test 8080:8080

# Then visit in your browser:
# http://localhost:8080
# http://localhost:8080/secrets
```

### Option B: Ask DevOps to Check

If you don't have kubectl access, ask your DevOps team to run:

```bash
# Get the pod name
kubectl get pods -n docs -l app=github-metrics-test

# Check the logs
kubectl logs -n docs -l app=github-metrics-test

# Port forward and check the /secrets endpoint
kubectl port-forward -n docs deployment/github-metrics-test 8080:8080
curl http://localhost:8080/secrets
```

### Option C: Exec into the Pod

```bash
# Get the pod name
POD=$(kubectl get pods -n docs -l app=github-metrics-test -o jsonpath='{.items[0].metadata.name}')

# Exec into the pod and curl the endpoint
kubectl exec -n docs $POD -- wget -qO- http://localhost:8080/secrets
```

## Step 4: Verify Secrets

The `/secrets` endpoint should return JSON like this:

```json
{
  "timestamp": "2025-11-18T00:00:00.000Z",
  "environment": {
    "ATLAS_CONNECTION_STRING": {
      "exists": true,
      "length": 123,
      "preview": "mongodb+srv://cory:m..."
    },
    "GITHUB_TOKEN": {
      "exists": true,
      "length": 40,
      "preview": "ghp_W2wUDR..."
    }
  },
  "allEnvVars": [
    "ATLAS_CONNECTION_STRING",
    "GITHUB_TOKEN",
    "HOME",
    "HOSTNAME",
    ...
  ]
}
```

### ✅ Success Indicators

- Both `ATLAS_CONNECTION_STRING` and `GITHUB_TOKEN` show `"exists": true`
- The `preview` values match the beginning of your actual secrets
- The `length` values are reasonable (not 0)

### ❌ Failure Indicators

- Either secret shows `"exists": false`
- Error message: `"Environment variable not set"`
- Empty `allEnvVars` array

## Step 5: Troubleshooting

### If secrets are NOT loaded:

1. **Check the Secret exists in Kubernetes:**
   ```bash
   kubectl get secret github-metrics-secrets -n docs
   kubectl describe secret github-metrics-secrets -n docs
   ```

2. **Check the Deployment references the correct secret:**
   ```bash
   kubectl get deployment github-metrics-test -n docs -o yaml | grep -A 5 envFrom
   ```

3. **Check pod events for errors:**
   ```bash
   kubectl describe pod -n docs -l app=github-metrics-test
   ```

4. **Common issues:**
   - Secret doesn't exist → Ask DevOps to create it
   - Secret name mismatch → Check `secretsRef` in values
   - Wrong namespace → Verify you're in the `docs` namespace

## Step 6: Switch Back to CronJob

Once you've verified the secrets are working:

### Restore the original Drone config
```bash
cp .drone.yml.backup .drone.yml
```

### Deploy the actual cron job
```bash
git add .drone.yml
git commit -m "Switch back to CronJob - secrets verified"
git push origin main
```

### Clean up the test deployment
```bash
# Ask DevOps to delete the test deployment, or if you have access:
kubectl delete deployment github-metrics-test -n docs
kubectl delete service github-metrics-test -n docs
```

## Local Testing (Optional)

You can also test the server locally before deploying:

```bash
# Set environment variables
export ATLAS_CONNECTION_STRING="your-atlas-connection-string"
export GITHUB_TOKEN="your-github-token"

# Run the test server
cd github-metrics
node test-server.js

# Visit http://localhost:8080/secrets
```

## Summary

This testing approach lets you:
- ✅ Verify secrets are properly injected before running the cron job
- ✅ Debug issues without waiting for the daily cron schedule
- ✅ Confirm the Kubernetes setup is correct
- ✅ Test the deployment pipeline end-to-end

Once verified, switch back to the CronJob configuration and you're good to go! 🚀

