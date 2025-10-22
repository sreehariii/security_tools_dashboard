#!/usr/bin/env node

const https = require('https');
const http = require('http');

// Configuration
const TEST_CONFIG = {
    serverUrl: 'http://localhost:5001',
    concurrentRequests: 30,
    testDomain: 'google.com',
    testPort: 443
};

// Test data for various scenarios
const testCases = [
    { url: 'google.com', port: 443, name: 'Google' },
    { url: 'github.com', port: 443, name: 'GitHub' },
    { url: 'stackoverflow.com', port: 443, name: 'StackOverflow' },
    { url: 'microsoft.com', port: 443, name: 'Microsoft' },
    { url: 'cloudflare.com', port: 443, name: 'Cloudflare' },
    { url: 'amazon.com', port: 443, name: 'Amazon' },
    { url: 'apple.com', port: 443, name: 'Apple' },
    { url: 'mozilla.org', port: 443, name: 'Mozilla' },
    { url: 'npmjs.com', port: 443, name: 'NPM' },
    { url: 'nodejs.org', port: 443, name: 'Node.js' }
];

// Statistics tracking
const stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    responseTimeouts: 0,
    connectionErrors: 0,
    responseTimes: [],
    errors: new Map(),
    startTime: null,
    endTime: null
};

// Helper function to make SSL check request
function makeSSLCheckRequest(testCase, requestId) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        stats.totalRequests++;

        const postData = JSON.stringify({
            url: testCase.url,
            port: testCase.port
        });

        const options = {
            hostname: 'localhost',
            port: 5001,
            path: '/api/check-ssl',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 15000 // 15 second timeout
        };

        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                const responseTime = Date.now() - startTime;
                stats.responseTimes.push(responseTime);

                if (res.statusCode === 200) {
                    stats.successfulRequests++;
                    try {
                        const result = JSON.parse(responseData);
                        resolve({
                            success: true,
                            requestId,
                            testCase: testCase.name,
                            responseTime,
                            statusCode: res.statusCode,
                            hostname: result.hostname,
                            valid: result.valid,
                            domainMatch: result.domainMatch,
                            daysUntilExpiration: result.certificate?.daysUntilExpiration
                        });
                    } catch (parseError) {
                        stats.failedRequests++;
                        resolve({
                            success: false,
                            requestId,
                            testCase: testCase.name,
                            responseTime,
                            error: 'JSON parse error: ' + parseError.message
                        });
                    }
                } else {
                    stats.failedRequests++;
                    resolve({
                        success: false,
                        requestId,
                        testCase: testCase.name,
                        responseTime,
                        statusCode: res.statusCode,
                        error: responseData
                    });
                }
            });
        });

        req.on('error', (error) => {
            const responseTime = Date.now() - startTime;
            stats.failedRequests++;
            stats.connectionErrors++;
            
            const errorKey = error.code || 'UNKNOWN_ERROR';
            stats.errors.set(errorKey, (stats.errors.get(errorKey) || 0) + 1);

            resolve({
                success: false,
                requestId,
                testCase: testCase.name,
                responseTime,
                error: `Connection error: ${error.message}`
            });
        });

        req.on('timeout', () => {
            const responseTime = Date.now() - startTime;
            stats.failedRequests++;
            stats.responseTimeouts++;
            req.destroy();

            resolve({
                success: false,
                requestId,
                testCase: testCase.name,
                responseTime,
                error: 'Request timeout (15s)'
            });
        });

        req.write(postData);
        req.end();
    });
}

