/**
 * Test script for policy and role management tools
 * 
 * This script tests the creation of roles and policies, and assigning policies to roles.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { createAccessPolicy } from './tools/createAccessPolicy';
import { createRole } from './tools/createRole';
import { assignPolicyToRole } from './tools/assignPolicyToRole';
import { createLogger } from './utils/logger';

// Load environment variables
dotenv.config();

// Create a logger for this test
const logger = createLogger({ component: 'test-policy-management' });

// Check for required environment variables
const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8077';
const directusToken = process.env.DIRECTUS_ADMIN_TOKEN;

if (!directusToken) {
  logger.error('DIRECTUS_ADMIN_TOKEN environment variable is required');
  process.exit(1);
}

// Create Directus API client
const directusClient = axios.create({
  baseURL: directusUrl,
  headers: {
    'Authorization': `Bearer ${directusToken}`,
    'Content-Type': 'application/json'
  }
});

// Initialize our tools
const createPolicyFn = createAccessPolicy(directusClient);
const createRoleFn = createRole(directusClient);
const assignPolicyFn = assignPolicyToRole(directusClient);

async function runTest() {
  logger.info('Starting policy management test');
  
  try {
    // Step 1: Create a test role
    logger.info('Creating test role...');
    const testRoleName = `Test Role ${new Date().toISOString().substring(0, 19).replace(/[-:T]/g, '')}`;
    const roleResult = await createRoleFn({
      name: testRoleName,
      description: 'A test role created by the MCP policy management test'
    });
    
    if (roleResult.status !== 'success') {
      logger.error(`Failed to create role: ${roleResult.message}`);
      return;
    }
    
    logger.info(`Created role "${testRoleName}" with ID: ${roleResult.details.roleId}`);
    const roleId = roleResult.details.roleId;
    
    // Step 2: Create multiple test policies
    logger.info('Creating test policies...');
    
    // Create a basic access policy
    const basicPolicy = await createPolicyFn({
      name: `Basic Policy ${Date.now()}`,
      description: 'Basic access policy for testing',
      app_access: true
    });
    
    // Create an admin access policy
    const adminPolicy = await createPolicyFn({
      name: `Admin Policy ${Date.now()}`,
      description: 'Admin access policy for testing',
      admin_access: true,
      app_access: true
    });
    
    if (basicPolicy.status !== 'success' || adminPolicy.status !== 'success') {
      logger.error('Failed to create one or more policies');
      return;
    }
    
    const basicPolicyId = basicPolicy.details.policyId;
    const adminPolicyId = adminPolicy.details.policyId;
    
    logger.info(`Created basic policy with ID: ${basicPolicyId}`);
    logger.info(`Created admin policy with ID: ${adminPolicyId}`);
    
    // Step 3: Assign policies to the role
    logger.info('Assigning policies to role...');
    const assignResult = await assignPolicyFn({
      roleId,
      policyIds: [basicPolicyId, adminPolicyId]
    });
    
    if (assignResult.status !== 'success') {
      logger.error(`Failed to assign policies: ${assignResult.message}`);
      return;
    }
    
    logger.info(`Successfully assigned policies to role "${testRoleName}"`);
    
    // Use the allPolicies property with type checking
    const allPoliciesCount = assignResult.details?.allPolicies?.length || 0;
    logger.info(`Role now has ${allPoliciesCount} policies`);
    
    // Step 4: Verify the assignment by getting the role details
    logger.info('Verifying policy assignment...');
    const verifyResponse = await directusClient.get(`/roles/${roleId}`);
    const roleWithPolicies = verifyResponse.data.data;
    
    // Add type checking for policies array
    const policiesArray = roleWithPolicies.policies || [];
    logger.info(`Role "${roleWithPolicies.name}" has ${policiesArray.length} policies:`);
    for (const policyId of policiesArray) {
      logger.info(`- Policy ID: ${policyId}`);
    }
    
    logger.info('Policy management test completed successfully');
  } catch (error: any) {
    logger.error(`Error during test: ${error.message}`, error);
    
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