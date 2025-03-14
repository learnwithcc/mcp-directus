/**
 * Test script for improved policy assignment tool
 * 
 * This script tests the improved policy assignment tool that tries multiple
 * approaches for assigning policies to roles in Directus.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { createAccessPolicy } from '../tools/createAccessPolicy';
import { createRole } from '../tools/createRole';
import { improvedAssignPolicyToRole } from '../tools/improvedAssignPolicyToRole';
import { createLogger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Create a logger for this test
const logger = createLogger({ component: 'test-improved-policy-assignment' });

// Check for required environment variables
const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8077';
const directusToken = process.env.DIRECTUS_ADMIN_TOKEN;

if (!directusToken) {
  logger.error('DIRECTUS_ADMIN_TOKEN environment variable is required');
  process.exit(1);
}

// Create Directus API client with detailed logging
const directusClient = axios.create({
  baseURL: directusUrl,
  headers: {
    'Authorization': `Bearer ${directusToken}`,
    'Content-Type': 'application/json'
  }
});

// Add request and response interceptors for detailed logging
directusClient.interceptors.request.use(request => {
  logger.info(`API Request: ${request.method?.toUpperCase()} ${request.url}`);
  if (request.data) {
    logger.info(`Request Body: ${JSON.stringify(request.data, null, 2)}`);
  }
  return request;
});

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
    }
    return Promise.reject(error);
  }
);

// Initialize our tools
const createPolicyFn = createAccessPolicy(directusClient);
const createRoleFn = createRole(directusClient);
const assignPolicyFn = improvedAssignPolicyToRole(directusClient);

/**
 * Run the test script
 */
