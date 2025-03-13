/**
 * Relationship Verification
 * 
 * This module provides utilities for verifying relationships after they have been created,
 * ensuring they work properly with test data.
 */

import { AxiosInstance } from 'axios';
import { createLogger } from '../../../utils/logger';
import { normalizeResponse } from '../../../utils/normalizers/responseNormalizer';
import { RelationshipType } from '../results/relationshipErrors';

const logger = createLogger({ component: 'relationshipVerification' });

/**
 * Interface for relationship verification issues
 */
export interface VerificationIssue {
  type: 'error' | 'warning';
  message: string;
  details?: any;
}

/**
 * Interface for relationship verification result
 */
export interface VerificationResult {
  success: boolean;
  issues: VerificationIssue[];
  details: any;
}

/**
 * Interface for test data used in verification
 */
export interface RelationshipTestData {
  itemA?: { id: string | number; [key: string]: any };
  itemB?: { id: string | number; [key: string]: any };
  junctionItems?: Array<{ [key: string]: any }>;
}

/**
 * Verify a relationship by testing it with data
 * 
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for the verification
 * @returns Verification result
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
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for the verification
 * @returns Verification result
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
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for the verification
 * @returns Verification result
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
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for the verification
 * @returns Verification result
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
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for the verification
 * @returns Verification result
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