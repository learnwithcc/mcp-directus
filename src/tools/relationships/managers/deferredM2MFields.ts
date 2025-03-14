/**
 * Deferred M2M Field Management
 * 
 * This module provides utilities for handling M2M fields during item creation,
 * which often fails when trying to set M2M fields directly during initial item creation.
 * 
 * PROBLEM CONTEXT:
 * When creating items with M2M relationships in Directus, attempting to set the M2M fields
 * during the initial creation often fails because:
 * 1. The item must exist first before M2M relationships can be established
 * 2. Junction items need both sides of the relationship to exist
 * 3. Directus's API often rejects M2M field values during initial item creation
 * 
 * SOLUTION APPROACH:
 * This module implements a two-phase creation process:
 * 1. First phase: Create the base item without any M2M fields
 * 2. Second phase: Update the newly created item to establish M2M relationships
 * 
 * This approach is more reliable and handles the dependency order correctly.
 */

import { AxiosInstance } from 'axios';
import { createLogger } from '../../../utils/logger';
import { normalizeResponse } from '../../../utils/normalizers/responseNormalizer';

const logger = createLogger({ component: 'deferredM2MFields' });

/**
 * Interface for deferred M2M field
 * Represents a M2M relationship to be established in the second phase
 */
export interface DeferredM2MField {
  /**
   * Field name in the item - this is the M2M relationship field
   * configured in the Directus collection
   */
  field: string;
  
  /**
   * IDs to associate with the item through the M2M relationship
   * These are the IDs of items from the related collection
   */
  ids: string[] | number[];
}

/**
 * Interface for parameters for creating an item with M2M relationships
 * Used to structure the two-phase creation process
 */
export interface CreateItemWithM2MParams {
  /**
   * Collection to create the item in
   */
  collection: string;
  
  /**
   * Base item data without M2M fields
   * This is used in the first phase of creation
   */
  item: Record<string, any>;
  
  /**
   * M2M fields to add after item creation
   * These are applied in the second phase of creation
   */
  m2mFields?: DeferredM2MField[];
}

/**
 * Create an item with M2M relationships using a two-step process
 * 
 * This function addresses the issue where creating items with M2M fields directly often fails
 * because the relationship may not be fully established yet. It:
 * 1. Creates the base item without M2M fields
 * 2. Updates the item to add the M2M relationships
 *
 * Usage example:
 * ```typescript
 * const result = await createItemWithM2MRelationships(directusClient, {
 *   collection: 'products',
 *   item: { name: 'New Product', price: 99.99 },
 *   m2mFields: [
 *     { field: 'categories', ids: ['category1-id', 'category2-id'] }
 *   ]
 * });
 * ```
 *
 * @param directusClient The Axios instance for the Directus API
 * @param params Parameters for item creation
 * @returns Result of the operation with the created item
 */
export async function createItemWithM2MRelationships(
  directusClient: AxiosInstance,
  params: CreateItemWithM2MParams
): Promise<{ success: boolean; id?: string | number; data?: any; errors: string[] }> {
  const { collection, item, m2mFields = [] } = params;
  
  // Step 1: Prepare base item by filtering out M2M fields
  const baseFields = { ...item };
  
  // Remove any M2M fields from the base item to avoid creation failures
  for (const m2mField of m2mFields) {
    delete baseFields[m2mField.field];
  }
  
  try {
    // Step 2: Create the base item
    logger.info(`Creating item in ${collection} without M2M fields`);
    const createResponse = await directusClient.post(`/items/${collection}`, baseFields);
    const createResult = normalizeResponse(createResponse, `Create base item in ${collection}`);
    
    if (!createResult.success || !createResult.id) {
      logger.error(`Failed to create item in ${collection}`, { errors: createResult.errors });
      return {
        success: false,
        errors: createResult.errors
      };
    }
    
    const newItemId = createResult.id;
    logger.info(`Created item in ${collection} with ID: ${newItemId}`);
    
    // If no M2M fields, return the result directly
    if (m2mFields.length === 0) {
      return {
        success: true,
        id: newItemId,
        data: createResult.data,
        errors: []
      };
    }
    
    // Step 3: Add M2M relationships
    const m2mUpdates: Record<string, any> = {};
    let hasM2MFields = false;
    
    for (const m2mField of m2mFields) {
      if (m2mField.ids && m2mField.ids.length > 0) {
        m2mUpdates[m2mField.field] = m2mField.ids;
        hasM2MFields = true;
      }
    }
    
    // If there are M2M fields to update
    if (hasM2MFields) {
      logger.info(`Updating item ${newItemId} with M2M fields: ${Object.keys(m2mUpdates).join(', ')}`);
      
      try {
        const updateResponse = await directusClient.patch(`/items/${collection}/${newItemId}`, m2mUpdates);
        const updateResult = normalizeResponse(updateResponse, `Update item with M2M fields`);
        
        if (!updateResult.success) {
          logger.warn(`Item created but M2M fields could not be added`, { 
            itemId: newItemId, 
            errors: updateResult.errors 
          });
          
          return {
            success: true, // We consider this a partial success
            id: newItemId,
            data: createResult.data,
            errors: [`M2M fields could not be added: ${updateResult.errors.join(', ')}`]
          };
        }
        
        logger.info(`Successfully added M2M fields to item ${newItemId}`);
        return {
          success: true,
          id: newItemId,
          data: updateResult.data,
          errors: []
        };
      } catch (error: any) {
        logger.warn(`Item created but M2M fields could not be added`, { 
          itemId: newItemId, 
          error: error.message 
        });
        
        return {
          success: true, // We consider this a partial success
          id: newItemId,
          data: createResult.data,
          errors: [`M2M fields could not be added: ${error.message}`]
        };
      }
    }
    
    // Return the result if no actual M2M fields to update
    return {
      success: true,
      id: newItemId,
      data: createResult.data,
      errors: []
    };
  } catch (error: any) {
    logger.error(`Error creating item with M2M relationships`, { error });
    return {
      success: false,
      errors: [error.message || 'Unknown error occurred']
    };
  }
}

