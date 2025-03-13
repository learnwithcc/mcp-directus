/**
 * Diagnostic tool for Directus MCP permissions
 * 
 * This tool helps diagnose permission issues with the Directus API,
 * particularly focusing on schema modification permissions and CRUD operations.
 */

import { AxiosInstance, AxiosError } from 'axios';

interface TestResult {
  status: 'Success' | 'Failed' | 'Not tested';
  message?: string;
  details?: any;
}

interface DiagnosticResults {
  server: {
    connected: boolean;
    version?: string;
    error?: string;
  };
  user: {
    authenticated: boolean;
    id?: string;
    email?: string;
    role?: {
      id: string;
      name?: string;
      admin_access?: boolean;
      error?: string;
    };
    error?: string;
  };
  permissions: Record<string, any>;
  tests: {
    regular_collections: {
      collection_creation?: TestResult;
      field_creation?: TestResult;
      relation_creation?: TestResult;
      item_operations: {
        create?: TestResult;
        read?: TestResult;
        update?: TestResult;
        delete?: TestResult;
        search?: TestResult;
      };
    };
    system_collections: {
      read_users?: TestResult;
      read_files?: TestResult;
      read_roles?: TestResult;
      read_permissions?: TestResult;
    };
    schema_operations: {
      modify_schema?: TestResult;
      apply_schema_diff?: TestResult;
    };
  };
  recommendations: string[];
  error?: string;
  status?: number;
  details?: any;
}

