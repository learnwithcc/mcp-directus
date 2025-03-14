import axios from 'axios';
import { DirectusMCPServer } from '../directusMCPServer';
import dotenv from 'dotenv';
import { setupTestPermissions } from './utils/setup-test-permissions';
import { log } from '../utils/logging';

// Load environment variables
dotenv.config();

const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8077';
const directusToken = process.env.DIRECTUS_ADMIN_TOKEN || '';

if (!directusToken) {
  console.error('DIRECTUS_ADMIN_TOKEN is required');
  process.exit(1);
}

// Initialize the Directus client and MCP server
const directusClient = axios.create({
  baseURL: directusUrl,
  headers: {
    'Authorization': `Bearer ${directusToken}`,
    'Content-Type': 'application/json'
  }
});

const mcpServer = new DirectusMCPServer(directusUrl, directusToken);

/**
 * Test 1: Basic Collection Operations
 * - Create a collection
 * - Add fields to it
 * - Delete fields
 * - Delete collection
 */
async function testBasicCollectionOperations() {
  log('info', "\n=== TEST 1: BASIC COLLECTION OPERATIONS ===\n");
  
  const testCollectionName = 'test_basic_collection';
  
  try {
    // Step 1: Create a collection
    log('info', `Creating collection "${testCollectionName}"...`);
    
    const createCollectionResult = await mcpServer.invokeTool('createCollection', {
      name: testCollectionName,
      meta: {
        note: 'Test collection for MCP server functionality testing'
      }
    });
    
    log('info', `Collection created successfully: ${JSON.stringify(createCollectionResult.result)}`);
    
    // Step 2: Add fields to the collection
    log('info', '\nAdding fields to the collection...');
    
    const fields = [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'text' },
      { name: 'status', type: 'string' },
      { name: 'date_created', type: 'timestamp' }
    ];
    
    for (const field of fields) {
      log('info', `Creating field "${field.name}" of type "${field.type}"...`);
      
      const createFieldResult = await mcpServer.invokeTool('createField', {
        collection: testCollectionName,
        field: field.name,
        type: field.type
      });
      
      log('info', `Field "${field.name}" created successfully`);
    }
    
    // Step 3: Delete the fields
    log('info', '\nDeleting fields...');
    
    for (const field of fields) {
      log('info', `Deleting field "${field.name}"...`);
      
      try {
        await directusClient.delete(`/fields/${testCollectionName}/${field.name}`);
        log('info', `Field "${field.name}" deleted successfully`);
      } catch (error: any) {
        console.error(`Error deleting field "${field.name}":`, error.message);
      }
    }
    
    // Step 4: Delete the collection
    log('info', '\nDeleting the collection...');
    
    try {
      const deleteResult = await mcpServer.invokeTool('deleteCollection', { name: testCollectionName });
      log('info', `Collection "${testCollectionName}" deleted successfully: ${JSON.stringify(deleteResult.result)}`);
    } catch (error: any) {
      console.error(`Error deleting collection:`, error.message);
    }
    
    log('info', '\nBasic collection operations test completed successfully!');
    return true;
    
  } catch (error: any) {
    console.error('Error in basic collection operations test:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    return false;
  }
}

/**
 * Test 2: Complex Relation Collections
 * - Create two collections with several fields each
 * - Create a junction collection
 * - Delete collections
 */
