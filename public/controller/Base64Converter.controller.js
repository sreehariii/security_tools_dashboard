sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("sslchecker.controller.Base64Converter", {

        onInit: function () {
            // Initialize model properties with delay
            var that = this;
            setTimeout(function() {
                var oModel = that.getView().getModel();
                if (oModel) {
                    // Initialize form states
                    oModel.setProperty("/plainTextValueState", "None");
                    oModel.setProperty("/plainTextValueStateText", "");
                    oModel.setProperty("/base64ValueState", "None");
                    oModel.setProperty("/base64ValueStateText", "");
                    
                    // Initialize input values
                    oModel.setProperty("/plainText", "");
                    oModel.setProperty("/base64Text", "");
                    oModel.setProperty("/urlSafeMode", false);
                    
                    // Initialize busy states
                    oModel.setProperty("/encodeBusy", false);
                    oModel.setProperty("/decodeBusy", false);
                    
                    // Initialize result visibility
                    oModel.setProperty("/hasEncodeResults", false);
                    oModel.setProperty("/hasDecodeResults", false);
                    oModel.setProperty("/hasError", false);
                }
            }, 100);
        },

        onPlainTextChange: function () {
            var oModel = this.getView().getModel();
            var sText = oModel.getProperty("/plainText");
            
            // Reset validation state
            oModel.setProperty("/plainTextValueState", "None");
            oModel.setProperty("/plainTextValueStateText", "");
            
            // Production: Enhanced real-time validation
            if (sText && sText.length > 40000) {
                oModel.setProperty("/plainTextValueState", "Warning");
                oModel.setProperty("/plainTextValueStateText", "Text is approaching size limit (" + Math.round(sText.length/1024) + "KB / 50KB max)");
            } else if (sText && sText.length > 25000) {
                oModel.setProperty("/plainTextValueState", "Information");
                oModel.setProperty("/plainTextValueStateText", "Large text - encoding may take a moment (" + Math.round(sText.length/1024) + "KB)");
            }
            
            // Clear results when input changes significantly
            if (oModel.getProperty("/hasEncodeResults")) {
                oModel.setProperty("/hasEncodeResults", false);
            }
        },

        onBase64TextChange: function () {
            var oModel = this.getView().getModel();
            var sBase64 = oModel.getProperty("/base64Text");
            
            // Reset validation state
            oModel.setProperty("/base64ValueState", "None");
            oModel.setProperty("/base64ValueStateText", "");
            
            if (sBase64 && sBase64.trim() !== "") {
                var sTrimmed = sBase64.trim();
                
                // Production: Enhanced real-time validation with size feedback
                if (sTrimmed.length > 60000) {
                    oModel.setProperty("/base64ValueState", "Warning");
                    oModel.setProperty("/base64ValueStateText", "Base64 is approaching size limit (" + Math.round(sTrimmed.length/1024) + "KB / 75KB max)");
                } else if (sTrimmed.length > 40000) {
                    oModel.setProperty("/base64ValueState", "Information");
                    oModel.setProperty("/base64ValueStateText", "Large Base64 - decoding may take a moment (" + Math.round(sTrimmed.length/1024) + "KB)");
                } else {
                    // Perform validation only for reasonably sized inputs to avoid performance issues
                    var validationResult = this._validateBase64Input(sTrimmed);
                    if (!validationResult.isValid) {
                        oModel.setProperty("/base64ValueState", "Warning");
                        oModel.setProperty("/base64ValueStateText", validationResult.message);
                    }
                }
                
                // Clear results when input changes significantly
                if (oModel.getProperty("/hasDecodeResults")) {
                    oModel.setProperty("/hasDecodeResults", false);
                }
            }
        },

        _validateBase64Input: function (sInput) {
            // Enhanced Base64 validation
            var sClean = sInput.replace(/\s/g, ''); // Remove whitespace
            
            // Check for basic Base64 characters
            var base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            var urlSafeBase64Regex = /^[A-Za-z0-9\-_]*={0,2}$/;
            
            if (!base64Regex.test(sClean) && !urlSafeBase64Regex.test(sClean)) {
                return {
                    isValid: false,
                    message: "Contains invalid Base64 characters"
                };
            }
            
            // Check length (must be multiple of 4 for standard Base64)
            if (!urlSafeBase64Regex.test(sClean) && sClean.length % 4 !== 0) {
                return {
                    isValid: false,
                    message: "Invalid Base64 length (must be multiple of 4)"
                };
            }
            
            // Check padding
            var paddingCount = (sClean.match(/=/g) || []).length;
            if (paddingCount > 2) {
                return {
                    isValid: false,
                    message: "Invalid Base64 padding"
                };
            }
            
            // Check that padding is at the end
            if (paddingCount > 0 && !sClean.endsWith('='.repeat(paddingCount))) {
                return {
                    isValid: false,
                    message: "Base64 padding must be at the end"
                };
            }
            
            return { isValid: true };
        },

        onEncodeToBase64: function () {
            var oModel = this.getView().getModel();
            var sPlainText = oModel.getProperty("/plainText");
            
            // Enhanced input validation and sanitization
            if (!sPlainText || sPlainText.trim() === "") {
                MessageBox.error("Please enter text to encode to Base64.", {
                    title: "Missing Text",
                    icon: MessageBox.Icon.WARNING,
                    actions: [MessageBox.Action.OK]
                });
                return;
            }
            
            // Sanitize input for security
            sPlainText = this._sanitizeInput(sPlainText, "encoding");
            
            // Production: Enhanced security check with stricter limits
            if (sPlainText.length > 50000) { // Reduced from 100KB to 50KB for better performance
                var sizeKB = (sPlainText.length / 1024).toFixed(1);
                MessageBox.error("Text is too large (" + sizeKB + " KB). Maximum allowed size is 50KB for optimal performance and security.", {
                    title: "Input Too Large",
                    icon: MessageBox.Icon.ERROR,
                    actions: [MessageBox.Action.OK],
                    details: "Large inputs can cause memory issues. Consider splitting large texts into smaller chunks."
                });
                return;
            }
            
            // Production: Additional security validation
            if (sPlainText.includes('<script') || sPlainText.includes('javascript:') || sPlainText.includes('data:')) {
                MessageBox.warning("Input contains potentially unsafe content. Please review your input.", {
                    title: "Security Warning",
                    icon: MessageBox.Icon.WARNING,
                    actions: [MessageBox.Action.OK]
                });
            }
            
            // Show loading
            oModel.setProperty("/encodeBusy", true);
            oModel.setProperty("/hasEncodeResults", false);
            oModel.setProperty("/hasError", false);
            
            // Process encoding after short delay for UI feedback
            setTimeout(function() {
                try {
                    var sBase64;
                    var sEncodingType;
                    
                    // Use browser's built-in btoa function
                    try {
                        sBase64 = btoa(unescape(encodeURIComponent(sPlainText)));
                        sEncodingType = "Standard Base64 (UTF-8)";
                    } catch (e) {
                        // Fallback for browsers that don't support UTF-8 encoding
                        sBase64 = btoa(sPlainText);
                        sEncodingType = "Standard Base64 (ASCII)";
                        console.warn("UTF-8 encoding not supported, using ASCII:", e);
                    }
                    
                    var results = {
                        base64: sBase64,
                        inputLength: sPlainText.length,
                        outputLength: sBase64.length,
                        encodingType: sEncodingType,
                        timestamp: new Date().toLocaleString()
                    };
                    
                    oModel.setProperty("/encodeResults", results);
                    oModel.setProperty("/hasEncodeResults", true);
                    oModel.setProperty("/hasError", false);
                    
                } catch (error) {
                    console.error("Base64 encoding error:", error);
                    this._displayError("Failed to encode text to Base64: " + (error.message || "Unknown error"), 
                                     "This might happen with special characters, very large text, or memory limitations.",
                                     "Try reducing text size, removing special characters, or refresh the page and try again.");
                } finally {
                    oModel.setProperty("/encodeBusy", false);
                }
            }.bind(this), 200);
        },

        onDecodeFromBase64: function () {
            var oModel = this.getView().getModel();
            var sBase64 = oModel.getProperty("/base64Text");
            var bUrlSafe = oModel.getProperty("/urlSafeMode");
            
            // Enhanced input validation
            if (!sBase64 || sBase64.trim() === "") {
                MessageBox.error("Please enter a Base64 string to decode.", {
                    title: "Missing Base64",
                    icon: MessageBox.Icon.WARNING,
                    actions: [MessageBox.Action.OK]
                });
                return;
            }
            
            // Sanitize input for security
            sBase64 = this._sanitizeInput(sBase64.trim(), "decoding");
            
            // Production: Enhanced size check with stricter limits  
            if (sBase64.length > 75000) { // Reduced from 150KB to 75KB for better performance
                var sizeKB = (sBase64.length / 1024).toFixed(1);
                MessageBox.error("Base64 string is too large (" + sizeKB + " KB). Maximum allowed size is 75KB for optimal performance and security.", {
                    title: "Input Too Large", 
                    icon: MessageBox.Icon.ERROR,
                    actions: [MessageBox.Action.OK],
                    details: "Large Base64 inputs can cause memory issues. Consider processing smaller chunks."
                });
                return;
            }
            
            // Advanced validation
            var validationResult = this._validateBase64Input(sBase64);
            if (!validationResult.isValid) {
                MessageBox.error("Invalid Base64 format: " + validationResult.message, {
                    title: "Invalid Base64",
                    icon: MessageBox.Icon.ERROR,
                    actions: [MessageBox.Action.OK]
                });
                return;
            }
            
            // Show loading
            oModel.setProperty("/decodeBusy", true);
            oModel.setProperty("/hasDecodeResults", false);
            oModel.setProperty("/hasError", false);
            
            // Process decoding after short delay for UI feedback
            setTimeout(function() {
                try {
                    var sCleanBase64 = sBase64.trim().replace(/\s/g, '');
                    var sDecodedText;
                    var sDecodingType;
                    
                    // Handle URL-safe Base64
                    if (bUrlSafe) {
                        // Convert URL-safe Base64 to standard Base64
                        sCleanBase64 = sCleanBase64.replace(/\-/g, '+').replace(/_/g, '/');
                        
                        // Add padding if needed
                        while (sCleanBase64.length % 4) {
                            sCleanBase64 += '=';
                        }
                        sDecodingType = "URL-Safe Base64";
                    } else {
                        sDecodingType = "Standard Base64";
                    }
                    
                    // Decode using browser's built-in atob function
                    try {
                        var decoded = atob(sCleanBase64);
                        // Try to decode as UTF-8
                        sDecodedText = decodeURIComponent(escape(decoded));
                    } catch (e) {
                        // Fallback to direct decoding if UTF-8 fails
                        sDecodedText = atob(sCleanBase64);
                        console.warn("UTF-8 decoding failed, using direct decoding:", e);
                    }
                    
                    var results = {
                        plainText: sDecodedText,
                        inputLength: sBase64.length,
                        outputLength: sDecodedText.length,
                        decodingType: sDecodingType,
                        timestamp: new Date().toLocaleString()
                    };
                    
                    oModel.setProperty("/decodeResults", results);
                    oModel.setProperty("/hasDecodeResults", true);
                    oModel.setProperty("/hasError", false);
                    
                } catch (error) {
                    console.error("Base64 decoding error:", error);
                    this._displayError("Failed to decode Base64 string: " + (error.message || "Invalid Base64 format"),
                                     "The Base64 string might be corrupted, incomplete, or use a different encoding.",
                                     "Verify the Base64 string is complete, try URL-safe mode, or check for copy-paste errors.");
                } finally {
                    oModel.setProperty("/decodeBusy", false);
                }
            }.bind(this), 200);
        },

        onClearEncoder: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/plainText", "");
            oModel.setProperty("/hasEncodeResults", false);
            oModel.setProperty("/hasError", false);
            oModel.setProperty("/plainTextValueState", "None");
            oModel.setProperty("/plainTextValueStateText", "");
            MessageToast.show("Encoder cleared");
        },

        onClearDecoder: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/base64Text", "");
            oModel.setProperty("/hasDecodeResults", false);
            oModel.setProperty("/hasError", false);
            oModel.setProperty("/base64ValueState", "None");
            oModel.setProperty("/base64ValueStateText", "");
            MessageToast.show("Decoder cleared");
        },

        onLoadTextExample: function () {
            var oModel = this.getView().getModel();
            var exampleText = "Hello, World! 🌍\nThis is a sample text with:\n• Special characters: áéíóú\n• Numbers: 12345\n• Symbols: @#$%^&*()";
            
            oModel.setProperty("/plainText", exampleText);
            this.onPlainTextChange();
            MessageToast.show("Example text loaded");
        },

        onLoadBase64Example: function () {
            var oModel = this.getView().getModel();
            // Base64 example that corresponds to the text example (properly encoded)
            var exampleBase64 = "SGVsbG8sIFdvcmxkISDwn4yNClRoaXMgaXMgYSBzYW1wbGUgdGV4dCB3aXRoOgrigKIgU3BlY2lhbCBjaGFyYWN0ZXJzOiDDocOpw63Ds8O6CuKAoiBOdW1iZXJzOiAxMjM0NQrigKIgU3ltYm9sczogQCMkJV4mKigp";
            
            oModel.setProperty("/base64Text", exampleBase64);
            this.onBase64TextChange();
            MessageToast.show("Example Base64 loaded");
        },

        onCopyEncodedResult: function () {
            var oModel = this.getView().getModel();
            var sBase64 = oModel.getProperty("/encodeResults/base64");
            this._copyToClipboard(sBase64, "Base64 encoded result");
        },

        onCopyDecodedResult: function () {
            var oModel = this.getView().getModel();
            var sText = oModel.getProperty("/decodeResults/plainText");
            this._copyToClipboard(sText, "Decoded text result");
        },

        _displayError: function (errorMessage, details, suggestion) {
            var oModel = this.getView().getModel();
            
            oModel.setProperty("/error", {
                message: errorMessage,
                details: details || "",
                suggestion: suggestion || "",
                timestamp: new Date().toISOString()
            });
            oModel.setProperty("/hasError", true);
            oModel.setProperty("/hasEncodeResults", false);
            oModel.setProperty("/hasDecodeResults", false);
        },

        _copyToClipboard: function (sText, sLabel) {
            // Enhanced clipboard functionality with better error handling
            if (!sText) {
                MessageToast.show("Nothing to copy");
                return;
            }
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(sText).then(function () {
                    MessageToast.show("✓ " + sLabel + " copied to clipboard");
                }).catch(function (err) {
                    console.error('Modern clipboard API failed: ', err);
                    this._fallbackCopyTextToClipboard(sText, sLabel);
                }.bind(this));
            } else {
                this._fallbackCopyTextToClipboard(sText, sLabel);
            }
        },

        _fallbackCopyTextToClipboard: function (text, label) {
            var textArea = document.createElement("textarea");
            textArea.value = text;
            
            // Enhanced styling for better UX
            textArea.style.position = "fixed";
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.width = "2rem";
            textArea.style.height = "2rem";
            textArea.style.padding = "0";
            textArea.style.border = "none";
            textArea.style.outline = "none";
            textArea.style.boxShadow = "none";
            textArea.style.background = "transparent";
            textArea.style.opacity = "0";
            textArea.setAttribute("readonly", "");

            document.body.appendChild(textArea);
            
            // Better selection handling
            if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
                // iOS requires different approach
                var range = document.createRange();
                range.selectNodeContents(textArea);
                var selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                textArea.setSelectionRange(0, 999999);
            } else {
                textArea.select();
            }

            try {
                var successful = document.execCommand('copy');
                if (successful) {
                    MessageToast.show("✓ " + label + " copied to clipboard");
                } else {
                    MessageToast.show("⚠ Could not copy " + label + " - please select and copy manually");
                }
            } catch (err) {
                console.error('Fallback copy failed: ', err);
                MessageToast.show("⚠ Copy not supported - please select and copy manually");
            }

            document.body.removeChild(textArea);
        },

        onBase64ModeChange: function (oEvent) {
            var oModel = this.getView().getModel();
            var sSelectedKey = oEvent.getParameter("selectedItem").getKey();
            var bUrlSafe = (sSelectedKey === "urlsafe");
            
            oModel.setProperty("/urlSafeMode", bUrlSafe);
            
            var sMessage = bUrlSafe ? "URL-Safe Base64 mode selected" : "Standard Base64 mode selected";
            MessageToast.show(sMessage);
        },

        // Security: Enhanced input sanitization
        _sanitizeInput: function (sInput, sType) {
            if (!sInput || typeof sInput !== 'string') {
                return "";
            }
            
            // Remove potentially harmful characters for display
            var sSanitized = sInput.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            
            // Log suspicious input patterns (for monitoring)
            if (sInput !== sSanitized && console && console.warn) {
                console.warn('Sanitized ' + sType + ' input: removed control characters');
            }
            
            return sSanitized;
        }
    });
});
