const express = require('express');
const compression = require('compression');
const tls = require('tls');
const https = require('https');
const url = require('url');
const path = require('path');
const dns = require('dns').promises;
const crypto = require('crypto');
const forge = require('node-forge');

const app = express();
const PORT = process.env.PORT || 5001;

// Enable gzip compression
app.use(compression({
    level: 6, // Compression level (0-9)
    threshold: 1024, // Only compress files larger than 1KB
    filter: (req, res) => {
        // Don't compress if the request includes no-transform cache control
        if (req.headers['cache-control'] && req.headers['cache-control'].includes('no-transform')) {
            return false;
        }
        // Use compression for all other requests
        return compression.filter(req, res);
    }
}));

// Limit request body size for security (increased for certificate chains)
app.use(express.json({ limit: '100kb' }));

// Security headers and caching
app.use((req, res, next) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Caching headers for static assets
    if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
        // Cache static assets for 1 year
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (req.path.match(/\.(html|htm)$/)) {
        // Cache HTML files for 1 hour
        res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (req.path.startsWith('/api/')) {
        // Don't cache API responses
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    next();
});

// Health check endpoint for Cloud Foundry
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'UP',
        timestamp: new Date().toISOString(),
        service: 'SSL Certificate Checker',
        version: '1.0.0'
    });
});

// Serve static files with optimized settings
app.use(express.static('public', {
    maxAge: '1y', // Cache for 1 year
    etag: true,   // Enable ETags for better caching
    lastModified: true, // Enable Last-Modified headers
    setHeaders: (res, path) => {
        // Special handling for index.html
        if (path.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
        }
    }
}));

// SPA routing - serve index.html for all non-API, non-static routes
app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    // If the request is for a static file with extension, let express.static handle it
    if (req.path.match(/\.[a-z0-9]+$/i)) {
        return next();
    }
    
    // Otherwise serve index.html for client-side routing
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Helper function to extract hostname from URL
function extractHostname(inputUrl) {
    try {
        // Add protocol if not present
        if (!inputUrl.match(/^[a-zA-Z]+:\/\//)) {
            inputUrl = 'https://' + inputUrl;
        }
        const parsed = new url.URL(inputUrl);
        return parsed.hostname;
    } catch (error) {
        throw new Error('Invalid URL format');
    }
}

// Helper function to resolve hostname to IP address
async function resolveHostnameToIP(hostname) {
    try {
        // Check if it's already an IP address
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
        
        if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
            return hostname; // Already an IP address
        }
        
        // Resolve hostname to IP
        const addresses = await dns.resolve4(hostname);
        return addresses[0]; // Return the first IP address
    } catch (error) {
        // If IPv4 resolution fails, try IPv6
        try {
            const addresses = await dns.resolve6(hostname);
            return addresses[0];
        } catch (ipv6Error) {
            throw new Error(`Unable to resolve hostname: ${error.message}`);
        }
    }
}

// Helper function to validate hostname/IP address
function validateHostname(hostname) {
    if (!hostname || hostname.length === 0) {
        return { valid: false, reason: 'Hostname is required' };
    }

    // Check for invalid characters
    if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
        return { valid: false, reason: 'Hostname contains invalid characters' };
    }

    // Check if it's an IP address
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    if (ipv4Regex.test(hostname)) {
        // Validate IPv4 ranges
        const parts = hostname.split('.');
        for (let part of parts) {
            const num = parseInt(part);
            if (num < 0 || num > 255) {
                return { valid: false, reason: 'Invalid IPv4 address' };
            }
        }
        
        // Block private/internal IP ranges for security
        const firstOctet = parseInt(parts[0]);
        const secondOctet = parseInt(parts[1]);
        
        // Block localhost, private networks, and reserved ranges
        if (firstOctet === 127 || // Localhost
            firstOctet === 10 || // Private Class A
            (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) || // Private Class B
            (firstOctet === 192 && secondOctet === 168) || // Private Class C
            firstOctet === 169 || // Link-local
            firstOctet >= 224) { // Multicast and reserved
            return { valid: false, reason: 'Access to private/internal networks is not allowed' };
        }
        
        return { valid: true };
    } else if (ipv6Regex.test(hostname)) {
        // Block IPv6 localhost and private ranges
        if (hostname.startsWith('::1') || hostname.startsWith('fe80:') || hostname.startsWith('fc00:') || hostname.startsWith('fd00:')) {
            return { valid: false, reason: 'Access to private/internal networks is not allowed' };
        }
        return { valid: true };
    } else {
        // Domain name validation
        if (hostname.length > 253) {
            return { valid: false, reason: 'Hostname too long' };
        }
        
        // Check for valid domain pattern
        const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
        if (!domainRegex.test(hostname)) {
            return { valid: false, reason: 'Invalid hostname format' };
        }
        
        // Block localhost variations
        if (hostname.toLowerCase().includes('localhost') || hostname === '0.0.0.0') {
            return { valid: false, reason: 'Access to localhost is not allowed' };
        }
        
        return { valid: true };
    }
}

