/**
 * Alternative Policy Assignment Test
 * 
 * This script tests different approaches for assigning policies to roles
 * to overcome the 403 Forbidden error we've been encountering.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { createLogger } from '../utils/logger';
import { createAccessPolicy } from '../tools/createAccessPolicy';
import { createRole } from '../tools/createRole';

// Load environment variables
dotenv.config();

// Create a logger for this test
const logger = createLogger({ component: 'test-policy-assignment-alternatives' });

// Check for required environment variables
const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8077';
const directusToken = process.env.DIRECTUS_ADMIN_TOKEN;

if (!directusToken) {
  logger.error('DIRECTUS_ADMIN_TOKEN environment variable is required');
  process.exit(1);
}

// Create Directus API client with detailed error logging
const directusClient = axios.create({
  baseURL: directusUrl,
  headers: {
    'Authorization': `Bearer ${directusToken}`,
    'Content-Type': 'application/json'
  }
});

// Add request interceptor for logging
directusClient.interceptors.request.use(request => {
  logger.info(`API Request: ${request.method?.toUpperCase()} ${request.url}`);
  if (request.data) {
    logger.info(`Request Body: ${JSON.stringify(request.data, null, 2)}`);
  }
  return request;
});

// Add response interceptor for detailed error logging
directusClient.interceptors.response.use(
  response => {
    logger.info(`Response Status: ${response.status}`);
    return response;
  },
  error => {
    logger.error(`API Error: ${error.message}`);
    if (error.response) {
      logger.error(`Status: ${error.response.status}`);
      logger.error(`Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
      logger.error(`Response Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
    }
    return Promise.reject(error);
  }
);

// Initialize our tools
const createPolicyFn = createAccessPolicy(directusClient);
const createRoleFn = createRole(directusClient);

/**
 * Try different approaches to assign policies to a role
 */
async function tryPolicyAssignment(roleId: string, policyIds: string[]) {
  logger.info(`Attempting to assign policies to role ${roleId}`);
  logger.info(`Policy IDs: ${JSON.stringify(policyIds)}`);
  
  // Get current role data for reference
  try {
    const roleResponse = await directusClient.get(`/roles/${roleId}`);
    logger.info(`Current role data: ${JSON.stringify(roleResponse.data.data, null, 2)}`);
  } catch (error: any) {
    logger.error(`Failed to get current role data: ${error.message}`);
  }
  
  // Approach 1: Direct updating using PATCH with policies array
  try {
    logger.info("Approach 1: Direct PATCH to /roles/{id} with policies array");
    const response = await directusClient.patch(`/roles/${roleId}`, {
      policies: policyIds
    });
    logger.info("Approach 1 succeeded!");
    return {
      status: 'success',
      message: 'Successfully assigned policies to role',
      method: 'direct-patch',
      details: response.data.data
    };
  } catch (error: any) {
    logger.error(`Approach 1 failed: ${error.message}`);
  }
  
  // Approach 2: Using schema API
  try {
    logger.info("Approach 2: Using schema API");
    const payload = {
      roles: {
        [roleId]: {
          policies: policyIds
        }
      }
    };
    const response = await directusClient.post(`/schema/apply`, payload);
    logger.info("Approach 2 succeeded!");
    return {
      status: 'success',
      message: 'Successfully assigned policies to role using schema API',
      method: 'schema-api',
      details: response.data
    };
  } catch (error: any) {
    logger.error(`Approach 2 failed: ${error.message}`);
  }
  
  // Approach 3: Using POST to a different endpoint (roles/{id}/policies)
  try {
    logger.info("Approach 3: POST to roles/{id}/policies");
    // Try sending each policy ID separately
    for (const policyId of policyIds) {
      await directusClient.post(`/roles/${roleId}/policies`, {
        policy: policyId
      });
    }
    logger.info("Approach 3 succeeded!");
    return {
      status: 'success',
      message: 'Successfully assigned policies to role using POST to roles/{id}/policies',
      method: 'post-to-subresource',
      details: { roleId, policyIds }
    };
  } catch (error: any) {
    logger.error(`Approach 3 failed: ${error.message}`);
  }
  
  // Approach 4: Using an undocumented endpoint that might exist
  try {
    logger.info("Approach 4: POST to role_policies junction");
    // This assumes there might be a junction collection called 'directus_role_policies'
    for (const policyId of policyIds) {
      await directusClient.post(`/items/directus_role_policies`, {
        role: roleId,
        policy: policyId
      });
    }
    logger.info("Approach 4 succeeded!");
    return {
      status: 'success',
      message: 'Successfully assigned policies to role using directus_role_policies',
      method: 'post-to-junction',
      details: { roleId, policyIds }
    };
  } catch (error: any) {
    logger.error(`Approach 4 failed: ${error.message}`);
  }
  
  // None of the approaches worked
  return {
    status: 'error',
    message: 'All policy assignment approaches failed',
    details: { roleId, policyIds }
  };
}

/**
 * Run the test to try different policy assignment methods
 */
async function runTest() {
  logger.info('Starting policy assignment alternatives test');
  
  try {
    // Step 1: Create test policies
    logger.info('Creating test policies...');
    
    const testPolicy1 = await createPolicyFn({
      name: `Test Policy 1 ${Date.now()}`,
      description: 'Test policy for alternatives test',
      app_access: true
    });
    
    const testPolicy2 = await createPolicyFn({
      name: `Test Policy 2 ${Date.now()}`,
      description: 'Another test policy for alternatives test',
      app_access: true
    });
    
    if (testPolicy1.status !== 'success' || testPolicy2.status !== 'success') {
      logger.error('Failed to create one or more policies');
      return;
    }
    
    const policy1Id = testPolicy1.details.policyId;
    const policy2Id = testPolicy2.details.policyId;
    
    logger.info(`Created test policy 1 with ID: ${policy1Id}`);
    logger.info(`Created test policy 2 with ID: ${policy2Id}`);
    
    // Step 2: Create a test role
    logger.info('Creating test role...');
    const roleResult = await createRoleFn({
      name: `Test Role ${Date.now()}`,
      description: 'A test role for alternatives test'
    });
    
    if (roleResult.status !== 'success') {
      logger.error(`Failed to create role: ${roleResult.message}`);
      return;
    }
    
    const roleId = roleResult.details.roleId;
    logger.info(`Created test role with ID: ${roleId}`);
    
    // Step 3: Try different approaches to assign policies
    const assignmentResult = await tryPolicyAssignment(roleId, [policy1Id, policy2Id]);
    
    logger.info(`Policy assignment result: ${assignmentResult.status}`);
    logger.info(`Message: ${assignmentResult.message}`);
    
    // Step 4: Verify if any of the approaches worked by getting the role details
    try {
      const verifyResponse = await directusClient.get(`/roles/${roleId}`);
      const roleWithPolicies = verifyResponse.data.data;
      
      logger.info(`Final role data: ${JSON.stringify(roleWithPolicies, null, 2)}`);
      
      // Check if policies were assigned
      const policiesArray = roleWithPolicies.policies || [];
      logger.info(`Role has ${policiesArray.length} policies assigned`);
      
      if (policiesArray.length > 0) {
        logger.info('Policy assignment successful!');
      } else {
        logger.info('Policy assignment appears to have failed despite API success');
      }
    } catch (error: any) {
      logger.error(`Failed to verify policy assignment: ${error.message}`);
    }
    
    logger.info('Test completed');
  } catch (error: any) {
    logger.error(`Error during test: ${error.message}`);
  }
}

// Run the test
runTest().catch(error => {
  logger.error('Unhandled error in test', error);
}); 