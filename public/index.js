sap.ui.define([
    "sap/ui/core/mvc/XMLView",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Core"
], function (XMLView, JSONModel, Core) {
    "use strict";

    // Performance optimized initialization
    const initializeApp = function() {
        // Hide loading overlay
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.transition = 'opacity 0.3s ease-out';
            setTimeout(() => overlay.remove(), 300);
        }

        // Create optimized data model with minimal initial data
        const oModel = new JSONModel({
            // SSL Checker properties
            sslUrl: "",
            sslPort: "",
            darkMode: false,
            busy: false,
            hasResults: false,
            hasError: false,
            errorMessage: "",
            results: {},
            urlValueState: "None",
            urlValueStateText: "",
            
            // Port Scanner properties  
            scanHost: "",
            scanPort: "",
            scanBusy: false,
            hasScanResults: false,
            hasScanError: false,
            scanErrorMessage: "",
            scanResults: {},
            hostValueState: "None",
            hostValueStateText: "",
            portValueState: "None",
            portValueStateText: "",
            
            // Certificate Key Matcher properties
            certificate: "",
            privateKey: "",
            matchBusy: false,
            hasMatchResults: false,
            hasMatchError: false,
            matchErrorMessage: "",
            matchResults: {},
            certValueState: "None",
            certValueStateText: "",
            keyValueState: "None",
            keyValueStateText: "",
            
            // Certificate Decoder properties
            certificateToDecode: "",
            decodeBusy: false,
            hasDecodeResults: false,
            hasDecodeError: false,
            decodeErrorMessage: "",
            decodeResults: {},
            certDecodeValueState: "None",
            certDecodeValueStateText: "",
            
            // CSR Decoder properties
            csrToDecode: "",
            csrDecodeBusy: false,
            hasCSRDecodeResults: false,
            hasCSRDecodeError: false,
            csrDecodeError: {},
            csrDecodeResults: {},
            csrDecodeValueState: "None",
            csrDecodeValueStateText: "",
            
            // DNS Lookup properties
            dnsDomain: "",
            dnsBusy: false,
            hasDnsResults: false,
            hasDnsError: false,
            dnsError: {},
            dnsResults: {},
            dnsValueState: "None",
            dnsValueStateText: "",
            
            // JWT Decoder properties
            jwtToken: "",
            jwtBusy: false,
            hasJwtResults: false,
            hasJwtError: false,
            jwtError: {},
            jwtResults: {},
            jwtValueState: "None",
            jwtValueStateText: "",
            
            // Epoch Time Converter properties
            epochTime: "",
            epochType: "auto",
            epochBusy: false,
            hasEpochResults: false,
            hasEpochError: false,
            epochError: {},
            epochResults: {},
            epochValueState: "None",
            epochValueStateText: "",
            humanTime: "",
            humanDate: "",
            humanTimezone: "",
            useCurrentTime: false,
            
            // Base64 Converter properties
            plainText: "",
            base64Text: "",
            urlSafeMode: false,
            encodeBusy: false,
            decodeBusy: false,
            hasEncodeResults: false,
            hasDecodeResults: false,
            hasBase64Error: false,
            base64Error: {},
            encodeResults: {},
            decodeResults: {},
            plainTextValueState: "None",
            plainTextValueStateText: "",
            base64ValueState: "None",
            base64ValueStateText: ""
        });

        // Enable two-way data binding for better performance
        oModel.setDefaultBindingMode("TwoWay");

        // Create and place the App view
        XMLView.create({
            viewName: "sslchecker.view.App",
            id: "appView",
            async: true // Enable async view creation
        }).then(function (oView) {
            oView.setModel(oModel);
            oView.placeAt("content");
            
            // Mark app as ready
            document.body.classList.add('app-ready');
        }).catch(function(error) {
            console.error("Error creating view:", error);
            // Show error message to user
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.innerHTML = '<div style="color: #ff4444; text-align: center;">Failed to load application<br><small>Please refresh the page</small></div>';
            }
        });
    };

    // Wait for UI5 to be fully loaded with timeout fallback
    const readyTimeout = setTimeout(() => {
        console.warn("UI5 Core ready timeout, initializing anyway");
        initializeApp();
    }, 10000); // 10 second timeout

    Core.ready().then(function() {
        clearTimeout(readyTimeout);
        // Small delay to ensure DOM is ready
        requestAnimationFrame(initializeApp);
    });
});

