/**
 * Direct test connection script with explicit console logging
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check for required environment variables
const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8077';
const directusToken = process.env.DIRECTUS_ADMIN_TOKEN;

if (!directusToken) {
  console.error('DIRECTUS_ADMIN_TOKEN environment variable is required');
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

async function testConnection() {
  console.log('Testing connection to Directus...');
  
  try {
    // Check server info
    console.log('Checking server info...');
    const serverInfo = await directusClient.get('/server/info');
    console.log(`Connected to Directus version: ${serverInfo.data.data.version}`);
    
    // Check authentication and user info
    console.log('Checking authentication...');
    const currentUser = await directusClient.get('/users/me');
    const userData = currentUser.data.data;
    console.log(`Authenticated as user: ${userData.email || userData.id}`);
    console.log(`User role: ${userData.role?.name || userData.role?.id}`);
    
    // Check role details
    if (userData.role) {
      console.log('Checking role details...');
      try {
        const roleResponse = await directusClient.get(`/roles/${userData.role.id}`);
        const roleData = roleResponse.data.data;
        console.log(`Role details: ${JSON.stringify(roleData, null, 2)}`);
      } catch (error: any) {
        console.error(`Failed to get role details: ${error.message}`);
      }
    }
    
    // Test listing roles
    console.log('Testing listing roles...');
    try {
      const rolesResponse = await directusClient.get('/roles');
      console.log(`Found ${rolesResponse.data.data.length} roles`);
    } catch (error: any) {
      console.error(`Failed to list roles: ${error.message}`);
    }
    
    // Test listing policies
    console.log('Testing listing policies...');
    try {
      const policiesResponse = await directusClient.get('/policies');
      console.log(`Found ${policiesResponse.data.data.length} policies`);
    } catch (error: any) {
      console.error(`Failed to list policies: ${error.message}`);
    }
    
    console.log('Connection test completed');
  } catch (error: any) {
    console.error(`Error during test: ${error.message}`);
    
    if (error.response) {
      console.error(`API Response Status: ${error.response.status}`);
      console.error(`API Response Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

// Run the test
testConnection().catch(error => {
  console.error('Unhandled error in test', error);
}); 