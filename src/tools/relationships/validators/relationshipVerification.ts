/**
 * Relationship Verification
 * 
 * This module provides utilities for verifying relationships after they have been created,
 * ensuring they work properly with test data.
 * 
 * PURPOSE:
 * - Verify that relationships function correctly by testing them with actual data
 * - Detect configuration issues in relationship definitions that might not appear until runtime
 * - Ensure that all sides of a relationship work (e.g., both A→B and B→A in bidirectional relationships)
 * - Provide detailed diagnostics when relationships don't work as expected
 * 
 * VERIFICATION APPROACH:
 * The verification process uses the following approach:
 * 1. Use sample test data for both sides of the relationship
 * 2. Establish the relationship between test items
 * 3. Query from both sides to ensure the relationship is correctly established
 * 4. Clean up test relationship data to avoid leaving test artifacts
 * 5. Provide detailed reporting on any issues encountered
 */

import { AxiosInstance } from 'axios';
import { createLogger } from '../../../utils/logger';
import { normalizeResponse } from '../../../utils/normalizers/responseNormalizer';
import { RelationshipType } from '../results/relationshipErrors';

const logger = createLogger({ component: 'relationshipVerification' });

/**
 * Interface for relationship verification issues
 * Issues can be errors (critical problems) or warnings (non-critical issues)
 */
export interface VerificationIssue {
  /**
   * Type of issue - either a critical error or a non-critical warning
   */
  type: 'error' | 'warning';
  
  /**
   * Human-readable description of the issue
   */
  message: string;
  
  /**
   * Additional contextual details about the issue
   * Useful for debugging and troubleshooting
   */
  details?: any;
}

/**
 * Interface for relationship verification result
 * Contains comprehensive information about the verification process
 */
export interface VerificationResult {
  /**
   * Whether the verification was successful overall
   * (false if any critical errors were encountered)
   */
  success: boolean;
  
  /**
   * List of issues encountered during verification
   * May include both errors and warnings
   */
  issues: VerificationIssue[];
  
  /**
   * Additional details about the verification process
   * Contains test results and diagnostic information
   */
  details: any;
}

/**
 * Interface for test data used in verification
 * Provides sample entities to use in relationship testing
 */
export interface RelationshipTestData {
  /**
   * Test item from the first collection in the relationship
   * Should have at least an ID, but may include other fields
   */
  itemA?: { id: string | number; [key: string]: any };
  
  /**
   * Test item from the second collection in the relationship
   * Should have at least an ID, but may include other fields
   */
  itemB?: { id: string | number; [key: string]: any };
  
  /**
   * Optional pre-existing junction items (for M2M relationships)
   * Can be used to test existing relationships
   */
  junctionItems?: Array<{ [key: string]: any }>;
}

/**
 * Verify a relationship by testing it with data
 * 
 * This function is the main entry point for relationship verification.
 * It routes to the appropriate verification strategy based on the
 * relationship type.
 * 
 * Example usage:
 * ```typescript
 * const result = await verifyRelationshipWithData(directusClient, {
 *   relationshipType: 'manyToMany',
 *   collectionA: 'products',
 *   collectionB: 'categories',
 *   fieldA: 'categories',
 *   fieldB: 'products',
 *   junctionCollection: 'products_categories',
 *   testData: {
 *     itemA: { id: 'product-id' },
 *     itemB: { id: 'category-id' }
 *   }
 * });
 * ```
 * 
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for the verification
 * @returns Verification result with detailed diagnostics
 */
export async function verifyRelationshipWithData(
  directusClient: AxiosInstance,
  params: {
    relationshipType: RelationshipType;
    collectionA: string;
    collectionB: string;
    fieldA?: string;
    fieldB?: string;
    junctionCollection?: string;
    testData?: RelationshipTestData;
  }
): Promise<VerificationResult> {
  const {
    relationshipType,
    collectionA,
    collectionB,
    fieldA,
    fieldB,
    junctionCollection,
    testData
  } = params;
  
  const result: VerificationResult = {
    success: false,
    issues: [],
    details: {}
  };
  
  // If no test data is provided, we can't verify with data
  if (!testData) {
    result.issues.push({
      type: 'warning',
      message: 'No test data provided for relationship verification'
    });
    return result;
  }
  
  // Strategy depends on the relationship type
  switch (relationshipType) {
    case 'manyToMany':
      return verifyManyToManyRelationship(directusClient, {
        collectionA,
        collectionB,
        fieldA: fieldA!,
        fieldB: fieldB!,
        junctionCollection: junctionCollection!,
        testData
      });
      
    case 'oneToMany':
      return verifyOneToManyRelationship(directusClient, {
        collectionA,
        collectionB,
        fieldA: fieldA!,
        fieldB: fieldB!,
        testData
      });
      
    case 'manyToOne':
      return verifyManyToOneRelationship(directusClient, {
        collectionA,
        collectionB,
        fieldA: fieldA!,
        fieldB: fieldB!,
        testData
      });
      
    case 'oneToOne':
      return verifyOneToOneRelationship(directusClient, {
        collectionA,
        collectionB,
        fieldA: fieldA!,
        fieldB: fieldB!,
        testData
      });
      
    default:
      result.issues.push({
        type: 'error',
        message: `Unknown relationship type: ${relationshipType}`
      });
      return result;
  }
}