// Helper function to check if certificate matches domain
function checkDomainMatch(cert, hostname) {
    if (!cert.subject || !cert.subject.CN) {
        return { matches: false, reason: 'Certificate has no Common Name (CN)' };
    }

    const cn = cert.subject.CN;
    const altNames = cert.subjectaltname ? 
        cert.subjectaltname.split(', ').map(name => name.replace('DNS:', '')) : [];

    // Check exact match with CN
    if (cn === hostname) {
        return { matches: true, matchedWith: cn };
    }

    // Check wildcard match with CN
    if (cn.startsWith('*.')) {
        const wildcardDomain = cn.substring(2);
        const hostnameParts = hostname.split('.');
        const wildcardParts = wildcardDomain.split('.');
        
        if (hostnameParts.length === wildcardParts.length + 1) {
            const hostnameBase = hostnameParts.slice(1).join('.');
            if (hostnameBase === wildcardDomain) {
                return { matches: true, matchedWith: cn };
            }
        }
    }

    // Check Subject Alternative Names
    for (const altName of altNames) {
        if (altName === hostname) {
            return { matches: true, matchedWith: altName };
        }
        
        // Check wildcard in SAN
        if (altName.startsWith('*.')) {
            const wildcardDomain = altName.substring(2);
            const hostnameParts = hostname.split('.');
            const wildcardParts = wildcardDomain.split('.');
            
            if (hostnameParts.length === wildcardParts.length + 1) {
                const hostnameBase = hostnameParts.slice(1).join('.');
                if (hostnameBase === wildcardDomain) {
                    return { matches: true, matchedWith: altName };
                }
            }
        }
    }

    return { 
        matches: false, 
        reason: `Domain '${hostname}' does not match certificate CN '${cn}' or any Subject Alternative Names` 
    };
}

// Helper function to validate certificate chain
function validateCertificateChain(peerCert) {
    const chain = [];
    let current = peerCert;
    
    while (current) {
        chain.push({
            subject: current.subject,
            issuer: current.issuer,
            valid_from: current.valid_from,
            valid_to: current.valid_to,
            fingerprint: current.fingerprint,
            serialNumber: current.serialNumber
        });
        
        // Check if we've reached the root (self-signed)
        if (current.issuerCertificate && 
            current.issuerCertificate.fingerprint !== current.fingerprint) {
            current = current.issuerCertificate;
        } else {
            break;
        }
    }
    
    return chain;
}