async function testComplexRelationCollections() {
  log('info', "\n=== TEST 2: COMPLEX RELATION COLLECTIONS ===\n");
  
  const productsCollection = 'test_products';
  const categoriesCollection = 'test_categories';
  const junctionCollection = 'test_products_categories';
  
  try {
    // Step 1: Create the products collection
    log('info', `Creating collection "${productsCollection}"...`);
    
    await mcpServer.invokeTool('createCollection', {
      name: productsCollection,
      meta: {
        note: 'Test products collection with relations'
      }
    });
    
    log('info', `Collection "${productsCollection}" created successfully`);
    
    // Step 2: Create the categories collection
    log('info', `\nCreating collection "${categoriesCollection}"...`);
    
    await mcpServer.invokeTool('createCollection', {
      name: categoriesCollection,
      meta: {
        note: 'Test categories collection with relations'
      }
    });
    
    log('info', `Collection "${categoriesCollection}" created successfully`);
    
    // Step 3: Create the junction collection
    log('info', `\nCreating junction collection "${junctionCollection}"...`);
    
    await mcpServer.invokeTool('createCollection', {
      name: junctionCollection,
      meta: {
        note: 'Junction collection for products and categories'
      }
    });
    
    log('info', `Collection "${junctionCollection}" created successfully`);
    
    // Step 4: Add fields to products collection
    log('info', '\nAdding fields to products collection...');
    
    await mcpServer.invokeTool('createField', {
      collection: productsCollection,
      field: 'name',
      type: 'string'
    });
    
    log('info', `Field "name" created in products collection`);
    
    await mcpServer.invokeTool('createField', {
      collection: productsCollection,
      field: 'price',
      type: 'float'
    });
    
    log('info', `Field "price" created in products collection`);
    
    await mcpServer.invokeTool('createField', {
      collection: productsCollection,
      field: 'description',
      type: 'text'
    });
    
    log('info', `Field "description" created in products collection`);
    
    // Step 5: Add fields to categories collection
    log('info', '\nAdding fields to categories collection...');
    
    await mcpServer.invokeTool('createField', {
      collection: categoriesCollection,
      field: 'name',
      type: 'string'
    });
    
    log('info', `Field "name" created in categories collection`);
    
    await mcpServer.invokeTool('createField', {
      collection: categoriesCollection,
      field: 'description',
      type: 'text'
    });
    
    log('info', `Field "description" created in categories collection`);
    
    // Step 6: Add fields to junction collection
    log('info', '\nAdding fields to junction collection...');
    
    await mcpServer.invokeTool('createField', {
      collection: junctionCollection,
      field: 'product_id',
      type: 'integer'
    });
    
    log('info', `Field "product_id" created in junction collection`);
    
    await mcpServer.invokeTool('createField', {
      collection: junctionCollection,
      field: 'category_id',
      type: 'integer'
    });
    
    log('info', `Field "category_id" created in junction collection`);
    
    log('info', '\nComplex relation collections test completed successfully!');
    return true;
  } catch (error: any) {
    console.error('Error in complex relation collections test:', error.message);
    
    // Attempt to clean up after error
    log('info', '\nAttempting cleanup after error...');
    
    try {
      log('info', `Attempting to delete collection "${junctionCollection}"`);
      await directusClient.delete(`/collections/${junctionCollection}`);
      log('info', `Collection "${junctionCollection}" deleted successfully`);
      
      log('info', `Attempting to delete collection "${productsCollection}"`);
      await directusClient.delete(`/collections/${productsCollection}`);
      log('info', `Collection "${productsCollection}" deleted successfully`);
      
      log('info', `Attempting to delete collection "${categoriesCollection}"`);
      await directusClient.delete(`/collections/${categoriesCollection}`);
      log('info', `Collection "${categoriesCollection}" deleted successfully`);
    } catch (cleanupError: any) {
      console.error('Error during cleanup:', cleanupError.message);
    }
    
    return false;
  }
}

// Run the tests sequentially
async function runTests() {
  log('info', "Starting MCP server functionality tests...");
  
  // Run Test 1
  const test1Result = await testBasicCollectionOperations();
  
  // Only run Test 2 if Test 1 succeeds
  if (test1Result) {
    await testComplexRelationCollections();
  } else {
    log('info', "Skipping Test 2 because Test 1 failed");
  }
  
  log('info', "\nTests completed!");
}

// Execute the tests
async function main() {
  // Set up required permissions first
  log('info', "Setting up required permissions before running tests...");
  const permissionsSetup = await setupTestPermissions();
  
  if (!permissionsSetup) {
    console.error("Failed to set up permissions. Tests may not work correctly.");
    process.exit(1);
  }
  
  // Run the tests
  runTests().catch(error => {
    console.error("Unhandled error during tests:", error);
  });
}

// Execute the main function
main(); 