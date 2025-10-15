# SAP Cloud Foundry Deployment Guide

This document provides step-by-step instructions to deploy the SSL Certificate Checker application to SAP Cloud Foundry.

## Prerequisites

Before deploying, ensure you have:

1. **SAP BTP Account** - Access to SAP Business Technology Platform with Cloud Foundry environment
2. **CF CLI** - Cloud Foundry Command Line Interface installed
3. **Node.js** - Version 18.0.0 or higher
4. **npm** - Version 8.0.0 or higher

## Installation & Setup

### 1. Install CF CLI

Download and install the CF CLI from: https://docs.cloudfoundry.org/cf-cli/install-go-cli.html

Verify installation:
```bash
cf --version
```

### 2. Login to SAP Cloud Foundry

```bash
# Login to your SAP BTP Cloud Foundry environment
cf login -a https://api.cf.{region}.hana.ondemand.com

# Replace {region} with your actual region (e.g., eu10, us10, ap21)
# Examples:
# cf login -a https://api.cf.eu10.hana.ondemand.com
# cf login -a https://api.cf.us10.hana.ondemand.com
```

Enter your SAP BTP credentials when prompted.

### 3. Target Organization and Space

```bash
# List available organizations
cf orgs

# Target your organization
cf target -o "your-org-name"

# List available spaces
cf spaces

# Target your space (typically 'dev', 'test', or 'prod')
cf target -s "your-space-name"
```

## Deployment

### Option 1: Quick Deployment

```bash
# From the project root directory
npm run cf-push
```

### Option 2: Manual Deployment

```bash
# From the project root directory
cf push -f manifest.yml
```

### Option 3: Custom Deployment with Different App Name

```bash
# Deploy with a custom application name
cf push my-ssl-checker -f manifest.yml
```

## Manifest Configuration

The `manifest.yml` file contains the deployment configuration:

```yaml
---
applications:
- name: ssl-certificate-checker
  memory: 512M
  disk_quota: 1G
  instances: 1
  buildpacks:
    - nodejs_buildpack
  stack: cflinuxfs4
  services: []
  env:
    NODE_ENV: production
  routes:
    - route: ssl-certificate-checker-${random-word}.cfapps.sap.hana.ondemand.com
  health-check-type: http
  health-check-http-endpoint: /health
  timeout: 180
```

### Configuration Options

- **memory**: Application memory allocation (512MB)
- **disk_quota**: Disk space allocation (1GB) 
- **instances**: Number of application instances (1)
- **buildpack**: Uses Node.js buildpack for deployment
- **stack**: Linux file system stack
- **health-check**: HTTP health check on `/health` endpoint
- **timeout**: Startup timeout (3 minutes)

## Custom Configuration

### 1. Change Application Name

Edit `manifest.yml`:
```yaml
- name: your-custom-app-name
```

### 2. Adjust Resources

For higher traffic applications:
```yaml
- memory: 1G
  disk_quota: 2G
  instances: 2
```

### 3. Custom Route

Specify a custom route:
```yaml
routes:
  - route: my-ssl-checker.cfapps.sap.hana.ondemand.com
```

### 4. Environment Variables

Add custom environment variables:
```yaml
env:
  NODE_ENV: production
  CUSTOM_VAR: "value"
```

## Post-Deployment

### 1. Check Application Status

```bash
# Check if application is running
cf apps

# View application details
cf app ssl-certificate-checker

# View application logs
cf logs ssl-certificate-checker --recent
```

### 2. Test Health Endpoint

```bash
# Test the health check endpoint
curl https://your-app-route.cfapps.sap.hana.ondemand.com/health
```

Expected response:
```json
{
  "status": "UP",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "SSL Certificate Checker",
  "version": "1.0.0"
}
```

### 3. Access Application

Open your browser and navigate to:
```
https://your-app-route.cfapps.sap.hana.ondemand.com
```

## Monitoring & Maintenance

### View Logs

```bash
# Stream live logs
cf logs ssl-certificate-checker

# View recent logs
cf logs ssl-certificate-checker --recent
```

### Scale Application

```bash
# Scale instances
cf scale ssl-certificate-checker -i 3

# Scale memory
cf scale ssl-certificate-checker -m 1G
```

### Restart Application

```bash
cf restart ssl-certificate-checker
```

### Update Application

```bash
# After making code changes
cf push ssl-certificate-checker
```

## Troubleshooting

### Common Issues

1. **Application Won't Start**
   ```bash
   cf logs ssl-certificate-checker --recent
   ```
   Check for port binding issues or missing dependencies.

2. **Health Check Failures**
   - Verify `/health` endpoint is accessible
   - Check application startup time vs. timeout setting

3. **Memory Issues**
   ```bash
   cf scale ssl-certificate-checker -m 1G
   ```

4. **Route Conflicts**
   - Use a unique route name
   - Check existing routes: `cf routes`

### Debug Commands

```bash
# SSH into running container
cf ssh ssl-certificate-checker

# View environment variables
cf env ssl-certificate-checker

# Check application events
cf events ssl-certificate-checker
```

## Security Considerations

### 1. Network Policies

The application includes security measures to prevent SSRF attacks:
- Blocks access to private IP ranges
- Validates hostnames and domains
- Implements input sanitization

### 2. HTTPS Only

Ensure your routes use HTTPS in production:
```yaml
routes:
  - route: ssl-certificate-checker.cfapps.sap.hana.ondemand.com
```

### 3. Security Headers

The application automatically sets security headers:
- X-Content-Type-Options
- X-Frame-Options  
- X-XSS-Protection
- Referrer-Policy

## Support

For issues related to:
- **SAP Cloud Foundry**: Check SAP Community or create support tickets
- **Application**: Review application logs and check the troubleshooting section
- **CF CLI**: Refer to Cloud Foundry documentation

## Additional Resources

- [SAP Cloud Foundry Documentation](https://help.sap.com/products/BTP/65de2977205c403bbc107264b8eccf4b/b328cc89ea14484d9655b8cfb8efb508.html)
- [Cloud Foundry CLI Documentation](https://docs.cloudfoundry.org/cf-cli/)
- [Node.js Buildpack](https://docs.cloudfoundry.org/buildpacks/node/index.html)