/**
 * Verify a Many-to-Many relationship
 * 
 * This function tests a M2M relationship by:
 * 1. Creating a junction item to link test items from both collections
 * 2. Querying collection A and verifying it can see collection B through the M2M field
 * 3. Querying collection B and verifying it can see collection A through the M2M field
 * 4. Cleaning up the test junction item
 * 
 * The verification tests both sides of the relationship to ensure
 * bidirectional access works correctly.
 * 
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for the verification
 * @returns Verification result with detailed diagnostics
 */
async function verifyManyToManyRelationship(
  directusClient: AxiosInstance,
  params: {
    collectionA: string;
    collectionB: string;
    fieldA: string;
    fieldB: string;
    junctionCollection: string;
    testData: RelationshipTestData;
  }
): Promise<VerificationResult> {
  const {
    collectionA,
    collectionB,
    fieldA,
    fieldB,
    junctionCollection,
    testData
  } = params;
  
  const result: VerificationResult = {
    success: true,
    issues: [],
    details: {}
  };
  
  // Step 1: Check that we have test data
  if (!testData.itemA || !testData.itemB) {
    result.issues.push({
      type: 'warning',
      message: 'Missing test items for M2M relationship verification'
    });
    result.success = false;
    return result;
  }
  
  // Now we know both itemA and itemB exist
  const itemA = testData.itemA;
  const itemB = testData.itemB;
  
  try {
    // Step 2: Create a junction item to link the test items
    const junctionData = {
      [`${collectionA}_id`]: itemA.id,
      [`${collectionB}_id`]: itemB.id
    };
    
    let junctionItemId: string | number | undefined;
    
    try {
      logger.info(`Creating test junction item between ${collectionA}/${itemA.id} and ${collectionB}/${itemB.id}`);
      const createResponse = await directusClient.post(`/items/${junctionCollection}`, junctionData);
      const createResult = normalizeResponse(createResponse, `Create test junction item`);
      
      if (!createResult.success || !createResult.id) {
        result.issues.push({
          type: 'error',
          message: `Failed to create junction item: ${createResult.errors.join(', ')}`,
          details: { createResult }
        });
        result.success = false;
      } else {
        junctionItemId = createResult.id;
        result.details.junctionItemId = junctionItemId;
        logger.info(`Created junction item with ID: ${junctionItemId}`);
      }
    } catch (error: any) {
      result.issues.push({
        type: 'error',
        message: `Error creating junction item: ${error.message}`,
        details: { error }
      });
      result.success = false;
    }
    
    // If we successfully created a junction item, try to fetch related items
    if (junctionItemId) {
      // Step 3: Check if we can retrieve item A and see item B in its M2M field
      try {
        const itemAResponse = await directusClient.get(`/items/${collectionA}/${itemA.id}`, {
          params: {
            fields: `*,${fieldA}.*`
          }
        });
        
        const itemAResult = normalizeResponse(itemAResponse, `Get item A with M2M field`);
        
        if (!itemAResult.success) {
          result.issues.push({
            type: 'error',
            message: `Failed to retrieve item A with M2M field: ${itemAResult.errors.join(', ')}`,
            details: { itemAResult }
          });
          result.success = false;
        } else {
          // Check if the M2M field contains item B
          const m2mField = itemAResult.data[fieldA];
          if (!m2mField || !Array.isArray(m2mField) || !m2mField.some((item: any) => item.id === itemB.id)) {
            result.issues.push({
              type: 'error',
              message: `Item A's M2M field does not contain item B`,
              details: { m2mField }
            });
            result.success = false;
          } else {
            logger.info(`Item A's M2M field correctly contains item B`);
            result.details.itemAVerified = true;
          }
        }
      } catch (error: any) {
        result.issues.push({
          type: 'error',
          message: `Error retrieving item A with M2M field: ${error.message}`,
          details: { error }
        });
        result.success = false;
      }
      
      // Step 4: Check if we can retrieve item B and see item A in its M2M field
      try {
        const itemBResponse = await directusClient.get(`/items/${collectionB}/${itemB.id}`, {
          params: {
            fields: `*,${fieldB}.*`
          }
        });
        
        const itemBResult = normalizeResponse(itemBResponse, `Get item B with M2M field`);
        
        if (!itemBResult.success) {
          result.issues.push({
            type: 'error',
            message: `Failed to retrieve item B with M2M field: ${itemBResult.errors.join(', ')}`,
            details: { itemBResult }
          });
          result.success = false;
        } else {
          // Check if the M2M field contains item A
          const m2mField = itemBResult.data[fieldB];
          if (!m2mField || !Array.isArray(m2mField) || !m2mField.some((item: any) => item.id === itemA.id)) {
            result.issues.push({
              type: 'error',
              message: `Item B's M2M field does not contain item A`,
              details: { m2mField }
            });
            result.success = false;
          } else {
            logger.info(`Item B's M2M field correctly contains item A`);
            result.details.itemBVerified = true;
          }
        }
      } catch (error: any) {
        result.issues.push({
          type: 'error',
          message: `Error retrieving item B with M2M field: ${error.message}`,
          details: { error }
        });
        result.success = false;
      }
      
      // Step 5: Clean up the test junction item
      try {
        logger.info(`Cleaning up test junction item ${junctionItemId}`);
        await directusClient.delete(`/items/${junctionCollection}/${junctionItemId}`);
      } catch (cleanupError: any) {
        logger.warn(`Could not clean up test junction item ${junctionItemId}`, { cleanupError });
        result.issues.push({
          type: 'warning',
          message: `Could not clean up test junction item: ${cleanupError.message}`,
          details: { cleanupError }
        });
      }
    }
    
    // Final result
    if (result.success) {
      logger.info(`M2M relationship between ${collectionA} and ${collectionB} verified successfully`);
    } else {
      logger.warn(`M2M relationship verification has issues`, { issues: result.issues });
    }
    
    return result;
  } catch (error: any) {
    logger.error(`Error verifying M2M relationship`, { error });
    return {
      success: false,
      issues: [{
        type: 'error',
        message: `Error verifying M2M relationship: ${error.message}`,
        details: { error }
      }],
      details: {}
    };
  }
}

