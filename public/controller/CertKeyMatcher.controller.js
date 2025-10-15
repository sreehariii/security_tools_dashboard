sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("sslchecker.controller.CertKeyMatcher", {

        onInit: function () {
            // Initialize value states
            var oModel = this.getView().getModel();
            if (oModel) {
                oModel.setProperty("/certValueState", "None");
                oModel.setProperty("/certValueStateText", "");
                oModel.setProperty("/keyValueState", "None");
                oModel.setProperty("/keyValueStateText", "");
            }
        },

        onClearForm: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/certificate", "");
            oModel.setProperty("/privateKey", "");
            oModel.setProperty("/hasMatchResults", false);
            oModel.setProperty("/hasMatchError", false);
            oModel.setProperty("/certValueState", "None");
            oModel.setProperty("/certValueStateText", "");
            oModel.setProperty("/keyValueState", "None");
            oModel.setProperty("/keyValueStateText", "");
            MessageToast.show("Form cleared");
        },

        _validateInputs: function () {
            var oModel = this.getView().getModel();
            var sCertificate = oModel.getProperty("/certificate");
            var sPrivateKey = oModel.getProperty("/privateKey");
            var bValid = true;
            var sMessage = "";

            // Reset value states
            oModel.setProperty("/certValueState", "None");
            oModel.setProperty("/certValueStateText", "");
            oModel.setProperty("/keyValueState", "None");
            oModel.setProperty("/keyValueStateText", "");

            // Validate certificate
            if (!sCertificate || sCertificate.trim() === "") {
                oModel.setProperty("/certValueState", "Error");
                oModel.setProperty("/certValueStateText", "Certificate is required");
                sMessage = "Please paste your certificate in PEM format.\n\nIt should start with:\n-----BEGIN CERTIFICATE-----";
                bValid = false;
            } else {
                var sCertTrimmed = sCertificate.trim();
                if (!sCertTrimmed.includes("-----BEGIN CERTIFICATE-----") || 
                    !sCertTrimmed.includes("-----END CERTIFICATE-----")) {
                    oModel.setProperty("/certValueState", "Error");
                    oModel.setProperty("/certValueStateText", "Invalid certificate format. Expected PEM format.");
                    bValid = false;
                } else if (sCertTrimmed.length > 50000) {
                    oModel.setProperty("/certValueState", "Error");
                    oModel.setProperty("/certValueStateText", "Certificate too large");
                    bValid = false;
                }
            }

            // Validate private key
            if (!sPrivateKey || sPrivateKey.trim() === "") {
                oModel.setProperty("/keyValueState", "Error");
                oModel.setProperty("/keyValueStateText", "Private key is required");
                if (!sMessage) {
                    sMessage = "Please paste your private key in PEM format.\n\nIt should start with:\n-----BEGIN PRIVATE KEY-----\nor\n-----BEGIN RSA PRIVATE KEY-----";
                }
                bValid = false;
            } else {
                var sKeyTrimmed = sPrivateKey.trim();
                if (!sKeyTrimmed.includes("-----BEGIN") || 
                    !sKeyTrimmed.includes("PRIVATE KEY-----")) {
                    oModel.setProperty("/keyValueState", "Error");
                    oModel.setProperty("/keyValueStateText", "Invalid private key format. Expected PEM format.");
                    bValid = false;
                } else if (sKeyTrimmed.length > 50000) {
                    oModel.setProperty("/keyValueState", "Error");
                    oModel.setProperty("/keyValueStateText", "Private key too large");
                    bValid = false;
                }
            }

            return {
                isValid: bValid,
                message: sMessage || "Please correct the errors in the form"
            };
        },

        onMatchCertKey: function () {
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

            var sCertificate = oModel.getProperty("/certificate");
            var sPrivateKey = oModel.getProperty("/privateKey");

            // Show loading
            oModel.setProperty("/matchBusy", true);
            oModel.setProperty("/hasMatchResults", false);
            oModel.setProperty("/hasMatchError", false);

            // Make API call
            fetch('/api/match-cert-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    certificate: sCertificate.trim(),
                    privateKey: sPrivateKey.trim()
                })
            })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { response: response, data: data };
                });
            })
            .then(function (result) {
                oModel.setProperty("/matchBusy", false);
                
                if (result.response.ok) {
                    this._displayResults(result.data);
                } else {
                    this._displayError(result.data.error, result.data.details);
                }
            }.bind(this))
            .catch(function (error) {
                oModel.setProperty("/matchBusy", false);
                console.error("Certificate Key Match Error:", error);
                this._displayError("Network Error", "Failed to connect to the server. Please check your connection and try again.");
            }.bind(this));
        },

        _displayResults: function (data) {
            var oModel = this.getView().getModel();
            
            // Determine match status
            var statusState = data.matches ? "Success" : "Error";
            var statusText = data.matches ? "Keys Match" : "Keys Don't Match";
            var statusIcon = data.matches ? "sap-icon://accept" : "sap-icon://decline";
            
            var messageType = data.matches ? "Success" : "Error";
            var message = data.matchDetails;

            // Format certificate info
            var certInfo = {
                subject: this._formatSubject(data.certificate.subject),
                issuer: this._formatSubject(data.certificate.issuer),
                validFrom: data.certificate.validFrom,
                validTo: data.certificate.validTo,
                daysUntilExpiration: data.certificate.daysUntilExpiration,
                serialNumber: data.certificate.serialNumber,
                fingerprint: data.certificate.fingerprint,
                fingerprint256: data.certificate.fingerprint256
            };

            // Determine expiry status
            var expiryState = "Success";
            var expiryText = "";
            if (typeof data.certificate.daysUntilExpiration === 'number') {
                if (data.certificate.daysUntilExpiration < 0) {
                    expiryState = "Error";
                    expiryText = "Expired";
                } else if (data.certificate.daysUntilExpiration < 30) {
                    expiryState = "Warning";
                    expiryText = "Expires Soon";
                } else {
                    expiryText = "Valid";
                }
            } else {
                expiryText = "Unknown";
            }

            var results = {
                statusText: statusText,
                statusState: statusState,
                statusIcon: statusIcon,
                message: message,
                messageType: messageType,
                matches: data.matches,
                
                // Certificate information
                certificate: certInfo,
                expiryState: expiryState,
                expiryText: expiryText,
                showExpiryDays: typeof data.certificate.daysUntilExpiration === 'number',
                expiryDays: data.certificate.daysUntilExpiration + " days",
                
                // Private key information
                privateKey: {
                    type: data.privateKey.type,
                    size: data.privateKey.size,
                    format: data.privateKey.format
                },
                
                // Compatibility information
                compatibility: {
                    keyType: data.compatibility.keyType,
                    supported: data.compatibility.supported,
                    algorithm: data.compatibility.algorithm,
                    supportedText: data.compatibility.supported ? "✓ Supported" : "✗ Not Supported",
                    supportedState: data.compatibility.supported ? "Success" : "Warning"
                }
            };

            oModel.setProperty("/matchResults", results);
            oModel.setProperty("/hasMatchResults", true);
            
            MessageToast.show("Certificate and key comparison completed");
        },

        _displayError: function (error, details) {
            var oModel = this.getView().getModel();
            var errorMsg = error + (details ? ": " + details : "");
            
            oModel.setProperty("/matchErrorMessage", errorMsg);
            oModel.setProperty("/hasMatchError", true);
            oModel.setProperty("/hasMatchResults", false);
        },

        _formatSubject: function (subject) {
            if (typeof subject === 'string') {
                return subject;
            }

            if (typeof subject === 'object' && subject !== null) {
                var parts = [];
                if (subject.CN) parts.push("CN=" + subject.CN);
                if (subject.O) parts.push("O=" + subject.O);
                if (subject.OU) parts.push("OU=" + subject.OU);
                if (subject.C) parts.push("C=" + subject.C);
                return parts.join(", ") || "N/A";
            }

            return subject || "N/A";
        },

        onCopyCertificate: function () {
            var oModel = this.getView().getModel();
            var sCertificate = oModel.getProperty("/certificate");
            this._copyToClipboard(sCertificate, "Certificate");
        },

        onCopyPrivateKey: function () {
            var oModel = this.getView().getModel();
            var sPrivateKey = oModel.getProperty("/privateKey");
            this._copyToClipboard(sPrivateKey, "Private Key");
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
        }
    });
});
