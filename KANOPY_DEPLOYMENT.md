# Kanopy Deployment Guide for GitHub Metrics Cron Job

This guide walks you through deploying the `github-metrics` tool as a Kubernetes CronJob using Kanopy, Drone CI, and Helm.

## Overview

- **Tool**: `github-metrics` - Collects GitHub engagement metrics and stores them in MongoDB Atlas
- **Schedule**: Runs daily at 2:00 AM UTC (`0 2 * * *`)
- **Platform**: Kubernetes via Kanopy (MongoDB's internal K8s platform)
- **CI/CD**: Drone CI with automated build and deployment
- **Container Registry**: AWS ECR (`795250896452.dkr.ecr.us-east-1.amazonaws.com`)

## Prerequisites

1. **Access to Drone CI** - You need access to the Drone UI for this repository
2. **Kubernetes Access** - Access to the `docs` namespace in Kanopy staging cluster
3. **AWS ECR Credentials** - Access keys for pushing images to ECR
4. **GitHub Token** - Personal access token with repo access
5. **MongoDB Atlas** - Connection string for storing metrics

## Step 1: Configure Drone Secrets

You need to add three secrets to your Drone repository settings:

### Access Drone Secrets UI

1. Go to your Drone instance (typically `https://drone.corp.mongodb.com` or similar)
2. Navigate to your repository: `cbullinger/code-example-tooling`
3. Click on **Settings** → **Secrets**

### Add Required Secrets

Add the following secrets:

| Secret Name | Description | How to Get It |
|-------------|-------------|---------------|
| `ecr_access_key` | AWS ECR Access Key ID | Contact your MongoDB DevOps team or AWS admin |
| `ecr_secret_key` | AWS ECR Secret Access Key | Contact your MongoDB DevOps team or AWS admin |
| `staging_kubernetes_token` | Kubernetes service account token for staging | Contact your Kanopy admin or DevOps team |

**Note**: These are typically managed by MongoDB's infrastructure team. You may need to request access through your team's standard process.

## Step 2: Deploy Kubernetes Resources

Before the Drone pipeline can deploy the cron job, you need to create the necessary Kubernetes resources in the `docs` namespace.

### Apply the Kubernetes Manifests

```bash
# Make sure you're connected to the correct Kubernetes cluster
kubectl config current-context

# Create the namespace if it doesn't exist
kubectl create namespace docs --dry-run=client -o yaml | kubectl apply -f -

# Apply the service account
kubectl apply -f k8s/service-account.yaml

# Create the ConfigMap (edit first if you need custom config)
kubectl apply -f k8s/github-metrics-config.yaml

# Create the Secret (IMPORTANT: Edit this file first with your actual credentials!)
# DO NOT commit the file with real credentials!
kubectl apply -f k8s/github-metrics-secret.yaml
```

### Update the Secret with Real Credentials

**Before applying the secret**, edit `k8s/github-metrics-secret.yaml` and replace:

1. `REPLACE_WITH_YOUR_ATLAS_CONNECTION_STRING` with your actual MongoDB Atlas connection string
2. `REPLACE_WITH_YOUR_GITHUB_TOKEN` with your GitHub personal access token

**Security Best Practice**: 
- Never commit real credentials to Git
- Consider using a secret management tool like Sealed Secrets or External Secrets Operator
- Add `k8s/github-metrics-secret.yaml` to `.gitignore` after editing

Alternatively, create the secret directly without a file:

```bash
kubectl create secret generic github-metrics-secrets \
  --namespace=docs \
  --from-literal=ATLAS_CONNECTION_STRING='mongodb+srv://user:pass@cluster.mongodb.net/db' \
  --from-literal=GITHUB_TOKEN='ghp_your_token_here'
```

### Verify Resources

```bash
# Check that all resources were created
kubectl get serviceaccount tool-jobs-sa -n docs
kubectl get configmap github-metrics-config -n docs
kubectl get secret github-metrics-secrets -n docs
```

## Step 3: Trigger the Drone Pipeline

Once the secrets are configured in Drone and the Kubernetes resources are created:

1. **Push to main branch**:
   ```bash
   git add .
   git commit -m "Configure Kanopy deployment"
   git push origin main
   ```

2. **Monitor the build**:
   - Go to your Drone UI
   - Watch the pipeline execute
   - The pipeline will:
     - Build the Docker image using Kaniko
     - Push it to ECR with tags `git-<commit-sha>` and `latest`
     - Deploy the Helm chart to the `docs` namespace

## Step 4: Verify the Deployment

After the Drone pipeline completes successfully:

```bash
# Check if the CronJob was created
kubectl get cronjob github-metrics -n docs

# View the CronJob details
kubectl describe cronjob github-metrics -n docs

# Check the schedule
kubectl get cronjob github-metrics -n docs -o jsonpath='{.spec.schedule}'

# Manually trigger a job to test (optional)
kubectl create job --from=cronjob/github-metrics github-metrics-manual-test -n docs

# Watch the job
kubectl get jobs -n docs -w

# View logs from the job
kubectl logs -n docs -l job-name=github-metrics-manual-test --follow
```

## Step 5: Monitor and Maintain

### View Logs

```bash
# Get recent jobs
kubectl get jobs -n docs -l app.kubernetes.io/name=tool-cron

# View logs from the most recent job
kubectl logs -n docs -l app.kubernetes.io/name=tool-cron --tail=100
```

### Update the Schedule

To change the cron schedule, edit `.drone.yml`:

```yaml
values: >
  schedule=0 3 * * *,  # Change to 3 AM UTC
```

Then commit and push to trigger a new deployment.

### Update Environment Variables

- **Secrets**: Update the Kubernetes secret:
  ```bash
  kubectl edit secret github-metrics-secrets -n docs
  ```

- **Config**: Update the ConfigMap:
  ```bash
  kubectl edit configmap github-metrics-config -n docs
  ```

After updating, the next scheduled run will use the new values.

## Troubleshooting

### Pipeline Fails at "publish" Step

**Issue**: Cannot push to ECR

**Solutions**:
- Verify ECR credentials are correct in Drone secrets
- Check that the ECR repository exists or `create_repository: true` is set
- Ensure your AWS credentials have ECR push permissions

### Pipeline Fails at "deploy-staging" Step

**Issue**: Cannot deploy to Kubernetes

**Solutions**:
- Verify `staging_kubernetes_token` secret is correct
- Check that you have permissions in the `docs` namespace
- Ensure the Kubernetes resources (Secret, ConfigMap, ServiceAccount) exist

### CronJob Created but Jobs Fail

**Issue**: Jobs start but fail to complete

**Solutions**:
```bash
# Check job logs
kubectl logs -n docs -l app.kubernetes.io/name=tool-cron --tail=100

# Common issues:
# 1. Missing environment variables - check the secret and configmap
# 2. Invalid MongoDB connection string - test it separately
# 3. Invalid GitHub token - verify token has correct scopes
# 4. Application errors - check the github-metrics code
```

### Check CronJob Status

```bash
# View CronJob details
kubectl describe cronjob github-metrics -n docs

# Check recent jobs
kubectl get jobs -n docs --sort-by=.metadata.creationTimestamp

# View pod status
kubectl get pods -n docs -l app.kubernetes.io/name=tool-cron
```

## Architecture

```
┌─────────────────┐
│   GitHub Repo   │
│  (main branch)  │
└────────┬────────┘
         │
         │ Push triggers
         ▼
┌─────────────────┐
│   Drone CI      │
│                 │
│  1. Build image │──────► AWS ECR
│  2. Push to ECR │        (Container Registry)
│  3. Deploy Helm │
└────────┬────────┘
         │
         │ Deploys to
         ▼
┌─────────────────────────────────┐
│  Kubernetes (Kanopy Staging)    │
│  Namespace: docs                │
│                                 │
│  ┌───────────────────────────┐ │
│  │  CronJob: github-metrics  │ │
│  │  Schedule: 0 2 * * *      │ │
│  │                           │ │
│  │  Runs daily at 2 AM UTC   │ │
│  └───────────┬───────────────┘ │
│              │                  │
│              │ Creates          │
│              ▼                  │
│  ┌───────────────────────────┐ │
│  │  Job (ephemeral)          │ │
│  │  ┌─────────────────────┐  │ │
│  │  │  Pod                │  │ │
│  │  │  - Runs script      │  │ │
│  │  │  - Collects metrics │  │ │
│  │  │  - Writes to Atlas  │  │ │
│  │  └─────────────────────┘  │ │
│  └───────────────────────────┘ │
└─────────────────────────────────┘
         │
         │ Writes metrics to
         ▼
┌─────────────────┐
│ MongoDB Atlas   │
│ (Metrics DB)    │
└─────────────────┘
```

## Next Steps

- [ ] Configure Drone secrets
- [ ] Create Kubernetes resources in `docs` namespace
- [ ] Update secret with real credentials
- [ ] Push to main branch to trigger deployment
- [ ] Verify CronJob is created and scheduled
- [ ] Monitor first scheduled run
- [ ] Set up alerts for job failures (optional)

## Additional Resources

- [Drone CI Documentation](https://docs.drone.io)
- [Kubernetes CronJob Documentation](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
- [Helm Documentation](https://helm.sh/docs/)
- MongoDB Kanopy internal documentation (contact your DevOps team)

