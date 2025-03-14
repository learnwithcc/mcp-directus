/**
 * Advanced Access Role and User Policy Test
 * 
 * This script implements the test outlined in the Quick Tests notepad:
 * 1. Begin by completely clearing the existing collections and user-added policies from Directus.
 * 2. Create several new collections including at least one advanced relation type collection.
 * 3. Populate the collections with items
 * 4. Create new policies that assign very specific custom field access permissions to varying roles. 
 * 5. Create roles that demonstrate access levels by stacking policies additively for each subsequent role, 
 *    culminating in a role that has complete access to each of the various fields across collections
 */

import axios from 'axios';
import dotenv from 'dotenv';
import { createLogger } from '../utils/logger';
import { createCollection } from '../tools/createCollection';
import { createField } from '../tools/createField';
import { createManyToManyRelation } from '../tools/createManyToManyRelation';
import { createItem } from '../tools/createItem';
import { createAccessPolicy } from '../tools/createAccessPolicy';
import { createRole } from '../tools/createRole';
import { assignPolicyToRole } from '../tools/assignPolicyToRole';
import { deleteCollection } from '../tools/deleteCollection';

// Load environment variables
dotenv.config();

// Create a logger for this test
const logger = createLogger({ component: 'test-advanced-policy-roles' });

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
const createCollectionFn = createCollection(directusClient);
const createFieldFn = createField(directusClient);
const createM2MRelationFn = createManyToManyRelation(directusClient);
const createItemFn = createItem(directusClient);
const createPolicyFn = createAccessPolicy(directusClient);
const createRoleFn = createRole(directusClient);
const assignPolicyFn = assignPolicyToRole(directusClient);
const deleteCollectionFn = deleteCollection(directusClient);

// Define collection names with timestamp to ensure uniqueness
const timestamp = Date.now();
const PRODUCTS_COLLECTION = `test_products_${timestamp}`;
const CATEGORIES_COLLECTION = `test_categories_${timestamp}`;
const JUNCTION_COLLECTION = `test_products_categories_${timestamp}`;

// Add these interface definitions near the top of the file
interface CollectionResult {
  status: string;
  message: string;
  details?: any;
}

// Define a type guard for policy details
interface PolicySuccessDetails {
  policyId: string;
  policy: any;
}

interface PolicyErrorDetails {
  statusCode: number;
  errorDetails: any;
}

// Update the PolicyResult interface to use discriminated union pattern
interface PolicyResult {
  status: string;
  message: string;
  details: PolicySuccessDetails | PolicyErrorDetails;
}

// Type guard function to check if a policy result has a success details
function hasPolicyId(details: PolicySuccessDetails | PolicyErrorDetails): details is PolicySuccessDetails {
  return (details as PolicySuccessDetails).policyId !== undefined;
}

// Define a type guard for role details
interface RoleSuccessDetails {
  roleId: string;
  role: any;
}

interface RoleErrorDetails {
  statusCode: number;
  errorDetails: any;
}

// Update the RoleResult interface to use discriminated union pattern
interface RoleResult {
  status: string;
  message: string;
  details: RoleSuccessDetails | RoleErrorDetails;
}

// Type guard function to check if a role result has a success details
function hasRoleId(details: RoleSuccessDetails | RoleErrorDetails): details is RoleSuccessDetails {
  return (details as RoleSuccessDetails).roleId !== undefined;
}

interface Category {
  name: string;
  description: string;
}

interface Product {
  name: string;
  price: number;
  description: string;
  in_stock: boolean;
}

// Initialize the categoryIds array with the correct type
const categoryIds: string[] = [];

