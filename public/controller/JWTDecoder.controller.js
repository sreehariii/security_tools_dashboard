sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("sslchecker.controller.JWTDecoder", {

        onInit: function () {
            // Initialize value states - delay to ensure model is available
            var that = this;
            setTimeout(function() {
                var oModel = that.getView().getModel();
                if (oModel) {
                    oModel.setProperty("/jwtValueState", "None");
                    oModel.setProperty("/jwtValueStateText", "");
                    oModel.setProperty("/jwtBusy", false);
                    oModel.setProperty("/hasJwtResults", false);
                    oModel.setProperty("/hasJwtError", false);
                    oModel.setProperty("/jwtToken", "");
                }
            }, 100);
        },

        onClearForm: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/jwtToken", "");
            oModel.setProperty("/hasJwtResults", false);
            oModel.setProperty("/hasJwtError", false);
            oModel.setProperty("/jwtValueState", "None");
            oModel.setProperty("/jwtValueStateText", "");
            MessageToast.show("Form cleared");
        },

        onLoadExample: function () {
            var oModel = this.getView().getModel();
            // Example JWT token for demonstration
            var exampleJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE2ODc2NzU0MjIsImF1ZCI6ImV4YW1wbGUtYXVkaWVuY2UiLCJpc3MiOiJleGFtcGxlLWlzc3VlciIsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJqb2huLmRvZUBleGFtcGxlLmNvbSJ9.a7Z7eWKb8YrK8X2JdVqY8Z6VqVzKZaVqz2d8s9f2a7b";
            
            oModel.setProperty("/jwtToken", exampleJWT);
            oModel.setProperty("/jwtValueState", "None");
            oModel.setProperty("/jwtValueStateText", "");
            MessageToast.show("Example JWT loaded");
        },

        _validateInputs: function () {
            var oModel = this.getView().getModel();
            var sJwtToken = oModel.getProperty("/jwtToken");
            var bValid = true;
            var sMessage = "";

            // Reset value states
            oModel.setProperty("/jwtValueState", "None");
            oModel.setProperty("/jwtValueStateText", "");

            // Validate JWT token
            if (!sJwtToken || sJwtToken.trim() === "") {
                oModel.setProperty("/jwtValueState", "Error");
                oModel.setProperty("/jwtValueStateText", "JWT token is required");
                sMessage = "Please enter a JWT token to decode.\n\nA JWT token consists of three parts separated by dots (.)";
                bValid = false;
            } else {
                var sTrimmedToken = sJwtToken.trim();
                
                // Basic JWT format validation
                var jwtParts = sTrimmedToken.split('.');
                if (jwtParts.length !== 3) {
                    oModel.setProperty("/jwtValueState", "Error");
                    oModel.setProperty("/jwtValueStateText", "Invalid JWT format");
                    sMessage = "JWT token must have exactly 3 parts separated by dots.\n\nFormat: header.payload.signature";
                    bValid = false;
                } else if (!/^[A-Za-z0-9_-]+$/.test(jwtParts[0]) || 
                          !/^[A-Za-z0-9_-]+$/.test(jwtParts[1]) || 
                          !/^[A-Za-z0-9_-]*$/.test(jwtParts[2])) {
                    oModel.setProperty("/jwtValueState", "Error");
                    oModel.setProperty("/jwtValueStateText", "Invalid characters in JWT");
                    sMessage = "JWT token contains invalid characters.\n\nOnly Base64url characters (A-Z, a-z, 0-9, -, _) are allowed.";
                    bValid = false;
                } else if (sTrimmedToken.length > 8192) {
                    oModel.setProperty("/jwtValueState", "Error");
                    oModel.setProperty("/jwtValueStateText", "JWT token too long");
                    sMessage = "JWT token is too long. Maximum length is 8192 characters.";
                    bValid = false;
                }
            }

            return {
                isValid: bValid,
                message: sMessage || "Please correct the errors in the form"
            };
        },

        onDecodeJWT: function () {
            var oModel = this.getView().getModel();
            
            // Enhanced validation with security checks
            var validationResult = this._validateInputs();
            if (!validationResult.isValid) {
                MessageBox.error(validationResult.message, {
                    title: "Invalid JWT Token",
                    icon: MessageBox.Icon.WARNING,
                    actions: [MessageBox.Action.OK]
                });
                return;
            }

            // Additional security validation
            var sToken = oModel.getProperty("/jwtToken").trim();
            var parts = sToken.split('.');
            
            if (parts.length !== 3) {
                MessageBox.error("Invalid JWT format. A valid JWT must have exactly 3 parts separated by dots (header.payload.signature).", {
                    title: "Invalid JWT Format",
                    icon: MessageBox.Icon.ERROR,
                    actions: [MessageBox.Action.OK]
                });
                return;
            }

            var sJwtToken = oModel.getProperty("/jwtToken").trim();

            // Show loading
            oModel.setProperty("/jwtBusy", true);
            oModel.setProperty("/hasJwtResults", false);
            oModel.setProperty("/hasJwtError", false);

            // Make API call
            fetch('/api/decode-jwt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: sJwtToken
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || 'JWT decode failed');
                    });
                }
                return response.json();
            })
            .then(data => {
                this._displayResults(data);
            })
            .catch(error => {
                this._displayError(error.message);
            })
            .finally(() => {
                oModel.setProperty("/jwtBusy", false);
            });
        },

        _displayResults: function (data) {
            var oModel = this.getView().getModel();
            
            // Process the JWT results for display
            const processedResults = {
                format: "JWT (JSON Web Token)",
                parts: data.parts || 3,
                length: data.originalToken ? data.originalToken.length : 0,
                isExpired: data.payload && data.payload.exp ? Date.now() / 1000 > data.payload.exp : false,
                header: this._processHeader(data.header),
                payload: this._processPayload(data.payload),
                signature: this._processSignature(data.signature, data.header),
                security: this._analyzeJWTSecurity(data)
            };

            // Set results in model
            oModel.setProperty("/jwtResults", processedResults);
            oModel.setProperty("/hasJwtResults", true);
            oModel.setProperty("/hasJwtError", false);
        },

        _processHeader: function (header) {
            return {
                alg: header.alg || 'Unknown',
                typ: header.typ || 'Unknown',
                kid: header.kid,
                raw: JSON.stringify(header, null, 2)
            };
        },

        _processPayload: function (payload) {
            var standardClaims = {
                iss: payload.iss,
                sub: payload.sub,
                aud: Array.isArray(payload.aud) ? payload.aud.join(', ') : payload.aud,
                exp: payload.exp,
                iat: payload.iat,
                nbf: payload.nbf,
                jti: payload.jti,
                expFormatted: payload.exp ? new Date(payload.exp * 1000).toLocaleString() : undefined,
                iatFormatted: payload.iat ? new Date(payload.iat * 1000).toLocaleString() : undefined,
                nbfFormatted: payload.nbf ? new Date(payload.nbf * 1000).toLocaleString() : undefined
            };

            // Extract custom claims (non-standard)
            var customClaims = [];
            var standardClaimKeys = ['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti'];
            
            for (var key in payload) {
                if (payload.hasOwnProperty(key) && !standardClaimKeys.includes(key)) {
                    customClaims.push({
                        key: key,
                        value: typeof payload[key] === 'object' ? JSON.stringify(payload[key]) : String(payload[key])
                    });
                }
            }

            return {
                ...standardClaims,
                customClaims: customClaims,
                hasStandardClaims: Object.values(standardClaims).some(val => val !== undefined && val !== null),
                hasCustomClaims: customClaims.length > 0,
                raw: JSON.stringify(payload, null, 2)
            };
        },

        _processSignature: function (signature, header) {
            return {
                algorithm: header.alg || 'Unknown',
                length: signature ? signature.length : 0,
                base64: signature || 'No signature'
            };
        },

        _analyzeJWTSecurity: function (data) {
            var recommendations = [];
            var algorithmSecure = true;
            var algorithmAssessment = "Secure";

            // Analyze algorithm
            if (data.header.alg === 'none') {
                algorithmSecure = false;
                algorithmAssessment = "Insecure (No signature)";
                recommendations.push("'none' algorithm means no signature verification - highly insecure");
            } else if (data.header.alg === 'HS256') {
                algorithmAssessment = "Secure (HMAC SHA-256)";
                recommendations.push("Ensure secret key is strong and properly managed");
            } else if (data.header.alg && data.header.alg.startsWith('RS')) {
                algorithmAssessment = "Secure (RSA with SHA)";
                recommendations.push("RSA signature provides good security");
            } else if (data.header.alg && data.header.alg.startsWith('ES')) {
                algorithmAssessment = "Secure (ECDSA)";
                recommendations.push("ECDSA provides excellent security with smaller keys");
            } else {
                algorithmAssessment = "Unknown algorithm";
                recommendations.push("Verify that the algorithm is supported and secure");
            }

            // Analyze expiration
            var notExpired = true;
            var expirationStatus = "Valid";
            var currentTime = Math.floor(Date.now() / 1000);

            if (!data.payload.exp) {
                expirationStatus = "No expiration set";
                recommendations.push("Consider setting an expiration time (exp) for better security");
            } else if (currentTime > data.payload.exp) {
                notExpired = false;
                expirationStatus = "EXPIRED";
                recommendations.push("Token has expired and should not be accepted");
            } else {
                var timeUntilExpiry = data.payload.exp - currentTime;
                var daysUntilExpiry = Math.floor(timeUntilExpiry / 86400);
                if (daysUntilExpiry < 1) {
                    expirationStatus = "Expires soon (less than 1 day)";
                    recommendations.push("Token expires soon - consider refreshing");
                } else {
                    expirationStatus = `Valid (expires in ${daysUntilExpiry} days)`;
                }
            }

            // Additional security recommendations
            if (!data.payload.iss) {
                recommendations.push("Consider adding issuer (iss) claim for better token validation");
            }
            if (!data.payload.aud) {
                recommendations.push("Consider adding audience (aud) claim to specify intended recipients");
            }

            return {
                algorithmSecure: algorithmSecure,
                algorithmAssessment: algorithmAssessment,
                notExpired: notExpired,
                expirationStatus: expirationStatus,
                recommendations: recommendations
            };
        },

        _displayError: function (errorMessage) {
            var oModel = this.getView().getModel();
            
            oModel.setProperty("/jwtError", {
                message: errorMessage,
                details: "Please verify that the JWT token is properly formatted and try again.",
                timestamp: new Date().toISOString()
            });
            oModel.setProperty("/hasJwtError", true);
            oModel.setProperty("/hasJwtResults", false);
        },

        formatJSON: function (sJson) {
            if (!sJson) return "";
            
            try {
                // Format JSON with syntax highlighting using HTML
                var formatted = sJson
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"([^"]+)":/g, '<span style="color: #0066cc; font-weight: bold;">"$1":</span>')
                    .replace(/: "([^"]*)"/g, ': <span style="color: #008000;">"$1"</span>')
                    .replace(/: ([0-9]+)/g, ': <span style="color: #ff6600;">$1</span>')
                    .replace(/: (true|false|null)/g, ': <span style="color: #cc0066;">$1</span>');
                    
                return '<pre style="margin: 0; white-space: pre-wrap; word-wrap: break-word;">' + formatted + '</pre>';
            } catch (e) {
                return '<pre style="margin: 0;">' + sJson + '</pre>';
            }
        }
    });
});
