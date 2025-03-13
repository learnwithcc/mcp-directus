import { AxiosInstance, AxiosError } from 'axios';

// Define interfaces for Directus API response types
interface DirectusError {
  message: string;
  extensions?: {
    code?: string;
  };
}

interface DirectusErrorResponse {
  errors?: DirectusError[];
}

interface PerformanceMetrics {
  totalDuration: number;
  serverResponseTime?: number;
  endpoints: Record<string, {
    duration: number;
    status: number;
  }>;
  rateLimitInfo?: {
    limit?: number;
    remaining?: number;
    reset?: number;
  };
}

export function testConnection(directusClient: AxiosInstance) {
  /**
   * Test the connection to Directus and check permissions with performance metrics
   * @returns Test results showing connectivity, permissions, and performance data
   */
  const fn = async () => {
    const metrics: PerformanceMetrics = {
      totalDuration: 0,
      endpoints: {}
    };
    
    const startTime = Date.now();
    
    try {
      console.log('Testing Directus connection and permissions...');
      
      // Step 1: Test basic connectivity by getting server info
      console.log('Checking server connectivity...');
      const serverInfoStart = Date.now();
      const serverInfo = await directusClient.get('/server/info');
      const serverInfoDuration = Date.now() - serverInfoStart;
      
      // Extract rate limit information if available
      const rateLimitLimit = serverInfo.headers['x-ratelimit-limit'];
      const rateLimitRemaining = serverInfo.headers['x-ratelimit-remaining'];
      const rateLimitReset = serverInfo.headers['x-ratelimit-reset'];
      
      if (rateLimitLimit || rateLimitRemaining || rateLimitReset) {
        metrics.rateLimitInfo = {
          limit: rateLimitLimit ? parseInt(rateLimitLimit) : undefined,
          remaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
          reset: rateLimitReset ? parseInt(rateLimitReset) : undefined
        };
      }
      
      // Check for server-timing header for server-side processing time
      const serverTiming = serverInfo.headers['server-timing'];
      if (serverTiming) {
        const match = serverTiming.match(/total;dur=([0-9.]+)/);
        if (match && match[1]) {
          metrics.serverResponseTime = parseFloat(match[1]);
        }
      }
      
      metrics.endpoints['/server/info'] = {
        duration: serverInfoDuration,
        status: serverInfo.status
      };
      
      console.log('Server connected successfully');
      console.log(`Response time: ${serverInfoDuration}ms`);
      
      // Step 2: Check authentication and user permissions
      console.log('Checking authentication...');
      
      // Test with token authentication (which is the default)
      const authStart = Date.now();
      const currentUser = await directusClient.get('/users/me');
      const authDuration = Date.now() - authStart;
      
      metrics.endpoints['/users/me'] = {
        duration: authDuration,
        status: currentUser.status
      };
      
      const userRole = currentUser.data.data.role;
      const userPolicies = currentUser.data.data.policies || [];
      
      console.log(`Authenticated as user ${currentUser.data.data.email} with role ${userRole?.name || userRole?.id}`);
      console.log(`User has ${userPolicies.length} policies applied`);
      console.log(`Authentication response time: ${authDuration}ms`);
      
      // Step 3: Check collection permissions with performance metrics
      console.log('Checking collection permissions...');
      const collectionsStart = Date.now();
      const permissions = await directusClient.get('/permissions/me');
      const permissionsDuration = Date.now() - collectionsStart;
      
      metrics.endpoints['/permissions/me'] = {
        duration: permissionsDuration,
        status: permissions.status
      };
      
      console.log(`Permissions fetched in ${permissionsDuration}ms`);
      
      // Step 4: Test schema-specific permissions
      console.log('Checking schema permissions...');
      const schemaStart = Date.now();
      const collectionsList = await directusClient.get('/collections');
      const schemaEndTime = Date.now();
      const schemaDuration = schemaEndTime - schemaStart;
      
      metrics.endpoints['/collections'] = {
        duration: schemaDuration,
        status: collectionsList.status
      };
      
      const collectionsCount = collectionsList.data.data.length;
      console.log(`Retrieved ${collectionsCount} collections in ${schemaDuration}ms`);
      
      // Try to read fields endpoint
      const fieldsStart = Date.now();
      const fields = await directusClient.get('/fields');
      const fieldsDuration = Date.now() - fieldsStart;
      
      metrics.endpoints['/fields'] = {
        duration: fieldsDuration,
        status: fields.status
      };
      
      const fieldsCount = fields.data.data.length;
      console.log(`Retrieved ${fieldsCount} fields in ${fieldsDuration}ms`);
      
      // Step 5: Test connectivity patterns to determine network conditions
      const connectivityTests = await testNetworkConnectivity(directusClient, metrics);
      
      // Check for specific permissions issues
      let permissionIssues: Array<{type: string, error: string}> = [];
      
      // Step 6: Test collection operations with performance monitoring
      // Create a temporary test collection name
      const testCollectionName = `test_collection_${Date.now()}`;
      
      try {
        // Test collection creation
        const collectionCreateStart = Date.now();
        const createCollection = await directusClient.post('/collections', {
          collection: testCollectionName,
          meta: {
            icon: 'box'
          },
          schema: {
            name: testCollectionName
          }
        });
        const collectionCreateDuration = Date.now() - collectionCreateStart;
        
        metrics.endpoints['/collections (POST)'] = {
          duration: collectionCreateDuration,
          status: createCollection.status
        };
        
        console.log(`✅ Collection creation permission test passed in ${collectionCreateDuration}ms`);
        
        // Test field creation
        try {
          const fieldCreateStart = Date.now();
          const createField = await directusClient.post(`/fields/${testCollectionName}`, {
            field: 'test_field',
            type: 'string',
            meta: {
              interface: 'input'
            },
            schema: {
              name: 'test_field',
              table: testCollectionName,
              data_type: 'varchar',
              is_nullable: true
            }
          });
          const fieldCreateDuration = Date.now() - fieldCreateStart;
          
          metrics.endpoints[`/fields/${testCollectionName} (POST)`] = {
            duration: fieldCreateDuration,
            status: createField.status
          };
          
          console.log(`✅ Field creation permission test passed in ${fieldCreateDuration}ms`);
        } catch (error) {
          const fieldError = error as AxiosError<DirectusErrorResponse>;
          console.error('❌ Field creation permission test failed');
          permissionIssues.push({
            type: 'field_creation',
            error: fieldError.response?.data?.errors?.[0]?.message || 'Unknown error'
          });
        }
        
        // Clean up the test collection
        try {
          const deleteStart = Date.now();
          const deleteResponse = await directusClient.delete(`/collections/${testCollectionName}`);
          const deleteDuration = Date.now() - deleteStart;
          
          metrics.endpoints[`/collections/${testCollectionName} (DELETE)`] = {
            duration: deleteDuration,
            status: deleteResponse.status
          };
          
          console.log(`✅ Collection deletion permission test passed in ${deleteDuration}ms`);
        } catch (error) {
          const deleteError = error as AxiosError<DirectusErrorResponse>;
          console.error('❌ Collection deletion permission test failed');
          permissionIssues.push({
            type: 'collection_deletion',
            error: deleteError.response?.data?.errors?.[0]?.message || 'Unknown error'
          });
        }
      } catch (error) {
        const collectionError = error as AxiosError<DirectusErrorResponse>;
        console.error('❌ Collection creation permission test failed');
        permissionIssues.push({
          type: 'collection_creation',
          error: collectionError.response?.data?.errors?.[0]?.message || 'Unknown error'
        });
      }
      
      // Step 7: Test alternative authentication methods
      // Note: This is a simulated test as we can't easily switch authentication methods dynamically
      const authTests = await testAuthenticationMethods(directusClient);
      
      // Calculate total test duration
      const totalDuration = Date.now() - startTime;
      metrics.totalDuration = totalDuration;
      
      console.log(`Total test duration: ${totalDuration}ms`);
      
      // Analyze rate limits if detected
      const rateLimitAnalysis = analyzeRateLimits(metrics.rateLimitInfo);
      
      // Return comprehensive test results
      return {
        serverConnected: true,
        serverVersion: serverInfo.data.data.version,
        authentication: {
          authenticated: true,
          userId: currentUser.data.data.id,
          email: currentUser.data.data.email,
          role: userRole,
          policies: userPolicies,
          methods: authTests
        },
        permissions: {
          collections: {
            read: collectionsCount > 0,
            count: collectionsCount
          },
          fields: {
            read: fieldsCount > 0,
            count: fieldsCount
          }
        },
        schemaTests: {
          passed: permissionIssues.length === 0,
          issues: permissionIssues
        },
        connectivity: connectivityTests,
        performance: metrics,
        rateLimits: rateLimitAnalysis
      };
    } catch (caughtError) {
      const error = caughtError as AxiosError<DirectusErrorResponse>;
      console.error('Error testing Directus connection:', error);
      
      // Calculate total test duration even for errors
      const totalDuration = Date.now() - startTime;
      metrics.totalDuration = totalDuration;
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        
        // Record the endpoint that failed
        if (error.config?.url) {
          const method = error.config.method?.toUpperCase() || 'GET';
          metrics.endpoints[`${error.config.url} (${method})`] = {
            duration: totalDuration, // We don't know the exact duration of the failed request
            status: error.response.status
          };
        }
        
        return {
          serverConnected: error.response.status !== 0,
          error: {
            status: error.response.status,
            message: error.response?.data?.errors?.[0]?.message || 'Unknown error',
            code: error.response?.data?.errors?.[0]?.extensions?.code
          },
          performance: metrics
        };
      }
      
      return {
        serverConnected: false,
        error: {
          message: error.message || 'Connection failed'
        },
        performance: metrics
      };
    }
  };
  
  /**
   * Test network connectivity patterns
   */
  async function testNetworkConnectivity(
    directusClient: AxiosInstance, 
    metrics: PerformanceMetrics
  ): Promise<Record<string, any>> {
    console.log('Testing network connectivity patterns...');
    
    const results: Record<string, any> = {
      latency: { average: 0, min: Number.MAX_SAFE_INTEGER, max: 0 },
      stability: { success: 0, total: 0 }
    };
    
    try {
      // Test connection latency with multiple ping-like requests
      const pingCount = 3;
      let totalLatency = 0;
      
      for (let i = 0; i < pingCount; i++) {
        const pingStart = Date.now();
        try {
          const pingResponse = await directusClient.get('/server/ping');
          const pingDuration = Date.now() - pingStart;
          
          metrics.endpoints[`/server/ping (${i+1})`] = {
            duration: pingDuration,
            status: pingResponse.status
          };
          
          totalLatency += pingDuration;
          results.stability.success++;
          
          // Update min/max latency
          results.latency.min = Math.min(results.latency.min, pingDuration);
          results.latency.max = Math.max(results.latency.max, pingDuration);
          
          console.log(`Ping test ${i+1}: ${pingDuration}ms`);
        } catch (error) {
          console.error(`Ping test ${i+1} failed`);
        }
        
        results.stability.total++;
      }
      
      // Calculate average latency
      if (results.stability.success > 0) {
        results.latency.average = Math.round(totalLatency / results.stability.success);
      }
      
      // If min is still at initial value, reset it to 0
      if (results.latency.min === Number.MAX_SAFE_INTEGER) {
        results.latency.min = 0;
      }
      
      // Test connection with a larger payload to evaluate bandwidth
      try {
        const largeQueryStart = Date.now();
        const largeQuery = await directusClient.get('/collections', {
          params: { limit: 100 }
        });
        const largeQueryDuration = Date.now() - largeQueryStart;
        
        metrics.endpoints['/collections (large query)'] = {
          duration: largeQueryDuration,
          status: largeQuery.status
        };
        
        // Estimate payload size in KB
        const responseSize = JSON.stringify(largeQuery.data).length / 1024;
        
        results.bandwidth = {
          responseSize: Math.round(responseSize * 100) / 100, // Round to 2 decimal places
          kbps: Math.round((responseSize * 8 * 1000) / largeQueryDuration * 100) / 100,
          duration: largeQueryDuration
        };
        
        console.log(`Bandwidth test: Received ~${results.bandwidth.responseSize}KB in ${largeQueryDuration}ms`);
      } catch (error) {
        console.error('Bandwidth test failed');
      }
      
      return results;
    } catch (error) {
      console.error('Error testing network connectivity:', error);
      return { error: 'Connectivity tests failed' };
    }
  }
  
  /**
   * Test different authentication methods (simulation)
   */
  async function testAuthenticationMethods(directusClient: AxiosInstance): Promise<Record<string, any>> {
    // Note: We're simulating this test since we can't easily switch authentication methods
    console.log('Evaluating authentication methods (simulated)...');
    
    const results = {
      token: { supported: true, current: true },
      key: { supported: true, current: false },
      cookie: { supported: true, current: false },
      oauth: { supported: false, current: false }
    };
    
    try {
      // Check if OAuth is configured by querying the OAuth providers endpoint
      try {
        const oauthResponse = await directusClient.get('/auth/oauth');
        if (oauthResponse.status === 200 && oauthResponse.data?.data?.length > 0) {
          results.oauth.supported = true;
          console.log(`OAuth providers found: ${oauthResponse.data.data.map((p: any) => p.name).join(', ')}`);
        }
      } catch (error) {
        console.log('OAuth providers not available or not configured');
      }
      
      return results;
    } catch (error) {
      console.error('Error testing authentication methods:', error);
      return { error: 'Authentication method tests failed' };
    }
  }
  
  /**
   * Analyze rate limits if detected
   */
  function analyzeRateLimits(rateLimitInfo?: PerformanceMetrics['rateLimitInfo']): Record<string, any> | null {
    if (!rateLimitInfo) {
      return null;
    }
    
    interface RateLimitAnalysis {
      detected: boolean;
      limit?: number;
      remaining?: number;
      reset?: number;
      status: string;
      usagePercentage?: number;
    }
    
    const analysis: RateLimitAnalysis = {
      detected: true,
      ...rateLimitInfo,
      status: 'OK'
    };
    
    // Check if we're close to hitting the rate limit
    if (rateLimitInfo.remaining !== undefined && rateLimitInfo.limit !== undefined) {
      const usagePercentage = 100 * (1 - (rateLimitInfo.remaining / rateLimitInfo.limit));
      analysis.usagePercentage = Math.round(usagePercentage);
      
      if (usagePercentage > 80) {
        analysis.status = 'WARNING';
      }
      if (usagePercentage > 95) {
        analysis.status = 'CRITICAL';
      }
    }
    
    return analysis;
  }
  
  fn.description = 'Test the connection to Directus and check permissions with detailed performance metrics';
  fn.parameters = {
    type: 'object',
    properties: {}
  };
  
  return fn;
} 