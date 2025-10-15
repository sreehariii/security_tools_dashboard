sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("sslchecker.controller.PortScanner", {

        onInit: function () {
            // Properties are initialized in index.js, no need to check
        },

        onClearForm: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/scanHost", "");
            oModel.setProperty("/scanPort", "");
            oModel.setProperty("/hasScanResults", false);
            oModel.setProperty("/hasScanError", false);
            oModel.setProperty("/hostValueState", "None");
            oModel.setProperty("/hostValueStateText", "");
            oModel.setProperty("/portValueState", "None");
            oModel.setProperty("/portValueStateText", "");
            MessageToast.show("Form cleared");
        },

        _validateInputs: function () {
            var oModel = this.getView().getModel();
            var sHost = oModel.getProperty("/scanHost");
            var sPort = oModel.getProperty("/scanPort");
            var bValid = true;
            var sMessage = "";

            // Reset value states
            oModel.setProperty("/hostValueState", "None");
            oModel.setProperty("/hostValueStateText", "");
            oModel.setProperty("/portValueState", "None");
            oModel.setProperty("/portValueStateText", "");

            // Validate host
            if (!sHost || sHost.trim() === "") {
                oModel.setProperty("/hostValueState", "Error");
                oModel.setProperty("/hostValueStateText", "Host is required");
                sMessage = "Please enter a hostname or IP address to scan.\n\nExample: google.com or 8.8.8.8";
                bValid = false;
            } else {
                // Enhanced host validation (IP or domain)
                var sHostTrimmed = sHost.trim();
                var isValidHost = false;
                
                // Check for valid characters first
                if (!/^[a-zA-Z0-9.-]+$/.test(sHostTrimmed)) {
                    oModel.setProperty("/hostValueState", "Error");
                    oModel.setProperty("/hostValueStateText", "Host contains invalid characters");
                    bValid = false;
                } else {
                    // Check for IPv4
                    var ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
                    if (ipPattern.test(sHostTrimmed)) {
                        var parts = sHostTrimmed.split('.');
                        var isValidIP = true;
                        for (var i = 0; i < parts.length; i++) {
                            var num = parseInt(parts[i]);
                            if (num < 0 || num > 255) {
                                isValidIP = false;
                                break;
                            }
                        }
                        
                        // Block private IP ranges
                        if (isValidIP) {
                            var firstOctet = parseInt(parts[0]);
                            var secondOctet = parseInt(parts[1]);
                            
                            if (firstOctet === 127 || firstOctet === 10 || 
                                (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) ||
                                (firstOctet === 192 && secondOctet === 168) ||
                                firstOctet === 169 || firstOctet >= 224) {
                                oModel.setProperty("/hostValueState", "Error");
                                oModel.setProperty("/hostValueStateText", "Access to private/internal networks is not allowed");
                                bValid = false;
                            } else {
                                isValidHost = true;
                            }
                        }
                    } else {
                        // Check for valid domain
                        var domainPattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
                        if (domainPattern.test(sHostTrimmed) && sHostTrimmed.length <= 253 &&
                            !sHostTrimmed.toLowerCase().includes('localhost') && sHostTrimmed !== '0.0.0.0') {
                            isValidHost = true;
                        }
                    }
                    
                    if (!isValidHost && bValid) {
                        oModel.setProperty("/hostValueState", "Error");
                        oModel.setProperty("/hostValueStateText", "Please enter a valid public IP address or domain");
                        bValid = false;
                    }
                }
            }

            // Validate port
            if (!sPort || sPort.trim() === "") {
                oModel.setProperty("/portValueState", "Error");
                oModel.setProperty("/portValueStateText", "Port is required");
                if (!sMessage) {
                    sMessage = "Please enter a port number to scan.\n\nExample: 80, 443, or 22";
                }
                bValid = false;
            } else {
                var nPort = parseInt(sPort);
                if (isNaN(nPort) || nPort < 1 || nPort > 65535) {
                    oModel.setProperty("/portValueState", "Error");
                    oModel.setProperty("/portValueStateText", "Port must be between 1 and 65535");
                    if (!sMessage) {
                        sMessage = "Please enter a valid port number (1-65535).\n\nExample: 80, 443, or 22";
                    }
                    bValid = false;
                }
            }

            return {
                isValid: bValid,
                message: sMessage || "Please correct the errors in the form"
            };
        },

        onScanPort: function () {
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

            var sHost = oModel.getProperty("/scanHost");
            var sPort = oModel.getProperty("/scanPort");

            // Show loading
            oModel.setProperty("/scanBusy", true);
            oModel.setProperty("/hasScanResults", false);
            oModel.setProperty("/hasScanError", false);

            // Make API call
            fetch('/api/scan-port', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    host: sHost.trim(),
                    port: parseInt(sPort)
                })
            })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { response: response, data: data };
                });
            })
            .then(function (result) {
                oModel.setProperty("/scanBusy", false);
                
                if (result.response.ok) {
                    this._displayResults(result.data);
                } else {
                    this._displayError(result.data.error, result.data.details);
                }
            }.bind(this))
            .catch(function (error) {
                oModel.setProperty("/scanBusy", false);
                console.error("Port Scan Error:", error);
                this._displayError("Network Error", "Failed to connect to the server. Please check your connection and try again.");
            }.bind(this));
        },

        _displayResults: function (data) {
            var oModel = this.getView().getModel();
            
            var statusState = data.isOpen ? "Success" : "Error";
            var statusText = data.isOpen ? "Port Open" : "Port Closed";
            var statusIcon = data.isOpen ? "sap-icon://accept" : "sap-icon://decline";
            
            var messageType = data.isOpen ? "Success" : "Warning";
            var message = data.isOpen ? 
                "The port is open and accepting connections." : 
                "The port is closed or not accessible.";

            var results = {
                statusText: statusText,
                statusState: statusState,
                statusIcon: statusIcon,
                targetDisplay: data.host + ":" + data.port,
                message: message,
                messageType: messageType,
                host: data.host,
                ipAddress: data.ipAddress,
                port: data.port,
                portStatus: data.isOpen ? "Open" : "Closed",
                portStatusState: statusState,
                showService: !!data.serviceName,
                serviceName: data.serviceName || "Unknown",
                showResponseTime: data.isOpen && !!data.responseTime,
                responseTime: data.responseTime ? data.responseTime + " ms" : ""
            };

            oModel.setProperty("/scanResults", results);
            oModel.setProperty("/hasScanResults", true);
            
            MessageToast.show("Port scan completed");
        },

        _displayError: function (error, details) {
            var oModel = this.getView().getModel();
            var errorMsg = error + (details ? ": " + details : "");
            
            oModel.setProperty("/scanErrorMessage", errorMsg);
            oModel.setProperty("/hasScanError", true);
            oModel.setProperty("/hasScanResults", false);
        }
    });
});

