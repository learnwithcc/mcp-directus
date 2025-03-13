/**
 * Field Deletion in Directus 11.5.1
 * 
 * This tool provides a standard way to delete existing fields from Directus collections.
 * It includes proper error handling and validation to ensure the operation completes
 * successfully or provides meaningful error messages.
 */

import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'deleteField' });

export function deleteField(directusClient: AxiosInstance) {
  /**
   * Delete a field from a collection
   * @param collection The collection containing the field
   * @param field The name/key of the field to delete
   * @returns Status information about the deletion
   */
  const fn = async ({ 
    collection,
    field
  }: { 
    collection: string;
    field: string;
  }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'deleteField', 
      collection,
      field
    });

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for field deletion`);
      validateParams({ collection, field }, {
        collection: { required: true, type: 'string', customValidator: validateCollectionName },
        field: { required: true, type: 'string' }
      });

      // Validate we're not modifying system collections
      if (collection.startsWith('directus_')) {
        throw new Error('Cannot delete fields from system collections. Only user collections are allowed.');
      }

      opLogger.info(`Attempting to delete field "${field}" from collection "${collection}"`);

      // Delete the field using the fields endpoint
      const response = await directusClient.delete(`/fields/${collection}/${field}`);
      
      opLogger.info(`Field "${field}" deleted successfully from collection "${collection}"`);
      
      return {
        status: 'success',
        message: `Field "${field}" deleted successfully from collection "${collection}"`,
        details: {
          collection,
          field
        }
      };
    } catch (error: any) {
      opLogger.error(`Error deleting field "${field}" from collection "${collection}"`, error);
      
      let statusCode, errorMessage, errorDetails;
      
      if (error.response) {
        statusCode = error.response.status;
        errorDetails = error.response.data;
        
        // Provide more helpful error messages based on common status codes
        if (statusCode === 403) {
          errorMessage = `Permission denied. Ensure your token has admin privileges to modify schema.`;
        } else if (statusCode === 404) {
          errorMessage = `Field "${field}" or collection "${collection}" not found.`;
        } else if (error.response.data && error.response.data.errors) {
          // Extract error message from Directus error response
          errorMessage = error.response.data.errors.map((err: any) => err.message).join('; ');
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = error.message;
      }
      
      return {
        status: 'error',
        message: errorMessage,
        details: {
          collection,
          field,
          statusCode,
          errorDetails
        }
      };
    }
  };

  fn.description = 'Delete a field from a Directus collection';
  fn.parameters = {
    type: 'object',
    required: ['collection', 'field'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection containing the field'
      },
      field: {
        type: 'string',
        description: 'The name/key of the field to delete'
      }
    }
  };
  
  return fn;
} 