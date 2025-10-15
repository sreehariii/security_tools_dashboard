// Performance monitoring and optimization utilities
(function() {
    'use strict';

    // Performance metrics collection
    const performanceMetrics = {
        navigationStart: 0,
        domContentLoaded: 0,
        ui5Loaded: 0,
        appReady: 0
    };

    // Mark navigation start
    performanceMetrics.navigationStart = performance.timing.navigationStart;

    // Monitor DOM content loaded
    document.addEventListener('DOMContentLoaded', function() {
        performanceMetrics.domContentLoaded = Date.now();
        console.log('DOM Content Loaded:', performanceMetrics.domContentLoaded - performanceMetrics.navigationStart + 'ms');
    });

    // Monitor UI5 loading
    window.addEventListener('load', function() {
        performanceMetrics.ui5Loaded = Date.now();
        console.log('Window Load (UI5):', performanceMetrics.ui5Loaded - performanceMetrics.navigationStart + 'ms');
        
        // Monitor app ready state
        const checkAppReady = () => {
            if (document.body.classList.contains('app-ready')) {
                performanceMetrics.appReady = Date.now();
                console.log('App Ready:', performanceMetrics.appReady - performanceMetrics.navigationStart + 'ms');
                
                // Log performance summary
                setTimeout(() => {
                    logPerformanceSummary();
                }, 100);
            } else {
                requestAnimationFrame(checkAppReady);
            }
        };
        checkAppReady();
    });

    // Performance summary logging
    function logPerformanceSummary() {
        const total = performanceMetrics.appReady - performanceMetrics.navigationStart;
        
        console.groupCollapsed('🚀 SSL Tools Performance Summary');
        console.log('Navigation Start → DOM Ready:', performanceMetrics.domContentLoaded - performanceMetrics.navigationStart + 'ms');
        console.log('DOM Ready → UI5 Loaded:', performanceMetrics.ui5Loaded - performanceMetrics.domContentLoaded + 'ms');
        console.log('UI5 Loaded → App Ready:', performanceMetrics.appReady - performanceMetrics.ui5Loaded + 'ms');
        console.log('Total Load Time:', total + 'ms');
        
        // Performance rating
        if (total < 1000) {
            console.log('⚡ Excellent performance!');
        } else if (total < 2000) {
            console.log('✅ Good performance');
        } else if (total < 3000) {
            console.log('⚠️ Fair performance - could be optimized');
        } else {
            console.log('❌ Slow performance - needs optimization');
        }
        
        console.groupEnd();
        
        // Optional: Send metrics to analytics (if needed)
        // sendPerformanceMetrics(performanceMetrics);
    }

    // Resource preloading utility
    function preloadResource(url, type = 'script') {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        link.as = type;
        if (type === 'script') {
            link.crossOrigin = 'anonymous';
        }
        document.head.appendChild(link);
    }

    // Preload critical UI5 resources (only if not already loaded)
    if (window.location.pathname !== '/health') {
        // Preload common UI5 resources
        setTimeout(() => {
            const ui5BaseUrl = 'https://sdk.openui5.org/resources/';
            preloadResource(ui5BaseUrl + 'sap/m/library.js', 'script');
            preloadResource(ui5BaseUrl + 'sap/ui/layout/library.js', 'script');
            preloadResource(ui5BaseUrl + 'sap/tnt/library.js', 'script');
        }, 100);
    }

    // Expose metrics for debugging
    window.sslToolsPerformance = performanceMetrics;
})();
