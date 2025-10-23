sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Core",
    "sap/m/MessageToast"
], function (Controller, Core, MessageToast) {
    "use strict";

    return Controller.extend("sslchecker.controller.App", {

        onInit: function () {
            // Check for saved theme preference
            var savedTheme = localStorage.getItem('theme') || 'light';
            var oModel = this.getView().getModel();
            
            // Apply saved theme
            if (savedTheme === 'dark') {
                Core.applyTheme("sap_horizon_dark");
            } else {
                Core.applyTheme("sap_horizon");
            }
            
            // Set dark mode in model if it exists
            if (oModel) {
                oModel.setProperty("/darkMode", savedTheme === 'dark');
            }
            
            // Initialize mobile responsiveness
            this._initializeMobileSupport();
            
            // Set up hamburger menu event handling
            var that = this;
            document.addEventListener('click', function(e) {
                if (e.target && (e.target.id === 'sideNavToggleHTML' || e.target.classList.contains('custom-hamburger'))) {
                    e.preventDefault();
                    that.onToggleSideNavigation();
                }
            });
            
            // Initialize routing
            this._initializeRouting();
            
            // Listen for popstate (browser back/forward)
            window.addEventListener('popstate', this._handleRouteChange.bind(this));
            
            // Load initial route
            this._handleRouteChange();
            
            // Check if we should show cache clear message (only once per session)
            if (!sessionStorage.getItem('cacheMsgShown')) {
                setTimeout(() => {
                    this._showCacheClearHelper();
                }, 1000); // Show after 1 second
                sessionStorage.setItem('cacheMsgShown', 'true');
            }
        },

        _initializeRouting: function () {
            this._pages = {};
            this._navContainer = this.byId("navContainer");
        },

        _handleRouteChange: function () {
            var sPath = window.location.pathname.substring(1) || '';
            if (sPath === '') {
                sPath = 'ssl-checker';
            }
            this._navigateToPage(sPath);
        },

        _navigateToPage: function (sPageKey) {
            var oNavContainer = this._navContainer;
            var sPageId = "";
            var sViewName = "";
            
            // Map routes to pages
            switch(sPageKey) {
                case 'ssl-checker':
                case '':
                    sPageId = "sslCheckerPage";
                    sViewName = "sslchecker.view.SSLChecker";
                    this._selectNavigationItem("sslChecker");
                    break;
                case 'port-scanner':
                    sPageId = "portScannerPage";
                    sViewName = "sslchecker.view.PortScanner";
                    this._selectNavigationItem("portScanner");
                    break;
                case 'cert-key-matcher':
                    sPageId = "certKeyMatcherPage";
                    sViewName = "sslchecker.view.CertKeyMatcher";
                    this._selectNavigationItem("certKeyMatcher");
                    break;
                case 'cert-decoder':
                    sPageId = "certDecoderPage";
                    sViewName = "sslchecker.view.CertDecoder";
                    this._selectNavigationItem("certDecoder");
                    break;
                case 'csr-decoder':
                    sPageId = "csrDecoderPage";
                    sViewName = "sslchecker.view.CSRDecoder";
                    this._selectNavigationItem("csrDecoder");
                    break;
                case 'dns-lookup':
                    sPageId = "dnsLookupPage";
                    sViewName = "sslchecker.view.DNSLookup";
                    this._selectNavigationItem("dnsLookup");
                    break;
                case 'jwt-decoder':
                    sPageId = "jwtDecoderPage";
                    sViewName = "sslchecker.view.JWTDecoder";
                    this._selectNavigationItem("jwtDecoder");
                    break;
            case 'epoch-converter':
                sPageId = "epochConverterPage";
                sViewName = "sslchecker.view.EpochConverter";
                this._selectNavigationItem("epochConverter");
                break;
            case 'base64-converter':
                sPageId = "base64ConverterPage";
                sViewName = "sslchecker.view.Base64Converter";
                this._selectNavigationItem("base64Converter");
                break;
                default:
                    // Redirect to SSL Checker for unknown routes
                    window.history.replaceState(null, '', '/ssl-checker');
                    sPageKey = 'ssl-checker';
                    sPageId = "sslCheckerPage";
                    sViewName = "sslchecker.view.SSLChecker";
                    this._selectNavigationItem("sslChecker");
                    break;
            }
            
            // Check if page already exists
            var oPage = Core.byId(sPageId);
            if (oPage) {
                oNavContainer.to(oPage.getId());
            } else {
                // Create the page
                sap.ui.core.mvc.XMLView.create({
                    id: sPageId,
                    viewName: sViewName
                }).then(function (oView) {
                    var oViewModel = this.getView().getModel();
                    if (oViewModel) {
                        oView.setModel(oViewModel);
                    }
                    oNavContainer.addPage(oView);
                    oNavContainer.to(oView.getId());
                    this._pages[sPageKey] = oView;
                }.bind(this));
            }
        },

        _selectNavigationItem: function (sKey) {
            var oNavList = this.byId("navigationList");
            if (oNavList) {
                oNavList.setSelectedKey(sKey);
            }
        },

        onToggleTheme: function () {
            var oModel = this.getView().getModel();
            var bDarkMode = oModel.getProperty("/darkMode");
            
            // Toggle the theme
            bDarkMode = !bDarkMode;
            oModel.setProperty("/darkMode", bDarkMode);
            
            // Apply the theme
            if (bDarkMode) {
                Core.applyTheme("sap_horizon_dark");
                MessageToast.show("Dark mode enabled");
            } else {
                Core.applyTheme("sap_horizon");
                MessageToast.show("Light mode enabled");
            }
            
            // Save preference
            localStorage.setItem('theme', bDarkMode ? 'dark' : 'light');
        },

        _initializeMobileSupport: function () {
            // Check if we're on mobile
            this._isMobile = window.innerWidth <= 768;
            
            // Set initial side navigation state
            var oSideNavigation = this.byId("sideNavigation");
            if (oSideNavigation && this._isMobile) {
                oSideNavigation.setExpanded(false);
            }
            
            // Listen for resize events to handle orientation changes
            window.addEventListener('resize', function() {
                this._isMobile = window.innerWidth <= 768;
                if (oSideNavigation && this._isMobile) {
                    oSideNavigation.setExpanded(false);
                }
            }.bind(this));
        },

        onToggleSideNavigation: function () {
            var oSideNavigation = this.byId("sideNavigation");
            if (!oSideNavigation) {
                return;
            }
            var bExpanded = oSideNavigation.getExpanded();
            oSideNavigation.setExpanded(!bExpanded);
        },

        onItemSelect: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            var sKey = oItem.getKey();
            
            if (!oItem.getEnabled()) {
                MessageToast.show("Coming soon...");
                return;
            }
            
            // Update URL using pushState for clean URLs
            var sPath = '';
            switch(sKey) {
                case "sslChecker":
                    sPath = '/ssl-checker';
                    break;
                case "portScanner":
                    sPath = '/port-scanner';
                    break;
                case "certKeyMatcher":
                    sPath = '/cert-key-matcher';
                    break;
                case "certDecoder":
                    sPath = '/cert-decoder';
                    break;
                case "csrDecoder":
                    sPath = '/csr-decoder';
                    break;
                case "dnsLookup":
                    sPath = '/dns-lookup';
                    break;
                case "jwtDecoder":
                    sPath = '/jwt-decoder';
                    break;
                case "epochConverter":
                    sPath = '/epoch-converter';
                    break;
                case "base64Converter":
                    sPath = '/base64-converter';
                    break;
                case "contactUs":
                    this._showContactDialog();
                    // Auto-collapse side navigation after selection on mobile devices
                    if (this._isMobile) {
                        var oSideNavigation = this.byId("sideNavigation");
                        if (oSideNavigation && oSideNavigation.getExpanded()) {
                            setTimeout(function() {
                                oSideNavigation.setExpanded(false);
                            }, 300); // Small delay for better UX
                        }
                    }
                    return; // Don't navigate, just show dialog
            }
            
            if (sPath) {
                window.history.pushState(null, '', sPath);
                this._handleRouteChange();
                
                // Auto-collapse side navigation after selection on mobile devices
                if (this._isMobile) {
                    var oSideNavigation = this.byId("sideNavigation");
                    if (oSideNavigation && oSideNavigation.getExpanded()) {
                        setTimeout(function() {
                            oSideNavigation.setExpanded(false);
                        }, 300); // Small delay for better UX
                    }
                }
            }
        },

        _showContactDialog: function () {
            var that = this;
            
            if (!this._oContactDialog) {
                this._oContactDialog = new sap.m.Dialog({
                    title: "Contact Us",
                    contentWidth: "400px",
                    type: "Message",
                    content: [
                        new sap.m.VBox({
                            class: "sapUiMediumMargin",
                            items: [
                                new sap.m.Text({
                                    text: "Get in touch with us! We'd love to hear from you.",
                                    class: "sapUiMediumMarginBottom"
                                }),
                                new sap.m.Text({
                                    text: "Contact us for:",
                                    class: "sapUiTinyMarginBottom"
                                }),
                                new sap.m.Text({
                                    text: "• Bug fixes & issues",
                                    class: "sapUiTinyText sapUiTinyMarginBottom"
                                }),
                                new sap.m.Text({
                                    text: "• New feature requests", 
                                    class: "sapUiTinyText sapUiTinyMarginBottom"
                                }),
                                new sap.m.Text({
                                    text: "• Feedback & suggestions",
                                    class: "sapUiTinyText sapUiMediumMarginBottom"
                                }),
                                new sap.m.Label({
                                    text: "Email Address:",
                                    class: "sapUiTinyMarginBottom"
                                }),
                                new sap.m.HBox({
                                    alignItems: "Center",
                                    class: "sapUiTinyMarginBottom",
                                    items: [
                                        new sap.m.Text({
                                            text: "sreehari.janardhanan01@sap.com",
                                            class: "sapUiMediumMarginEnd"
                                        }),
                                        new sap.m.Button({
                                            icon: "sap-icon://copy",
                                            type: "Transparent",
                                            tooltip: "Copy email address",
                                            press: function() {
                                                that._copyEmailToClipboard();
                                            }
                                        })
                                    ]
                                })
                            ]
                        })
                    ],
                    endButton: new sap.m.Button({
                        text: "Close",
                        type: "Emphasized",
                        press: function () {
                            that._oContactDialog.close();
                        }
                    })
                });
                
                this.getView().addDependent(this._oContactDialog);
            }
            
            this._oContactDialog.open();
        },

        _copyEmailToClipboard: function () {
            var emailAddress = "sreehari.janardhanan01@sap.com";
            
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(emailAddress).then(function () {
                    sap.m.MessageToast.show("Email address copied to clipboard!");
                }).catch(function (err) {
                    console.error('Could not copy email: ', err);
                    this._fallbackCopyEmail(emailAddress);
                }.bind(this));
            } else {
                this._fallbackCopyEmail(emailAddress);
            }
        },

        _fallbackCopyEmail: function (email) {
            var textArea = document.createElement("textarea");
            textArea.value = email;
            
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
                    sap.m.MessageToast.show("Email address copied to clipboard!");
                } else {
                    sap.m.MessageToast.show("Could not copy email address");
                }
            } catch (err) {
                console.error('Fallback: Unable to copy email', err);
                sap.m.MessageToast.show("Could not copy email address");
            }

            document.body.removeChild(textArea);
        },

        _detectBrowser: function() {
            const userAgent = navigator.userAgent.toLowerCase();
            const vendor = navigator.vendor.toLowerCase();
            
            if (userAgent.indexOf('edg') > -1) {
                return {
                    name: 'Microsoft Edge',
                    url: 'edge://settings/clearBrowserData'
                };
            } else if (userAgent.indexOf('chrome') > -1 && vendor.indexOf('google') > -1) {
                return {
                    name: 'Google Chrome',
                    url: 'chrome://settings/clearBrowserData'
                };
            } else if (userAgent.indexOf('firefox') > -1) {
                return {
                    name: 'Mozilla Firefox',
                    url: 'about:preferences#privacy'
                };
            } else if (userAgent.indexOf('safari') > -1 && vendor.indexOf('apple') > -1) {
                return {
                    name: 'Safari',
                    url: null
                };
            } else if (userAgent.indexOf('opera') > -1 || userAgent.indexOf('opr') > -1) {
                return {
                    name: 'Opera',
                    url: 'opera://settings/clearBrowserData'
                };
            } else {
                return {
                    name: 'Your Browser',
                    url: null
                };
            }
        },

        _showCacheClearHelper: function() {
            const browser = this._detectBrowser();
            
            let message = "💡 Tip: If you don't see new features or experience issues, try clearing your browser cache.";
            
            const contentItems = [
                new sap.m.Text({
                    text: message
                }).addStyleClass("sapUiSmallMarginBottom")
            ];
            
            if (browser.url) {
                contentItems.push(
                    new sap.m.Text({
                        text: "🔗 " + browser.url,
                        wrapping: true
                    }).addStyleClass("sapUiTinyMarginTop sapUiCodeFont")
                );
            } else {
                contentItems.push(
                    new sap.m.Text({
                        text: "Please clear your cache manually through your browser settings."
                    }).addStyleClass("sapUiTinyMarginTop")
                );
            }
            
            const dialog = new sap.m.Dialog({
                title: "Info",
                type: "Message",
                content: [
                    new sap.m.VBox({
                        items: contentItems
                    }).addStyleClass("sapUiContentPadding")
                ],
                beginButton: new sap.m.Button({
                    text: "Got it",
                    type: "Emphasized",
                    press: function() {
                        dialog.close();
                    }
                }),
                endButton: new sap.m.Button({
                    text: "Don't show again",
                    press: function() {
                        sessionStorage.setItem('cacheMsgShown', 'permanent');
                        dialog.close();
                    }
                }),
                afterClose: function() {
                    dialog.destroy();
                }
            });
            
            dialog.open();
        }
    });
});
