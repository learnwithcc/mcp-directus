/**
 * Minimal test script for policy and role management
 * 
 * This script tests the creation of roles and policies without attempting to assign policies to roles.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { createAccessPolicy } from '../tools/createAccessPolicy';
import { createRole } from '../tools/createRole';
import { createLogger } from '../utils/logger';

// Load environment variables
dotenv.config();

// Create a logger for this test
const logger = createLogger({ component: 'test-policy-management-minimal' });

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

async function runTest() {
  logger.info('Starting minimal policy management test');
  
  try {
    // Step 1: List existing roles
    logger.info('Listing existing roles...');
    try {
      const rolesResponse = await directusClient.get('/roles');
      logger.info(`Found ${rolesResponse.data.data.length} roles:`);
      for (const role of rolesResponse.data.data) {
        logger.info(`- ${role.name} (${role.id})`);
      }
    } catch (error: any) {
      logger.error(`Failed to list roles: ${error.message}`);
    }
    
    // Step 2: List existing policies
    logger.info('Listing existing policies...');
    try {
      const policiesResponse = await directusClient.get('/policies');
      logger.info(`Found ${policiesResponse.data.data.length} policies:`);
      for (const policy of policiesResponse.data.data) {
        logger.info(`- ${policy.name} (${policy.id})`);
      }
    } catch (error: any) {
      logger.error(`Failed to list policies: ${error.message}`);
    }
    
    // Step 3: Create a test role
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
    
    // Step 4: Create multiple test policies
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
    
    logger.info(`Created basic policy with ID: ${basicPolicy.details.policyId}`);
    logger.info(`Created admin policy with ID: ${adminPolicy.details.policyId}`);
    
    // Step 5: Manual instructions
    logger.info('');
    logger.info('MANUAL ASSIGNMENT REQUIRED:');
    logger.info('To complete the test, manually connect the policies to the role using the Directus Admin app:');
    logger.info(`1. Go to Settings > Roles > "${testRoleName}"`);
    logger.info(`2. Add the following policies:`);
    logger.info(`   - Basic Policy (${basicPolicy.details.policyId})`);
    logger.info(`   - Admin Policy (${adminPolicy.details.policyId})`);
    logger.info('');
    
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