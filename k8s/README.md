# Kubernetes Manifests for GitHub Metrics Cron Job

This directory contains Kubernetes manifests for deploying the `github-metrics` cron job to Kanopy.

## Files

- **`service-account.yaml`** - ServiceAccount for the cron job pods
- **`github-metrics-config.yaml`** - ConfigMap for non-sensitive configuration
- **`github-metrics-secret.yaml`** - Secret for sensitive credentials (NEVER commit with real values!)

## Quick Start

### 1. Edit the Secret

**IMPORTANT**: Before applying, edit `github-metrics-secret.yaml` and replace the placeholder values:

```yaml
stringData:
  ATLAS_CONNECTION_STRING: "mongodb+srv://user:pass@cluster.mongodb.net/database"
  GITHUB_TOKEN: "ghp_your_actual_token_here"
```

### 2. Apply to Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Or apply individually
kubectl apply -f k8s/service-account.yaml
kubectl apply -f k8s/github-metrics-config.yaml
kubectl apply -f k8s/github-metrics-secret.yaml
```

### 3. Verify

```bash
kubectl get serviceaccount tool-jobs-sa -n docs
kubectl get configmap github-metrics-config -n docs
kubectl get secret github-metrics-secrets -n docs
```

## Security Notes

⚠️ **NEVER commit real credentials to Git!**

The `.gitignore` file is configured to ignore `*-secret.yaml` files to prevent accidental commits.

### Alternative: Create Secret Directly

Instead of editing the YAML file, you can create the secret directly:

```bash
kubectl create secret generic github-metrics-secrets \
  --namespace=docs \
  --from-literal=ATLAS_CONNECTION_STRING='your-connection-string' \
  --from-literal=GITHUB_TOKEN='your-github-token'
```

## Updating Secrets

To update the secret after it's been created:

```bash
# Edit interactively
kubectl edit secret github-metrics-secrets -n docs

# Or delete and recreate
kubectl delete secret github-metrics-secrets -n docs
kubectl create secret generic github-metrics-secrets \
  --namespace=docs \
  --from-literal=ATLAS_CONNECTION_STRING='new-value' \
  --from-literal=GITHUB_TOKEN='new-value'
```

## See Also

- [KANOPY_DEPLOYMENT.md](../KANOPY_DEPLOYMENT.md) - Complete deployment guide
- [charts/tool-cron/](../charts/tool-cron/) - Helm chart for the cron job