// Helper function to calculate days until expiration
function getDaysUntilExpiration(validTo) {
    const expiryDate = new Date(validTo);
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

// API endpoint to check SSL certificate
app.post('/api/check-ssl', async (req, res) => {
    const { url: inputUrl, port } = req.body;
    
    if (!inputUrl) {
        return res.status(400).json({ error: 'URL is required' });
    }

    // Validate and sanitize input
    const sanitizedUrl = inputUrl.toString().trim();
    if (sanitizedUrl.length > 2000) {
        return res.status(400).json({ error: 'URL too long' });
    }

    const targetPort = port || 443;
    
    // Validate port
    if (port !== undefined) {
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            return res.status(400).json({ error: 'Invalid port number' });
        }
    }
    
    let hostname;

    try {
        hostname = extractHostname(sanitizedUrl);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    // Validate hostname for security
    const hostnameValidation = validateHostname(hostname);
    if (!hostnameValidation.valid) {
        return res.status(400).json({ error: hostnameValidation.reason });
    }

    // Resolve hostname to IP address
    let ipAddress = null;
    try {
        ipAddress = await resolveHostnameToIP(hostname);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    const options = {
        host: hostname,
        port: targetPort,
        method: 'GET',
        rejectUnauthorized: false, // We want to get certificate info even if invalid
        agent: false
    };

    let socket;
    let timeoutId;
    let isResponseSent = false;

    const cleanup = () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        if (socket) {
            socket.removeAllListeners();
            if (!socket.destroyed) {
                socket.destroy();
            }
        }
    };

    const sendResponse = (statusCode, data) => {
        if (isResponseSent) return;
        isResponseSent = true;
        cleanup();
        res.status(statusCode).json(data);
    };

    try {
        socket = tls.connect(targetPort, hostname, {
            servername: hostname,
            rejectUnauthorized: false,
            timeout: 10000
        });

        // Set a timeout for the entire operation
        timeoutId = setTimeout(() => {
            sendResponse(500, { error: 'Connection timeout' });
        }, 10000);

        socket.on('secureConnect', () => {
            try {
            const cert = socket.getPeerCertificate(true);
            const authorized = socket.authorized;
            const authorizationError = socket.authorizationError;

            if (!cert || Object.keys(cert).length === 0) {
                    return sendResponse(500, { error: 'Failed to retrieve certificate' });
                }

                // Validate certificate has required properties
                if (!cert.subject || !cert.issuer || !cert.valid_from || !cert.valid_to) {
                    return sendResponse(500, { error: 'Invalid certificate structure' });
            }

            // Check domain match
            const domainMatch = checkDomainMatch(cert, hostname);

            // Validate certificate chain
            const certificateChain = validateCertificateChain(cert);

            // Calculate days until expiration
            const daysUntilExpiration = getDaysUntilExpiration(cert.valid_to);

                // Extract Subject Alternative Names safely
            const subjectAltNames = cert.subjectaltname ? 
                cert.subjectaltname.split(', ').map(name => name.replace('DNS:', '')) : [];

            const result = {
                hostname,
                    ipAddress,
                port: targetPort,
                valid: authorized,
                authorized,
                authorizationError: authorizationError ? authorizationError.toString() : null,
                domainMatch: domainMatch.matches,
                domainMatchInfo: domainMatch,
                certificate: {
                        subject: cert.subject || {},
                        issuer: cert.issuer || {},
                    subjectaltname: subjectAltNames,
                    valid_from: cert.valid_from,
                    valid_to: cert.valid_to,
                    daysUntilExpiration,
                        fingerprint: cert.fingerprint || 'N/A',
                        fingerprint256: cert.fingerprint256 || 'N/A',
                        serialNumber: cert.serialNumber || 'N/A',
                        protocol: socket.getProtocol() || 'N/A',
                        cipher: socket.getCipher() || {}
                },
                certificateChain: certificateChain,
                chainLength: certificateChain.length
            };

                sendResponse(200, result);
            } catch (error) {
                sendResponse(500, { error: 'Error processing certificate data', details: error.message });
            }
        });

        socket.on('error', (error) => {
            let errorMessage = 'Failed to connect to server';
            let details = error.message;

            // Provide more specific error messages
            if (error.code === 'ENOTFOUND') {
                errorMessage = 'Host not found';
                details = 'The hostname could not be resolved';
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connection refused';
                details = 'The server refused the connection';
            } else if (error.code === 'ETIMEDOUT') {
                errorMessage = 'Connection timeout';
                details = 'The connection attempt timed out';
            }

            sendResponse(500, { error: errorMessage, details: details });
        });

        socket.on('timeout', () => {
            sendResponse(500, { error: 'Connection timeout' });
        });

    } catch (error) {
        sendResponse(500, { 
            error: 'Failed to check SSL certificate',
            details: error.message 
        });
    }
});

// API endpoint to scan port
app.post('/api/scan-port', async (req, res) => {
    const { host, port } = req.body;
    
    if (!host || !port) {
        return res.status(400).json({ error: 'Host and port are required' });
    }

    // Validate and sanitize input
    const sanitizedHost = host.toString().trim();
    if (sanitizedHost.length > 253) {
        return res.status(400).json({ error: 'Hostname too long' });
    }

    // Validate port
    const targetPort = parseInt(port);
    if (isNaN(targetPort) || targetPort < 1 || targetPort > 65535) {
        return res.status(400).json({ error: 'Invalid port number' });
    }

    // Validate hostname for security
    const hostnameValidation = validateHostname(sanitizedHost);
    if (!hostnameValidation.valid) {
        return res.status(400).json({ error: hostnameValidation.reason });
    }

    // Resolve hostname to IP address
    let ipAddress = null;
    try {
        ipAddress = await resolveHostnameToIP(sanitizedHost);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }

    // Common port services mapping
    const commonPorts = {
        20: 'FTP Data',
        21: 'FTP Control',
        22: 'SSH',
        23: 'Telnet',
        25: 'SMTP',
        53: 'DNS',
        80: 'HTTP',
        110: 'POP3',
        143: 'IMAP',
        443: 'HTTPS',
        465: 'SMTPS',
        587: 'SMTP',
        993: 'IMAPS',
        995: 'POP3S',
        3306: 'MySQL',
        3389: 'RDP',
        5432: 'PostgreSQL',
        5900: 'VNC',
        8080: 'HTTP Proxy',
        8443: 'HTTPS Alt',
        27017: 'MongoDB'
    };

    const startTime = Date.now();
    const net = require('net');
    let socket;
    let isResponseSent = false;
    
    const timeout = 5000; // 5 seconds timeout
    
    const cleanup = () => {
        if (socket) {
            socket.removeAllListeners();
            if (!socket.destroyed) {
                socket.destroy();
            }
        }
    };

    const sendResponse = (data) => {
        if (isResponseSent) return;
        isResponseSent = true;
        cleanup();
        res.json(data);
    };

    try {
        socket = new net.Socket();
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
        const responseTime = Date.now() - startTime;
        
            sendResponse({
                host: sanitizedHost,
                ipAddress,
            port: targetPort,
            isOpen: true,
            serviceName: commonPorts[targetPort] || 'Unknown Service',
            responseTime: responseTime
        });
    });
    
    socket.on('timeout', () => {
            sendResponse({
                host: sanitizedHost,
                ipAddress,
            port: targetPort,
            isOpen: false,
            serviceName: commonPorts[targetPort] || 'Unknown Service'
        });
    });
    
    socket.on('error', (error) => {
        // ECONNREFUSED means port is closed
        // ETIMEDOUT or EHOSTUNREACH means host is unreachable
        const isOpen = false;
        
            sendResponse({
                host: sanitizedHost,
                ipAddress,
            port: targetPort,
            isOpen: isOpen,
            serviceName: commonPorts[targetPort] || 'Unknown Service',
            errorType: error.code
        });
    });
        
        socket.connect(targetPort, sanitizedHost);
        
    } catch (error) {
        if (!isResponseSent) {
            res.status(500).json({
                error: 'Failed to scan port',
                details: error.message
            });
        }
    }
});

