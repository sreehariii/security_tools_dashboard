sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("sslchecker.controller.SSLChecker", {

        onInit: function () {
            // Initialize value states
            var oModel = this.getView().getModel();
            if (oModel) {
                oModel.setProperty("/urlValueState", "None");
                oModel.setProperty("/urlValueStateText", "");
                oModel.setProperty("/portValueState", "None");
                oModel.setProperty("/portValueStateText", "");
            }
        },

        onClearForm: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/sslUrl", "");
            oModel.setProperty("/sslPort", "");
            oModel.setProperty("/hasResults", false);
            oModel.setProperty("/hasError", false);
            oModel.setProperty("/urlValueState", "None");
            oModel.setProperty("/urlValueStateText", "");
            oModel.setProperty("/portValueState", "None");
            oModel.setProperty("/portValueStateText", "");
            MessageToast.show("Form cleared");
        },

        onCopyFingerprint: function (oEvent) {
            var oButton = oEvent.getSource();
            var sFingerprint = oButton.data("fingerprint");
            this._copyToClipboard(sFingerprint, "SHA1 Fingerprint");
        },

        onCopyFingerprint256: function (oEvent) {
            var oButton = oEvent.getSource();
            var sFingerprint = oButton.data("fingerprint");
            this._copyToClipboard(sFingerprint, "SHA256 Fingerprint");
        },

        _copyToClipboard: function (sText, sLabel) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(sText).then(function () {
                    MessageToast.show(sLabel + " copied to clipboard");
                }).catch(function (err) {
                    MessageToast.show("Failed to copy to clipboard");
                });
            } else {
                // Fallback for older browsers
                var textArea = document.createElement("textarea");
                textArea.value = sText;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    MessageToast.show(sLabel + " copied to clipboard");
                } catch (err) {
                    MessageToast.show("Failed to copy to clipboard");
                }
                document.body.removeChild(textArea);
            }
        },

        _validateInputs: function () {
            var oModel = this.getView().getModel();
            var sUrl = oModel.getProperty("/sslUrl");
            var sPort = oModel.getProperty("/sslPort");
            var bValid = true;
            var sMessage = "";

            // Reset value states
            oModel.setProperty("/urlValueState", "None");
            oModel.setProperty("/urlValueStateText", "");
            oModel.setProperty("/portValueState", "None");
            oModel.setProperty("/portValueStateText", "");

            // Validate URL
            if (!sUrl || sUrl.trim() === "") {
                oModel.setProperty("/urlValueState", "Error");
                oModel.setProperty("/urlValueStateText", "URL is required");
                sMessage = "Please enter a URL to check the SSL certificate.\n\nExample: google.com or https://google.com";
                bValid = false;
            } else {
                // Enhanced URL validation
                var sUrlTrimmed = sUrl.trim();
                var isValidUrl = false;
                
                // Check URL length
                if (sUrlTrimmed.length > 2000) {
                    oModel.setProperty("/urlValueState", "Error");
                    oModel.setProperty("/urlValueStateText", "URL is too long");
                    bValid = false;
                } else {
                    try {
                        // Try to extract hostname for validation
                        var hostname = sUrlTrimmed;
                        
                        // Remove protocol if present
                        if (sUrlTrimmed.match(/^[a-zA-Z]+:\/\//)) {
                            var url = new URL(sUrlTrimmed);
                            hostname = url.hostname;
                        } else if (sUrlTrimmed.match(/^https?:\/\//)) {
                            var url = new URL(sUrlTrimmed);
                            hostname = url.hostname;
                        } else {
                            // Add protocol for parsing
                            var url = new URL('https://' + sUrlTrimmed);
                            hostname = url.hostname;
                        }
                        
                        // Check for valid characters
                        if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
                            throw new Error('Invalid characters');
                        }
                        
                        // Check domain pattern
                        var domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
                        if (domainPattern.test(hostname) && hostname.length <= 253 &&
                            !hostname.toLowerCase().includes('localhost') && hostname !== '0.0.0.0') {
                            
                            // Also validate it's not a private IP
                            var ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
                            if (ipPattern.test(hostname)) {
                                var parts = hostname.split('.');
                                var firstOctet = parseInt(parts[0]);
                                var secondOctet = parseInt(parts[1]);
                                
                                if (firstOctet === 127 || firstOctet === 10 || 
                                    (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
                                    (firstOctet === 192 && secondOctet === 168) ||
                                    firstOctet === 169 || firstOctet >= 224) {
                                    throw new Error('Private IP not allowed');
                                }
                            }
                            
                            isValidUrl = true;
                        }
                    } catch (error) {
                        // URL parsing or validation failed
                    }
                    
                    if (!isValidUrl) {
                        oModel.setProperty("/urlValueState", "Error");
                        oModel.setProperty("/urlValueStateText", "Please enter a valid public domain or URL");
                        bValid = false;
                    }
                }
            }

            // Validate port
            if (sPort && sPort.trim() !== "") {
                var nPort = parseInt(sPort);
                if (isNaN(nPort) || nPort < 1 || nPort > 65535) {
                    oModel.setProperty("/portValueState", "Error");
                    oModel.setProperty("/portValueStateText", "Port must be between 1 and 65535");
                    if (!sMessage) {
                        sMessage = "Please enter a valid port number (1-65535).";
                    }
                    bValid = false;
                }
            }

            return {
                isValid: bValid,
                message: sMessage || "Please correct the errors in the form"
            };
        },

        onCheckSSL: function () {
            var oModel = this.getView().getModel();
            
            // Validate inputs
            var validationResult = this._validateInputs();
            if (!validationResult.isValid) {
                MessageBox.error(validationResult.message, {
                    title: "Missing Required Information",
                    icon: MessageBox.Icon.WARNING,
                    actions: [MessageBox.Action.OK]
                });
                return;
            }

            var sUrl = oModel.getProperty("/sslUrl");
            var sPort = oModel.getProperty("/sslPort");

            // Show loading
            oModel.setProperty("/busy", true);
            oModel.setProperty("/hasResults", false);
            oModel.setProperty("/hasError", false);

            // Make API call
            fetch('/api/check-ssl', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: sUrl.trim(),
                    port: sPort ? parseInt(sPort) : undefined
                })
            })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { response: response, data: data };
                });
            })
            .then(function (result) {
                oModel.setProperty("/busy", false);
                
                if (result.response.ok) {
                    this._displayResults(result.data);
                } else {
                    this._displayError(result.data.error, result.data.details);
                }
            }.bind(this))
            .catch(function (error) {
                oModel.setProperty("/busy", false);
                console.error("SSL Check Error:", error);
                this._displayError("Network Error", "Failed to connect to the server. Please check your connection and try again.");
            }.bind(this));
        },

        _displayResults: function (data) {
            var oModel = this.getView().getModel();
            
            // Determine status
            var statusState = "Success";
            var statusText = "Valid & Secure";
            var statusIcon = "sap-icon://accept";

            if (!data.valid || !data.domainMatch) {
                statusState = "Error";
                statusText = "Invalid Certificate";
                statusIcon = "sap-icon://error";
            } else if (data.certificate.daysUntilExpiration < 30) {
                statusState = "Warning";
                statusText = "Valid (Expiring Soon)";
                statusIcon = "sap-icon://warning";
            }

            // Expiry message
            var expiryMessage = "";
            var expiryType = "Success";
            var showExpiry = true;

            if (data.certificate.daysUntilExpiration < 0) {
                expiryMessage = "⚠️ Certificate Expired! This certificate expired " + Math.abs(data.certificate.daysUntilExpiration) + " days ago.";
                expiryType = "Error";
            } else if (data.certificate.daysUntilExpiration < 7) {
                expiryMessage = "⚠️ Critical: Expires Very Soon! Only " + data.certificate.daysUntilExpiration + " days remaining.";
                expiryType = "Error";
            } else if (data.certificate.daysUntilExpiration < 30) {
                expiryMessage = "⚠️ Warning: Expires Soon. " + data.certificate.daysUntilExpiration + " days remaining.";
                expiryType = "Warning";
            } else {
                expiryMessage = "✓ Certificate Valid. " + data.certificate.daysUntilExpiration + " days remaining until expiration.";
                expiryType = "Success";
            }

            // Days until expiration state
            var daysState = "Success";
            if (data.certificate.daysUntilExpiration < 0) {
                daysState = "Error";
            } else if (data.certificate.daysUntilExpiration < 30) {
                daysState = "Warning";
            }

            // Format certificate chain
            var chain = data.certificateChain.map(function (cert, index) {
                var level = index === 0 ? "Server Certificate" :
                    index === data.certificateChain.length - 1 ? "Root CA" :
                    "Intermediate CA " + index;

                return {
                    level: level,
                    subject: this._formatSubject(cert.subject),
                    issuer: this._formatSubject(cert.issuer),
                    valid_from: cert.valid_from,
                    valid_to: cert.valid_to,
                    serialNumber: cert.serialNumber,
                    fingerprint: cert.fingerprint
                };
            }.bind(this));

            // Format SAN list
            var sanList = [];
            if (data.certificate.subjectaltname && data.certificate.subjectaltname.length > 0) {
                sanList = data.certificate.subjectaltname.map(function (san) {
                    return { name: san };
                });
            }

            // Set results
            var results = {
                statusText: statusText,
                statusState: statusState,
                statusIcon: statusIcon,
                hostname: data.hostname + ":" + data.port,
                ipAddress: data.ipAddress,
                
                showExpiry: showExpiry,
                expiryMessage: expiryMessage,
                expiryType: expiryType,
                
                certValid: data.valid ? "✓ Yes" : "✗ No",
                certValidState: data.valid ? "Success" : "Error",
                domainMatch: data.domainMatch ? "✓ Yes" : "✗ No",
                domainMatchState: data.domainMatch ? "Success" : "Error",
                
                showMatchedWith: !!data.domainMatchInfo.matchedWith,
                matchedWith: data.domainMatchInfo.matchedWith || "",
                
                showAuthError: !!data.authorizationError,
                authError: data.authorizationError || "",
                
                cn: data.certificate.subject.CN || "N/A",
                org: data.certificate.subject.O || "N/A",
                validFrom: data.certificate.valid_from,
                validTo: data.certificate.valid_to,
                daysText: data.certificate.daysUntilExpiration + " days",
                daysState: daysState,
                issuerCN: data.certificate.issuer.CN || "N/A",
                issuerOrg: data.certificate.issuer.O || "N/A",
                serial: data.certificate.serialNumber,
                protocol: data.certificate.protocol,
                cipher: data.certificate.cipher.name + " (" + data.certificate.cipher.version + ")",
                fingerprint: data.certificate.fingerprint,
                fingerprint256: data.certificate.fingerprint256,
                
                showSAN: sanList.length > 0,
                sanList: sanList,
                
                chainLength: data.chainLength,
                chain: chain
            };

            oModel.setProperty("/results", results);
            oModel.setProperty("/hasResults", true);
            
            MessageToast.show("SSL Certificate check completed");
        },

        _displayError: function (error, details) {
            var oModel = this.getView().getModel();
            var errorMsg = error + (details ? ": " + details : "");
            
            oModel.setProperty("/errorMessage", errorMsg);
            oModel.setProperty("/hasError", true);
            oModel.setProperty("/hasResults", false);
        },

        _formatSubject: function (subject) {
            if (typeof subject === 'string') {
                return subject;
            }

            var parts = [];
            if (subject.CN) parts.push("CN=" + subject.CN);
            if (subject.O) parts.push("O=" + subject.O);
            if (subject.OU) parts.push("OU=" + subject.OU);
            if (subject.C) parts.push("C=" + subject.C);

            return parts.join(", ") || "N/A";
        },

        onExportResults: function () {
            var oModel = this.getView().getModel();
            var oResults = oModel.getProperty("/results");
            
            if (!oResults || !oResults.hostname) {
                MessageToast.show("No results to export");
                return;
            }

            // Create export data
            var exportData = {
                hostname: oResults.hostname,
                status: oResults.statusText,
                validFrom: oResults.validFrom,
                validTo: oResults.validTo,
                daysUntilExpiration: oResults.daysText,
                commonName: oResults.cn,
                organization: oResults.org,
                issuerCN: oResults.issuerCN,
                issuerOrg: oResults.issuerOrg,
                serialNumber: oResults.serial,
                protocol: oResults.protocol,
                cipher: oResults.cipher,
                fingerprintSHA1: oResults.fingerprint,
                fingerprintSHA256: oResults.fingerprint256,
                subjectAltNames: oResults.sanList ? oResults.sanList.map(function(s) { return s.name; }) : [],
                certificateChain: oResults.chain || []
            };

            // Convert to JSON
            var jsonStr = JSON.stringify(exportData, null, 2);
            
            // Create blob and download
            var blob = new Blob([jsonStr], { type: "application/json" });
            var url = window.URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            a.download = "ssl-certificate-" + oResults.hostname.replace(/[^a-z0-9]/gi, '_') + ".json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            MessageToast.show("Certificate details exported");
        }
    });
});

