# SSL Tools - Security Toolkit - SAP UI5

A professional, enterprise-grade security toolkit built with SAP UI5 framework. Features SSL certificate checking, port scanning, certificate-key matching, and more. Includes a modern dark theme by default and follows SAP Fiori design principles.

## Features

### Core Tools
- ✅ **SSL Certificate Checker** - Verify SSL certificates with chain analysis
- 🔍 **Port Scanner** - Check if ports are open on target hosts
- 🔑 **Certificate Key Matcher** - Verify private key matches certificate
- 📜 **Certificate Decoder** - Decode and analyze SSL certificates
- 📝 **CSR Decoder** - Decode Certificate Signing Requests
- 🌐 **DNS Lookup** - Comprehensive DNS record analysis
- 🔐 **JWT Decoder** - Decode and validate JSON Web Tokens
- ⏱️ **Epoch Time Converter** - Convert epoch timestamps (auto-detect format)
- 🔤 **Base64 Encoder/Decoder** - Encode/decode with URL-safe mode

### Security & Performance
- 🛡️ **Production-Hardened Security**:
  - Rate limiting (100 req/min per IP)
  - HSTS, CSP, anti-clickjacking headers
  - SSRF protection, input validation
  - Private IP blocking, size limits
- 🚀 **Performance Optimized**:
  - Gzip compression (60-80% reduction)
  - Resource preloading & async loading
  - Connection pooling & timeouts
- 🌙 **Modern UI/UX**:
  - SAP Fiori design principles
  - Dark theme by default with toggle
  - Fully responsive (mobile/tablet/desktop)
- ☁️ **Cloud Ready** - Optimized for SAP Cloud Foundry deployment

## Architecture

### SAP UI5 Component-Based Structure
```
public/
├── index.html              # Main HTML with UI5 bootstrap
├── Component.js            # Main component controller
├── manifest.json           # App descriptor (metadata)
├── controller/
│   ├── App.controller.js   # App controller
│   └── Main.controller.js  # Main view controller
├── view/
│   ├── App.view.xml        # App shell view
│   └── Main.view.xml       # Main view with all UI
├── css/
│   └── style.css          # Custom CSS styling
└── i18n/
    └── i18n.properties    # Internationalization texts
```

## Installation

1. Install dependencies:
```bash
npm install
```

## Local Development

1. Start the server locally:
```bash
npm start
```

2. For development with auto-reload:
```bash
npm run dev
```

3. Open your browser and navigate to:
```
http://localhost:5001
```

## Cloud Deployment

### SAP Cloud Foundry

This application is ready for deployment to SAP Cloud Foundry. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

Quick deployment:
```bash
# Login to SAP Cloud Foundry
cf login -a https://api.cf.{region}.hana.ondemand.com

# Deploy the application
npm run cf-push
```

The application will be available at:
```
https://ssl-certificate-checker-{random-word}.cfapps.sap.hana.ondemand.com
```

### Health Check

The application includes a health check endpoint for Cloud Foundry:
```
GET /health
```

Response:
```json
{
  "status": "UP",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "SSL Certificate Checker",
  "version": "1.0.0"
}
```

3. The application features:
   - **Dark theme by default** (SAP Horizon Dark)
   - **Theme toggle button** in the header (lightbulb icon)
   - **Three tabs** for organized information:
     - Validation: Certificate validity and domain matching
     - Certificate Details: Full certificate information
     - Certificate Chain: Complete chain visualization

4. **SSL Certificate Checker**:
   - Enter a URL (e.g., `google.com` or `https://google.com`)
   - Optionally specify a port (defaults to 443)
   - Click "Check SSL Certificate"

5. **Port Scanner**:
   - Enter a host (IP address or domain)
   - Enter a port number (1-65535)
   - Click "Scan Port"

6. **Certificate Key Matcher**:
   - Paste SSL certificate in PEM format
   - Paste private key in PEM format  
   - Click "Match Certificate & Key"

7. **Certificate Decoder**:
   - Paste SSL certificate(s) in PEM format
   - Support for single certificates or certificate chains
   - Click "Decode Certificate"

## UI Components

### Main Features:
- **Icon Tab Bar** - Three organized tabs for different information types
- **Object Status** - Visual status indicators with colors
- **Message Strips** - Contextual alerts for warnings and errors
- **Responsive Grid** - Automatic layout adjustment for different screen sizes
- **Block Layout** - Professional header section
- **Simple Form** - Clean input form with proper labels
- **Custom List Items** - Certificate chain visualization

### Theme Support:
- **Dark Mode (Default)** - SAP Horizon Dark theme
- **Light Mode** - SAP Horizon theme
- Theme preference is saved in localStorage

## API Endpoint

The application exposes a REST API endpoint:

**POST** `/api/check-ssl`

Request body:
```json
{
  "url": "example.com",
  "port": 443
}
```

Response includes:
- Certificate validity status
- Domain match verification
- Certificate details (subject, issuer, validity dates, etc.)
- Complete certificate chain
- Protocol and cipher information
- Fingerprints (SHA1 and SHA256)
- Subject Alternative Names

## Performance & Optimization

### ⚡ Fast Loading Times
- **Gzip Compression**: 60-80% reduction in asset sizes
- **Resource Preloading**: Critical resources load in priority order
- **Smart Caching**: 1-year cache for static assets, optimized for browsers
- **CDN Optimization**: Optimized SAP UI5 framework loading
- **Loading Indicators**: Professional loading experience with progress feedback

### 📊 Expected Performance
- **WiFi/4G**: 0.5-1 second load time
- **3G**: 1-3 seconds load time  
- **Slow connections**: Graceful loading with progress indicators

See [PERFORMANCE.md](./PERFORMANCE.md) for detailed optimization guide.

## Technical Stack

- **Frontend**: SAP UI5 (OpenUI5) with performance optimizations
- **Theme**: SAP Horizon (Dark by default) with hardware acceleration
- **Backend**: Node.js with Express, compression, and caching
- **SSL Checking**: Native Node.js TLS module with security hardening
- **Port Scanning**: Native Node.js net module with validation
- **Architecture**: MVC pattern with component-based structure
- **Performance**: Gzip compression, resource preloading, smart caching
- **Security**: SSRF protection, input validation, security headers
- **Responsive**: Fully responsive using SAP UI5 responsive containers

## Development

For development with auto-reload:
```bash
npm run dev
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Security Notes

- The application sets `rejectUnauthorized: false` to allow inspection of invalid certificates
- This is intentional to provide detailed information about certificate issues
- The application clearly indicates when certificates are invalid

## SAP Fiori Design Principles

This application follows SAP Fiori design guidelines:
- **Simple** - Focus on the essential, clean and clutter-free design
- **Coherent** - Consistent user experience across the app
- **Responsive** - Adapts to all device types
- **Delightful** - Modern, professional appearance with smooth interactions

## License

ISC

## Version

1.0.0
