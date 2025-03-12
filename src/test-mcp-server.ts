import axios from 'axios';
import { DirectusMCPServer } from './directusMCPServer';
import dotenv from 'dotenv';

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
  console.log("\n=== TEST 1: BASIC COLLECTION OPERATIONS ===\n");
  
  const testCollectionName = 'test_basic_collection';
  
  try {
    // Step 1: Create a collection
    console.log(`Creating collection "${testCollectionName}"...`);
    
    const createCollectionResult = await mcpServer.invokeTool('createCollection', {
      name: testCollectionName,
      meta: {
        note: 'Test collection for MCP server functionality testing'
      }
    });
    
    console.log('Collection created successfully:', createCollectionResult.result);
    
    // Step 2: Add fields to the collection
    console.log('\nAdding fields to the collection...');
    
    const fields = [
      { name: 'title', type: 'string' },
      { name: 'description', type: 'text' },
      { name: 'status', type: 'string' },
      { name: 'date_created', type: 'timestamp' }
    ];
    
    for (const field of fields) {
      console.log(`Creating field "${field.name}" of type "${field.type}"...`);
      
      const createFieldResult = await mcpServer.invokeTool('createField', {
        collection: testCollectionName,
        field: field.name,
        type: field.type
      });
      
      console.log(`Field "${field.name}" created successfully`);
    }
    
    // Step 3: Delete the fields
    console.log('\nDeleting fields...');
    
    for (const field of fields) {
      console.log(`Deleting field "${field.name}"...`);
      
      try {
        await directusClient.delete(`/fields/${testCollectionName}/${field.name}`);
        console.log(`Field "${field.name}" deleted successfully`);
      } catch (error: any) {
        console.error(`Error deleting field "${field.name}":`, error.message);
      }
    }
    
    // Step 4: Delete the collection
    console.log('\nDeleting the collection...');
    
    try {
      await directusClient.delete(`/collections/${testCollectionName}`);
      console.log(`Collection "${testCollectionName}" deleted successfully`);
    } catch (error: any) {
      console.error(`Error deleting collection:`, error.message);
    }
    
    console.log('\nBasic collection operations test completed successfully!');
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
 * Test 2: Complex Relation Collection Operations
 * - Create two collections
 * - Add fields to both collections
 * - Create a junction collection
 * - Set up M2M and M2O relations
 * - Delete fields, relations, and collections
 */
async function testComplexRelationCollections() {
  console.log("\n=== TEST 2: COMPLEX RELATION COLLECTIONS ===\n");
  
  const productsCollection = 'test_products';
  const categoriesCollection = 'test_categories';
  const junctionCollection = 'test_products_categories';
  
  try {
    // Step 1: Create the products collection
    console.log(`Creating collection "${productsCollection}"...`);
    
    await mcpServer.invokeTool('createCollection', {
      name: productsCollection,
      meta: {
        note: 'Test products collection with relations'
      }
    });
    
    console.log(`Collection "${productsCollection}" created successfully`);
    
    // Step 2: Create the categories collection
    console.log(`\nCreating collection "${categoriesCollection}"...`);
    
    await mcpServer.invokeTool('createCollection', {
      name: categoriesCollection,
      meta: {
        note: 'Test categories collection with relations'
      }
    });
    
    console.log(`Collection "${categoriesCollection}" created successfully`);
    
    // Step 3: Add fields to products collection
    console.log('\nAdding fields to products collection...');
    
    const productFields = [
      { name: 'name', type: 'string' },
      { name: 'price', type: 'float' },
      { name: 'description', type: 'text' }
    ];
    
    for (const field of productFields) {
      await mcpServer.invokeTool('createField', {
        collection: productsCollection,
        field: field.name,
        type: field.type
      });
      
      console.log(`Field "${field.name}" created in products collection`);
    }
    
    // Step 4: Add fields to categories collection
    console.log('\nAdding fields to categories collection...');
    
    const categoryFields = [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'text' }
    ];
    
    for (const field of categoryFields) {
      await mcpServer.invokeTool('createField', {
        collection: categoriesCollection,
        field: field.name,
        type: field.type
      });
      
      console.log(`Field "${field.name}" created in categories collection`);
    }
    
    // Step 5: Create a Many-to-Many relation
    console.log('\nCreating Many-to-Many relation between products and categories...');
    
    const m2mResult = await mcpServer.invokeTool('createManyToManyRelation', {
      collection_a: productsCollection,
      collection_b: categoriesCollection,
      field_a_name: 'categories',
      field_b_name: 'products',
      junction_collection: junctionCollection
    });
    
    console.log('Many-to-Many relation created successfully:', m2mResult.result);
    
    // Step 6: Create a Many-to-One relation (product to primary category)
    console.log('\nCreating Many-to-One relation from products to categories...');
    
    const m2oResult = await mcpServer.invokeTool('createRelation', {
      collection: productsCollection,
      field: 'primary_category',
      related_collection: categoriesCollection,
      meta: {
        interface: 'select-dropdown-m2o',
        special: 'm2o'
      }
    });
    
    console.log('Many-to-One relation created successfully');
    
    // Step 7: Clean up - Delete relations, fields, and collections
    console.log('\nPerforming cleanup operations...');
    
    // Delete M2O relation field
    console.log('Deleting M2O relation field...');
    await directusClient.delete(`/fields/${productsCollection}/primary_category`);
    
    // Delete junction collection (this should delete the M2M relation fields too)
    console.log('Deleting junction collection...');
    await directusClient.delete(`/collections/${junctionCollection}`);
    
    // Delete product fields
    console.log('Deleting product fields...');
    for (const field of productFields) {
      await directusClient.delete(`/fields/${productsCollection}/${field.name}`);
    }
    
    // Delete category fields
    console.log('Deleting category fields...');
    for (const field of categoryFields) {
      await directusClient.delete(`/fields/${categoriesCollection}/${field.name}`);
    }
    
    // Delete main collections
    console.log('Deleting products collection...');
    await directusClient.delete(`/collections/${productsCollection}`);
    
    console.log('Deleting categories collection...');
    await directusClient.delete(`/collections/${categoriesCollection}`);
    
    console.log('\nComplex relation collections test completed successfully!');
    return true;
    
  } catch (error: any) {
    console.error('Error in complex relation collections test:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
    
    // Attempt cleanup in case of error
    try {
      console.log('\nAttempting cleanup after error...');
      
      // Delete collections
      await directusClient.delete(`/collections/${junctionCollection}`).catch(() => {});
      await directusClient.delete(`/collections/${productsCollection}`).catch(() => {});
      await directusClient.delete(`/collections/${categoriesCollection}`).catch(() => {});
      
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }
    
    return false;
  }
}

// Run the tests sequentially
async function runTests() {
  console.log("Starting MCP server functionality tests...");
  
  // Run Test 1
  const test1Result = await testBasicCollectionOperations();
  
  // Only run Test 2 if Test 1 succeeds
  if (test1Result) {
    await testComplexRelationCollections();
  } else {
    console.log("Skipping Test 2 because Test 1 failed");
  }
  
  console.log("\nTests completed!");
}

// Execute the tests
runTests().catch(error => {
  console.error("Unhandled error during tests:", error);
}); 