# Standardized Code Examples

This document provides code examples that demonstrate the standardized patterns implemented across the MCP server tools.

## Basic Tool Structure

All tools now follow this standardized structure:

```typescript
import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'toolName' });

export function toolName(directusClient: AxiosInstance) {
  /**
   * Tool description
   * @param param1 Parameter description
   * @param param2 Parameter description
   * @returns Return value description
   */
  const fn = async ({ param1, param2 }: { param1: Type1; param2: Type2 }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'toolName',
      // Context-specific properties
      param1, 
      param2
    });

    try {
      // Validate input parameters
      opLogger.info('Validating parameters');
      validateParams({ param1, param2 }, {
        param1: { required: true, type: 'string' },
        param2: { required: true, type: 'string' }
      });

      // Core functionality with comprehensive logging
      opLogger.info('Performing operation');
      
      // Directus API call
      const response = await directusClient.get(`/endpoint/${param1}`);
      
      opLogger.info('Operation completed successfully');
      
      // Return standardized success response
      return {
        status: 'success',
        message: 'Human-readable success message',
        details: {
          param1,
          param2,
          result: response.data.data
        }
      };
    } catch (error: any) {
      // Log detailed error information
      opLogger.error('Error performing operation', error);
      
      // Extract and format error details
      let errorMessage = error.message;
      let statusCode;
      let errorDetails;
      
      if (error.response) {
        statusCode = error.response.status;
        errorDetails = error.response.data;
        
        // Provide context-specific error messages
        if (statusCode === 403) {
          errorMessage = 'Permission denied error message';
        } else if (statusCode === 404) {
          errorMessage = 'Not found error message';
        }
      }
      
      // Return standardized error response
      return {
        status: 'error',
        message: errorMessage,
        details: {
          param1,
          param2,
          statusCode,
          errorDetails
        }
      };
    }
  };
  
  // Tool metadata for the MCP system
  fn.description = 'Tool description';
  fn.parameters = {
    type: 'object',
    required: ['param1', 'param2'],
    properties: {
      param1: {
        type: 'string',
        description: 'Parameter description'
      },
      param2: {
        type: 'string',
        description: 'Parameter description'
      }
    }
  };
  
  return fn;
}
```

## Rollback Mechanism Example

The following example demonstrates the transaction-like rollback mechanism implemented for complex operations:

```typescript
export function createComplexRelation(directusClient: AxiosInstance) {
  const fn = async ({ param1, param2 }: { param1: string; param2: string }) => {
    const opLogger = createLogger({ 
      component: 'createComplexRelation',
      param1,
      param2
    });
    
    // Track created resources for potential rollback
    const createdResources: Array<{
      type: 'collection' | 'field' | 'relation',
      collection?: string,
      field?: string,
      path: string
    }> = [];

    try {
      // Validate input parameters
      opLogger.info('Validating parameters');
      validateParams({ param1, param2 }, {
        param1: { required: true, type: 'string' },
        param2: { required: true, type: 'string' }
      });

      // Step 1: Create a collection
      opLogger.info('Creating collection');
      const collectionResponse = await directusClient.post('/collections', {
        collection: param1,
        meta: { /* metadata */ },
        schema: { /* schema */ }
      });
      
      // Track the created collection
      createdResources.push({
        type: 'collection',
        collection: param1,
        path: `/collections/${param1}`
      });
      
      // Step 2: Create a field
      opLogger.info('Creating field');
      const fieldResponse = await directusClient.post(`/fields/${param1}`, {
        field: param2,
        type: 'string',
        meta: { /* metadata */ },
        schema: { /* schema */ }
      });
      
      // Track the created field
      createdResources.push({
        type: 'field',
        collection: param1,
        field: param2,
        path: `/fields/${param1}/${param2}`
      });

      // Operation completed successfully
      opLogger.info('Complex relation created successfully');
      
      return {
        status: 'success',
        message: `Created complex relation successfully`,
        details: {
          param1,
          param2,
          collection: collectionResponse.data.data,
          field: fieldResponse.data.data
        }
      };
    } catch (error: any) {
      // Log the error
      opLogger.error('Error creating complex relation', error);
      
      // Perform rollback of created resources in reverse order
      opLogger.warn(`Rolling back ${createdResources.length} created resources`);
      
      for (const resource of [...createdResources].reverse()) {
        try {
          opLogger.info(`Rolling back ${resource.type}: ${resource.path}`);
          await directusClient.delete(resource.path);
          opLogger.info(`Successfully rolled back ${resource.type}`);
        } catch (rollbackError) {
          opLogger.error(`Failed to roll back ${resource.type}`, rollbackError);
        }
      }
      
      // Format and return error response
      let errorMessage = error.message;
      let statusCode;
      let errorDetails;
      
      if (error.response) {
        statusCode = error.response.status;
        errorDetails = error.response.data;
        
        // Provide context-specific error messages
        if (statusCode === 403) {
          errorMessage = 'Permission denied error message';
        }
      }
      
      return {
        status: 'error',
        message: errorMessage,
        details: {
          param1,
          param2,
          statusCode,
          errorDetails,
          rollback: {
            attempted: createdResources.length,
            successful: true // In a real implementation, track success/failure
          }
        }
      };
    }
  };
  
  fn.description = 'Create a complex relation with rollback capabilities';
  fn.parameters = {
    type: 'object',
    required: ['param1', 'param2'],
    properties: {
      param1: {
        type: 'string',
        description: 'Parameter description'
      },
      param2: {
        type: 'string',
        description: 'Parameter description'
      }
    }
  };
  
  return fn;
}
```

## Special Collection Handling Example

This example shows how tools properly handle Directus system collections:

```typescript
// Handle special system collections
let response;
if (collection === 'directus_users') {
  opLogger.info('Using special endpoint for users collection');
  response = await directusClient.get(`/users/${id}`);
} else if (collection === 'directus_files') {
  opLogger.info('Using special endpoint for files collection');
  response = await directusClient.get(`/files/${id}`);
} else if (collection === 'directus_roles') {
  opLogger.info('Using special endpoint for roles collection');
  response = await directusClient.get(`/roles/${id}`);
} else {
  // Standard collection
  response = await directusClient.get(`/items/${collection}/${id}`);
}
```

## Error Handling Example

This example demonstrates the improved error handling with specific guidance:

```typescript
if (error.response) {
  statusCode = error.response.status;
  errorDetails = error.response.data;
  
  // Provide more helpful error messages based on common status codes
  if (statusCode === 403) {
    errorMessage = `Permission denied. Ensure your token has appropriate read permissions for "${collection}".`;
  } else if (statusCode === 404) {
    errorMessage = `Item with ID "${id}" not found in collection "${collection}".`;
  } else if (statusCode === 400) {
    errorMessage = `Invalid data provided for collection "${collection}".`;
  } else if (error.response.data && error.response.data.errors) {
    // Extract error message from Directus error response
    errorMessage = error.response.data.errors.map((err: any) => err.message).join('; ');
  }
}
```

## Validation Example

This example shows the standardized parameter validation:

```typescript
validateParams({ collection, id, item }, {
  collection: { required: true, type: 'string', customValidator: validateCollectionName },
  id: { required: true, type: 'string', allowEmpty: false },
  item: { required: true, type: 'object' }
});
``` 