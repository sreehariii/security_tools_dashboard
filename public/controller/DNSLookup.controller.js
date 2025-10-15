sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("sslchecker.controller.DNSLookup", {

        onInit: function () {
            // Initialize value states
            var oModel = this.getView().getModel();
            if (oModel) {
                oModel.setProperty("/dnsValueState", "None");
                oModel.setProperty("/dnsValueStateText", "");
            }
        },

        onClearForm: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/dnsDomain", "");
            oModel.setProperty("/hasDnsResults", false);
            oModel.setProperty("/hasDnsError", false);
            oModel.setProperty("/dnsValueState", "None");
            oModel.setProperty("/dnsValueStateText", "");
            MessageToast.show("Form cleared");
        },

        _validateInputs: function () {
            var oModel = this.getView().getModel();
            var sDomain = oModel.getProperty("/dnsDomain");
            var bValid = true;
            var sMessage = "";

            // Reset value states
            oModel.setProperty("/dnsValueState", "None");
            oModel.setProperty("/dnsValueStateText", "");

            // Validate domain
            if (!sDomain || sDomain.trim() === "") {
                oModel.setProperty("/dnsValueState", "Error");
                oModel.setProperty("/dnsValueStateText", "Domain is required");
                sMessage = "Please enter a domain name to perform DNS lookup.\n\nExample: google.com or github.com";
                bValid = false;
            } else {
                var sDomainTrimmed = sDomain.trim();
                
                // Basic domain validation
                if (sDomainTrimmed.length > 255) {
                    oModel.setProperty("/dnsValueState", "Error");
                    oModel.setProperty("/dnsValueStateText", "Domain name too long");
                    sMessage = "Domain name must be less than 255 characters.";
                    bValid = false;
                } else if (!/^[a-zA-Z0-9.-]+$/.test(sDomainTrimmed)) {
                    oModel.setProperty("/dnsValueState", "Error");
                    oModel.setProperty("/dnsValueStateText", "Invalid domain format");
                    sMessage = "Domain name contains invalid characters.\n\nUse only letters, numbers, dots, and hyphens.";
                    bValid = false;
                } else if (sDomainTrimmed.startsWith('.') || sDomainTrimmed.endsWith('.') || sDomainTrimmed.includes('..')) {
                    oModel.setProperty("/dnsValueState", "Error");
                    oModel.setProperty("/dnsValueStateText", "Invalid domain format");
                    sMessage = "Domain name format is invalid.\n\nExample: google.com";
                    bValid = false;
                }
            }

            return {
                isValid: bValid,
                message: sMessage || "Please correct the errors in the form"
            };
        },

        onLookupDNS: function () {
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

            var sDomain = oModel.getProperty("/dnsDomain");

            // Show loading
            oModel.setProperty("/dnsBusy", true);
            oModel.setProperty("/hasDnsResults", false);
            oModel.setProperty("/hasDnsError", false);

            // Make API call
            fetch('/api/dns-lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    domain: sDomain
                })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || 'DNS lookup failed');
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
                oModel.setProperty("/dnsBusy", false);
            });
        },

        _displayResults: function (data) {
            var oModel = this.getView().getModel();
            
            // Process the DNS results for display
            const processedResults = {
                domain: data.results.domain,
                ipAddress: data.results.ipAddress,
                timestamp: data.results.timestamp,
                summary: data.results.summary,
                records: {}
            };

            // Process each record type
            const recordTypes = ['A', 'AAAA', 'MX', 'TXT', 'CNAME', 'NS', 'SOA'];
            
            recordTypes.forEach(type => {
                const record = data.results.records[type];
                if (record && !record.error) {
                    processedResults.records[type] = {
                        type: type,
                        hasData: true,
                        data: this._formatRecordData(type, record),
                        count: Array.isArray(record) ? record.length : 1
                    };
                } else {
                    processedResults.records[type] = {
                        type: type,
                        hasData: false,
                        error: record ? record.error : 'NXDOMAIN',
                        message: record ? record.message : 'No records found'
                    };
                }
            });

            // Set results in model
            oModel.setProperty("/dnsResults", processedResults);
            oModel.setProperty("/hasDnsResults", true);
            oModel.setProperty("/hasDnsError", false);
        },

        _formatRecordData: function (type, data) {
            switch (type) {
                case 'A':
                case 'AAAA':
                    return data.map(ip => ({ value: ip }));
                    
                case 'MX':
                    return data.map(mx => ({
                        value: `${mx.exchange} (Priority: ${mx.priority})`,
                        exchange: mx.exchange,
                        priority: mx.priority
                    }));
                    
                case 'TXT':
                    return data.map(txt => ({ value: txt }));
                    
                case 'CNAME':
                case 'NS':
                    return data.map(name => ({ value: name }));
                    
                case 'SOA':
                    return [{
                        value: `${data.nsname}`,
                        details: [
                            `Primary NS: ${data.nsname}`,
                            `Hostmaster: ${data.hostmaster}`,
                            `Serial: ${data.serial}`,
                            `Refresh: ${data.refresh}s`,
                            `Retry: ${data.retry}s`,
                            `Expire: ${data.expire}s`,
                            `Min TTL: ${data.minttl}s`
                        ]
                    }];
                    
                default:
                    return [];
            }
        },

        _displayError: function (errorMessage) {
            var oModel = this.getView().getModel();
            
            oModel.setProperty("/dnsError", {
                message: errorMessage,
                timestamp: new Date().toISOString()
            });
            oModel.setProperty("/hasDnsError", true);
            oModel.setProperty("/hasDnsResults", false);
        },

        onCopyDomain: function () {
            var oModel = this.getView().getModel();
            var sDomain = oModel.getProperty("/dnsResults/domain");
            this._copyToClipboard(sDomain, "Domain name");
        },

        onCopyIP: function () {
            var oModel = this.getView().getModel();
            var sIP = oModel.getProperty("/dnsResults/ipAddress");
            if (sIP) {
                this._copyToClipboard(sIP, "IP address");
            }
        },

        onCopyRecord: function (oEvent) {
            var oButton = oEvent.getSource();
            var sValue = oButton.data("value");
            var sType = oButton.data("type");
            if (sValue) {
                this._copyToClipboard(sValue, sType + " record");
            }
        },

        _copyToClipboard: function (sText, sLabel) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(sText).then(function () {
                    MessageToast.show(sLabel + " copied to clipboard");
                }).catch(function (err) {
                    console.error('Could not copy text: ', err);
                    this._fallbackCopyTextToClipboard(sText, sLabel);
                }.bind(this));
            } else {
                this._fallbackCopyTextToClipboard(sText, sLabel);
            }
        },

        _fallbackCopyTextToClipboard: function (text, label) {
            var textArea = document.createElement("textarea");
            textArea.value = text;
            
            // Avoid scrolling to bottom
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.position = "fixed";

            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                var successful = document.execCommand('copy');
                if (successful) {
                    MessageToast.show(label + " copied to clipboard");
                } else {
                    MessageToast.show("Could not copy " + label);
                }
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
                MessageToast.show("Could not copy " + label);
            }

            document.body.removeChild(textArea);
        }
    });
});
