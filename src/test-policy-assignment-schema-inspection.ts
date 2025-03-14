/**
 * Database Schema Inspection for Role-Policy Relationship
 * 
 * This script inspects the Directus database schema to understand
 * how roles and policies are related in the database.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { createLogger } from './utils/logger';

// Load environment variables
dotenv.config();

// Create a logger for this test
const logger = createLogger({ component: 'schema-inspection' });

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
    }
    return Promise.reject(error);
  }
);

/**
 * Get all collections in the Directus instance
 */
async function getAllCollections() {
  logger.info('Getting all collections...');
  const response = await directusClient.get('/collections');
  return response.data.data;
}

/**
 * Get all system collections in the Directus instance
 */
async function getSystemCollections() {
  logger.info('Getting system collections...');
  const allCollections = await getAllCollections();
  return allCollections.filter((collection: any) => collection.collection.startsWith('directus_'));
}

/**
 * Get detailed schema for a specific collection
 */
async function getCollectionSchema(collectionName: string) {
  logger.info(`Getting schema for collection: ${collectionName}`);
  try {
    const response = await directusClient.get(`/collections/${collectionName}`);
    return response.data.data;
  } catch (error: any) {
    logger.error(`Error getting schema for ${collectionName}: ${error.message}`);
    return null;
  }
}

/**
 * Get all fields for a specific collection
 */
async function getCollectionFields(collectionName: string) {
  logger.info(`Getting fields for collection: ${collectionName}`);
  try {
    const response = await directusClient.get(`/fields/${collectionName}`);
    return response.data.data;
  } catch (error: any) {
    logger.error(`Error getting fields for ${collectionName}: ${error.message}`);
    return [];
  }
}

/**
 * Get all relations in the database
 */
async function getAllRelations() {
  logger.info('Getting all relations...');
  try {
    const response = await directusClient.get('/relations');
    return response.data.data;
  } catch (error: any) {
    logger.error(`Error getting relations: ${error.message}`);
    return [];
  }
}

/**
 * Get a test role and examine its structure
 */
async function getTestRole() {
  logger.info('Creating a test role to examine...');
  try {
    // Create a test role
    const roleResponse = await directusClient.post('/roles', {
      name: `Test Role Schema ${Date.now()}`,
      description: 'A test role for schema inspection'
    });
    
    const roleId = roleResponse.data.data.id;
    logger.info(`Created test role with ID: ${roleId}`);
    
    // Get the role details
    const roleDetails = await directusClient.get(`/roles/${roleId}`);
    logger.info(`Role details: ${JSON.stringify(roleDetails.data.data, null, 2)}`);
    
    // Try to see if there's role meta collection
    try {
      const response = await directusClient.get(`/items/directus_roles_meta`);
      logger.info(`Role meta collection exists: ${JSON.stringify(response.data.data, null, 2)}`);
    } catch (error: any) {
      logger.info(`directus_roles_meta doesn't exist or isn't accessible`);
    }
    
    return roleId;
  } catch (error: any) {
    logger.error(`Error with test role: ${error.message}`);
    return null;
  }
}

/**
 * Create a test policy and examine its structure
 */
async function getTestPolicy() {
  logger.info('Creating a test policy to examine...');
  try {
    // Create a test policy
    const policyResponse = await directusClient.post('/policies', {
      name: `Test Policy Schema ${Date.now()}`,
      description: 'A test policy for schema inspection',
      app_access: true
    });
    
    const policyId = policyResponse.data.data.id;
    logger.info(`Created test policy with ID: ${policyId}`);
    
    // Get the policy details
    const policyDetails = await directusClient.get(`/policies/${policyId}`);
    logger.info(`Policy details: ${JSON.stringify(policyDetails.data.data, null, 2)}`);
    
    return policyId;
  } catch (error: any) {
    logger.error(`Error with test policy: ${error.message}`);
    return null;
  }
}

/**
 * Examine role and policy relationship
 */
