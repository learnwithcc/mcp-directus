/**
 * Create a Many-to-Many relationship directly using the Directus API endpoints one by one
 * With complete metadata as required by Directus 11.5.1
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
 * Create a collection with basic fields
 */
async function createCollection(name: string, note: string = '') {
  console.log(`Creating collection "${name}"...`);
  
  try {
    await directusClient.post('/collections', {
      collection: name,
      schema: {
        name: name,
        comment: note
      },
      meta: {
        note: note,
        hidden: false,
        singleton: false,
        icon: 'box'
      }
    });
    
    console.log(`Collection "${name}" created successfully`);
    return true;
  } catch (error: any) {
    console.error(`Failed to create collection "${name}":`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Create a field with complete metadata
 */
async function createField(collection: string, field: string, type: string, meta: any = {}) {
  console.log(`Creating field "${field}" in "${collection}"...`);
  
  try {
    await directusClient.post(`/fields/${collection}`, {
      field: field,
      type: type,
      meta: {
        hidden: false,
        readonly: false,
        interface: type === 'string' ? 'input' : type === 'text' ? 'input-multiline' : null,
        display: type === 'string' ? 'formatted-value' : type === 'text' ? 'formatted-value' : null,
        width: 'full',
        ...meta
      },
      schema: {
        name: field,
        table: collection,
        data_type: type,
        is_nullable: true
      }
    });
    
    console.log(`Field "${field}" created successfully`);
    return true;
  } catch (error: any) {
    console.error(`Failed to create field "${field}":`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Create a simple junction collection for a M2M relationship
 * Creating the junction but not the relation yet
 */
async function createJunctionCollection(collectionA: string, collectionB: string, junctionCollection: string) {
  try {
    // 1. Create the junction collection
    await createCollection(junctionCollection, `Junction table for ${collectionA} and ${collectionB}`);
    
    // 2. Create the foreign key to Collection A
    await directusClient.post(`/fields/${junctionCollection}`, {
      field: `${collectionA}_id`,
      type: 'integer',
      schema: {
        name: `${collectionA}_id`,
        table: junctionCollection,
        data_type: 'integer',
        is_nullable: false,
        default_value: null
      },
      meta: {
        interface: 'select-dropdown-m2o',
        special: ['m2o'],
        options: {
          template: '{{id}}'
        }
      }
    });
    
    // 3. Create the foreign key to Collection B
    await directusClient.post(`/fields/${junctionCollection}`, {
      field: `${collectionB}_id`,
      type: 'integer',
      schema: {
        name: `${collectionB}_id`,
        table: junctionCollection,
        data_type: 'integer',
        is_nullable: false,
        default_value: null
      },
      meta: {
        interface: 'select-dropdown-m2o',
        special: ['m2o'],
        options: {
          template: '{{id}}'
        }
      }
    });
    
    return true;
  } catch (error: any) {
    console.error(`Failed to create junction collection:`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Create direct M2O relations for the junction fields
 */
async function createJunctionRelations(collectionA: string, collectionB: string, junctionCollection: string) {
  try {
    // 1. Create relation from junction to Collection A
    await directusClient.post('/relations', {
      collection: junctionCollection,
      field: `${collectionA}_id`,
      related_collection: collectionA,
      meta: {
        junction_field: null,
        many_collection: junctionCollection,
        many_field: `${collectionA}_id`,
        one_collection: collectionA,
        one_field: null,
        one_allowed_collections: null,
        one_collection_field: null,
        sort_field: null
      }
    });
    
    // 2. Create relation from junction to Collection B
    await directusClient.post('/relations', {
      collection: junctionCollection,
      field: `${collectionB}_id`,
      related_collection: collectionB,
      meta: {
        junction_field: null,
        many_collection: junctionCollection,
        many_field: `${collectionB}_id`,
        one_collection: collectionB,
        one_field: null,
        one_allowed_collections: null,
        one_collection_field: null,
        sort_field: null
      }
    });
    
    return true;
  } catch (error: any) {
    console.error(`Failed to create junction relations:`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Create M2M fields in the main collections
 */
async function createM2MFields(
  collectionA: string, 
  collectionB: string, 
  junctionCollection: string,
  fieldAName: string,
  fieldBName: string
) {
  try {
    // 1. Create the M2M field in collection A
    await directusClient.post(`/fields/${collectionA}`, {
      field: fieldAName,
      type: 'alias',
      meta: {
        special: ['m2m'],
        interface: 'list-m2m',
        options: {
          template: '{{id}}'
        }
      }
    });
    
    // 2. Create the M2M field in collection B
    await directusClient.post(`/fields/${collectionB}`, {
      field: fieldBName,
      type: 'alias',
      meta: {
        special: ['m2m'],
        interface: 'list-m2m',
        options: {
          template: '{{id}}'
        }
      }
    });
    
    return true;
  } catch (error: any) {
    console.error(`Failed to create M2M fields:`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Create the M2M relations in both directions
 */
async function createM2MRelations(
  collectionA: string, 
  collectionB: string, 
  junctionCollection: string,
  fieldAName: string,
  fieldBName: string
) {
  try {
    // 1. Create relation from Collection A to Collection B
    await directusClient.post('/relations', {
      collection: collectionA,
      field: fieldAName,
      related_collection: collectionB,
      meta: {
        junction_field: `${collectionA}_id`,
        many_collection: junctionCollection,
        many_field: `${collectionB}_id`,
        one_collection: collectionA,
        one_field: fieldAName,
        one_allowed_collections: null,
        one_collection_field: null,
        sort_field: null
      }
    });
    
    // 2. Create relation from Collection B to Collection A
    await directusClient.post('/relations', {
      collection: collectionB,
      field: fieldBName,
      related_collection: collectionA,
      meta: {
        junction_field: `${collectionB}_id`,
        many_collection: junctionCollection,
        many_field: `${collectionA}_id`,
        one_collection: collectionB,
        one_field: fieldBName,
        one_allowed_collections: null,
        one_collection_field: null,
        sort_field: null
      }
    });
    
    return true;
  } catch (error: any) {
    console.error(`Failed to create M2M relations:`, error.response?.data || error.message);
    return false;
  }
}

/**
 * Create a Many-to-Many relationship between two collections
 * Breaking the process down into smaller steps to isolate any issues
 */
async function createManyToManyRelation(
  collectionA: string, 
  collectionB: string, 
  junctionCollection: string,
  fieldAName: string = `${collectionB}`,
  fieldBName: string = `${collectionA}`
) {
  console.log(`Creating M2M relationship between "${collectionA}" and "${collectionB}" using junction "${junctionCollection}"...`);
  
  try {
    // Step 1: Create the junction collection with foreign key fields
    console.log(`Creating junction collection and fields...`);
    await createJunctionCollection(collectionA, collectionB, junctionCollection);
    
    // Step 2: Create the M2O relations for the junction fields
    console.log(`Creating M2O relations for junction fields...`);
    await createJunctionRelations(collectionA, collectionB, junctionCollection);
    
    // Step 3: Create the M2M fields in the main collections
    console.log(`Creating M2M fields in main collections...`);
    await createM2MFields(collectionA, collectionB, junctionCollection, fieldAName, fieldBName);
    
    // Step 4: Create the M2M relations
    console.log(`Creating M2M relations...`);
    await createM2MRelations(collectionA, collectionB, junctionCollection, fieldAName, fieldBName);
    
    console.log(`M2M relationship created successfully`);
    return true;
  } catch (error: any) {
    console.error(`Failed to create M2M relationship:`, error.message);
    return false;
  }
}

/**
 * Clean up all collections created for testing
 */
async function cleanupCollections(collections: string[]) {
  console.log(`Cleaning up collections: ${collections.join(', ')}...`);
  
  for (const collection of collections) {
    try {
      await directusClient.delete(`/collections/${collection}`);
      console.log(`Deleted collection "${collection}"`);
    } catch (error: any) {
      console.error(`Failed to delete collection "${collection}":`, error.response?.data || error.message);
    }
  }
}

/**
 * Run a test to create M2M relationship
 */
async function testM2MRelationship() {
  const productsCollection = 'test_products';
  const categoriesCollection = 'test_categories';
  const junctionCollection = 'test_products_categories';
  
  try {
    // Create collections
    await createCollection(productsCollection, 'Test products collection');
    await createCollection(categoriesCollection, 'Test categories collection');
    
    // Add fields to products
    await createField(productsCollection, 'name', 'string');
    await createField(productsCollection, 'price', 'float');
    await createField(productsCollection, 'description', 'text');
    
    // Add fields to categories
    await createField(categoriesCollection, 'name', 'string');
    await createField(categoriesCollection, 'description', 'text');
    
    // Create M2M relationship
    await createManyToManyRelation(
      productsCollection,
      categoriesCollection,
      junctionCollection,
      'categories',
      'products'
    );
    
    console.log(`\nTest completed successfully!`);
  } catch (error: any) {
    console.error(`Test failed:`, error.message);
  } finally {
    // Cleanup
    await cleanupCollections([junctionCollection, productsCollection, categoriesCollection]);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testM2MRelationship()
    .then(() => {
      console.log('Finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { createManyToManyRelation, createCollection, createField, cleanupCollections }; 