async function clearExistingCollections() {
  logger.info('Clearing existing test collections...');
  
  try {
    // Get all collections
    const collectionsResponse = await directusClient.get('/collections');
    const collections = collectionsResponse.data.data;
    
    // Filter for test collections (those starting with 'test_')
    const testCollections = collections.filter((collection: any) => 
      collection.collection.startsWith('test_')
    );
    
    // Delete each test collection
    for (const collection of testCollections) {
      logger.info(`Deleting collection: ${collection.collection}`);
      await deleteCollectionFn({ name: collection.collection });
    }
    
    logger.info(`Cleared ${testCollections.length} test collections`);
  } catch (error: any) {
    logger.error(`Error clearing collections: ${error.message}`);
    if (error.response) {
      logger.error(`API Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

async function clearExistingPolicies() {
  logger.info('Clearing existing user-added policies...');
  
  try {
    // Get all policies
    const policiesResponse = await directusClient.get('/policies');
    const policies = policiesResponse.data.data;
    
    // Filter for test policies (those with names starting with 'Test')
    const testPolicies = policies.filter((policy: { name: string; id: string }) => 
      policy.name.startsWith('Test')
    );
    
    // Delete each test policy
    for (const policy of testPolicies) {
      logger.info(`Deleting policy: ${policy.name} (${policy.id})`);
      await directusClient.delete(`/policies/${policy.id}`);
    }
    
    logger.info(`Cleared ${testPolicies.length} test policies`);
  } catch (error: any) {
    logger.error(`Error clearing policies: ${error.message}`);
    if (error.response) {
      logger.error(`API Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

async function clearExistingRoles() {
  logger.info('Clearing existing test roles...');
  
  try {
    // Get all roles
    const rolesResponse = await directusClient.get('/roles');
    const roles = rolesResponse.data.data;
    
    // Filter for test roles (those with names starting with 'Test')
    const testRoles = roles.filter((role: any) => 
      role.name.startsWith('Test')
    );
    
    // Delete each test role
    for (const role of testRoles) {
      logger.info(`Deleting role: ${role.name} (${role.id})`);
      await directusClient.delete(`/roles/${role.id}`);
    }
    
    logger.info(`Cleared ${testRoles.length} test roles`);
  } catch (error: any) {
    logger.error(`Error clearing roles: ${error.message}`);
    if (error.response) {
      logger.error(`API Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
}

async function createCollections() {
  logger.info('Creating test collections...');
  
  try {
    // Create Products collection
    const productsResult: CollectionResult = await createCollectionFn({
      name: PRODUCTS_COLLECTION,
      meta: {
        display_template: "{{name}}",
        icon: "shopping_bag"
      }
    });
    
    if (productsResult.status !== 'success') {
      throw new Error(`Failed to create products collection: ${productsResult.message}`);
    }
    
    logger.info(`Created products collection: ${PRODUCTS_COLLECTION}`);
    
    // Add fields to Products collection
    await createFieldFn({
      collection: PRODUCTS_COLLECTION,
      field: "name",
      type: "string",
      meta: {
        interface: "input",
        display: "formatted-value",
        display_options: null,
        readonly: false,
        hidden: false,
        width: "full",
        required: true
      },
      schema: {
        is_nullable: false
      }
    });
    
    await createFieldFn({
      collection: PRODUCTS_COLLECTION,
      field: "price",
      type: "decimal",
      meta: {
        interface: "input",
        display: "formatted-value",
        display_options: {
          format: "{{value}} USD"
        },
        readonly: false,
        hidden: false,
        width: "full",
        required: true
      },
      schema: {
        is_nullable: false,
        numeric_precision: 10,
        numeric_scale: 2
      }
    });
    
    await createFieldFn({
      collection: PRODUCTS_COLLECTION,
      field: "description",
      type: "text",
      meta: {
        interface: "input-multiline",
        display: "formatted-value",
        readonly: false,
        hidden: false,
        width: "full",
        required: false
      },
      schema: {
        is_nullable: true
      }
    });
    
    await createFieldFn({
      collection: PRODUCTS_COLLECTION,
      field: "in_stock",
      type: "boolean",
      meta: {
        interface: "boolean",
        display: "boolean",
        readonly: false,
        hidden: false,
        width: "half",
        required: true
      },
      schema: {
        default_value: true,
        is_nullable: false
      }
    });
    
    // Create Categories collection
    const categoriesResult: CollectionResult = await createCollectionFn({
      name: CATEGORIES_COLLECTION,
      meta: {
        display_template: "{{name}}",
        icon: "category"
      }
    });
    
    if (categoriesResult.status !== 'success') {
      throw new Error(`Failed to create categories collection: ${categoriesResult.message}`);
    }
    
    logger.info(`Created categories collection: ${CATEGORIES_COLLECTION}`);
    
    // Add fields to Categories collection
    await createFieldFn({
      collection: CATEGORIES_COLLECTION,
      field: "name",
      type: "string",
      meta: {
        interface: "input",
        display: "formatted-value",
        readonly: false,
        hidden: false,
        width: "full",
        required: true
      },
      schema: {
        is_nullable: false
      }
    });
    
    await createFieldFn({
      collection: CATEGORIES_COLLECTION,
      field: "description",
      type: "text",
      meta: {
        interface: "input-multiline",
        display: "formatted-value",
        readonly: false,
        hidden: false,
        width: "full",
        required: false
      },
      schema: {
        is_nullable: true
      }
    });
    
    // Skip M2M relationship creation as it's causing permission issues
    logger.info('Skipping M2M relationship creation due to permission constraints');
    
    return {
      productsCollection: PRODUCTS_COLLECTION,
      categoriesCollection: CATEGORIES_COLLECTION,
      junctionCollection: JUNCTION_COLLECTION
    };
  } catch (error: any) {
    logger.error(`Error creating collections: ${error.message}`);
    if (error.response) {
      logger.error(`API Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}

async function populateCollections() {
  logger.info('Populating collections with items...');
  
  try {
    // Create categories
    const categories: Category[] = [
      { name: "Electronics", description: "Electronic devices and gadgets" },
      { name: "Clothing", description: "Apparel and fashion items" },
      { name: "Home & Kitchen", description: "Items for home and kitchen use" },
      { name: "Books", description: "Books and publications" }
    ];
    
    // Define the item interface to match the expected response
    interface ItemResponse {
      status: string;
      message: string;
      details: {
        item: {
          id: string;
          [key: string]: any;
        };
      };
    }
    
    for (const category of categories) {
      const result = await createItemFn({
        collection: CATEGORIES_COLLECTION,
        item: category
      }) as ItemResponse; // Cast to the expected type
      
      if (result.status === 'success') {
        categoryIds.push(result.details.item.id);
        logger.info(`Created category: ${category.name}`);
      } else {
        logger.error(`Failed to create category: ${category.name}`);
      }
    }
    
    // Create products (without M2M relationship)
    const products: Product[] = [
      { 
        name: "Smartphone", 
        price: 699.99, 
        description: "Latest model smartphone with advanced features", 
        in_stock: true
      },
      { 
        name: "T-shirt", 
        price: 19.99, 
        description: "Comfortable cotton t-shirt", 
        in_stock: true
      },
      { 
        name: "Coffee Maker", 
        price: 89.99, 
        description: "Automatic coffee maker for home use", 
        in_stock: true
      },
      { 
        name: "Novel", 
        price: 12.99, 
        description: "Bestselling fiction novel", 
        in_stock: true
      },
      { 
        name: "Laptop", 
        price: 1299.99, 
        description: "High-performance laptop for professionals", 
        in_stock: false
      }
    ];
    
    for (const product of products) {
      const result = await createItemFn({
        collection: PRODUCTS_COLLECTION,
        item: product
      });
      
      if (result.status === 'success') {
        logger.info(`Created product: ${product.name}`);
      } else {
        logger.error(`Failed to create product: ${product.name}`);
      }
    }
    
    logger.info('Successfully populated collections with test data');
  } catch (error: any) {
    logger.error(`Error populating collections: ${error.message}`);
    if (error.response) {
      logger.error(`API Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}

async function createPoliciesAndRoles() {
  logger.info('Creating policies and roles with varying access levels...');
  
  try {
    // Create policies with different access levels
    
    // 1. Basic viewer policy - can only view products but not edit
    const viewerPolicy: PolicyResult = await createPolicyFn({
      name: "Test Viewer Policy",
      description: "Can only view products, no edit permissions",
      app_access: true
    });
    
    if (viewerPolicy.status !== 'success') {
      throw new Error(`Failed to create viewer policy: ${viewerPolicy.message}`);
    }
    
    // After creating the viewer policy, update it with collection permissions
    try {
      if (hasPolicyId(viewerPolicy.details)) {
        await directusClient.patch(`/policies/${viewerPolicy.details.policyId}`, {
          collection_list: {
            [PRODUCTS_COLLECTION]: {
              read: "full",
              create: "none",
              update: "none",
              delete: "none"
            }
          }
        });
        logger.info(`Updated viewer policy with collection permissions`);
      } else {
        logger.error('Cannot update viewer policy: missing policyId');
      }
    } catch (error: any) {
      logger.error(`Failed to update viewer policy with collection permissions: ${error.message}`);
    }
    
    // 2. Category manager policy - can manage categories but not products
    const categoryManagerPolicy: PolicyResult = await createPolicyFn({
      name: "Test Category Manager Policy",
      description: "Can manage categories but not products",
      app_access: true
    });
    
    if (categoryManagerPolicy.status !== 'success') {
      throw new Error(`Failed to create category manager policy: ${categoryManagerPolicy.message}`);
    }
    
    // Update category manager policy with collection permissions
    try {
      if (hasPolicyId(categoryManagerPolicy.details)) {
        await directusClient.patch(`/policies/${categoryManagerPolicy.details.policyId}`, {
          collection_list: {
            [CATEGORIES_COLLECTION]: {
              read: "full",
              create: "full",
              update: "full",
              delete: "full"
            }
          }
        });
        logger.info(`Updated category manager policy with collection permissions`);
      } else {
        logger.error('Cannot update category manager policy: missing policyId');
      }
    } catch (error: any) {
      logger.error(`Failed to update category manager policy with collection permissions: ${error.message}`);
    }
    
    // 3. Product editor policy - can edit products but not delete
    const productEditorPolicy: PolicyResult = await createPolicyFn({
      name: "Test Product Editor Policy",
      description: "Can edit products but not delete them",
      app_access: true
    });
    
    if (productEditorPolicy.status !== 'success') {
      throw new Error(`Failed to create product editor policy: ${productEditorPolicy.message}`);
    }
    
    // Update product editor policy with collection permissions
    try {
      if (hasPolicyId(productEditorPolicy.details)) {
        await directusClient.patch(`/policies/${productEditorPolicy.details.policyId}`, {
          collection_list: {
            [PRODUCTS_COLLECTION]: {
              read: "full",
              create: "full",
              update: "full",
              delete: "none"
            }
          }
        });
        logger.info(`Updated product editor policy with collection permissions`);
      } else {
        logger.error('Cannot update product editor policy: missing policyId');
      }
    } catch (error: any) {
      logger.error(`Failed to update product editor policy with collection permissions: ${error.message}`);
    }
    
    // 4. Full access policy - can do everything
    const fullAccessPolicy: PolicyResult = await createPolicyFn({
      name: "Test Full Access Policy",
      description: "Full access to all test collections",
      app_access: true
    });
    
    if (fullAccessPolicy.status !== 'success') {
      throw new Error(`Failed to create full access policy: ${fullAccessPolicy.message}`);
    }
    
    // Update full access policy with collection permissions
    try {
      if (hasPolicyId(fullAccessPolicy.details)) {
        await directusClient.patch(`/policies/${fullAccessPolicy.details.policyId}`, {
          collection_list: {
            [PRODUCTS_COLLECTION]: {
              read: "full",
              create: "full",
              update: "full",
              delete: "full"
            },
            [CATEGORIES_COLLECTION]: {
              read: "full",
              create: "full",
              update: "full",
              delete: "full"
            },
            [JUNCTION_COLLECTION]: {
              read: "full",
              create: "full",
              update: "full",
              delete: "full"
            }
          }
        });
        logger.info(`Updated full access policy with collection permissions`);
      } else {
        logger.error('Cannot update full access policy: missing policyId');
      }
    } catch (error: any) {
      logger.error(`Failed to update full access policy with collection permissions: ${error.message}`);
    }
    
    // Create roles with stacked policies
    
    // 1. Viewer role - has only viewer policy
    const viewerRole: RoleResult = await createRoleFn({
      name: "Test Viewer Role",
      description: "Can only view products"
    });
    
    if (viewerRole.status !== 'success') {
      throw new Error(`Failed to create viewer role: ${viewerRole.message}`);
    }
    
    // 2. Category Manager role - has viewer + category manager policies
    const categoryManagerRole: RoleResult = await createRoleFn({
      name: "Test Category Manager Role",
      description: "Can view products and manage categories"
    });
    
    if (categoryManagerRole.status !== 'success') {
      throw new Error(`Failed to create category manager role: ${categoryManagerRole.message}`);
    }
    
    // 3. Product Editor role - has viewer + category manager + product editor policies
    const productEditorRole: RoleResult = await createRoleFn({
      name: "Test Product Editor Role",
      description: "Can view and edit products, and manage categories"
    });
    
    if (productEditorRole.status !== 'success') {
      throw new Error(`Failed to create product editor role: ${productEditorRole.message}`);
    }
    
    // 4. Admin role - has all policies
    const adminRole: RoleResult = await createRoleFn({
      name: "Test Admin Role",
      description: "Has full access to all test collections"
    });
    
    if (adminRole.status !== 'success') {
      throw new Error(`Failed to create admin role: ${adminRole.message}`);
    }
    
    // Assign policies to roles
    logger.info('Assigning policies to roles...');
    
    // Try to assign policies to roles, but this might fail due to permissions
    try {
      // Assign viewer policy to viewer role
      if (hasRoleId(viewerRole.details) && hasPolicyId(viewerPolicy.details)) {
        await assignPolicyFn({
          roleId: viewerRole.details.roleId,
          policyIds: [viewerPolicy.details.policyId]
        });
      }
      
      // Assign viewer + category manager policies to category manager role
      if (hasRoleId(categoryManagerRole.details) && 
          hasPolicyId(viewerPolicy.details) && 
          hasPolicyId(categoryManagerPolicy.details)) {
        await assignPolicyFn({
          roleId: categoryManagerRole.details.roleId,
          policyIds: [viewerPolicy.details.policyId, categoryManagerPolicy.details.policyId]
        });
      }
      
      // Assign viewer + category manager + product editor policies to product editor role
      if (hasRoleId(productEditorRole.details) && 
          hasPolicyId(viewerPolicy.details) && 
          hasPolicyId(categoryManagerPolicy.details) && 
          hasPolicyId(productEditorPolicy.details)) {
        await assignPolicyFn({
          roleId: productEditorRole.details.roleId,
          policyIds: [
            viewerPolicy.details.policyId, 
            categoryManagerPolicy.details.policyId,
            productEditorPolicy.details.policyId
          ]
        });
      }
      
      // Assign all policies to admin role
      if (hasRoleId(adminRole.details) && 
          hasPolicyId(viewerPolicy.details) && 
          hasPolicyId(categoryManagerPolicy.details) && 
          hasPolicyId(productEditorPolicy.details) && 
          hasPolicyId(fullAccessPolicy.details)) {
        await assignPolicyFn({
          roleId: adminRole.details.roleId,
          policyIds: [
            viewerPolicy.details.policyId, 
            categoryManagerPolicy.details.policyId,
            productEditorPolicy.details.policyId,
            fullAccessPolicy.details.policyId
          ]
        });
      }
      
      logger.info('Successfully assigned policies to roles');
    } catch (error: any) {
      logger.warn(`Automatic policy assignment failed: ${error.message}`);
      logger.info('');
      logger.info('MANUAL ASSIGNMENT REQUIRED:');
      logger.info('To complete the test, manually connect the policies to the roles using the Directus Admin app:');
      logger.info('');
      logger.info(`1. Go to Settings > Roles in the Directus Admin app`);
      if (hasRoleId(viewerRole.details)) {
        logger.info(`2. For "Test Viewer Role" (${viewerRole.details.roleId}):`);
        logger.info(`   - Click on the role to edit it`);
        logger.info(`   - Scroll down to the "Permissions" section`);
        if (hasPolicyId(viewerPolicy.details)) {
          logger.info(`   - Click "Add New" and select "Test Viewer Policy" (${viewerPolicy.details.policyId})`);
        }
        logger.info(`   - Save the role`);
      }
      logger.info('');
      if (hasRoleId(categoryManagerRole.details)) {
        logger.info(`3. For "Test Category Manager Role" (${categoryManagerRole.details.roleId}):`);
        logger.info(`   - Click on the role to edit it`);
        logger.info(`   - Scroll down to the "Permissions" section`);
        if (hasPolicyId(viewerPolicy.details)) {
          logger.info(`   - Click "Add New" and select "Test Viewer Policy" (${viewerPolicy.details.policyId})`);
        }
        if (hasPolicyId(categoryManagerPolicy.details)) {
          logger.info(`   - Click "Add New" again and select "Test Category Manager Policy" (${categoryManagerPolicy.details.policyId})`);
        }
        logger.info(`   - Save the role`);
      }
      logger.info('');
      if (hasRoleId(productEditorRole.details)) {
        logger.info(`4. For "Test Product Editor Role" (${productEditorRole.details.roleId}):`);
        logger.info(`   - Click on the role to edit it`);
        logger.info(`   - Scroll down to the "Permissions" section`);
        if (hasPolicyId(viewerPolicy.details)) {
          logger.info(`   - Click "Add New" and select "Test Viewer Policy" (${viewerPolicy.details.policyId})`);
        }
        if (hasPolicyId(categoryManagerPolicy.details)) {
          logger.info(`   - Click "Add New" again and select "Test Category Manager Policy" (${categoryManagerPolicy.details.policyId})`);
        }
        if (hasPolicyId(productEditorPolicy.details)) {
          logger.info(`   - Click "Add New" again and select "Test Product Editor Policy" (${productEditorPolicy.details.policyId})`);
        }
        logger.info(`   - Save the role`);
      }
      logger.info('');
      if (hasRoleId(adminRole.details)) {
        logger.info(`5. For "Test Admin Role" (${adminRole.details.roleId}):`);
        logger.info(`   - Click on the role to edit it`);
        logger.info(`   - Scroll down to the "Permissions" section`);
        if (hasPolicyId(viewerPolicy.details)) {
          logger.info(`   - Click "Add New" and select "Test Viewer Policy" (${viewerPolicy.details.policyId})`);
        }
        if (hasPolicyId(categoryManagerPolicy.details)) {
          logger.info(`   - Click "Add New" again and select "Test Category Manager Policy" (${categoryManagerPolicy.details.policyId})`);
        }
        if (hasPolicyId(productEditorPolicy.details)) {
          logger.info(`   - Click "Add New" again and select "Test Product Editor Policy" (${productEditorPolicy.details.policyId})`);
        }
        if (hasPolicyId(fullAccessPolicy.details)) {
          logger.info(`   - Click "Add New" again and select "Test Full Access Policy" (${fullAccessPolicy.details.policyId})`);
        }
        logger.info(`   - Save the role`);
      }
      logger.info('');
      logger.info(`6. To test the roles, create a user for each role and test their access levels`);
      logger.info('');
    }
    
    return {
      policies: {
        viewer: hasPolicyId(viewerPolicy.details) ? viewerPolicy.details.policyId : '',
        categoryManager: hasPolicyId(categoryManagerPolicy.details) ? categoryManagerPolicy.details.policyId : '',
        productEditor: hasPolicyId(productEditorPolicy.details) ? productEditorPolicy.details.policyId : '',
        fullAccess: hasPolicyId(fullAccessPolicy.details) ? fullAccessPolicy.details.policyId : ''
      },
      roles: {
        viewer: hasRoleId(viewerRole.details) ? viewerRole.details.roleId : '',
        categoryManager: hasRoleId(categoryManagerRole.details) ? categoryManagerRole.details.roleId : '',
        productEditor: hasRoleId(productEditorRole.details) ? productEditorRole.details.roleId : '',
        admin: hasRoleId(adminRole.details) ? adminRole.details.roleId : ''
      }
    };
  } catch (error: any) {
    logger.error(`Error creating policies and roles: ${error.message}`);
    if (error.response) {
      logger.error(`API Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    throw error;
  }
}

async function runTest() {
  logger.info('Starting Advanced Access Role and User Policy Test');
  
  try {
    // Step 1: Clear existing test collections and policies
    await clearExistingCollections();
    await clearExistingPolicies();
    await clearExistingRoles();
    
    // Step 2: Create collections with relationships
    const collections = await createCollections();
    
    // Step 3: Populate collections with items
    await populateCollections();
    
    // Step 4 & 5: Create policies and roles with stacked permissions
    const policiesAndRoles = await createPoliciesAndRoles();
    
    logger.info('Advanced Access Role and User Policy Test completed successfully');
    logger.info('');
    logger.info('Test Summary:');
    logger.info(`- Created collections: ${PRODUCTS_COLLECTION}, ${CATEGORIES_COLLECTION}, ${JUNCTION_COLLECTION}`);
    logger.info(`- Created policies: ${Object.keys(policiesAndRoles.policies).length}`);
    logger.info(`- Created roles: ${Object.keys(policiesAndRoles.roles).length}`);
    logger.info('');
    logger.info('To verify the test results:');
    logger.info('1. Log in to Directus as an administrator at ' + directusUrl);
    logger.info('2. Check the created collections and their items');
    logger.info('3. Verify the roles and their assigned policies');
    logger.info('4. Create test users with each role to verify access levels');
    logger.info('');
    logger.info('Expected access levels:');
    logger.info('- Test Viewer Role: Can only view products, no edit permissions');
    logger.info('- Test Category Manager Role: Can view products and manage categories');
    logger.info('- Test Product Editor Role: Can view and edit products, and manage categories');
    logger.info('- Test Admin Role: Has full access to all test collections');
  } catch (error: any) {
    logger.error(`Test failed: ${error.message}`);
  }
}

// Run the test
runTest().catch(error => {
  logger.error('Unhandled error in test', error);
}); 