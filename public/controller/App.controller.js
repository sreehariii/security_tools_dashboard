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
                case 'whois-lookup':
                    MessageToast.show("WHOIS Lookup - Coming soon");
                    window.history.pushState(null, '', '/ssl-checker');
                    this._navigateToPage('ssl-checker');
                    return;
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
                case "whoisLookup":
                    sPath = '/whois-lookup';
                    break;
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
        }
    });
});