/**
 * Helper function to extract M2M fields from an item
 * 
 * This helps separate M2M fields from regular fields in an item object.
 * Useful when you have a mixed object and need to apply the two-phase
 * creation process.
 * 
 * Usage example:
 * ```typescript
 * const item = {
 *   name: 'Product',
 *   categories: ['cat1', 'cat2'],
 *   tags: ['tag1', 'tag2']
 * };
 * 
 * const m2mFields = extractM2MFields(item, ['categories', 'tags']);
 * // This will extract the categories and tags fields for deferred processing
 * ```
 * 
 * @param item The item data with mixed regular and M2M fields
 * @param m2mFieldNames Names of fields that are M2M relationships
 * @returns Array of deferred M2M fields ready for the two-phase process
 */
export function extractM2MFields(
  item: Record<string, any>,
  m2mFieldNames: string[]
): DeferredM2MField[] {
  const m2mFields: DeferredM2MField[] = [];
  
  for (const fieldName of m2mFieldNames) {
    if (fieldName in item && Array.isArray(item[fieldName])) {
      m2mFields.push({
        field: fieldName,
        ids: item[fieldName]
      });
    }
  }
  
  return m2mFields;
}

/**
 * Add M2M relationships to an existing item
 * 
 * This function handles just the second phase of the two-phase process,
 * useful when you already have an item and need to establish M2M relationships.
 * 
 * Usage example:
 * ```typescript
 * await addM2MRelationshipsToItem(
 *   directusClient,
 *   'products',
 *   'product-id-123',
 *   [{ field: 'categories', ids: ['cat1', 'cat2'] }]
 * );
 * ```
 * 
 * @param directusClient The Axios instance for the Directus API
 * @param collection Collection name
 * @param itemId ID of the item to update
 * @param m2mFields M2M fields to add
 * @returns Result of the operation
 */
export async function addM2MRelationshipsToItem(
  directusClient: AxiosInstance,
  collection: string,
  itemId: string | number,
  m2mFields: DeferredM2MField[]
): Promise<{ success: boolean; data?: any; errors: string[] }> {
  if (m2mFields.length === 0) {
    return { success: true, errors: [] };
  }
  
  const updates: Record<string, any> = {};
  
  for (const m2mField of m2mFields) {
    if (m2mField.ids && m2mField.ids.length > 0) {
      updates[m2mField.field] = m2mField.ids;
    }
  }
  
  if (Object.keys(updates).length === 0) {
    return { success: true, errors: [] };
  }
  
  try {
    logger.info(`Adding M2M relationships to ${collection}/${itemId}: ${Object.keys(updates).join(', ')}`);
    const response = await directusClient.patch(`/items/${collection}/${itemId}`, updates);
    const result = normalizeResponse(response, `Add M2M relationships to item`);
    
    if (!result.success) {
      return {
        success: false,
        errors: result.errors
      };
    }
    
    return {
      success: true,
      data: result.data,
      errors: []
    };
  } catch (error: any) {
    logger.error(`Error adding M2M relationships to item`, { error, collection, itemId });
    return {
      success: false,
      errors: [error.message || 'Unknown error occurred']
    };
  }
} 