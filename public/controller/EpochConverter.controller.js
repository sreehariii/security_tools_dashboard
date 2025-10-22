sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("sslchecker.controller.EpochConverter", {

        onInit: function () {
            // Initialize model properties with delay
            var that = this;
            setTimeout(function() {
                var oModel = that.getView().getModel();
                if (oModel) {
                    // Initialize form states
                    oModel.setProperty("/epochValueState", "None");
                    oModel.setProperty("/epochValueStateText", "");
                    oModel.setProperty("/humanValueState", "None");
                    oModel.setProperty("/humanValueStateText", "");
                    
                    // Initialize default values
                    oModel.setProperty("/selectedTimezone", "local");
                    oModel.setProperty("/epochInput", "");
                    oModel.setProperty("/humanDate", "");
                    oModel.setProperty("/humanTime", "");
                    oModel.setProperty("/detectedFormat", "");
                    
                    // Initialize busy states
                    oModel.setProperty("/epochBusy", false);
                    oModel.setProperty("/humanBusy", false);
                    
                    // Initialize result visibility
                    oModel.setProperty("/hasEpochResults", false);
                    oModel.setProperty("/hasHumanResults", false);
                    oModel.setProperty("/hasEpochError", false);
                    
                    // Start current time updates
                    that._updateCurrentTime();
                    that._startCurrentTimeUpdates();
                }
            }, 100);
        },

        onExit: function () {
            if (this._currentTimeInterval) {
                clearInterval(this._currentTimeInterval);
            }
        },

        _startCurrentTimeUpdates: function () {
            var that = this;
            this._currentTimeInterval = setInterval(function() {
                that._updateCurrentTime();
            }, 1000); // Update every second
        },

        _updateCurrentTime: function () {
            var oModel = this.getView().getModel();
            if (!oModel) return;
            
            var now = new Date();
            var unixTimestamp = Math.floor(now.getTime() / 1000);
            var jsTimestamp = now.getTime();
            
            oModel.setProperty("/currentTime", {
                unix: unixTimestamp,
                javascript: jsTimestamp,
                local: now.toLocaleString(),
                utc: now.toUTCString()
            });
        },

        onClearForm: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/epochInput", "");
            oModel.setProperty("/humanDate", "");
            oModel.setProperty("/humanTime", "");
            oModel.setProperty("/detectedFormat", "");
            oModel.setProperty("/hasEpochResults", false);
            oModel.setProperty("/hasHumanResults", false);
            oModel.setProperty("/hasEpochError", false);
            oModel.setProperty("/epochValueState", "None");
            oModel.setProperty("/epochValueStateText", "");
            oModel.setProperty("/humanValueState", "None");
            oModel.setProperty("/humanValueStateText", "");
            MessageToast.show("All forms cleared");
        },

        onClearHumanForm: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/humanDate", "");
            oModel.setProperty("/humanTime", "");
            oModel.setProperty("/hasHumanResults", false);
            oModel.setProperty("/humanValueState", "None");
            oModel.setProperty("/humanValueStateText", "");
            MessageToast.show("Human time form cleared");
        },

        onEpochInputChange: function () {
            var oModel = this.getView().getModel();
            var sInput = oModel.getProperty("/epochInput");
            
            if (sInput && sInput.trim() !== "") {
                var detectedFormat = this._detectEpochFormat(sInput.trim());
                oModel.setProperty("/detectedFormat", detectedFormat.displayName);
            } else {
                oModel.setProperty("/detectedFormat", "");
            }
        },

        _detectEpochFormat: function (sInput) {
            // Remove any non-digit characters for validation
            var sCleanInput = sInput.replace(/[^\d]/g, '');
            var nLength = sCleanInput.length;
            var nValue = parseInt(sCleanInput);
            
            // More intelligent detection based on value ranges and length
            if (nLength <= 10) {
                // Unix timestamp (seconds) - typically 10 digits
                // Validate range: 1970-01-01 (0) to 2100-01-01 (4102444800)
                if (nValue >= 0 && nValue <= 4102444800) {
                    return {
                        format: "seconds",
                        displayName: "Unix Timestamp (seconds)",
                        multiplier: 1000
                    };
                }
            } else if (nLength >= 11 && nLength <= 13) {
                // JavaScript timestamp (milliseconds) - typically 13 digits
                // Validate range: 1970-01-01 (0) to 2100-01-01 (4102444800000)
                if (nValue >= 0 && nValue <= 4102444800000) {
                    return {
                        format: "milliseconds", 
                        displayName: "JavaScript Timestamp (milliseconds)",
                        multiplier: 1
                    };
                }
            } else if (nLength >= 14 && nLength <= 16) {
                // Microseconds - typically 16 digits
                // Range check for reasonable microsecond values
                if (nValue >= 0) {
                    return {
                        format: "microseconds",
                        displayName: "Microseconds Timestamp",
                        multiplier: 0.001
                    };
                }
            } else if (nLength >= 17 && nLength <= 19) {
                // Nanoseconds - typically 19 digits
                // Range check for reasonable nanosecond values
                if (nValue >= 0) {
                    return {
                        format: "nanoseconds",
                        displayName: "Nanoseconds Timestamp", 
                        multiplier: 0.000001
                    };
                }
            }
            
            // Fallback: Try to guess based on reasonable ranges
            if (nValue >= 1000000000 && nValue <= 4102444800) {
                return {
                    format: "seconds",
                    displayName: "Unix Timestamp (seconds)",
                    multiplier: 1000
                };
            } else if (nValue >= 1000000000000 && nValue <= 4102444800000) {
                return {
                    format: "milliseconds",
                    displayName: "JavaScript Timestamp (milliseconds)",
                    multiplier: 1
                };
            } else {
                // Ultimate fallback
                return {
                    format: "unknown",
                    displayName: "Unknown Format (treating as seconds)",
                    multiplier: 1000
                };
            }
        },

        onUseCurrentEpoch: function () {
            var oModel = this.getView().getModel();
            var now = new Date();
            // Default to Unix timestamp (most common)
            var currentEpoch = Math.floor(now.getTime() / 1000);
            
            oModel.setProperty("/epochInput", currentEpoch.toString());
            
            // Trigger format detection
            this.onEpochInputChange();
            
            MessageToast.show("Current Unix timestamp loaded");
        },

        onUseCurrentDateTime: function () {
            var oModel = this.getView().getModel();
            var now = new Date();
            
            // Format for DatePicker (YYYY-MM-dd)
            var formattedDate = now.getFullYear() + '-' +
                String(now.getMonth() + 1).padStart(2, '0') + '-' +
                String(now.getDate()).padStart(2, '0');
                
            // Format for TimePicker (HH:mm:ss)
            var formattedTime = String(now.getHours()).padStart(2, '0') + ':' +
                String(now.getMinutes()).padStart(2, '0') + ':' +
                String(now.getSeconds()).padStart(2, '0');
                
            oModel.setProperty("/humanDate", formattedDate);
            oModel.setProperty("/humanTime", formattedTime);
            MessageToast.show("Current date/time loaded");
        },

        _validateEpochInput: function () {
            var oModel = this.getView().getModel();
            var sInput = oModel.getProperty("/epochInput");
            var bValid = true;
            var sMessage = "";

            // Reset value states
            oModel.setProperty("/epochValueState", "None");
            oModel.setProperty("/epochValueStateText", "");

            if (!sInput || sInput.trim() === "") {
                oModel.setProperty("/epochValueState", "Error");
                oModel.setProperty("/epochValueStateText", "Epoch timestamp is required");
                sMessage = "Please enter an epoch timestamp to convert.\n\nExample: 1698765432 for Unix timestamp";
                bValid = false;
            } else {
                var sTrimmed = sInput.trim();
                
                // Enhanced security validation
                if (sTrimmed.length > 20) {
                    oModel.setProperty("/epochValueState", "Error");
                    oModel.setProperty("/epochValueStateText", "Input too long - max 20 digits");
                    sMessage = "Epoch timestamp is too long. Maximum allowed length is 20 digits.";
                    bValid = false;
                } else if (!/^\d+$/.test(sTrimmed)) {
                    oModel.setProperty("/epochValueState", "Error");
                    oModel.setProperty("/epochValueStateText", "Invalid format - numbers only");
                    sMessage = "Epoch timestamp must contain only numbers (0-9).";
                    bValid = false;
                } else {
                    // Check for integer overflow protection
                    var nValue;
                    try {
                        nValue = parseInt(sTrimmed);
                        if (!Number.isFinite(nValue) || nValue < 0) {
                            throw new Error("Invalid number");
                        }
                    } catch (e) {
                        oModel.setProperty("/epochValueState", "Error");
                        oModel.setProperty("/epochValueStateText", "Number too large or invalid");
                        sMessage = "The entered number is too large or invalid.";
                        bValid = false;
                        return { isValid: bValid, message: sMessage };
                    }
                    
                    var detectedFormat = this._detectEpochFormat(sTrimmed);
                    
                    // Enhanced range validation based on detected format
                    switch (detectedFormat.format) {
                        case "seconds":
                            if (nValue < 0 || nValue > 4102444800) { // Year 2100
                                oModel.setProperty("/epochValueState", "Warning");
                                oModel.setProperty("/epochValueStateText", "Timestamp outside typical range");
                                sMessage = "Warning: Unix timestamp is outside typical range (1970-2100).";
                                // Don't set bValid to false for warnings
                            }
                            break;
                        case "milliseconds":
                            if (nValue < 0 || nValue > 4102444800000) {
                                oModel.setProperty("/epochValueState", "Warning");
                                oModel.setProperty("/epochValueStateText", "Timestamp outside typical range");
                                sMessage = "Warning: JavaScript timestamp is outside typical range (1970-2100).";
                            }
                            break;
                        case "microseconds":
                            if (nValue < 0) {
                                oModel.setProperty("/epochValueState", "Error");
                                oModel.setProperty("/epochValueStateText", "Invalid microseconds timestamp");
                                sMessage = "Microseconds timestamp must be positive.";
                                bValid = false;
                            }
                            break;
                        case "nanoseconds":
                            if (sTrimmed.length > 19) {
                                oModel.setProperty("/epochValueState", "Error");
                                oModel.setProperty("/epochValueStateText", "Nanoseconds timestamp too large");
                                sMessage = "Nanoseconds timestamp is too large to process safely.";
                                bValid = false;
                            }
                            break;
                        case "unknown":
                            oModel.setProperty("/epochValueState", "Warning");
                            oModel.setProperty("/epochValueStateText", "Unknown format - treating as seconds");
                            sMessage = "Warning: Could not detect timestamp format. Treating as Unix seconds.";
                            break;
                    }
                }
            }

            return {
                isValid: bValid,
                message: sMessage
            };
        },

        onConvertEpochToHuman: function () {
            var oModel = this.getView().getModel();
            
            // Validate inputs
            var validationResult = this._validateEpochInput();
            if (!validationResult.isValid) {
                MessageBox.error(validationResult.message, {
                    title: "Invalid Input",
                    icon: MessageBox.Icon.WARNING,
                    actions: [MessageBox.Action.OK]
                });
                return;
            }

            // Show loading
            oModel.setProperty("/epochBusy", true);
            oModel.setProperty("/hasEpochResults", false);
            oModel.setProperty("/hasEpochError", false);

            // Process conversion after short delay for UI feedback
            var that = this;
            setTimeout(function() {
                try {
                    var sInput = oModel.getProperty("/epochInput").trim();
                    var nInput = parseInt(sInput);
                    var detectedFormat = that._detectEpochFormat(sInput);
                    
                    // Convert to JavaScript timestamp (milliseconds) using detected format
                    var jsTimestamp = nInput * detectedFormat.multiplier;
                    
                    // Safety check for reasonable timestamp values
                    if (jsTimestamp < 0 || jsTimestamp > Number.MAX_SAFE_INTEGER) {
                        throw new Error("Timestamp value is outside safe processing range");
                    }
                    
                    var date = new Date(jsTimestamp);
                    
                    // Check if date is valid and reasonable
                    if (isNaN(date.getTime())) {
                        throw new Error("Invalid timestamp produces invalid date");
                    }
                    
                    // Additional validation for reasonable date ranges
                    var year = date.getFullYear();
                    if (year < 1900 || year > 2200) {
                        // Still process but add warning to results
                        console.warn("Timestamp converts to unusual year:", year);
                    }
                    
                    // Generate all formats
                    var unixTimestamp = Math.floor(jsTimestamp / 1000);
                    var microTimestamp = Math.floor(jsTimestamp * 1000);
                    var nanoTimestamp = Math.floor(jsTimestamp * 1000000);
                    
                    var results = {
                        input: sInput,
                        format: detectedFormat.displayName,
                        localTime: date.toLocaleString(),
                        utcTime: date.toUTCString(),
                        isoTime: date.toISOString(),
                        unixTimestamp: unixTimestamp,
                        jsTimestamp: Math.floor(jsTimestamp),
                        microTimestamp: microTimestamp,
                        nanoTimestamp: nanoTimestamp
                    };
                    
                    oModel.setProperty("/epochResults", results);
                    oModel.setProperty("/hasEpochResults", true);
                    oModel.setProperty("/hasEpochError", false);
                    
                } catch (error) {
                    this._displayError("Failed to convert epoch timestamp: " + error.message);
                } finally {
                    oModel.setProperty("/epochBusy", false);
                }
            }.bind(this), 200);
        },

        _validateHumanInput: function () {
            var oModel = this.getView().getModel();
            var sDate = oModel.getProperty("/humanDate");
            var sTime = oModel.getProperty("/humanTime");
            var bValid = true;
            var sMessage = "";

            // Reset value states
            oModel.setProperty("/humanValueState", "None");
            oModel.setProperty("/humanValueStateText", "");

            if (!sDate || sDate.trim() === "") {
                oModel.setProperty("/humanValueState", "Error");
                oModel.setProperty("/humanValueStateText", "Date is required");
                sMessage = "Please select a date to convert to epoch format.";
                bValid = false;
            } else if (!sTime || sTime.trim() === "") {
                oModel.setProperty("/humanValueState", "Error");
                oModel.setProperty("/humanValueStateText", "Time is required");
                sMessage = "Please select a time to convert to epoch format.";
                bValid = false;
            } else {
                // Try different date/time format combinations
                var testDate = this._parseDateTime(sDate.trim(), sTime.trim());
                
                if (!testDate || isNaN(testDate.getTime())) {
                    oModel.setProperty("/humanValueState", "Error");
                    oModel.setProperty("/humanValueStateText", "Invalid date/time format");
                    sMessage = "The selected date and time is not valid. Date format: " + sDate + ", Time format: " + sTime;
                    bValid = false;
                    
                    // Log for debugging
                    console.log("Date validation failed:", {
                        date: sDate,
                        time: sTime,
                        combined: sDate + "T" + sTime,
                        parsed: testDate
                    });
                }
            }

            return {
                isValid: bValid,
                message: sMessage
            };
        },

        _parseDateTime: function (sDate, sTime) {
            // Try different combinations to parse the date/time
            var testFormats = [
                sDate + "T" + sTime,  // ISO format
                sDate + " " + sTime,  // Space separated
                sDate + "T" + sTime + ":00",  // Add seconds if missing
                sDate + " " + sTime + ":00"   // Space separated with seconds
            ];
            
            for (var i = 0; i < testFormats.length; i++) {
                var testDate = new Date(testFormats[i]);
                if (!isNaN(testDate.getTime())) {
                    console.log("Successfully parsed with format:", testFormats[i]);
                    return testDate;
                }
            }
            
            // If all formats fail, try parsing date and time separately and combining
            try {
                var dateObj = new Date(sDate + "T00:00:00");
                var timeParts = sTime.split(":");
                if (timeParts.length >= 2) {
                    dateObj.setHours(parseInt(timeParts[0]) || 0);
                    dateObj.setMinutes(parseInt(timeParts[1]) || 0);
                    dateObj.setSeconds(parseInt(timeParts[2]) || 0);
                    
                    if (!isNaN(dateObj.getTime())) {
                        console.log("Successfully parsed by combining parts:", dateObj);
                        return dateObj;
                    }
                }
            } catch (e) {
                console.log("Failed to parse by combining parts:", e);
            }
            
            console.log("All parsing attempts failed for:", sDate, sTime);
            return null;
        },

        onConvertHumanToEpoch: function () {
            var oModel = this.getView().getModel();
            
            // Validate inputs
            var validationResult = this._validateHumanInput();
            if (!validationResult.isValid) {
                MessageBox.error(validationResult.message, {
                    title: "Invalid Input", 
                    icon: MessageBox.Icon.WARNING,
                    actions: [MessageBox.Action.OK]
                });
                return;
            }

            // Show loading
            oModel.setProperty("/humanBusy", true);
            oModel.setProperty("/hasHumanResults", false);
            oModel.setProperty("/hasEpochError", false);

            // Process conversion after short delay for UI feedback
            var that = this;
            setTimeout(function() {
                try {
                    var sDate = oModel.getProperty("/humanDate").trim();
                    var sTime = oModel.getProperty("/humanTime").trim();
                    var sTimezone = oModel.getProperty("/selectedTimezone");
                    
                    // Log input values for debugging
                    console.log("Converting human to epoch:", { date: sDate, time: sTime, timezone: sTimezone });
                    
                    // Use robust parsing function
                    var date = that._parseDateTime(sDate, sTime);
                    
                    if (!date || isNaN(date.getTime())) {
                        throw new Error("Invalid date/time format");
                    }
                    
                    // Apply timezone handling
                    if (sTimezone === "utc") {
                        // Adjust for UTC: get the time components and create a UTC date
                        var localOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
                        date = new Date(date.getTime() + localOffset);
                    }
                    // For local time, use the date as-is
                    
                    var jsTimestamp = date.getTime();
                    var unixTimestamp = Math.floor(jsTimestamp / 1000);
                    var microTimestamp = jsTimestamp * 1000;
                    var nanoTimestamp = jsTimestamp * 1000000;
                    
                    var results = {
                        inputDateTime: sDate + " " + sTime,
                        timezone: sTimezone === "utc" ? "UTC" : "Local Time",
                        unixTimestamp: unixTimestamp,
                        jsTimestamp: jsTimestamp,
                        microTimestamp: Math.floor(microTimestamp),
                        nanoTimestamp: Math.floor(nanoTimestamp)
                    };
                    
                    oModel.setProperty("/humanResults", results);
                    oModel.setProperty("/hasHumanResults", true);
                    oModel.setProperty("/hasEpochError", false);
                    
                } catch (error) {
                    this._displayError("Failed to convert date/time: " + error.message);
                } finally {
                    oModel.setProperty("/humanBusy", false);
                }
            }.bind(this), 200);
        },


        _displayError: function (errorMessage) {
            var oModel = this.getView().getModel();
            
            oModel.setProperty("/epochError", {
                message: errorMessage,
                details: "Please check your input and try again.",
                timestamp: new Date().toISOString()
            });
            oModel.setProperty("/hasEpochError", true);
            oModel.setProperty("/hasEpochResults", false);
            oModel.setProperty("/hasHumanResults", false);
        },

        // Copy functions for current time
        onCopyCurrentUnix: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/currentTime/unix");
            this._copyToClipboard(value.toString(), "Current Unix timestamp");
        },

        onCopyCurrentJS: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/currentTime/javascript");
            this._copyToClipboard(value.toString(), "Current JavaScript timestamp");
        },

        // Copy functions for epoch conversion results
        onCopyLocalTime: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/epochResults/localTime");
            this._copyToClipboard(value, "Local time");
        },

        onCopyUtcTime: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/epochResults/utcTime");
            this._copyToClipboard(value, "UTC time");
        },

        onCopyIsoTime: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/epochResults/isoTime");
            this._copyToClipboard(value, "ISO time");
        },

        onCopyUnixTimestamp: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/epochResults/unixTimestamp");
            this._copyToClipboard(value.toString(), "Unix timestamp");
        },

        onCopyJsTimestamp: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/epochResults/jsTimestamp");
            this._copyToClipboard(value.toString(), "JavaScript timestamp");
        },

        onCopyMicroTimestamp: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/epochResults/microTimestamp");
            this._copyToClipboard(value.toString(), "Microseconds timestamp");
        },

        onCopyNanoTimestamp: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/epochResults/nanoTimestamp");
            this._copyToClipboard(value.toString(), "Nanoseconds timestamp");
        },

        // Copy functions for human conversion results
        onCopyHumanUnix: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/humanResults/unixTimestamp");
            this._copyToClipboard(value.toString(), "Unix timestamp");
        },

        onCopyHumanJS: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/humanResults/jsTimestamp");
            this._copyToClipboard(value.toString(), "JavaScript timestamp");
        },

        onCopyHumanMicro: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/humanResults/microTimestamp");
            this._copyToClipboard(value.toString(), "Microseconds timestamp");
        },

        onCopyHumanNano: function () {
            var oModel = this.getView().getModel();
            var value = oModel.getProperty("/humanResults/nanoTimestamp");
            this._copyToClipboard(value.toString(), "Nanoseconds timestamp");
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
        }
    });
});