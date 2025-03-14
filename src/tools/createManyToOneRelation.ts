/**
 * CREATING MANY-TO-ONE RELATIONSHIPS IN DIRECTUS 11.5.1
 * 
 * This tool provides a dedicated function for creating many-to-one (M2O)
 * relationships between two collections in Directus.
 * 
 * In a many-to-one relationship:
 * - Multiple records from the "many" collection can be associated with one record from the "one" collection
 * - Each record from the "many" collection can only be associated with one record from the "one" collection
 * 
 * The implementation creates a foreign key field in the "many" collection that references the "one" collection.
 */

import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'createManyToOneRelation' });

export function createManyToOneRelation(directusClient: AxiosInstance) {
  /**
   * Create a many-to-one relationship between two collections
   * @param many_collection The "many" side of the relationship (child)
   * @param one_collection The "one" side of the relationship (parent)
   * @param foreign_key_field The name of the foreign key field in the many_collection
   * @returns Information about the created M2O relationship
   */
  const fn = async ({ 
    many_collection,
    one_collection,
    foreign_key_field
  }: { 
    many_collection: string;
    one_collection: string;
    foreign_key_field: string;
  }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'createManyToOneRelation', 
      many_collection,
      one_collection,
      foreign_key_field
    });

    // Track resources created for potential rollback
    const createdResources = {
      foreign_key_field: false,
      relation: false
    };

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for M2O relationship creation`);
      validateParams({ many_collection, one_collection, foreign_key_field }, {
        many_collection: { required: true, type: 'string', customValidator: validateCollectionName },
        one_collection: { required: true, type: 'string', customValidator: validateCollectionName },
        foreign_key_field: { required: true, type: 'string' }
      });

      // Validate we're not modifying system collections
      if (many_collection.startsWith('directus_') || one_collection.startsWith('directus_')) {
        throw new Error('Cannot create relations for system collections. Only user collections are allowed.');
      }

      opLogger.info(`Creating M2O relationship between ${many_collection} (child) and ${one_collection} (parent)`);

      // Step 1: Create the foreign key field in the many collection
      opLogger.info(`Creating foreign key field "${foreign_key_field}" in ${many_collection}`);
      
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
        
        createdResources.foreign_key_field = true;
        opLogger.info(`Foreign key field "${foreign_key_field}" created successfully`);
      } catch (error: any) {
        await rollbackResources(createdResources, many_collection, foreign_key_field);
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
        
        createdResources.relation = true;
        opLogger.info(`Relation created successfully`);
      } catch (error: any) {
        await rollbackResources(createdResources, many_collection, foreign_key_field);
        opLogger.error(`Error creating relation between collections`, error);
        throw new Error(`Failed to create relation: ${error.message}`);
      }

      opLogger.info(`Successfully created M2O relationship between ${many_collection} and ${one_collection}`);

      return {
        status: 'success',
        message: `Created many-to-one relationship between ${many_collection} and ${one_collection}`,
        details: {
          many_collection,
          one_collection,
          foreign_key_field
        }
      };
    } catch (error: any) {
      opLogger.error(`Error creating M2O relationship`, error);
      return {
        status: 'error',
        message: error.message,
        details: {
          many_collection,
          one_collection,
          foreign_key_field
        }
      };
    }
  };

  /**
   * Roll back created resources in case of failure
   * @param resources Object tracking which resources were created
   * @param many_collection Name of the "many" collection
   * @param foreign_key_field Name of the foreign key field
   */
  async function rollbackResources(
    resources: {
      foreign_key_field: boolean;
      relation: boolean;
    },
    many_collection: string,
    foreign_key_field: string
  ) {
    const rollbackLogger = createLogger({ component: 'createManyToOneRelation:rollback' });
    
    rollbackLogger.info('Starting rollback of created resources');
    
    try {
      // Delete the foreign key field in the "many" collection
      // This will also implicitly delete the relation
      if (resources.foreign_key_field) {
        try {
          await directusClient.delete(`/fields/${many_collection}/${foreign_key_field}`);
          rollbackLogger.info(`Deleted foreign key field "${foreign_key_field}" in many_collection`);
        } catch (error) {
          rollbackLogger.error(`Failed to delete foreign key field in many_collection during rollback`);
        }
      }
      
      rollbackLogger.info('Rollback completed');
    } catch (error: any) {
      rollbackLogger.error(`Error during rollback: ${error.message}`);
    }
  }

  fn.description = 'Create a many-to-one relationship between two Directus collections';
  fn.parameters = {
    type: 'object',
    required: ['many_collection', 'one_collection', 'foreign_key_field'],
    properties: {
      many_collection: {
        type: 'string',
        description: 'The "many" side of the relationship (child)'
      },
      one_collection: {
        type: 'string',
        description: 'The "one" side of the relationship (parent)'
      },
      foreign_key_field: {
        type: 'string',
        description: 'The name of the foreign key field in the many_collection'
      }
    }
  };
  
  return fn;
} 