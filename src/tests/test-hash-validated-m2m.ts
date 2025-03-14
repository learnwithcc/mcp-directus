/**
 * Test script for hash-validated M2M relationship creation
 * 
 * This script demonstrates how to use the new schemaApplyWithHash utilities
 * to create Many-to-Many relationships with proper hash validation.
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { createM2MRelationWithHash } from '../utils/schemaApplyWithHash';
import { createCollection, createField, cleanupCollections } from '../utils/create-test-m2m-directly';

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
 * Run a test to create M2M relationship with hash validation
 */
async function testHashValidatedM2M() {
  const productsCollection = 'test_products_hash';
  const categoriesCollection = 'test_categories_hash';
  const junctionCollection = 'test_products_categories_hash';
  
  try {
    console.log('\n--- Testing hash-validated M2M relationship creation ---\n');
    
    // Step 1: Create collections
    console.log('Creating test collections...');
    await createCollection(productsCollection, 'Test products collection for hash validation');
    await createCollection(categoriesCollection, 'Test categories collection for hash validation');
    
    // Step 2: Add fields to products
    console.log('Adding fields to products collection...');
    await createField(productsCollection, 'name', 'string');
    await createField(productsCollection, 'price', 'float');
    await createField(productsCollection, 'description', 'text');
    
    // Step 3: Add fields to categories
    console.log('Adding fields to categories collection...');
    await createField(categoriesCollection, 'name', 'string');
    await createField(categoriesCollection, 'description', 'text');
    
    // Step 4: Create M2M relationship with hash validation
    console.log('Creating M2M relationship with hash validation...');
    const result = await createM2MRelationWithHash(directusClient, {
      collectionA: productsCollection,
      collectionB: categoriesCollection,
      junctionCollection: junctionCollection,
      fieldAName: 'categories',
      fieldBName: 'products',
      fieldAOptions: {
        template: '{{name}}'
      },
      fieldBOptions: {
        template: '{{name}}'
      }
    });
    
    console.log('\nTest result:');
    console.log(JSON.stringify(result, null, 2));
    
    // Step 5: Test idempotency - try creating the same relationship again
    console.log('\nTesting idempotency - creating the same relationship again...');
    const idempotencyResult = await createM2MRelationWithHash(directusClient, {
      collectionA: productsCollection,
      collectionB: categoriesCollection,
      junctionCollection: junctionCollection,
      fieldAName: 'categories',
      fieldBName: 'products'
    });
    
    console.log('\nIdempotency test result:');
    console.log(JSON.stringify(idempotencyResult, null, 2));
    
    // Step 6: Test forcing apply without hash validation
    console.log('\nTesting force apply option...');
    const forceResult = await createM2MRelationWithHash(directusClient, {
      collectionA: productsCollection,
      collectionB: categoriesCollection,
      junctionCollection: junctionCollection,
      fieldAName: 'categories',
      fieldBName: 'products',
      forceApply: true
    });
    
    console.log('\nForce apply test result:');
    console.log(JSON.stringify(forceResult, null, 2));
    
    console.log('\nTest completed successfully!');
  } catch (error: any) {
    console.error(`Test failed:`, error.message);
  } finally {
    // Step 7: Cleanup
    console.log('\nCleaning up test collections...');
    await cleanupCollections([junctionCollection, productsCollection, categoriesCollection]);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testHashValidatedM2M()
    .then(() => {
      console.log('Finished');
      process.exit(0);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} 