async function runTest() {
  logger.info('Starting improved policy assignment test');
  
  try {
    // Step 1: Create a test role
    logger.info('Creating test role...');
    const testRoleName = `Test Role ${new Date().toISOString().substring(0, 19).replace(/[-:T]/g, '')}`;
    const roleResult = await createRoleFn({
      name: testRoleName,
      description: 'A test role created for testing improved policy assignment'
    });
    
    if (roleResult.status !== 'success') {
      logger.error(`Failed to create role: ${roleResult.message}`);
      return;
    }
    
    const roleId = roleResult.details.roleId;
    logger.info(`Created role "${testRoleName}" with ID: ${roleId}`);
    
    // Step 2: Create test policies
    logger.info('Creating test policies...');
    
    // Create policies with different access levels
    const policies = await Promise.all([
      createPolicyFn({
        name: `Basic Policy ${Date.now()}`,
        description: 'Basic access policy for testing',
        app_access: true
      }),
      createPolicyFn({
        name: `Admin Policy ${Date.now() + 1}`,
        description: 'Admin access policy for testing',
        admin_access: true,
        app_access: true
      }),
      createPolicyFn({
        name: `Restricted Policy ${Date.now() + 2}`,
        description: 'Restricted access policy for testing',
        app_access: true,
        enforce_tfa: true
      })
    ]);
    
    // Check if all policies were created successfully
    const failedPolicies = policies.filter((p: any) => p.status !== 'success');
    if (failedPolicies.length > 0) {
      logger.error(`Failed to create ${failedPolicies.length} policies`);
      failedPolicies.forEach((p: any) => {
        logger.error(`- ${p.message}`);
      });
      return;
    }
    
    // Extract policy IDs
    const policyIds = policies.map((p: any) => p.details.policyId);
    
    logger.info(`Created ${policyIds.length} test policies:`);
    policies.forEach((p: any, i: number) => {
      logger.info(`- Policy ${i+1}: ${p.details.policy.name} (${p.details.policyId})`);
    });
    
    // Step 3: Try to assign policies to the role using improved tool
    logger.info('Assigning policies to role using improved tool...');
    
    const assignmentOptions = {
      roleId,
      policyIds,
      useExperimentalApproaches: true
    };
    
    logger.info(`Assignment options: ${JSON.stringify(assignmentOptions, null, 2)}`);
    
    const assignmentResult = await assignPolicyFn(assignmentOptions);
    
    logger.info(`Assignment result status: ${assignmentResult.status}`);
    logger.info(`Assignment message: ${assignmentResult.message}`);
    
    if (assignmentResult.status === 'success') {
      logger.info('✅ SUCCESSFUL POLICY ASSIGNMENT!');
      
      // Log which approach worked
      const successfulAttempt = assignmentResult.details?.attempts?.find((a: any) => a.success);
      if (successfulAttempt) {
        logger.info(`✅ Successful method: ${successfulAttempt.method}`);
        
        // Add documentation about this approach
        logger.info('----- DOCUMENTATION -----');
        logger.info('The following approach succeeded in assigning policies to a role:');
        
        switch (successfulAttempt.method) {
          case 'standard-patch':
            logger.info('Standard PATCH to /roles/{id} with policies array worked.');
            logger.info('This is the recommended approach for assigning policies to roles.');
            break;
          case 'schema-api':
            logger.info('Using the schema/snapshot and schema/apply endpoints worked.');
            logger.info('This approach requires getting a schema hash and then applying changes.');
            break;
          case 'directus-access':
            logger.info('Creating entries in the directus_access junction table worked.');
            logger.info('This approach directly manipulates the junction table.');
            break;
          case 'graphql-mutation':
            logger.info('Using a GraphQL mutation to update the role worked.');
            logger.info('This approach uses the GraphQL API instead of the REST API.');
            break;
          default:
            logger.info(`Method: ${successfulAttempt.method}`);
        }
      }
    } else {
      logger.error('❌ POLICY ASSIGNMENT FAILED');
      
      // Log all attempted approaches
      if (assignmentResult.details?.attempts) {
        logger.info('Attempted approaches:');
        assignmentResult.details.attempts.forEach((attempt: any, i: number) => {
          logger.info(`- Approach ${i+1} (${attempt.method}): ${attempt.success ? 'SUCCESS' : 'FAILED'}`);
          if (!attempt.success && attempt.error?.response?.status) {
            logger.info(`  Status: ${attempt.error.response.status}`);
          }
        });
      }
      
      logger.error('Manual assignment through the Directus admin interface may be required.');
      logger.info('Steps for manual assignment:');
      logger.info('1. Log into Directus admin interface');
      logger.info('2. Navigate to Settings > Roles');
      logger.info(`3. Select the role "${testRoleName}"`);
      logger.info('4. In the "Policies" field, add the following policies:');
      policies.forEach(p => {
        logger.info(`   - ${p.details.policy.name}`);
      });
    }
    
    // Step 4: Verify the assignment by getting the role details
    logger.info('Verifying role details after assignment attempt...');
    try {
      const verifyResponse = await directusClient.get(`/roles/${roleId}`);
      const roleWithPolicies = verifyResponse.data.data;
      
      const assignedPolicies = roleWithPolicies.policies || [];
      
      logger.info(`Role "${roleWithPolicies.name}" has ${assignedPolicies.length} policies assigned`);
      
      // Calculate how many of our test policies were successfully assigned
      const successfullyAssigned = policyIds.filter((id: string) => assignedPolicies.includes(id));
      logger.info(`${successfullyAssigned.length} out of ${policyIds.length} test policies were successfully assigned`);
      
      if (successfullyAssigned.length === policyIds.length) {
        logger.info('✅ All policies were successfully assigned');
      } else if (successfullyAssigned.length > 0) {
        logger.info('⚠️ Some policies were assigned, but not all');
      } else {
        logger.info('❌ No policies were assigned');
      }
    } catch (error: any) {
      logger.error(`Failed to verify role details: ${error.message}`);
    }
    
    logger.info('Test completed');
  } catch (error: any) {
    logger.error(`Error during test: ${error.message}`);
    
    if (error.response) {
      logger.error(`API Response Status: ${error.response.status}`);
      logger.error(`API Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Run the test
runTest().catch(error => {
  logger.error('Unhandled error in test', error);
}); 