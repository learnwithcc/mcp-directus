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

export function testConnection(directusClient: AxiosInstance) {
  /**
   * Test the connection to Directus and check permissions
   * @returns Test results showing connectivity and permissions
   */
  const fn = async () => {
    try {
      console.log('Testing Directus connection and permissions...');
      
      // Step 1: Test basic connectivity by getting server info
      console.log('Checking server connectivity...');
      const serverInfo = await directusClient.get('/server/info');
      console.log('Server connected successfully');
      
      // Step 2: Check authentication and user permissions
      console.log('Checking authentication...');
      const currentUser = await directusClient.get('/users/me');
      const userRole = currentUser.data.data.role;
      const userPolicies = currentUser.data.data.policies || [];
      
      console.log(`Authenticated as user ${currentUser.data.data.email} with role ${userRole}`);
      console.log(`User has ${userPolicies.length} policies applied`);
      
      // Step 3: Check collection permissions
      console.log('Checking collection permissions...');
      const permissions = await directusClient.get('/permissions/me');
      
      // Step 4: Test schema-specific permissions
      console.log('Checking schema permissions...');
      const collectionsList = await directusClient.get('/collections');
      const collectionsCount = collectionsList.data.data.length;
      
      // Try to read fields endpoint
      const fields = await directusClient.get('/fields');
      const fieldsCount = fields.data.data.length;
      
      // Check for specific permissions issues
      let permissionIssues: Array<{type: string, error: string}> = [];
      
      // Create a temporary test collection name
      const testCollectionName = `test_collection_${Date.now()}`;
      
      try {
        // Test collection creation
        const createCollection = await directusClient.post('/collections', {
          collection: testCollectionName,
          meta: {
            icon: 'box'
          },
          schema: {
            name: testCollectionName
          }
        });
        
        console.log('✅ Collection creation permission test passed');
        
        // Test field creation
        try {
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
          console.log('✅ Field creation permission test passed');
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
          await directusClient.delete(`/collections/${testCollectionName}`);
          console.log('✅ Collection deletion permission test passed');
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
      
      // Return comprehensive test results
      return {
        serverConnected: true,
        serverVersion: serverInfo.data.data.version,
        authentication: {
          authenticated: true,
          userId: currentUser.data.data.id,
          email: currentUser.data.data.email,
          role: userRole,
          policies: userPolicies
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
        }
      };
    } catch (caughtError) {
      const error = caughtError as AxiosError<DirectusErrorResponse>;
      console.error('Error testing Directus connection:', error);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        
        return {
          serverConnected: error.response.status !== 0,
          error: {
            status: error.response.status,
            message: error.response?.data?.errors?.[0]?.message || 'Unknown error',
            code: error.response?.data?.errors?.[0]?.extensions?.code
          }
        };
      }
      
      return {
        serverConnected: false,
        error: {
          message: error.message || 'Connection failed'
        }
      };
    }
  };
  
  fn.description = 'Test the connection to Directus and check permissions';
  fn.parameters = {
    type: 'object',
    properties: {}
  };
  
  return fn;
} 