/**
 * COLLECTION VALIDATION IN DIRECTUS
 * 
 * This tool helps detect whether a collection in Directus is:
 * 1. A true database table (that can accept field definitions)
 * 2. A "pseudo-collection" or folder (organizational structure that cannot accept fields)
 * 
 * The distinction is important because attempting to create fields in a folder
 * will result in permission errors even when using an admin token with appropriate
 * permissions. This can be confusing as the error messages suggest permission issues
 * rather than an invalid collection type.
 * 
 * IMPLEMENTATION DETAILS:
 * 
 * This tool uses multiple detection methods in sequence:
 * 1. Schema Check: True collections have schema information
 * 2. Items Retrieval Test: True collections support item operations
 * 3. Metadata Analysis: Examining collection metadata for folder characteristics
 * 4. Field Creation Test (optional): Creating and deleting a test field
 * 
 * The tool is designed to be non-destructive by default, using read-only operations
 * unless the invasive_test option is explicitly enabled.
 */

import { AxiosInstance, AxiosError } from 'axios';

// Define interfaces for Directus API response types
interface DirectusError {
  message: string;
  extensions?: {
    code?: string;
  };
}

interface DirectusErrorResponse {
  errors?: DirectusError[];
}

export function validateCollection(directusClient: AxiosInstance) {
  /**
   * Validate if a collection is a true database collection or a pseudo-collection/folder
   * @param collection The name of the collection to validate
   * @param invasive_test Whether to use potentially destructive tests like creating a test field
   * @returns Validation results including collection type and validity status
   */
  const fn = async ({ 
    collection,
    invasive_test = false
  }: { 
    collection: string;
    invasive_test?: boolean;
  }) => {
    try {
      console.log(`Validating collection "${collection}"...`);
      const results: Record<string, any> = {
        collection,
        tests: {},
        is_valid_collection: false,
        collection_type: 'unknown',
        confidence: 'low',
        message: ''
      };
      
      let validationScore = 0;
      const MAX_SCORE = invasive_test ? 4 : 3;
      
      // Method 1: Check if we can retrieve the collection's schema
      console.log(`Method 1: Checking schema for "${collection}"...`);
      try {
        const schemaResponse = await directusClient.get(`/collections/${collection}/schema`);
        
        // If we have a schema with fields, it's likely a true collection
        if (schemaResponse.data.data && Object.keys(schemaResponse.data.data).length > 0) {
          results.tests.schema_check = {
            status: 'passed',
            details: 'Schema information is available'
          };
          validationScore += 1;
        } else {
          results.tests.schema_check = {
            status: 'inconclusive',
            details: 'Schema info exists but is empty'
          };
        }
      } catch (schemaError) {
        const error = schemaError as AxiosError<DirectusErrorResponse>;
        results.tests.schema_check = {
          status: 'failed',
          details: `Failed to retrieve schema: ${error.response?.data?.errors?.[0]?.message || error.message}`
        };
      }
      
      // Method 2: Test if we can retrieve items from the collection
      console.log(`Method 2: Testing item retrieval for "${collection}"...`);
      try {
        await directusClient.get(`/items/${collection}?limit=1`);
        // If we can retrieve items, it's likely a true collection
        results.tests.items_retrieval = {
          status: 'passed',
          details: 'Items retrieval is supported'
        };
        validationScore += 1;
      } catch (itemsError: any) {
        const error = itemsError as AxiosError<DirectusErrorResponse>;
        
        // A 403 forbidden doesn't necessarily mean it's not a collection
        // It could be a permissions issue for a real collection
        if (error.response && error.response.status === 403) {
          results.tests.items_retrieval = {
            status: 'inconclusive',
            details: 'Permission denied for item retrieval'
          };
        } else if (error.response && error.response.status === 404) {
          // A 404 on items endpoint likely means it's not a true collection
          results.tests.items_retrieval = {
            status: 'failed',
            details: 'Items endpoint not found'
          };
        } else {
          results.tests.items_retrieval = {
            status: 'failed',
            details: `Failed to retrieve items: ${error.response?.data?.errors?.[0]?.message || error.message}`
          };
        }
      }
      
      // Method 3: Check collection metadata
      console.log(`Method 3: Analyzing metadata for "${collection}"...`);
      try {
        const metaResponse = await directusClient.get(`/collections/${collection}`);
        const metaData = metaResponse.data.data;
        
        results.metadata = metaData;
        
        // In Directus, collection folders often have certain metadata properties
        if (metaData) {
          // Check if this has the characteristics of a folder
          if (metaData.meta && metaData.meta.group !== null && !metaData.schema) {
            results.tests.metadata_analysis = {
              status: 'failed',
              details: 'Metadata suggests this is a collection folder, not a table'
            };
          } else if (metaData.schema) {
            // True collections should have schema information
            results.tests.metadata_analysis = {
              status: 'passed',
              details: 'Metadata includes schema information'
            };
            validationScore += 1;
          } else {
            results.tests.metadata_analysis = {
              status: 'inconclusive',
              details: 'Metadata exists but is inconclusive'
            };
          }
        } else {
          results.tests.metadata_analysis = {
            status: 'inconclusive',
            details: 'No metadata available'
          };
        }
      } catch (metaError) {
        const error = metaError as AxiosError<DirectusErrorResponse>;
        results.tests.metadata_analysis = {
          status: 'failed',
          details: `Failed to retrieve metadata: ${error.response?.data?.errors?.[0]?.message || error.message}`
        };
      }
      
      // Method 4: Try to add a test field and then immediately delete it (if invasive_test is enabled)
      if (invasive_test) {
        console.log(`Method 4: Field creation test for "${collection}"...`);
        const testFieldName = `_test_field_${Date.now()}`;
        try {
          // Attempt to create a simple test field
          await directusClient.post(`/fields/${collection}`, {
            field: testFieldName,
            type: 'string',
            meta: {
              hidden: true
            },
            schema: {
              name: testFieldName,
              table: collection,
              data_type: 'varchar',
              is_nullable: true
            }
          });
          
          // If field creation succeeded, it's definitely a true collection
          results.tests.field_creation = {
            status: 'passed',
            details: 'Test field creation succeeded'
          };
          validationScore += 1;
          
          // Clean up by deleting the test field
          try {
            await directusClient.delete(`/fields/${collection}/${testFieldName}`);
            console.log(`Deleted test field ${testFieldName}`);
          } catch (deleteError) {
            console.warn(`Created test field but failed to delete it: ${testFieldName}`);
          }
        } catch (fieldError: any) {
          const error = fieldError as AxiosError<DirectusErrorResponse>;
          
          // Permission errors (403) don't definitively tell us if it's a pseudo-collection
          if (error.response && error.response.status === 403) {
            results.tests.field_creation = {
              status: 'inconclusive',
              details: 'Permission denied for field creation'
            };
          }
          // A 400 error often means it's not a valid collection for field creation
          else if (error.response && error.response.status === 400) {
            const errorMsg = error.response.data?.errors?.[0]?.message || '';
            
            // Some 400 errors give us clear information
            if (errorMsg.includes('Invalid collection') || 
                errorMsg.includes('not a valid collection') ||
                errorMsg.includes('collection not found')) {
              results.tests.field_creation = {
                status: 'failed',
                details: `Field creation failed with clear indication: ${errorMsg}`
              };
            } else {
              results.tests.field_creation = {
                status: 'failed',
                details: `Field creation failed: ${errorMsg}`
              };
            }
          } else {
            results.tests.field_creation = {
              status: 'failed',
              details: `Field creation failed: ${error.response?.data?.errors?.[0]?.message || error.message}`
            };
          }
        }
      }
      
      // Determine the final validation result
      const validationRatio = validationScore / MAX_SCORE;
      
      if (validationRatio >= 0.75) {
        results.is_valid_collection = true;
        results.collection_type = 'table';
        results.confidence = 'high';
        results.message = `"${collection}" is a valid database table`;
      } else if (validationRatio >= 0.5) {
        results.is_valid_collection = true;
        results.collection_type = 'table';
        results.confidence = 'medium';
        results.message = `"${collection}" is likely a valid database table`;
      } else if (validationRatio > 0) {
        results.is_valid_collection = false;
        results.collection_type = 'uncertain';
        results.confidence = 'low';
        results.message = `"${collection}" has some characteristics of a database table but validation is inconclusive`;
      } else {
        results.is_valid_collection = false;
        results.collection_type = 'folder';
        results.confidence = 'medium';
        results.message = `"${collection}" appears to be a folder or pseudo-collection, not a database table`;
      }
      
      results.validation_score = validationScore;
      results.validation_max = MAX_SCORE;
      results.validation_ratio = validationRatio;
      
      console.log(`Validation complete for "${collection}": ${results.message} (confidence: ${results.confidence})`);
      
      return {
        result: results
      };
    } catch (error: any) {
      console.error(`Error validating collection:`, error.message);
      
      return {
        error: `Error validating collection: ${error.message}`,
        details: error
      };
    }
  };
  
  fn.description = 'Validate if a collection is a true database collection or a pseudo-collection/folder';
  fn.parameters = {
    type: 'object',
    required: ['collection'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection to validate'
      },
      invasive_test: {
        type: 'boolean',
        description: 'Whether to use potentially destructive tests like creating a test field',
        default: false
      }
    }
  };
  
  return fn;
} 