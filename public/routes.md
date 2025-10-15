# Application Routes

## Available Routes

### SSL Certificate Checker
- **URL**: `/ssl-checker` or `/` (default)
- **Description**: Check SSL certificates, validate certificate chains, and verify domain matching
- **Status**: ✅ Active

### Port Scanner
- **URL**: `/port-scanner`
- **Description**: Scan ports to check if they are open or closed
- **Status**: ✅ Active

### DNS Lookup
- **URL**: `/dns-lookup`
- **Description**: Perform DNS lookups (Coming soon)
- **Status**: 🚧 Coming Soon

### WHOIS Lookup
- **URL**: `/whois-lookup`
- **Description**: WHOIS information lookup (Coming soon)
- **Status**: 🚧 Coming Soon

## How Routing Works

The application uses HTML5 History API for clean URLs:
- Each tool has a clean URL path (no hash)
- Server-side routing serves index.html for all routes
- Client-side routing handles navigation
- Direct links to specific tools work (e.g., bookmark `/port-scanner`)
- Invalid routes redirect to SSL Checker (home page)
- Browser back/forward buttons work correctly

## Examples

```
http://localhost:4001/                   → SSL Certificate Checker
http://localhost:4001/ssl-checker        → SSL Certificate Checker
http://localhost:4001/port-scanner       → Port Scanner
http://localhost:4001/dns-lookup         → Redirects to home (coming soon)
http://localhost:4001/invalid-route      → Redirects to home
```

## Technical Details

- **Server**: Express serves `index.html` for all non-API, non-static routes
- **Client**: Uses `window.history.pushState()` for navigation
- **Browser Back/Forward**: Handled via `popstate` event
- **API Routes**: All API routes are under `/api/*` and not affected

