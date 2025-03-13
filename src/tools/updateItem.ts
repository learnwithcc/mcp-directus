import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'updateItem' });

export function updateItem(directusClient: AxiosInstance) {
  /**
   * Update an existing item in a collection
   * @param collection The collection name
   * @param id The unique identifier of the item
   * @param item The updated item data
   * @returns The updated item
   */
  const fn = async ({ collection, id, item }: { collection: string; id: string; item: Record<string, any> }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'updateItem', 
      collection,
      item_id: id
    });

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for updating item in "${collection}"`);
      validateParams({ collection, id, item }, {
        collection: { required: true, type: 'string', customValidator: validateCollectionName },
        id: { required: true, type: 'string', allowEmpty: false },
        item: { required: true, type: 'object' }
      });

      opLogger.info(`Updating item with ID "${id}" in collection "${collection}"`);
      
      // Handle special system collections
      let response;
      if (collection === 'directus_users') {
        opLogger.info('Using special endpoint for users collection');
        response = await directusClient.patch(`/users/${id}`, item);
      } else if (collection === 'directus_files') {
        opLogger.info('Using special endpoint for files collection');
        response = await directusClient.patch(`/files/${id}`, item);
      } else if (collection === 'directus_roles') {
        opLogger.info('Using special endpoint for roles collection');
        response = await directusClient.patch(`/roles/${id}`, item);
      } else {
        // Standard collection
        response = await directusClient.patch(`/items/${collection}/${id}`, item);
      }
      
      opLogger.info(`Successfully updated item with ID "${id}" in "${collection}"`);
      
      return {
        status: 'success',
        message: `Updated item with ID "${id}" in collection "${collection}"`,
        details: {
          collection,
          id,
          item: response.data.data
        }
      };
    } catch (error: any) {
      opLogger.error(`Error updating item with ID "${id}" in collection "${collection}"`, error);
      
      let errorMessage = error.message;
      let statusCode;
      let errorDetails;
      
      if (error.response) {
        statusCode = error.response.status;
        errorDetails = error.response.data;
        
        // Provide more helpful error messages based on common status codes
        if (statusCode === 403) {
          errorMessage = `Permission denied. Ensure your token has appropriate update permissions for "${collection}".`;
        } else if (statusCode === 404) {
          errorMessage = `Item with ID "${id}" not found in collection "${collection}".`;
        } else if (statusCode === 400) {
          errorMessage = `Invalid data provided for updating item "${id}" in collection "${collection}".`;
        } else if (error.response.data && error.response.data.errors) {
          // Extract error message from Directus error response
          errorMessage = error.response.data.errors.map((err: any) => err.message).join('; ');
        }
      }
      
      return {
        status: 'error',
        message: errorMessage,
        details: {
          collection,
          id,
          statusCode,
          errorDetails
        }
      };
    }
  };
  
  fn.description = 'Update an existing item in a Directus collection';
  fn.parameters = {
    type: 'object',
    required: ['collection', 'id', 'item'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection'
      },
      id: {
        type: 'string',
        description: 'The unique identifier of the item'
      },
      item: {
        type: 'object',
        description: 'The updated item data'
      }
    }
  };
  
  return fn;
} 