/**
 * Verify a One-to-Many relationship
 * 
 * This function would test a O2M relationship by:
 * 1. Setting up a foreign key in the "many" side to point to the "one" side
 * 2. Querying the "one" side to verify it can access its related "many" items
 * 3. Querying the "many" side to verify it can access its parent "one" item
 * 
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for the verification
 * @returns Verification result with detailed diagnostics
 */
async function verifyOneToManyRelationship(
  directusClient: AxiosInstance,
  params: {
    collectionA: string;
    collectionB: string;
    fieldA: string;
    fieldB: string;
    testData: RelationshipTestData;
  }
): Promise<VerificationResult> {
  // Placeholder - to be implemented
  // This is a simplified demonstration of the pattern
  return {
    success: false,
    issues: [{
      type: 'warning',
      message: 'One-to-Many relationship verification not yet implemented'
    }],
    details: {}
  };
}

/**
 * Verify a Many-to-One relationship
 * 
 * This function would test a M2O relationship by:
 * 1. Setting up a foreign key in the "many" side to point to the "one" side
 * 2. Querying the "many" side to verify it can access its related "one" item
 * 3. Querying the "one" side to verify it can be accessed from the "many" side
 * 
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for the verification
 * @returns Verification result with detailed diagnostics
 */
async function verifyManyToOneRelationship(
  directusClient: AxiosInstance,
  params: {
    collectionA: string;
    collectionB: string;
    fieldA: string;
    fieldB: string;
    testData: RelationshipTestData;
  }
): Promise<VerificationResult> {
  // Placeholder - to be implemented
  // This is a simplified demonstration of the pattern
  return {
    success: false,
    issues: [{
      type: 'warning',
      message: 'Many-to-One relationship verification not yet implemented'
    }],
    details: {}
  };
}

/**
 * Verify a One-to-One relationship
 * 
 * This function would test a O2O relationship by:
 * 1. Setting up foreign keys in both collections to point to each other
 * 2. Querying from both sides to verify bidirectional access
 * 3. Verifying that the unique constraint is enforced
 * 
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for the verification
 * @returns Verification result with detailed diagnostics
 */
async function verifyOneToOneRelationship(
  directusClient: AxiosInstance,
  params: {
    collectionA: string;
    collectionB: string;
    fieldA: string;
    fieldB: string;
    testData: RelationshipTestData;
  }
): Promise<VerificationResult> {
  // Placeholder - to be implemented
  // This is a simplified demonstration of the pattern
  return {
    success: false,
    issues: [{
      type: 'warning',
      message: 'One-to-One relationship verification not yet implemented'
    }],
    details: {}
  };
} 