async function examineRolePolicyRelationship() {
  // Look for relations involving roles and policies
  const allRelations = await getAllRelations();
  
  // Filter for relations involving roles or policies
  const roleRelations = allRelations.filter((relation: any) => 
    relation.collection === 'directus_roles' || 
    relation.related_collection === 'directus_roles'
  );
  
  const policyRelations = allRelations.filter((relation: any) => 
    relation.collection === 'directus_policies' || 
    relation.related_collection === 'directus_policies'
  );
  
  // Look for direct relation between roles and policies
  const rolePolicyRelation = allRelations.filter((relation: any) => 
    (relation.collection === 'directus_roles' && relation.related_collection === 'directus_policies') ||
    (relation.collection === 'directus_policies' && relation.related_collection === 'directus_roles')
  );
  
  logger.info(`Role relations: ${JSON.stringify(roleRelations, null, 2)}`);
  logger.info(`Policy relations: ${JSON.stringify(policyRelations, null, 2)}`);
  logger.info(`Direct role-policy relations: ${JSON.stringify(rolePolicyRelation, null, 2)}`);
  
  // Look for junction collections
  const collections = await getAllCollections();
  const potentialJunctions = collections.filter((collection: any) => 
    collection.collection.includes('role') && collection.collection.includes('polic')
  );
  
  logger.info(`Potential junction collections: ${JSON.stringify(potentialJunctions, null, 2)}`);
  
  // Try to inspect the role schema
  const roleFields = await getCollectionFields('directus_roles');
  logger.info(`Role fields: ${JSON.stringify(roleFields, null, 2)}`);
  
  // Look for a policies field
  const policiesField = roleFields.find((field: any) => field.field === 'policies');
  if (policiesField) {
    logger.info(`Found policies field in roles: ${JSON.stringify(policiesField, null, 2)}`);
  } else {
    logger.info('No policies field found in roles');
  }
}

/**
 * Try various assignment methods based on schema inspection
 */
async function tryVariousAssignmentMethods(roleId: string, policyId: string) {
  logger.info(`Attempting various assignment methods for role ${roleId} and policy ${policyId}`);
  
  // Approach 1: Try using private database collections that start with underscore
  try {
    logger.info("Approach 1: Try accessing _join collection if it exists");
    const response = await directusClient.get('/items/_roles_policies');
    logger.info(`_roles_policies collection: ${JSON.stringify(response.data.data, null, 2)}`);
    
    // If we get here, try to insert a record
    await directusClient.post('/items/_roles_policies', {
      roles_id: roleId,
      policies_id: policyId
    });
    logger.info("Successfully created junction record in _roles_policies");
  } catch (error: any) {
    logger.error(`Approach 1 failed: ${error.message}`);
  }
  
  // Approach 2: Try special API for system collections
  try {
    logger.info("Approach 2: Try special system API");
    await directusClient.post('/roles/' + roleId + '/policy', {
      policy: policyId
    });
    logger.info("Successfully assigned using special API");
  } catch (error: any) {
    logger.error(`Approach 2 failed: ${error.message}`);
  }
  
  // Approach 3: Try with schema difference - compute a hash
  try {
    logger.info("Approach 3: Try schema difference with hash");
    
    // First get current schema
    const schemaResponse = await directusClient.get('/schema/snapshot');
    const currentSchema = schemaResponse.data.data;
    
    // Hash code for schema changes
    const hash = currentSchema.hash;
    
    // Now try to update with hash
    await directusClient.post('/schema/apply', {
      hash,
      data: {
        roles: {
          [roleId]: {
            policies: [policyId]
          }
        }
      }
    });
    logger.info("Successfully applied schema changes");
  } catch (error: any) {
    logger.error(`Approach 3 failed: ${error.message}`);
  }
  
  // Check if any approach worked
  try {
    const roleDetails = await directusClient.get(`/roles/${roleId}`);
    const roleData = roleDetails.data.data;
    
    if (roleData.policies && roleData.policies.includes(policyId)) {
      logger.info("Policy assignment succeeded!");
      return true;
    } else {
      logger.info("Policy assignment failed or policies field is empty");
      return false;
    }
  } catch (error: any) {
    logger.error(`Error checking assignment result: ${error.message}`);
    return false;
  }
}

/**
 * Run the test
 */
async function runTest() {
  logger.info('Starting schema inspection test');
  
  try {
    // Get and examine collections and their relationships
    await examineRolePolicyRelationship();
    
    // Create test objects
    const roleId = await getTestRole();
    const policyId = await getTestPolicy();
    
    if (roleId && policyId) {
      // Try various assignment methods
      const success = await tryVariousAssignmentMethods(roleId, policyId);
      
      if (success) {
        logger.info('🎉 Successfully found a working method for policy assignment!');
      } else {
        logger.info('All assignment methods failed.');
        logger.info('Manual assignment through the admin interface may be the only option.');
      }
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