// API endpoint to match certificate with private key
app.post('/api/match-cert-key', async (req, res) => {
    const { certificate, privateKey } = req.body;
    
    if (!certificate || !privateKey) {
        return res.status(400).json({ error: 'Both certificate and private key are required' });
    }

    // Validate and sanitize inputs
    const sanitizedCert = certificate.toString().trim();
    const sanitizedKey = privateKey.toString().trim();
    
    if (sanitizedCert.length > 50000 || sanitizedKey.length > 50000) {
        return res.status(400).json({ error: 'Certificate or private key too large' });
    }

    // Basic PEM format validation
    if (!sanitizedCert.includes('-----BEGIN CERTIFICATE-----') || 
        !sanitizedCert.includes('-----END CERTIFICATE-----')) {
        return res.status(400).json({ error: 'Invalid certificate format. Expected PEM format.' });
    }

    if (!sanitizedKey.includes('-----BEGIN') || !sanitizedKey.includes('PRIVATE KEY-----')) {
        return res.status(400).json({ error: 'Invalid private key format. Expected PEM format.' });
    }

    try {
        // Parse certificate to extract information
        const cert = crypto.X509Certificate ? 
            new crypto.X509Certificate(sanitizedCert) : 
            null;

        let certInfo = {};
        let publicKey = null;

        if (cert) {
            // Use X509Certificate API (Node.js 15.6+)
            certInfo = {
                subject: cert.subject,
                issuer: cert.issuer,
                validFrom: cert.validFrom,
                validTo: cert.validTo,
                serialNumber: cert.serialNumber,
                fingerprint: cert.fingerprint,
                fingerprint256: cert.fingerprint256
            };
            publicKey = cert.publicKey;
        } else {
            // Fallback for older Node.js versions
            const certBuffer = Buffer.from(sanitizedCert);
            publicKey = crypto.createPublicKey({
                key: certBuffer,
                format: 'pem'
            });
            
            // Basic certificate info extraction (limited without X509Certificate)
            certInfo = {
                subject: 'Certificate parsed (limited info)',
                issuer: 'Certificate parsed (limited info)',
                validFrom: 'Unknown',
                validTo: 'Unknown',
                serialNumber: 'Unknown',
                fingerprint: 'Unknown',
                fingerprint256: 'Unknown'
            };
        }

        // Parse private key
        let privateKeyObject;
        try {
            privateKeyObject = crypto.createPrivateKey({
                key: sanitizedKey,
                format: 'pem'
            });
        } catch (error) {
            return res.status(400).json({ 
                error: 'Invalid private key format', 
                details: error.message 
            });
        }

        // Test if private key matches certificate public key
        const testData = 'test-data-for-key-matching';
        let matches = false;
        let matchDetails = '';

        try {
            // Create signature with private key
            const sign = crypto.createSign('SHA256');
            sign.update(testData);
            const signature = sign.sign(privateKeyObject);

            // Verify signature with public key from certificate
            const verify = crypto.createVerify('SHA256');
            verify.update(testData);
            matches = verify.verify(publicKey, signature);
            
            matchDetails = matches ? 
                'Private key matches the certificate public key' :
                'Private key does NOT match the certificate public key';

        } catch (error) {
            return res.status(500).json({ 
                error: 'Error during key matching verification', 
                details: error.message 
            });
        }

        // Extract key information with better size detection
        const keyType = privateKeyObject.asymmetricKeyType || 'Unknown';
        let keySize = privateKeyObject.asymmetricKeySize;

        // If asymmetricKeySize is not available, try to extract it manually
        if (!keySize || keySize === 'Unknown') {
            try {
                // Get key details for size information
                const keyDetails = privateKeyObject.asymmetricKeyDetails;
                
                if (keyDetails) {
                    // For RSA keys
                    if (keyType === 'rsa' && keyDetails.modulusLength) {
                        keySize = keyDetails.modulusLength;
                    }
                    // For EC keys
                    else if (keyType === 'ec' && keyDetails.namedCurve) {
                        // Map common EC curves to key sizes
                        const curveToSize = {
                            'prime256v1': 256,
                            'secp256r1': 256,
                            'secp384r1': 384,
                            'secp521r1': 521,
                            'secp256k1': 256
                        };
                        keySize = curveToSize[keyDetails.namedCurve] || 'Unknown';
                    }
                    // For other key types, check if mgf1HashAlgorithm or other properties exist
                    else if (keyDetails.mgf1HashAlgorithm || keyDetails.saltLength) {
                        // This might be an RSA-PSS key, try to get modulus length
                        keySize = keyDetails.modulusLength || keyDetails.keySize || 'Unknown';
                    }
                }

                // Fallback: try to estimate from DER encoding if available
                if (!keySize || keySize === 'Unknown') {
                    try {
                        const keyDER = privateKeyObject.export({ format: 'der', type: 'pkcs8' });
                        // For RSA keys, the modulus is typically in the DER structure
                        // This is a rough estimation based on DER length
                        if (keyType === 'rsa') {
                            if (keyDER.length > 1100) keySize = 4096;
                            else if (keyDER.length > 600) keySize = 2048;
                            else if (keyDER.length > 300) keySize = 1024;
                            else keySize = 'Unknown';
                        }
                    } catch (derError) {
                        // DER export failed, keep as unknown
                    }
                }

            } catch (detailsError) {
                // If we can't get details, keep the original value
                keySize = keySize || 'Unknown';
            }
        }

        const keyInfo = {
            type: keyType,
            size: keySize
        };

        // Calculate certificate expiry days
        let daysUntilExpiration = 0;
        if (cert && cert.validTo) {
            const expiryDate = new Date(cert.validTo);
            const now = new Date();
            const diffTime = expiryDate - now;
            daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        const result = {
            matches,
            matchDetails,
            certificate: {
                ...certInfo,
                daysUntilExpiration: cert ? daysUntilExpiration : 'Unknown'
            },
            privateKey: {
                type: keyInfo.type,
                size: keyInfo.size ? `${keyInfo.size} bits` : 'Unknown',
                format: 'PEM'
            },
            compatibility: {
                keyType: keyInfo.type,
                supported: ['rsa', 'ec', 'ed25519', 'ed448'].includes(keyInfo.type?.toLowerCase()),
                algorithm: 'SHA256 with ' + (keyInfo.type || 'Unknown')
            }
        };

        res.json(result);

    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to process certificate and key',
            details: error.message 
        });
    }
});

