sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("sslchecker.controller.CertDecoder", {

        onInit: function () {
            // Initialize value states
            var oModel = this.getView().getModel();
            if (oModel) {
                oModel.setProperty("/certDecodeValueState", "None");
                oModel.setProperty("/certDecodeValueStateText", "");
            }
        },

        onClearForm: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/certificateToDecode", "");
            oModel.setProperty("/hasDecodeResults", false);
            oModel.setProperty("/hasDecodeError", false);
            oModel.setProperty("/certDecodeValueState", "None");
            oModel.setProperty("/certDecodeValueStateText", "");
            MessageToast.show("Form cleared");
        },

        _validateInputs: function () {
            var oModel = this.getView().getModel();
            var sCertificate = oModel.getProperty("/certificateToDecode");
            var bValid = true;
            var sMessage = "";

            // Reset value states
            oModel.setProperty("/certDecodeValueState", "None");
            oModel.setProperty("/certDecodeValueStateText", "");

            // Validate certificate
            if (!sCertificate || sCertificate.trim() === "") {
                oModel.setProperty("/certDecodeValueState", "Error");
                oModel.setProperty("/certDecodeValueStateText", "Certificate is required");
                sMessage = "Please paste your certificate in PEM format to decode.\n\nIt should start with:\n-----BEGIN CERTIFICATE-----";
                bValid = false;
            } else {
                var sCertTrimmed = sCertificate.trim();
                if (!sCertTrimmed.includes("-----BEGIN CERTIFICATE-----") || 
                    !sCertTrimmed.includes("-----END CERTIFICATE-----")) {
                    oModel.setProperty("/certDecodeValueState", "Error");
                    oModel.setProperty("/certDecodeValueStateText", "Invalid certificate format. Expected PEM format.");
                    bValid = false;
                } else if (sCertTrimmed.length > 100000) {
                    oModel.setProperty("/certDecodeValueState", "Error");
                    oModel.setProperty("/certDecodeValueStateText", "Certificate too large (max 100KB)");
                    bValid = false;
                }
            }

            return {
                isValid: bValid,
                message: sMessage || "Please correct the errors in the form"
            };
        },

        onDecodeCertificate: function () {
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

            var sCertificate = oModel.getProperty("/certificateToDecode");

            // Show loading
            oModel.setProperty("/decodeBusy", true);
            oModel.setProperty("/hasDecodeResults", false);
            oModel.setProperty("/hasDecodeError", false);

            // Make API call
            fetch('/api/decode-certificate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    certificate: sCertificate.trim()
                })
            })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { response: response, data: data };
                });
            })
            .then(function (result) {
                oModel.setProperty("/decodeBusy", false);
                
                if (result.response.ok) {
                    this._displayResults(result.data);
                } else {
                    this._displayError(result.data.error, result.data.details);
                }
            }.bind(this))
            .catch(function (error) {
                oModel.setProperty("/decodeBusy", false);
                console.error("Certificate Decode Error:", error);
                this._displayError("Network Error", "Failed to connect to the server. Please check your connection and try again.");
            }.bind(this));
        },

        _displayResults: function (data) {
            var oModel = this.getView().getModel();
            
            // Process each certificate
            var processedCerts = data.certificates.map(function(cert, index) {
                if (cert.error) {
                    return {
                        position: cert.position,
                        hasError: true,
                        error: cert.error,
                        certLevel: cert.certLevel
                    };
                }

                // Determine validity status
                var validityState = "Success";
                var validityText = "Valid";
                var validityIcon = "sap-icon://accept";

                if (typeof cert.daysUntilExpiration === 'number') {
                    if (cert.daysUntilExpiration < 0) {
                        validityState = "Error";
                        validityText = "Expired";
                        validityIcon = "sap-icon://error";
                    } else if (cert.daysUntilExpiration < 30) {
                        validityState = "Warning";
                        validityText = "Expires Soon";
                        validityIcon = "sap-icon://warning";
                    }
                }

                // Determine certificate level state
                var levelState = "Information";
                if (cert.certLevel === "Root CA") {
                    levelState = "Success";
                } else if (cert.certLevel === "Intermediate CA") {
                    levelState = "Warning";
                }

                return {
                    position: cert.position,
                    hasError: false,
                    
                    // Basic Info
                    certLevel: cert.certLevel,
                    levelState: levelState,
                    version: cert.version || "Unknown",
                    serialNumber: cert.serialNumber || "Unknown",
                    
                    // Subject & Issuer
                    subject: cert.subject || "Unknown",
                    issuer: cert.issuer || "Unknown",
                    
                    // Validity
                    validFrom: cert.validFrom || "Unknown",
                    validTo: cert.validTo || "Unknown",
                    daysUntilExpiration: cert.daysUntilExpiration,
                    validityState: validityState,
                    validityText: validityText,
                    validityIcon: validityIcon,
                    showDaysExpiry: typeof cert.daysUntilExpiration === 'number',
                    daysExpiryText: typeof cert.daysUntilExpiration === 'number' ? 
                        cert.daysUntilExpiration + " days" : "Unknown",
                    
                    // Fingerprints
                    fingerprint: cert.fingerprint || "Unknown",
                    fingerprint256: cert.fingerprint256 || "Unknown",
                    
                    // Public Key Info
                    publicKeyAlgorithm: cert.publicKeyAlgorithm || "Unknown",
                    publicKeySize: cert.publicKeyInfo?.size || "Unknown",
                    signatureAlgorithm: cert.signatureAlgorithm || "Unknown",
                    
                    // Extensions
                    hasExtensions: cert.extensions && cert.extensions.length > 0,
                    extensions: cert.extensions || [],
                    extensionCount: cert.extensions ? cert.extensions.length : 0
                };
            });

            // Extract summary information from the main certificate (first one - End Entity)
            var mainCert = processedCerts[0];
            var summaryInfo = {};
            
            if (mainCert && !mainCert.hasError) {
                // Extract Common Name from subject
                var commonName = "Unknown";
                if (mainCert.subject && mainCert.subject.includes("CN=")) {
                    var cnMatch = mainCert.subject.match(/CN=([^,]+)/);
                    if (cnMatch) {
                        commonName = cnMatch[1].trim();
                    }
                }
                
                // Extract SANs from the certificate data
                var sans = [];
                var originalCert = data.certificates[0];
                
                // First try to get SANs from extensions
                if (originalCert && originalCert.extensions) {
                    var sanExtension = originalCert.extensions.find(function(ext) {
                        return ext.name === 'Subject Alternative Name';
                    });
                    if (sanExtension && sanExtension.value) {
                        // Parse SAN values (format: "DNS:example.com, DNS:www.example.com")
                        sans = sanExtension.value.split(', ')
                            .map(function(san) { return san.replace('DNS:', '').trim(); })
                            .filter(function(san) { return san && san !== commonName; });
                    }
                }
                
                // Fallback: try to get SANs from subjectaltname property if extensions didn't work
                if (sans.length === 0 && originalCert && originalCert.subjectaltname) {
                    sans = originalCert.subjectaltname
                        .map(function(san) { return san.replace('DNS:', '').trim(); })
                        .filter(function(san) { return san && san !== commonName; });
                }
                
                summaryInfo = {
                    commonName: commonName,
                    sans: sans,
                    hasSans: sans.length > 0,
                    sanCount: sans.length,
                    sanText: sans.length > 0 ? sans.slice(0, 3).join(', ') + (sans.length > 3 ? ` (+${sans.length - 3} more)` : '') : 'None',
                    expiryDate: mainCert.validTo || "Unknown",
                    serialNumber: mainCert.serialNumber || "Unknown",
                    validityStatus: mainCert.validityText || "Unknown",
                    validityState: mainCert.validityState || "Information",
                    validityIcon: mainCert.validityIcon || "sap-icon://question-mark",
                    daysUntilExpiration: mainCert.daysUntilExpiration,
                    showDaysExpiry: mainCert.showDaysExpiry,
                    daysExpiryText: mainCert.daysExpiryText || "Unknown"
                };
            } else {
                summaryInfo = {
                    commonName: "Certificate Error",
                    sans: [],
                    hasSans: false,
                    sanCount: 0,
                    sanText: 'Unable to extract',
                    expiryDate: "Unknown",
                    serialNumber: "Unknown", 
                    validityStatus: "Invalid",
                    validityState: "Error",
                    validityIcon: "sap-icon://error",
                    daysUntilExpiration: 0,
                    showDaysExpiry: false,
                    daysExpiryText: "Unknown"
                };
            }

            var results = {
                certificatesFound: data.certificatesFound,
                isChain: data.certificatesFound > 1,
                chainValid: data.chainValid,
                decodedAt: data.decodedAt,
                certificates: processedCerts,
                
                // Enhanced summary info
                summaryText: data.certificatesFound === 1 ? 
                    "1 certificate decoded" : 
                    `${data.certificatesFound} certificates decoded (certificate chain)`,
                summaryState: data.certificatesFound > 1 ? "Information" : "Success",
                
                // Main certificate summary
                summary: summaryInfo
            };

            oModel.setProperty("/decodeResults", results);
            oModel.setProperty("/hasDecodeResults", true);
            
            MessageToast.show("Certificate decoding completed");
        },

        _displayError: function (error, details) {
            var oModel = this.getView().getModel();
            var errorMsg = error + (details ? ": " + details : "");
            
            oModel.setProperty("/decodeErrorMessage", errorMsg);
            oModel.setProperty("/hasDecodeError", true);
            oModel.setProperty("/hasDecodeResults", false);
        },

        onCopyCertificate: function () {
            var oModel = this.getView().getModel();
            var sCertificate = oModel.getProperty("/certificateToDecode");
            this._copyToClipboard(sCertificate, "Certificate");
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

        onCopySubject: function (oEvent) {
            var oButton = oEvent.getSource();
            var sSubject = oButton.data("subject");
            this._copyToClipboard(sSubject, "Subject");
        },

        onCopyIssuer: function (oEvent) {
            var oButton = oEvent.getSource();
            var sIssuer = oButton.data("issuer");
            this._copyToClipboard(sIssuer, "Issuer");
        },

        _copyToClipboard: function (sText, sLabel) {
            if (!sText || sText.trim() === "") {
                MessageToast.show("Nothing to copy");
                return;
            }

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

        onLoadSample: function () {
            var oModel = this.getView().getModel();
            var sampleCert = `-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----`;

            oModel.setProperty("/certificateToDecode", sampleCert);
            MessageToast.show("Sample certificate loaded (Let's Encrypt ISRG Root X1)");
        }
    });
});
