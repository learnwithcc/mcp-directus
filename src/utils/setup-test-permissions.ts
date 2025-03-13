/**
 * Set up permissions for Directus MCP server tests
 * 
 * This script creates the necessary permissions for creating collections, fields, and relations
 * to solve the 403 permission issues encountered during testing.
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8077';
const directusToken = process.env.DIRECTUS_ADMIN_TOKEN || '';

if (!directusToken) {
  console.error('DIRECTUS_ADMIN_TOKEN is required');
  process.exit(1);
}

// Initialize the Directus client
const directusClient = axios.create({
  baseURL: directusUrl,
  headers: {
    'Authorization': `Bearer ${directusToken}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Create a permission for a role to access a collection
 */
async function createPermission(collection: string, action: string, roleId: string) {
  try {
    console.log(`Creating ${action} permission for collection "${collection}" for role ${roleId}`);
    
    const permissionData = {
      collection,
      action,
      role: roleId,
      fields: ['*'],
      permissions: {},
      validation: null,
      presets: null,
      policy: {},
      name: `${action}_${collection}`
    };
    
    const response = await directusClient.post('/permissions', permissionData);
    console.log(`- Permission created successfully`);
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 400 && error.response?.data?.errors[0]?.message?.includes('duplicate')) {
      console.log(`- Permission already exists`);
      return null;
    }
    console.error(`- Error creating permission:`, error.response?.data || error.message);
    return null;
  }
}

/**
 * Set up all the necessary permissions for testing
 */
async function setupTestPermissions() {
  try {
    console.log("Setting up permissions for Directus MCP server tests...");
    
    // Get the admin role ID
    console.log("Retrieving admin role ID...");
    const rolesResponse = await directusClient.get('/roles');
    const adminRole = rolesResponse.data.data.find((role: any) => role.name === 'Administrator');
    
    if (!adminRole) {
      console.error("Could not find Administrator role");
      return false;
    }
    
    const ADMIN_ROLE_ID = adminRole.id;
    console.log(`Found Administrator role with ID: ${ADMIN_ROLE_ID}`);
    
    // Create permissions for system collections first
    console.log("\nSetting up permissions for system collections...");
    const systemCollections = ['directus_relations', 'directus_fields', 'directus_collections'];
    for (const collection of systemCollections) {
      for (const action of ['create', 'read', 'update', 'delete']) {
        await createPermission(collection, action, ADMIN_ROLE_ID);
      }
    }
    
    // Create permissions for test collections
    console.log("\nSetting up permissions for test collections...");
    const testCollections = [
      'test_basic_collection', 
      'test_products', 
      'test_categories', 
      'test_products_categories'
    ];
    
    for (const collection of testCollections) {
      for (const action of ['create', 'read', 'update', 'delete']) {
        await createPermission(collection, action, ADMIN_ROLE_ID);
      }
    }
    
    console.log("\nPermissions setup completed successfully!");
    return true;
  } catch (error: any) {
    console.error("Error setting up permissions:", error.response?.data || error.message);
    return false;
  }
}

// If script is run directly
if (require.main === module) {
  setupTestPermissions()
    .then(success => {
      if (success) {
        console.log("Permission setup completed.");
        process.exit(0);
      } else {
        console.error("Permission setup failed.");
        process.exit(1);
      }
    })
    .catch(error => {
      console.error("Unhandled error:", error);
      process.exit(1);
    });
}

export { setupTestPermissions }; 