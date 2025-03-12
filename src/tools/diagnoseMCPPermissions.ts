/**
 * Diagnostic tool for Directus MCP permissions
 * 
 * This tool helps diagnose permission issues with the Directus API,
 * particularly focusing on schema modification permissions.
 */

import { AxiosInstance } from 'axios';

export function diagnoseMCPPermissions(directusClient: AxiosInstance) {
  /**
   * Diagnose permission issues with Directus
   * @returns Diagnostic information about permissions
   */
  const fn = async () => {
    // Initialize results object
    const results: any = {
      server: { connected: false },
      user: { authenticated: false },
      permissions: {},
      tests: {},
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
          
          results.user.role.name = roleData.name;
          results.user.role.admin_access = isAdmin;
          
          if (!isAdmin) {
            results.recommendations.push('Your role does not have admin_access=true, which is required for schema operations');
          }
        } catch (error: any) {
          console.error('Failed to get role details:', error.message);
          results.user.role.error = error.message;
        }
      } catch (error: any) {
        console.error('Failed to authenticate:', error.message);
        results.user.error = error.message;
        results.recommendations.push('Check your DIRECTUS_ADMIN_TOKEN environment variable');
      }
      
      // Step 4: Test schema operations
      console.log('Testing schema operations...');
      
      // Create a test collection name with timestamp to avoid conflicts
      const testCollectionName = `test_diagnostic_${Date.now()}`;
      
      // Test collection creation
      let collectionCreationResult = 'Not tested';
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
        collectionCreationResult = 'Success';
      } catch (error: any) {
        collectionCreationResult = `Failed: ${error.response?.status} - ${error.response?.data?.errors?.[0]?.message || error.message}`;
      }
      
      // Test field creation
      let fieldCreationResult = 'Not tested';
      if (collectionCreationResult === 'Success') {
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
          fieldCreationResult = 'Success';
        } catch (error: any) {
          fieldCreationResult = `Failed: ${error.response?.status} - ${error.response?.data?.errors?.[0]?.message || error.message}`;
        }
        
        // Clean up the test collection
        try {
          await directusClient.delete(`/collections/${testCollectionName}`);
          console.log(`Test collection ${testCollectionName} deleted successfully`);
        } catch (error: any) {
          console.error(`Failed to delete test collection: ${error.message}`);
        }
      }
      
      results.tests = {
        collection_creation: collectionCreationResult,
        field_creation: fieldCreationResult
      };
      
      // Add recommendations based on test results
      if (collectionCreationResult !== 'Success') {
        results.recommendations.push('Collection creation failed. Check your role permissions for the directus_collections collection.');
      }
      
      if (fieldCreationResult !== 'Success') {
        results.recommendations.push('Field creation failed. Check your role permissions for the directus_fields collection.');
      }
      
      // Add general recommendations
      results.recommendations.push(
        "If schema operations are failing, check the following:",
        "1. Ensure your role has admin_access=true",
        "2. Check if there are any policies restricting schema operations",
        "3. Consider using the Directus admin UI for schema operations",
        "4. Check if any extensions are affecting permissions"
      );
      
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
  
  fn.description = 'Diagnose permission issues with Directus';
  fn.parameters = {
    type: 'object',
    properties: {}
  };
  
  return fn;
} 