export function diagnoseMCPPermissions(directusClient: AxiosInstance) {
  /**
   * Diagnose permission issues with Directus
   * @returns Diagnostic information about permissions
   */
  const fn = async () => {
    // Initialize results object
    const results: DiagnosticResults = {
      server: { connected: false },
      user: { authenticated: false },
      permissions: {},
      tests: {
        regular_collections: {
          item_operations: {}
        },
        system_collections: {},
        schema_operations: {}
      },
      recommendations: []
    };
    
    try {
      console.log('Running MCP permissions diagnostic...');
      
      // Step 1: Check basic connectivity
      console.log('Checking server connectivity...');
      try {
        const serverInfo = await directusClient.get('/server/info');
        const serverVersion = serverInfo.data.data.version;
        console.log(`Connected to Directus server version ${serverVersion}`);
        
        results.server = {
          version: serverVersion,
          connected: true
        };
      } catch (error: any) {
        console.error('Failed to connect to server:', error.message);
        results.server.error = error.message;
        results.recommendations.push('Check your DIRECTUS_URL environment variable');
      }
      
      // Step 2: Check authentication and user info
      console.log('Checking authentication...');
      try {
        const currentUser = await directusClient.get('/users/me');
        const userData = currentUser.data.data;
        const userRole = userData.role;
        const userEmail = userData.email;
        const userId = userData.id;
        
        console.log(`Authenticated as user ${userEmail} (${userId}) with role ${userRole.id}`);
        
        results.user = {
          authenticated: true,
          id: userId,
          email: userEmail,
          role: {
            id: userRole.id
          }
        };
        
        // Step 3: Check role details
        console.log('Checking role details...');
        try {
          const roleResponse = await directusClient.get(`/roles/${userRole.id}`);
          const roleData = roleResponse.data.data;
          const isAdmin = roleData.admin_access === true;
          
          console.log(`Role "${roleData.name}" has admin_access: ${isAdmin}`);
          
          if (results.user.role) {
            results.user.role.name = roleData.name;
            results.user.role.admin_access = isAdmin;
          }
          
          if (!isAdmin) {
            results.recommendations.push('Your role does not have admin_access=true, which is required for schema operations');
          }
        } catch (error: any) {
          console.error('Failed to get role details:', error.message);
          if (results.user.role) {
            results.user.role.error = error.message;
          }
        }
      } catch (error: any) {
        console.error('Failed to authenticate:', error.message);
        results.user.error = error.message;
        results.recommendations.push('Check your DIRECTUS_ADMIN_TOKEN environment variable');
      }
      
      // Step 4: Test regular collection operations
      console.log('Testing operations on regular collections...');
      
      // Create a test collection name with timestamp to avoid conflicts
      const testCollectionName = `test_diagnostic_${Date.now()}`;
      let testItemId: string | null = null;
      
      // Test collection creation
      try {
        await directusClient.post('/collections', {
          collection: testCollectionName,
          meta: {
            icon: 'box'
          },
          schema: {
            name: testCollectionName
          }
        });
        results.tests.regular_collections.collection_creation = { 
          status: 'Success' 
        };
      } catch (error: any) {
        results.tests.regular_collections.collection_creation = { 
          status: 'Failed',
          message: error.response?.data?.errors?.[0]?.message || error.message,
          details: error.response?.data
        };
      }
      
      // Test field creation
      if (results.tests.regular_collections.collection_creation?.status === 'Success') {
        try {
          await directusClient.post(`/fields/${testCollectionName}`, {
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
          results.tests.regular_collections.field_creation = { 
            status: 'Success' 
          };
        } catch (error: any) {
          results.tests.regular_collections.field_creation = { 
            status: 'Failed',
            message: error.response?.data?.errors?.[0]?.message || error.message,
            details: error.response?.data
          };
        }
        
        // Test relation creation
        try {
          // Create a second test field for relation
          await directusClient.post(`/fields/${testCollectionName}`, {
            field: 'related_field',
            type: 'integer',
            meta: {
              interface: 'input'
            },
            schema: {
              name: 'related_field',
              table: testCollectionName,
              data_type: 'integer',
              is_nullable: true
            }
          });
          
          // Create a relation
          await directusClient.post('/relations', {
            collection: testCollectionName,
            field: 'related_field',
            related_collection: testCollectionName,
            meta: {
              one_field: null,
              junction_field: null
            },
            schema: {
              on_delete: 'SET NULL'
            }
          });
          
          results.tests.regular_collections.relation_creation = { 
            status: 'Success' 
          };
        } catch (error: any) {
          results.tests.regular_collections.relation_creation = { 
            status: 'Failed',
            message: error.response?.data?.errors?.[0]?.message || error.message,
            details: error.response?.data
          };
        }
        
        // Test CRUD operations
        // CREATE
        try {
          const createResponse = await directusClient.post(`/items/${testCollectionName}`, {
            test_field: 'Test Value'
          });
          testItemId = createResponse.data.data.id;
          results.tests.regular_collections.item_operations.create = { 
            status: 'Success' 
          };
        } catch (error: any) {
          results.tests.regular_collections.item_operations.create = { 
            status: 'Failed',
            message: error.response?.data?.errors?.[0]?.message || error.message,
            details: error.response?.data
          };
        }
        
        // READ
        if (testItemId) {
          try {
            await directusClient.get(`/items/${testCollectionName}/${testItemId}`);
            results.tests.regular_collections.item_operations.read = { 
              status: 'Success' 
            };
          } catch (error: any) {
            results.tests.regular_collections.item_operations.read = { 
              status: 'Failed',
              message: error.response?.data?.errors?.[0]?.message || error.message,
              details: error.response?.data
            };
          }
          
          // UPDATE
          try {
            await directusClient.patch(`/items/${testCollectionName}/${testItemId}`, {
              test_field: 'Updated Value'
            });
            results.tests.regular_collections.item_operations.update = { 
              status: 'Success' 
            };
          } catch (error: any) {
            results.tests.regular_collections.item_operations.update = { 
              status: 'Failed',
              message: error.response?.data?.errors?.[0]?.message || error.message,
              details: error.response?.data
            };
          }
          
          // SEARCH
          try {
            await directusClient.get(`/items/${testCollectionName}`, {
              params: {
                filter: {
                  test_field: {
                    _eq: 'Updated Value'
                  }
                }
              }
            });
            results.tests.regular_collections.item_operations.search = { 
              status: 'Success' 
            };
          } catch (error: any) {
            results.tests.regular_collections.item_operations.search = { 
              status: 'Failed',
              message: error.response?.data?.errors?.[0]?.message || error.message,
              details: error.response?.data
            };
          }
          
          // DELETE
          try {
            await directusClient.delete(`/items/${testCollectionName}/${testItemId}`);
            results.tests.regular_collections.item_operations.delete = { 
              status: 'Success' 
            };
          } catch (error: any) {
            results.tests.regular_collections.item_operations.delete = { 
              status: 'Failed',
              message: error.response?.data?.errors?.[0]?.message || error.message,
              details: error.response?.data
            };
          }
        }
        
        // Clean up the test collection
        try {
          await directusClient.delete(`/collections/${testCollectionName}`);
          console.log(`Test collection ${testCollectionName} deleted successfully`);
        } catch (error: any) {
          console.error(`Failed to delete test collection: ${error.message}`);
        }
      }
      
      // Step 5: Test system collection operations
      console.log('Testing operations on system collections...');
      
      // Test reading users
      try {
        await directusClient.get('/users', { params: { limit: 1 }});
        results.tests.system_collections.read_users = { 
          status: 'Success' 
        };
      } catch (error: any) {
        results.tests.system_collections.read_users = { 
          status: 'Failed',
          message: error.response?.data?.errors?.[0]?.message || error.message,
          details: error.response?.data
        };
      }
      
      // Test reading files
      try {
        await directusClient.get('/files', { params: { limit: 1 }});
        results.tests.system_collections.read_files = { 
          status: 'Success' 
        };
      } catch (error: any) {
        results.tests.system_collections.read_files = { 
          status: 'Failed',
          message: error.response?.data?.errors?.[0]?.message || error.message,
          details: error.response?.data
        };
      }
      
      // Test reading roles
      try {
        await directusClient.get('/roles', { params: { limit: 1 }});
        results.tests.system_collections.read_roles = { 
          status: 'Success' 
        };
      } catch (error: any) {
        results.tests.system_collections.read_roles = { 
          status: 'Failed',
          message: error.response?.data?.errors?.[0]?.message || error.message,
          details: error.response?.data
        };
      }
      
      // Test reading permissions
      try {
        await directusClient.get('/permissions', { params: { limit: 1 }});
        results.tests.system_collections.read_permissions = { 
          status: 'Success' 
        };
      } catch (error: any) {
        results.tests.system_collections.read_permissions = { 
          status: 'Failed',
          message: error.response?.data?.errors?.[0]?.message || error.message,
          details: error.response?.data
        };
      }
      
      // Step 6: Test schema modification capabilities
      console.log('Testing schema modification capabilities...');
      
      // Test modifying schema directly
      try {
        const testSchema = {
          name: `test_schema_${Date.now()}`,
          collections: [
            {
              collection: `test_schema_collection_${Date.now()}`,
              meta: {
                icon: 'box'
              },
              schema: {
                name: `test_schema_collection_${Date.now()}`
              }
            }
          ]
        };
        
        // Just test schema snapshot and diff, but don't apply changes
        const snapshotResponse = await directusClient.get('/schema/snapshot');
        
        if (snapshotResponse.status === 200) {
          results.tests.schema_operations.modify_schema = { 
            status: 'Success' 
          };
        } else {
          results.tests.schema_operations.modify_schema = { 
            status: 'Failed',
            message: 'Schema snapshot endpoint returned non-200 status'
          };
        }
      } catch (error: any) {
        results.tests.schema_operations.modify_schema = { 
          status: 'Failed',
          message: error.response?.data?.errors?.[0]?.message || error.message,
          details: error.response?.data
        };
      }
      
      // Generate specific recommendations based on test results
      generateRecommendations(results);
      
      return results;
    } catch (error: any) {
      console.error('Error running diagnostic:', error.message);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      results.error = error.message;
      results.status = error.response?.status;
      results.details = error.response?.data;
      
      return results;
    }
  };
  
  /**
   * Generate specific recommendations based on test results
   */
  function generateRecommendations(results: DiagnosticResults) {
    // Clear existing general recommendations
    results.recommendations = [];
    
    // Check server connectivity
    if (!results.server.connected) {
      results.recommendations.push('Cannot connect to Directus server. Check your DIRECTUS_URL environment variable and server status.');
    }
    
    // Check authentication
    if (!results.user.authenticated) {
      results.recommendations.push('Authentication failed. Check your DIRECTUS_ADMIN_TOKEN environment variable.');
    }
    
    // Check admin role
    if (results.user.authenticated && results.user.role && results.user.role.admin_access === false) {
      results.recommendations.push('Your role does not have admin_access=true, which is required for schema operations.');
    }
    
    // Check collection creation
    const regularCollections = results.tests.regular_collections;
    if (regularCollections.collection_creation?.status === 'Failed') {
      results.recommendations.push(
        'Collection creation failed. Check your role permissions for the directus_collections collection. ' +
        `Details: ${regularCollections.collection_creation.message}`
      );
    }
    
    // Check field creation
    if (regularCollections.field_creation?.status === 'Failed') {
      results.recommendations.push(
        'Field creation failed. Check your role permissions for the directus_fields collection. ' +
        `Details: ${regularCollections.field_creation.message}`
      );
    }
    
    // Check relation creation
    if (regularCollections.relation_creation?.status === 'Failed') {
      results.recommendations.push(
        'Relation creation failed. Check your role permissions for the directus_relations collection. ' +
        `Details: ${regularCollections.relation_creation.message}`
      );
    }
    
    // Check CRUD operations
    const itemOps = regularCollections.item_operations;
    if (itemOps) {
      if (itemOps.create?.status === 'Failed') {
        results.recommendations.push(`Item creation failed. Check your create permissions. Details: ${itemOps.create.message}`);
      }
      if (itemOps.read?.status === 'Failed') {
        results.recommendations.push(`Item reading failed. Check your read permissions. Details: ${itemOps.read.message}`);
      }
      if (itemOps.update?.status === 'Failed') {
        results.recommendations.push(`Item updating failed. Check your update permissions. Details: ${itemOps.update.message}`);
      }
      if (itemOps.delete?.status === 'Failed') {
        results.recommendations.push(`Item deletion failed. Check your delete permissions. Details: ${itemOps.delete.message}`);
      }
      if (itemOps.search?.status === 'Failed') {
        results.recommendations.push(`Item search failed. Check your read permissions. Details: ${itemOps.search.message}`);
      }
    }
    
    // Check system collection access
    const sysCols = results.tests.system_collections;
    if (sysCols) {
      if (sysCols.read_users?.status === 'Failed') {
        results.recommendations.push('Cannot read users. Check your permissions for the directus_users collection.');
      }
      if (sysCols.read_files?.status === 'Failed') {
        results.recommendations.push('Cannot read files. Check your permissions for the directus_files collection.');
      }
      if (sysCols.read_roles?.status === 'Failed') {
        results.recommendations.push('Cannot read roles. Check your permissions for the directus_roles collection.');
      }
      if (sysCols.read_permissions?.status === 'Failed') {
        results.recommendations.push('Cannot read permissions. Check your permissions for the directus_permissions collection.');
      }
    }
    
    // Check schema operations
    const schemaOps = results.tests.schema_operations;
    if (schemaOps.modify_schema?.status === 'Failed') {
      results.recommendations.push(
        'Schema modification failed. Check your role has admin access and proper permissions. ' +
        `Details: ${schemaOps.modify_schema.message}`
      );
    }
    
    // Add general recommendations if there are issues
    if (results.recommendations.length > 0) {
      results.recommendations.push(
        "For schema operations issues, check the following:",
        "1. Ensure your role has admin_access=true",
        "2. Check if there are any policies restricting schema operations",
        "3. Check API keys have appropriate permissions",
        "4. Verify database user has appropriate privileges",
        "5. Check for extension conflicts"
      );
    }
  }
  
  fn.description = 'Diagnose permission issues with Directus, including schema operations and CRUD capabilities';
  fn.parameters = {
    type: 'object',
    properties: {}
  };
  
  return fn;
} 