// API endpoint to decode certificate
app.post('/api/decode-certificate', async (req, res) => {
    const { certificate } = req.body;
    
    if (!certificate) {
        return res.status(400).json({ error: 'Certificate is required' });
    }

    // Validate and sanitize input
    const sanitizedCert = certificate.toString().trim();
    
    if (sanitizedCert.length > 100000) {
        return res.status(400).json({ error: 'Certificate too large (max 100KB)' });
    }

    // Basic PEM format validation
    if (!sanitizedCert.includes('-----BEGIN CERTIFICATE-----') || 
        !sanitizedCert.includes('-----END CERTIFICATE-----')) {
        return res.status(400).json({ error: 'Invalid certificate format. Expected PEM format.' });
    }

    try {
        // Split multiple certificates if present
        const certRegex = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
        const certificates = sanitizedCert.match(certRegex) || [];
        
        if (certificates.length === 0) {
            return res.status(400).json({ error: 'No valid certificates found in input' });
        }

        const decodedCertificates = [];

        for (let i = 0; i < certificates.length; i++) {
            const certPem = certificates[i];
            
            try {
                let certInfo = {};
                let extensions = [];
                
                if (crypto.X509Certificate) {
                    // Use X509Certificate API (Node.js 15.6+)
                    const cert = new crypto.X509Certificate(certPem);
                    
                    // Calculate certificate expiry days
                    const expiryDate = new Date(cert.validTo);
                    const now = new Date();
                    const diffTime = expiryDate - now;
                    const daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    // Determine certificate type/level
                    let certLevel = 'End Entity';
                    if (i === certificates.length - 1 && certificates.length > 1) {
                        certLevel = 'Root CA';
                    } else if (i > 0) {
                        certLevel = 'Intermediate CA';
                    }
                    
                    // Parse extensions if available
                    try {
                        if (cert.keyUsage) {
                            extensions.push({
                                name: 'Key Usage',
                                critical: true,
                                value: cert.keyUsage.join(', ')
                            });
                        }
                        
                        if (cert.subjectAltName) {
                            extensions.push({
                                name: 'Subject Alternative Name',
                                critical: false,
                                value: cert.subjectAltName
                            });
                        }
                    } catch (extError) {
                        // Extensions parsing failed, continue without them
                    }
                    
                    certInfo = {
                        version: 3, // Most certificates are v3
                        serialNumber: cert.serialNumber,
                        subject: _parseX500Name(cert.subject),
                        issuer: _parseX500Name(cert.issuer),
                        validFrom: cert.validFrom,
                        validTo: cert.validTo,
                        daysUntilExpiration: daysUntilExpiration,
                        fingerprint: cert.fingerprint,
                        fingerprint256: cert.fingerprint256,
                        publicKeyAlgorithm: 'Unknown', // Not directly available in X509Certificate
                        signatureAlgorithm: 'Unknown', // Not directly available in X509Certificate
                        certLevel: certLevel,
                        extensions: extensions,
                        publicKeyInfo: {
                            algorithm: 'Unknown',
                            size: 'Unknown'
                        }
                    };
                    
                    // Try to get public key information
                    try {
                        const publicKey = cert.publicKey;
                        if (publicKey) {
                            certInfo.publicKeyInfo = {
                                algorithm: publicKey.asymmetricKeyType || 'Unknown',
                                size: publicKey.asymmetricKeySize ? `${publicKey.asymmetricKeySize} bits` : 'Unknown'
                            };
                            certInfo.publicKeyAlgorithm = publicKey.asymmetricKeyType || 'Unknown';
                        }
                    } catch (pkError) {
                        // Public key info extraction failed
                    }
                    
                } else {
                    // Fallback for older Node.js versions
                    certInfo = {
                        version: 'Unknown',
                        serialNumber: 'Unknown',
                        subject: 'Certificate parsed (limited info available)',
                        issuer: 'Certificate parsed (limited info available)', 
                        validFrom: 'Unknown',
                        validTo: 'Unknown',
                        daysUntilExpiration: 'Unknown',
                        fingerprint: 'Unknown',
                        fingerprint256: 'Unknown',
                        publicKeyAlgorithm: 'Unknown',
                        signatureAlgorithm: 'Unknown',
                        certLevel: i === 0 ? 'End Entity' : 'CA Certificate',
                        extensions: [],
                        publicKeyInfo: {
                            algorithm: 'Unknown',
                            size: 'Unknown'
                        }
                    };
                }

                // Add position information
                certInfo.position = i + 1;
                certInfo.totalCertificates = certificates.length;
                
                decodedCertificates.push(certInfo);
                
            } catch (certError) {
                decodedCertificates.push({
                    position: i + 1,
                    totalCertificates: certificates.length,
                    error: `Failed to parse certificate ${i + 1}: ${certError.message}`,
                    certLevel: 'Invalid Certificate'
                });
            }
        }

        const result = {
            certificatesFound: certificates.length,
            certificates: decodedCertificates,
            chainValid: certificates.length > 1,
            decodedAt: new Date().toISOString()
        };

        res.json(result);

    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to decode certificate',
            details: error.message 
        });
    }
});

