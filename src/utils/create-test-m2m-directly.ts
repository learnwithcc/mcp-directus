/**
 * Create a Many-to-Many relationship directly using the Directus API
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
 * Create a Many-to-Many relationship between two collections using schema apply
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
    // Step 1: Create junction collection if it doesn't exist
    console.log(`Creating junction collection "${junctionCollection}"...`);
    
    await directusClient.post('/collections', {
      collection: junctionCollection,
      schema: {
        name: junctionCollection
      },
      meta: {
        hidden: false,
        icon: 'import_export'
      }
    });
    
    // Use the schema apply endpoint to create the M2M relationship in one go
    console.log("Applying schema changes for M2M relationship...");
    
    const schemaData = {
      collections: [],
      fields: [
        // Create the id fields in the junction collection
        {
          collection: junctionCollection,
          field: `${collectionA}_id`,
          type: 'integer',
          schema: {
            name: `${collectionA}_id`,
            table: junctionCollection,
            data_type: 'integer',
            is_nullable: false
          },
          meta: {
            hidden: false,
            interface: 'select-dropdown-m2o',
            display: 'related-values',
            special: ['m2o'],
            required: true,
            options: {
              template: '{{id}}'
            }
          }
        },
        {
          collection: junctionCollection,
          field: `${collectionB}_id`,
          type: 'integer',
          schema: {
            name: `${collectionB}_id`,
            table: junctionCollection,
            data_type: 'integer',
            is_nullable: false
          },
          meta: {
            hidden: false,
            interface: 'select-dropdown-m2o',
            display: 'related-values',
            special: ['m2o'],
            required: true,
            options: {
              template: '{{id}}'
            }
          }
        },
        // Create M2M alias fields
        {
          collection: collectionA,
          field: fieldAName,
          type: 'alias',
          schema: null,
          meta: {
            interface: 'list-m2m',
            special: ['m2m'],
            options: {
              template: '{{id}}'
            }
          }
        },
        {
          collection: collectionB,
          field: fieldBName,
          type: 'alias',
          schema: null,
          meta: {
            interface: 'list-m2m',
            special: ['m2m'],
            options: {
              template: '{{id}}'
            }
          }
        }
      ],
      relations: [
        // Junction to Collection A
        {
          collection: junctionCollection,
          field: `${collectionA}_id`,
          related_collection: collectionA,
          schema: {
            on_delete: 'SET NULL'
          },
          meta: {
            junction_field: null
          }
        },
        // Junction to Collection B
        {
          collection: junctionCollection,
          field: `${collectionB}_id`,
          related_collection: collectionB,
          schema: {
            on_delete: 'SET NULL'
          },
          meta: {
            junction_field: null
          }
        },
        // Collection A to Collection B through Junction
        {
          collection: collectionA,
          field: fieldAName,
          related_collection: collectionB,
          schema: null,
          meta: {
            junction_field: `${collectionA}_id`,
            many_collection: junctionCollection,
            many_field: `${collectionB}_id`,
            sort_field: null
          }
        },
        // Collection B to Collection A through Junction
        {
          collection: collectionB,
          field: fieldBName,
          related_collection: collectionA,
          schema: null,
          meta: {
            junction_field: `${collectionB}_id`,
            many_collection: junctionCollection,
            many_field: `${collectionA}_id`,
            sort_field: null
          }
        }
      ]
    };
    
    await directusClient.post('/schema/apply', schemaData);
    
    console.log(`M2M relationship created successfully using schema apply`);
    return true;
  } catch (error: any) {
    console.error(`Failed to create M2M relationship:`, error.response?.data || error.message);
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