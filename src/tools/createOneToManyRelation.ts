/**
 * CREATING ONE-TO-MANY RELATIONSHIPS IN DIRECTUS 11.5.1
 * 
 * This tool provides a dedicated function for creating one-to-many (O2M)
 * relationships between two collections in Directus.
 * 
 * In a one-to-many relationship:
 * - One record from the "one" collection can be associated with multiple records from the "many" collection
 * - Each record from the "many" collection can only be associated with one record from the "one" collection
 * 
 * The implementation creates a M2O field in the "many" collection that references the "one" collection,
 * and optionally creates a corresponding O2M field in the "one" collection.
 */

import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'createOneToManyRelation' });

export function createOneToManyRelation(directusClient: AxiosInstance) {
  /**
   * Create a one-to-many relationship between two collections
   * @param one_collection The "one" side of the relationship (parent)
   * @param many_collection The "many" side of the relationship (child)
   * @param foreign_key_field The name of the foreign key field in the many_collection
   * @param one_field_name The name of the virtual field in the one_collection (optional)
   * @returns Information about the created O2M relationship
   */
  const fn = async ({ 
    one_collection,
    many_collection,
    foreign_key_field,
    one_field_name
  }: { 
    one_collection: string;
    many_collection: string;
    foreign_key_field: string;
    one_field_name?: string;
  }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'createOneToManyRelation', 
      one_collection,
      many_collection,
      foreign_key_field
    });

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for O2M relationship creation`);
      validateParams({ one_collection, many_collection, foreign_key_field }, {
        one_collection: { required: true, type: 'string', customValidator: validateCollectionName },
        many_collection: { required: true, type: 'string', customValidator: validateCollectionName },
        foreign_key_field: { required: true, type: 'string' }
      });

      // Validate we're not modifying system collections
      if (one_collection.startsWith('directus_') || many_collection.startsWith('directus_')) {
        throw new Error('Cannot create relations for system collections. Only user collections are allowed.');
      }

      opLogger.info(`Creating O2M relationship between ${one_collection} (parent) and ${many_collection} (child)`);

      // Step 1: Create the foreign key field in the many collection (M2O relationship)
      opLogger.info(`Creating foreign key field "${foreign_key_field}" in ${many_collection}`);
      
      // Creating the M2O field in the "many" collection
      try {
        await directusClient.post(`/fields/${many_collection}`, {
          field: foreign_key_field,
          type: 'uuid',
          meta: {
            special: ["m2o"],
            interface: "select-dropdown-m2o",
            options: {
              template: "{{id}}"
            },
            display: "related-values",
            display_options: {
              template: "{{id}}"
            }
          },
          schema: {
            is_nullable: true
          }
        });
        
        opLogger.info(`Foreign key field "${foreign_key_field}" created successfully`);
      } catch (error: any) {
        opLogger.error(`Error creating foreign key field in many collection`, error);
        throw new Error(`Failed to create foreign key field: ${error.message}`);
      }

      // Step 2: Create the relation between the collections
      opLogger.info(`Creating relation between collections`);
      
      try {
        await directusClient.post('/relations', {
          collection: many_collection,
          field: foreign_key_field,
          related_collection: one_collection
        });
        
        opLogger.info(`Relation created successfully`);
      } catch (error: any) {
        opLogger.error(`Error creating relation`, error);
        throw new Error(`Failed to create relation: ${error.message}`);
      }

      // Step 3: Create the virtual O2M field in the "one" collection if requested
      if (one_field_name) {
        opLogger.info(`Creating virtual O2M field "${one_field_name}" in ${one_collection}`);
        
        try {
          await directusClient.post(`/fields/${one_collection}`, {
            field: one_field_name,
            type: 'alias',
            meta: {
              special: ["o2m"],
              interface: "list-o2m",
              options: {
                template: "{{id}}",
                enableCreate: true,
                enableSelect: true
              },
              display: "related-values",
              display_options: {
                template: "{{id}}"
              }
            },
            schema: null
          });
          
          opLogger.info(`Virtual O2M field "${one_field_name}" created successfully`);
        } catch (error: any) {
          opLogger.error(`Error creating virtual O2M field in one collection`, error);
          // This is not a critical error, as the M2O relation is already established
          opLogger.warn(`Continuing despite error in creating virtual field`);
        }
      }

      return {
        status: 'success',
        message: `Created one-to-many relationship between ${one_collection} and ${many_collection}`,
        details: {
          one_collection,
          many_collection,
          foreign_key_field,
          one_field_name,
          relation_type: 'o2m'
        }
      };
    } catch (error: any) {
      opLogger.error(`Error creating O2M relationship`, error);
      return {
        status: 'error',
        message: error.message,
        details: {
          one_collection,
          many_collection,
          foreign_key_field,
          one_field_name
        }
      };
    }
  };

  fn.description = 'Create a one-to-many relationship between two Directus collections';
  fn.parameters = {
    type: 'object',
    required: ['one_collection', 'many_collection', 'foreign_key_field'],
    properties: {
      one_collection: {
        type: 'string',
        description: 'The "one" side of the relationship (parent)'
      },
      many_collection: {
        type: 'string',
        description: 'The "many" side of the relationship (child)'
      },
      foreign_key_field: {
        type: 'string',
        description: 'The name of the foreign key field in the many_collection'
      },
      one_field_name: {
        type: 'string',
        description: 'Optional name for the virtual field in the one_collection'
      }
    }
  };
  
  return fn;
} 