// CSR Decoder endpoint
app.post('/api/decode-csr', async (req, res) => {
    const { csr } = req.body;
    
    if (!csr) {
        return res.status(400).json({ error: 'CSR is required' });
    }

    // Validate and sanitize input
    const sanitizedCSR = csr.toString().trim();
    
    if (sanitizedCSR.length > 100000) {
        return res.status(400).json({ error: 'CSR too large (max 100KB)' });
    }

    // Basic PEM format validation for CSR
    if (!sanitizedCSR.includes('-----BEGIN CERTIFICATE REQUEST-----') || 
        !sanitizedCSR.includes('-----END CERTIFICATE REQUEST-----')) {
        return res.status(400).json({ error: 'Invalid CSR format. Expected PEM format with CERTIFICATE REQUEST headers.' });
    }

    try {
        // Extract CSR from PEM format
        const csrRegex = /-----BEGIN CERTIFICATE REQUEST-----[\s\S]*?-----END CERTIFICATE REQUEST-----/g;
        const csrs = sanitizedCSR.match(csrRegex) || [];
        
        if (csrs.length === 0) {
            return res.status(400).json({ error: 'No valid CSR found in input' });
        }

        if (csrs.length > 1) {
            return res.status(400).json({ error: 'Multiple CSRs detected. Please submit one CSR at a time.' });
        }

        const csrPem = csrs[0];
        
        try {
            // Parse CSR using node-forge
            let parsedCSR;
            
            try {
                // Convert PEM to forge CSR object
                parsedCSR = forge.pki.certificationRequestFromPem(csrPem);
            } catch (forgeError) {
                return res.status(400).json({ 
                    error: 'Invalid CSR format', 
                    details: 'Unable to parse CSR with node-forge: ' + forgeError.message
                });
            }
            
            // Extract subject information
            let subjectStr = '';
            const subject = parsedCSR.subject;
            
            const subjectParts = [];
            for (let i = 0; i < subject.attributes.length; i++) {
                const attr = subject.attributes[i];
                let name = attr.name || attr.type;
                
                // Convert common OIDs to readable names
                const oidNames = {
                    '2.5.4.3': 'CN',
                    '2.5.4.10': 'O',
                    '2.5.4.11': 'OU',
                    '2.5.4.6': 'C',
                    '2.5.4.8': 'ST',
                    '2.5.4.7': 'L',
                    '1.2.840.113549.1.9.1': 'emailAddress'
                };
                
                if (oidNames[name]) {
                    name = oidNames[name];
                }
                
                subjectParts.push(`${name}=${attr.value}`);
            }
            
            subjectStr = subjectParts.join(', ') || 'No subject found';
            
            // Extract Common Name from subject
            let commonName = 'Unknown';
            const cnAttribute = subject.attributes.find(attr => attr.name === 'commonName' || attr.shortName === 'CN');
            if (cnAttribute) {
                commonName = cnAttribute.value;
            }
            
            // Extract public key information
            const publicKey = parsedCSR.publicKey;
            let publicKeyAlgorithm = 'Unknown';
            let keySize = 'Unknown';
            let keyDetails = {};
            
            if (publicKey) {
                if (publicKey.n && publicKey.e) {
                    // RSA key
                    publicKeyAlgorithm = 'RSA';
                    keySize = `${publicKey.n.bitLength()} bits`;
                    keyDetails = {
                        modulus: publicKey.n.toString(16).substring(0, 32) + '...',
                        exponent: publicKey.e.toString()
                    };
                } else if (publicKey.point) {
                    // EC key
                    publicKeyAlgorithm = 'EC';
                    keySize = 'EC key';
                    if (publicKey.curve) {
                        keyDetails.curve = publicKey.curve;
                    }
                }
            }
            
            // Extract signature algorithm
            let signatureAlgorithm = 'Unknown';
            if (parsedCSR.signatureAlgorithm) {
                const sigAlg = parsedCSR.signatureAlgorithm;
                if (sigAlg === forge.pki.oids.sha1WithRSAEncryption) {
                    signatureAlgorithm = 'SHA1withRSA';
                } else if (sigAlg === forge.pki.oids.sha256WithRSAEncryption) {
                    signatureAlgorithm = 'SHA256withRSA';
                } else if (sigAlg === forge.pki.oids.sha384WithRSAEncryption) {
                    signatureAlgorithm = 'SHA384withRSA';
                } else if (sigAlg === forge.pki.oids.sha512WithRSAEncryption) {
                    signatureAlgorithm = 'SHA512withRSA';
                } else {
                    signatureAlgorithm = sigAlg || 'Unknown';
                }
            }
            
            // Extract attributes
            const attributes = [];
            if (parsedCSR.attributes && parsedCSR.attributes.length > 0) {
                for (let i = 0; i < parsedCSR.attributes.length; i++) {
                    const attr = parsedCSR.attributes[i];
                    attributes.push({
                        type: attr.type || 'Unknown',
                        name: attr.name || attr.type || 'Unknown',
                        values: attr.values || []
                    });
                }
            }
            
            // Extract extensions from CSR attributes (extension requests)  
            const extensions = [];
            let subjectAltNames = [];
            
            // Try to extract SANs using OpenSSL as a fallback since node-forge CSR extension parsing is limited
            try {
                // Check if we have extension requests
                const hasExtensionRequest = parsedCSR.attributes.some(attr => attr.type === forge.pki.oids.extensionRequest);
                
                if (hasExtensionRequest) {
                    extensions.push({
                        name: 'Extension Request',
                        value: 'Extensions present (use OpenSSL for detailed analysis)',
                        critical: false
                    });
                    
                    // Since node-forge CSR extension parsing is limited, 
                    // let's use a simpler approach to extract domain names from the CSR
                    const base64Data = csrPem
                        .replace('-----BEGIN CERTIFICATE REQUEST-----', '')
                        .replace('-----END CERTIFICATE REQUEST-----', '')
                        .replace(/\s/g, '');
                    
                    const csrBuffer = Buffer.from(base64Data, 'base64');
                    const csrHex = csrBuffer.toString('hex');
                    
                    // Look for the SAN extension pattern in the hex data
                    // SAN extension OID is 551d11 (2.5.29.17) in hex
                    if (csrHex.includes('551d11')) {
                        // Basic extraction of domain names from the CSR binary data
                        const csrString = csrBuffer.toString('binary');
                        
                        // Look for domain patterns that match common domains, including wildcards
                        const domainMatches = csrString.match(/(?:\*\.)?[a-zA-Z0-9][a-zA-Z0-9\.-]{1,60}\.[a-zA-Z]{2,6}/g);
                        if (domainMatches) {
                            // Filter and clean domain names, removing the CN if it appears
                            const cnDomain = subjectStr.match(/commonName=([^,]+)/);
                            const cnValue = cnDomain ? cnDomain[1].trim() : '';
                            
                            const uniqueDomains = [...new Set(domainMatches)]
                                .filter(domain => 
                                    // Valid domain pattern (including wildcards)
                                    /^(?:\*\.)?[a-zA-Z0-9][a-zA-Z0-9\.-]*\.[a-zA-Z]{2,6}$/.test(domain) &&
                                    // Reasonable length
                                    domain.length > 4 && domain.length < 64 &&
                                    // Contains at least one dot
                                    domain.includes('.') &&
                                    // Not just the CN (we want additional SANs)
                                    domain !== cnValue
                                )
                                .slice(0, 10); // Limit to reasonable number
                            
                            if (uniqueDomains.length > 0) {
                                subjectAltNames = uniqueDomains;
                                extensions.push({
                                    name: 'Subject Alternative Name',
                                    value: `${uniqueDomains.length} domains detected: ${uniqueDomains.join(', ')}`,
                                    altNames: uniqueDomains,
                                    critical: false
                                });
                            }
                        }
                    }
                }
            } catch (extError) {
                // If extension parsing fails, just note that we tried
                if (parsedCSR.attributes.some(attr => attr.type === forge.pki.oids.extensionRequest)) {
                    extensions.push({
                        name: 'Extension Request',
                        value: 'Extensions present but parsing failed',
                        critical: false
                    });
                }
            }
            
            // Calculate sizes
            const base64Content = csrPem
                .replace('-----BEGIN CERTIFICATE REQUEST-----', '')
                .replace('-----END CERTIFICATE REQUEST-----', '')
                .replace(/\s/g, '');
            const csrBuffer = Buffer.from(base64Content, 'base64');
            
            const csrInfo = {
                format: 'PEM',
                type: 'Certificate Signing Request',
                subject: subjectStr,
                commonName: commonName,
                subjectAltNames: subjectAltNames,
                publicKeyAlgorithm: publicKeyAlgorithm,
                signatureAlgorithm: signatureAlgorithm,
                keySize: keySize,
                keyDetails: keyDetails,
                attributes: attributes,
                extensions: extensions,
                size: csrBuffer.length,
                base64Length: base64Content.length,
                rawPEM: csrPem,
                parsingMethod: 'Node-Forge ASN.1 Parser',
                accuracy: 'High'
            };
            
            const result = {
                csrFound: true,
                csr: csrInfo,
                decodedAt: new Date().toISOString(),
                recommendation: 'CSR successfully parsed using node-forge. For OpenSSL comparison: openssl req -in your-csr.pem -text -noout'
            };

            res.json(result);

        } catch (csrError) {
            res.status(500).json({ 
                error: 'Failed to process CSR',
                details: csrError.message,
                recommendation: 'Verify CSR format. For analysis: openssl req -in your-csr.pem -text -noout'
            });
        }

    } catch (error) {
        res.status(500).json({
            error: 'Failed to decode CSR',
            details: error.message
        });
    }
});

