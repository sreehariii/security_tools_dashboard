sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("sslchecker.controller.CSRDecoder", {

        onInit: function () {
            // Initialize value states
            var oModel = this.getView().getModel();
            if (oModel) {
                oModel.setProperty("/csrDecodeValueState", "None");
                oModel.setProperty("/csrDecodeValueStateText", "");
            }
        },

        onClearForm: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/csrToDecode", "");
            oModel.setProperty("/hasCSRDecodeResults", false);
            oModel.setProperty("/hasCSRDecodeError", false);
            oModel.setProperty("/csrDecodeValueState", "None");
            oModel.setProperty("/csrDecodeValueStateText", "");
            MessageToast.show("Form cleared");
        },

        onLoadSampleCSR: function () {
            var sampleCSR = `-----BEGIN CERTIFICATE REQUEST-----
MIIGpDCCBIwCAQAwgaMxCzAJBgNVBAYTAkRFMRowGAYDVQQIDBFCYWRlbi1XdXJ0
dGVtYmVyZzERMA8GA1UEBwwIV2FsbGRvcmYxDzANBgNVBAoMBlNBUCBTRTEjMCEG
A1UECwwaU0FQIENsb3VkIE1hbmFnZWQgU2VydmljZXMxLzAtBgNVBAMMJiouYXBp
bWFuYWdlbWVudC5hcDEwLmhhbmEub25kZW1hbmQuY29tMIICIjANBgkqhkiG9w0B
AQEFAAOCAg8AMIICCgKCAgEAzY4j8WLIeYPqZoeBZA988ioQiNDFB2aiEEX339se
RYjCH4I8l0HgMREUi5e6AcEdi0Qw8Feglj8BVeeVlKhKPqsZXWYTuu7+x4OeGK6s
DXCSU8lyFyBnh2ciqskixW69/bLnJKSkz8GaKby86QPJNpqdXSQnYcpnTHLbc10O
labIyAgdfSxsYiSUMUx6ygOnpL2r2NluoCvirGqyF9iO5F47+XHaG+/B/6rC4tDI
XLfvBc/wYKwjAAtDZNIojMEoC0T/pbVO2AASfZytxxduv5oB/kMSIqc1/O/uI15r
2Y2duapGd8K/hpVUR7fl75M8/Ll909zyfnd881v2/27EZrRY481rBYd0dNXG+ucx
TBtYZTlGKS/MmTOx3eVT08CVLrXGlnqADlKXZMovPgyyUQeHX4BFvBB+KNgoTeAi
WucLL6Xhxd8EEW7v7blo/DYP9j23mV9fqY6lLLmYS6A7iHm8NHi5NCUyjr2dC0a8
KZfn3PRBxWwfbY+nA1/Nr4R1kHvP3TTsPa8SEq8bb+HD3svOt1jmL1u/Bu9CAFg5
/NgMqIr8QNuWd+EO4BLwHA9nqWPB/lQZhL/hyu2P5MU/Vs+l6YmgLOHdt7F/+Eiq
j/skREqLiqDHnkoqKFaKYQ3V0R27olsKhvr+CsDjOb3Awz4l4oKKtVbFUWZPVDYT
OAsCAwEAAaCCAbkwggG1BgkqhkiG9w0BCQ4xggGmMIIBojALBgNVHQ8EBAMCBDAw
EwYDVR0lBAwwCgYIKwYBBQUHAwEwggF8BgNVHREEggFzMIIBb4ImKi5hcGltYW5h
Z2VtZW50LmpwMTAuaGFuYS5vbmRlbWFuZC5jb22CJiouYXBpbWFuYWdlbWVudC5j
YTEwLmhhbmEub25kZW1hbmQuY29tgiYqLmFwaW1hbmFnZW1lbnQuYnIxMC5oYW5h
Lm9uZGVtYW5kLmNvbYImKi5hcGltYW5hZ2VtZW50LmFwMTAuaGFuYS5vbmRlbWFu
ZC5jb22CJiouYXBpbWFuYWdlbWVudC5hcDIxLmhhbmEub25kZW1hbmQuY29tgiYq
LmFwaW1hbmFnZW1lbnQudXMyMS5oYW5hLm9uZGVtYW5kLmNvbYIrKi50ZXN0LmFw
aW1hbmFnZW1lbnQuYXAxMC5oYW5hLm9uZGVtYW5kLmNvbYItKi50ZXN0MDEuYXBp
bWFuYWdlbWVudC5hcDEwLmhhbmEub25kZW1hbmQuY29tgiEqLmFwaW1hbmFnZW1l
bnQuaGFuYS5vbmRlbWFuZC5jb20wDQYJKoZIhvcNAQELBQADggIBAMuStVhmBLWY
Rq8NWRD1YE+4BgoT5dHH/uUurEUWJO9c7apZ8g0IhIPj/kvc/oq1k+y1H7lIXua7
so6d4fqFbXTfcb87UefiDqs9wSYVptJ3Ek3F8CSuPoXfjZ4r5GL1cH6prDA/OdKg
TLQOEhVgvBHEmL1pkY4eftmjxiuoZdyRKMws1aYbolnk3bvnh090SOa0LmX+076x
6TQ/ALbllOqU+bvxRmto8ioKgG/5fJ+dVb7281iZvCSF2c9ZkuSX8WIGZJzscyxU
YHM3GOrxEnlh84OMS7/JwjfL54L0uUCwjb/FRtCafgURvKJyTSf5vTyhc/wjHMTs
Ywp+0qsrpgDCdAoGo8rBGNY6dwXIB0z0QpvRIZo2uTtl1txjSVdzRfw+PyaEQrLd
XNqpn5Gfiac6HrP5ZnImyEWNKppIDxpoJNPCM3xCZgSA3LTE4a7vBhbJoFaZOIbR
A5qMMUponxlfzpKEKTu8/gN/KPPeV+K4TZRKUn5Sob67vaya174x+DZqv90Vq4Gh
5+znWrbBYU/o3ydcqBHGKbjhr0wRBYwEG5RM66VzW72pvpQTnaQj/qor1yxcBmrN
3pugChteHnTYpWf7JRYQsAD2ER6iriB038D2in5vP8o6wMrFPL7ePNAw5x3Fz4KY
QKw2tafB9veL/cDnbh4npdfPdgm9doCe
-----END CERTIFICATE REQUEST-----`;

            var oModel = this.getView().getModel();
            oModel.setProperty("/csrToDecode", sampleCSR);
            MessageToast.show("Sample CSR loaded");
        },

        _validateInputs: function () {
            var oModel = this.getView().getModel();
            var sCSR = oModel.getProperty("/csrToDecode");
            var bValid = true;
            var sMessage = "";

            // Reset value states
            oModel.setProperty("/csrDecodeValueState", "None");
            oModel.setProperty("/csrDecodeValueStateText", "");

            // Validate CSR
            if (!sCSR || sCSR.trim() === "") {
                oModel.setProperty("/csrDecodeValueState", "Error");
                oModel.setProperty("/csrDecodeValueStateText", "CSR is required");
                sMessage = "Please paste your Certificate Signing Request in PEM format.\n\nIt should start with:\n-----BEGIN CERTIFICATE REQUEST-----";
                bValid = false;
            } else {
                var sCSRTrimmed = sCSR.trim();
                if (!sCSRTrimmed.includes("-----BEGIN CERTIFICATE REQUEST-----") || 
                    !sCSRTrimmed.includes("-----END CERTIFICATE REQUEST-----")) {
                    oModel.setProperty("/csrDecodeValueState", "Error");
                    oModel.setProperty("/csrDecodeValueStateText", "Invalid CSR format. Expected PEM format.");
                    bValid = false;
                } else if (sCSRTrimmed.length > 100000) {
                    oModel.setProperty("/csrDecodeValueState", "Error");
                    oModel.setProperty("/csrDecodeValueStateText", "CSR too large (max 100KB)");
                    bValid = false;
                }
            }

            return {
                isValid: bValid,
                message: sMessage || "Please correct the errors in the form"
            };
        },

        onDecodeCSR: function () {
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

            var sCSR = oModel.getProperty("/csrToDecode");

            // Show loading
            oModel.setProperty("/csrDecodeBusy", true);
            oModel.setProperty("/hasCSRDecodeResults", false);
            oModel.setProperty("/hasCSRDecodeError", false);

            // Make API call
            fetch('/api/decode-csr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    csr: sCSR.trim()
                })
            })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { response: response, data: data };
                });
            })
            .then(function (result) {
                oModel.setProperty("/csrDecodeBusy", false);
                
                if (result.response.ok) {
                    this._displayResults(result.data);
                } else {
                    this._displayError(result.data.error, result.data.details);
                }
            }.bind(this))
            .catch(function (error) {
                oModel.setProperty("/csrDecodeBusy", false);
                console.error("CSR Decode Error:", error);
                this._displayError("Network Error", "Failed to connect to the server. Please check your connection and try again.");
            }.bind(this));
        },

        _displayResults: function (data) {
            var oModel = this.getView().getModel();
            
            // Process CSR information
            var processedCSR = {};
            
            if (data.csr && !data.csr.error) {
                // Determine parsing status
                var parsingState = "Information";
                var parsingIcon = "sap-icon://information";
                var parsingText = "Parsed";
                
                if (data.csr.accuracy === "Limited") {
                    parsingState = "Warning";
                    parsingIcon = "sap-icon://warning";
                    parsingText = "Limited Info";
                }
                
                // Process key information
                var keyInfo = {
                    algorithm: data.csr.publicKeyAlgorithm || "Unknown",
                    size: data.csr.keySize || "Unknown",
                    hasKeyInfo: (data.csr.publicKeyAlgorithm && data.csr.publicKeyAlgorithm !== "Unknown") || 
                               (data.csr.keySize && data.csr.keySize !== "Unknown")
                };
                
                // Process signature information
                var signatureInfo = {
                    algorithm: data.csr.signatureAlgorithm || "Unknown",
                    hasSignatureInfo: data.csr.signatureAlgorithm && data.csr.signatureAlgorithm !== "Unknown"
                };
                
                // Process Subject Alternative Names
                var subjectAltNames = data.csr.subjectAltNames || [];
                var hasSANs = subjectAltNames.length > 0;
                var sanCount = subjectAltNames.length;
                
                // Extract Common Name from subject
                var commonName = "Unknown";
                var subject = data.csr.subject || "";
                if (subject.includes("commonName=")) {
                    var cnMatch = subject.match(/commonName=([^,]+)/);
                    if (cnMatch) {
                        commonName = cnMatch[1].trim();
                    }
                }
                
                
                processedCSR = {
                    hasError: false,
                    format: data.csr.format || "PEM",
                    type: data.csr.type || "Certificate Signing Request",
                    subject: data.csr.subject || "Unknown",
                    parsingMethod: data.csr.parsingMethod || "Unknown",
                    accuracy: data.csr.accuracy || "Unknown",
                    parsingState: parsingState,
                    parsingIcon: parsingIcon,
                    parsingText: parsingText,
                    
                    // Key information
                    keyInfo: keyInfo,
                    
                    // Signature information  
                    signatureInfo: signatureInfo,
                    
                    // Common Name and Subject Alternative Names
                    commonName: commonName,
                    subjectAltNames: subjectAltNames,
                    hasSANs: hasSANs,
                    sanCount: sanCount,
                    sanText: hasSANs ? subjectAltNames.join(', ') : 'None',
                    
                    // Size information
                    size: data.csr.size || 0,
                    base64Length: data.csr.base64Length || 0,
                    hasSizeInfo: (data.csr.size && data.csr.size > 0) || (data.csr.base64Length && data.csr.base64Length > 0),
                    
                    // Raw PEM for display
                    rawPEM: data.csr.rawPEM || ""
                };
            } else {
                processedCSR = {
                    hasError: true,
                    error: data.csr ? data.csr.error : "Unknown error occurred",
                    parsingState: "Error",
                    parsingIcon: "sap-icon://error",
                    parsingText: "Failed"
                };
            }
            
            // Set results in model
            oModel.setProperty("/csrDecodeResults", {
                csrFound: data.csrFound,
                csr: processedCSR,
                decodedAt: data.decodedAt,
                recommendation: data.recommendation,
                
                // Summary for display
                summaryText: data.csrFound ? "CSR Successfully Processed" : "No CSR Found",
                summaryState: data.csrFound ? (processedCSR.hasError ? "Error" : "Success") : "Warning"
            });
            
            oModel.setProperty("/hasCSRDecodeResults", true);
            oModel.setProperty("/hasCSRDecodeError", false);
            
            MessageToast.show("CSR decoded successfully");
        },

        _displayError: function (sError, sDetails) {
            var oModel = this.getView().getModel();
            
            oModel.setProperty("/csrDecodeError", {
                message: sError || "Unknown error",
                details: sDetails || "",
                hasDetails: !!(sDetails && sDetails.trim())
            });
            
            oModel.setProperty("/hasCSRDecodeResults", false);
            oModel.setProperty("/hasCSRDecodeError", true);
            
            MessageBox.error(sError || "Failed to decode CSR");
        },

        onCopyCSR: function () {
            var oModel = this.getView().getModel();
            var sCSR = oModel.getProperty("/csrToDecode");
            this._copyToClipboard(sCSR, "CSR");
        },

        onCopySubject: function () {
            var oModel = this.getView().getModel();
            var sSubject = oModel.getProperty("/csrDecodeResults/csr/subject");
            this._copyToClipboard(sSubject, "Subject");
        },

        onCopySANs: function () {
            var oModel = this.getView().getModel();
            var aSANs = oModel.getProperty("/csrDecodeResults/csr/subjectAltNames");
            if (aSANs && aSANs.length > 0) {
                var sSANs = aSANs.join('\n');
                this._copyToClipboard(sSANs, "Subject Alternative Names");
            } else {
                MessageToast.show("No SANs to copy");
            }
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
                    var successful = document.execCommand('copy');
                    if (successful) {
                        MessageToast.show(sLabel + " copied to clipboard");
                    } else {
                        MessageToast.show("Failed to copy to clipboard");
                    }
                } catch (err) {
                    MessageToast.show("Copy not supported in this browser");
                }
                
                document.body.removeChild(textArea);
            }
        }
    });
});