// Function to run concurrent load test
async function runLoadTest() {
    console.log('🚀 Starting SSL Checker Load Test');
    console.log(`📊 Configuration:`);
    console.log(`   • Server: ${TEST_CONFIG.serverUrl}`);
    console.log(`   • Concurrent Requests: ${TEST_CONFIG.concurrentRequests}`);
    console.log(`   • Test Cases: ${testCases.length} different domains`);
    console.log('');

    stats.startTime = Date.now();

    // Create array of promises for concurrent requests
    const requests = [];
    
    for (let i = 0; i < TEST_CONFIG.concurrentRequests; i++) {
        // Distribute requests across different test cases
        const testCase = testCases[i % testCases.length];
        requests.push(makeSSLCheckRequest(testCase, i + 1));
    }

    console.log('⏳ Executing concurrent requests...');
    
    // Execute all requests concurrently
    const results = await Promise.all(requests);
    
    stats.endTime = Date.now();
    const totalDuration = stats.endTime - stats.startTime;

    // Process results
    console.log('\n📈 Load Test Results:');
    console.log('='.repeat(50));
    
    // Basic Statistics
    console.log(`Total Requests: ${stats.totalRequests}`);
    console.log(`Successful Requests: ${stats.successfulRequests} (${((stats.successfulRequests/stats.totalRequests)*100).toFixed(2)}%)`);
    console.log(`Failed Requests: ${stats.failedRequests} (${((stats.failedRequests/stats.totalRequests)*100).toFixed(2)}%)`);
    console.log(`Connection Errors: ${stats.connectionErrors}`);
    console.log(`Timeouts: ${stats.responseTimeouts}`);
    console.log(`Total Duration: ${totalDuration}ms (${(totalDuration/1000).toFixed(2)}s)`);
    
    // Response Time Statistics
    if (stats.responseTimes.length > 0) {
        const sortedTimes = stats.responseTimes.sort((a, b) => a - b);
        const minTime = sortedTimes[0];
        const maxTime = sortedTimes[sortedTimes.length - 1];
        const avgTime = stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length;
        const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
        const p95Time = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
        const p99Time = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

        console.log('\n⏱️  Response Time Statistics:');
        console.log(`Min Response Time: ${minTime}ms`);
        console.log(`Max Response Time: ${maxTime}ms`);
        console.log(`Average Response Time: ${avgTime.toFixed(2)}ms`);
        console.log(`Median Response Time: ${medianTime}ms`);
        console.log(`95th Percentile: ${p95Time}ms`);
        console.log(`99th Percentile: ${p99Time}ms`);
    }

    // Error Breakdown
    if (stats.errors.size > 0) {
        console.log('\n❌ Error Breakdown:');
        for (const [errorType, count] of stats.errors.entries()) {
            console.log(`${errorType}: ${count} occurrences`);
        }
    }

    // Throughput
    const requestsPerSecond = (stats.totalRequests / (totalDuration / 1000)).toFixed(2);
    console.log(`\n🔥 Throughput: ${requestsPerSecond} requests/second`);

    // Sample Results
    console.log('\n📋 Sample Results:');
    const successfulResults = results.filter(r => r.success).slice(0, 5);
    const failedResults = results.filter(r => !r.success).slice(0, 3);

    if (successfulResults.length > 0) {
        console.log('\n✅ Successful Requests (first 5):');
        successfulResults.forEach(result => {
            console.log(`  • ${result.testCase}: ${result.responseTime}ms, Valid: ${result.valid}, Domain Match: ${result.domainMatch}, Days Until Expiry: ${result.daysUntilExpiration}`);
        });
    }

    if (failedResults.length > 0) {
        console.log('\n❌ Failed Requests (first 3):');
        failedResults.forEach(result => {
            console.log(`  • ${result.testCase}: ${result.error}`);
        });
    }

    // Performance Assessment
    console.log('\n🎯 Performance Assessment:');
    const avgResponseTime = stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length;
    const successRate = (stats.successfulRequests / stats.totalRequests) * 100;

    if (successRate >= 95 && avgResponseTime <= 5000) {
        console.log('🟢 EXCELLENT: High success rate and good response times');
    } else if (successRate >= 90 && avgResponseTime <= 8000) {
        console.log('🟡 GOOD: Acceptable performance with room for improvement');
    } else if (successRate >= 80) {
        console.log('🟠 FAIR: Performance issues detected, investigation recommended');
    } else {
        console.log('🔴 POOR: Significant performance issues, optimization required');
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    if (stats.responseTimeouts > 0) {
        console.log('• Consider increasing server timeout settings');
    }
    if (stats.connectionErrors > stats.totalRequests * 0.1) {
        console.log('• High connection error rate - check server capacity and network');
    }
    if (avgResponseTime > 5000) {
        console.log('• Response times are high - consider optimizing SSL check logic');
    }
    if (successRate < 95) {
        console.log('• Success rate below 95% - investigate error causes');
    }

    console.log('\n✨ Load test completed!');
}

// Health check first
async function checkServerHealth() {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 5001,
            path: '/health',
            method: 'GET',
            timeout: 5000
        }, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => resolve(false));
        req.end();
    });
}

// Main execution
async function main() {
    console.log('🔍 Checking server health...');
    
    const isHealthy = await checkServerHealth();
    
    if (!isHealthy) {
        console.error('❌ Server is not responding at http://localhost:5001');
        console.error('   Please ensure the server is running with: npm start or node server.js');
        process.exit(1);
    }

    console.log('✅ Server is healthy, proceeding with load test...\n');
    
    await runLoadTest();
}

// Run the test
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Load test failed:', error.message);
        process.exit(1);
    });
}

module.exports = { runLoadTest, checkServerHealth };