// Helper function to parse X500 Distinguished Name
function _parseX500Name(x500Name) {
    if (typeof x500Name === 'string') {
        return x500Name;
    }
    
    if (typeof x500Name === 'object' && x500Name !== null) {
        const parts = [];
        if (x500Name.CN) parts.push(`CN=${x500Name.CN}`);
        if (x500Name.O) parts.push(`O=${x500Name.O}`);
        if (x500Name.OU) parts.push(`OU=${x500Name.OU}`);
        if (x500Name.C) parts.push(`C=${x500Name.C}`);
        if (x500Name.ST) parts.push(`ST=${x500Name.ST}`);
        if (x500Name.L) parts.push(`L=${x500Name.L}`);
        if (x500Name.emailAddress) parts.push(`emailAddress=${x500Name.emailAddress}`);
        return parts.join(', ') || 'Unknown';
    }
    
    return x500Name ? x500Name.toString() : 'Unknown';
}

// DNS Lookup API
app.post('/api/dns-lookup', async (req, res) => {
    try {
        const { domain } = req.body;

        // Validate domain input
        if (!domain || typeof domain !== 'string') {
            return res.status(400).json({ 
                error: 'Domain is required',
                recommendation: 'Please provide a valid domain name (e.g., google.com)'
            });
        }

        const cleanDomain = domain.trim().toLowerCase();
        
        // Basic domain validation
        if (cleanDomain.length === 0 || cleanDomain.length > 255) {
            return res.status(400).json({ 
                error: 'Invalid domain length',
                recommendation: 'Domain must be between 1 and 255 characters'
            });
        }

        // Enhanced domain validation (block private/reserved domains for security)
        if (cleanDomain === 'localhost' || 
            cleanDomain.endsWith('.local') || 
            cleanDomain.endsWith('.internal') ||
            cleanDomain.match(/^192\.168\./) ||
            cleanDomain.match(/^10\./) ||
            cleanDomain.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
            cleanDomain === '127.0.0.1') {
            return res.status(400).json({ 
                error: 'Private or reserved domain not allowed',
                recommendation: 'Please use a public domain name'
            });
        }

        const results = {
            domain: cleanDomain,
            timestamp: new Date().toISOString(),
            records: {},
            ipAddress: null
        };

        // Helper function to safely perform DNS lookups
        const safeLookup = async (type, method) => {
            try {
                const result = await method(cleanDomain);
                return { success: true, data: result };
            } catch (error) {
                return { 
                    success: false, 
                    error: error.code || error.message,
                    message: error.message
                };
            }
        };

        // Perform various DNS lookups in parallel
        const [
            aRecords,
            aaaaRecords, 
            mxRecords,
            txtRecords,
            cnameRecords,
            nsRecords,
            soaRecords
        ] = await Promise.all([
            safeLookup('A', dns.resolve4),
            safeLookup('AAAA', dns.resolve6),
            safeLookup('MX', dns.resolveMx),
            safeLookup('TXT', dns.resolveTxt),
            safeLookup('CNAME', dns.resolveCname),
            safeLookup('NS', dns.resolveNs),
            safeLookup('SOA', dns.resolveSoa)
        ]);

        // Process A records (IPv4)
        if (aRecords.success) {
            results.records.A = aRecords.data;
            results.ipAddress = aRecords.data[0]; // Use first A record as primary IP
        } else {
            results.records.A = { error: aRecords.error, message: aRecords.message };
        }

        // Process AAAA records (IPv6)  
        if (aaaaRecords.success) {
            results.records.AAAA = aaaaRecords.data;
        } else {
            results.records.AAAA = { error: aaaaRecords.error, message: aaaaRecords.message };
        }

        // Process MX records (Mail Exchange)
        if (mxRecords.success) {
            results.records.MX = mxRecords.data.map(mx => ({
                exchange: mx.exchange,
                priority: mx.priority
            }));
        } else {
            results.records.MX = { error: mxRecords.error, message: mxRecords.message };
        }

        // Process TXT records
        if (txtRecords.success) {
            results.records.TXT = txtRecords.data.map(txt => Array.isArray(txt) ? txt.join('') : txt);
        } else {
            results.records.TXT = { error: txtRecords.error, message: txtRecords.message };
        }

        // Process CNAME records
        if (cnameRecords.success) {
            results.records.CNAME = cnameRecords.data;
        } else {
            results.records.CNAME = { error: cnameRecords.error, message: cnameRecords.message };
        }

        // Process NS records (Name Servers)
        if (nsRecords.success) {
            results.records.NS = nsRecords.data;
        } else {
            results.records.NS = { error: nsRecords.error, message: nsRecords.message };
        }

        // Process SOA records (Start of Authority)
        if (soaRecords.success) {
            const soa = soaRecords.data;
            results.records.SOA = {
                nsname: soa.nsname,
                hostmaster: soa.hostmaster,
                serial: soa.serial,
                refresh: soa.refresh,
                retry: soa.retry,
                expire: soa.expire,
                minttl: soa.minttl
            };
        } else {
            results.records.SOA = { error: soaRecords.error, message: soaRecords.message };
        }

        // Add summary information
        const recordCounts = {
            A: Array.isArray(results.records.A) ? results.records.A.length : 0,
            AAAA: Array.isArray(results.records.AAAA) ? results.records.AAAA.length : 0,
            MX: Array.isArray(results.records.MX) ? results.records.MX.length : 0,
            TXT: Array.isArray(results.records.TXT) ? results.records.TXT.length : 0,
            NS: Array.isArray(results.records.NS) ? results.records.NS.length : 0
        };

        results.summary = {
            totalRecords: Object.values(recordCounts).reduce((sum, count) => sum + count, 0),
            recordTypes: Object.keys(recordCounts).filter(type => recordCounts[type] > 0),
            hasIPv4: recordCounts.A > 0,
            hasIPv6: recordCounts.AAAA > 0,
            hasMail: recordCounts.MX > 0
        };

        res.json({
            success: true,
            domain: cleanDomain,
            results,
            queriedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('DNS lookup error:', error);
        res.status(500).json({
            error: 'DNS lookup failed',
            details: error.message,
            recommendation: 'Please verify the domain name and try again'
        });
    }
});

app.listen(PORT, () => {
    console.log(`SSL Checker server running on http://localhost:${PORT}`);
});

