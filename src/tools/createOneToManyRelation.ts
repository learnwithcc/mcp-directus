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

    // Track resources created for potential rollback
    const createdResources = {
      foreign_key_field: false,
      relation: false,
      one_field: false
    };

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
        
        createdResources.foreign_key_field = true;
        opLogger.info(`Foreign key field "${foreign_key_field}" created successfully`);
      } catch (error: any) {
        await rollbackResources(createdResources, many_collection, one_collection, foreign_key_field, one_field_name);
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
        await rollbackResources(createdResources, many_collection, one_collection, foreign_key_field, one_field_name);
        opLogger.error(`Error creating relation between collections`, error);
        throw new Error(`Failed to create relation: ${error.message}`);
      }

      // Step 3: Create the O2M virtual field in the one collection (if requested)
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
                template: "{{id}}"
              },
              display: "related-values"
            },
            schema: null
          });
          
          createdResources.one_field = true;
          opLogger.info(`Virtual O2M field "${one_field_name}" created successfully`);
        } catch (error: any) {
          // If this fails, we don't roll back everything, as this is a non-critical part
          opLogger.warn(`Could not create virtual field in ${one_collection}: ${error.message}`);
          opLogger.warn(`This is not critical, as the relationship is established at the database level`);
        }
      }

      opLogger.info(`Successfully created O2M relationship between ${one_collection} and ${many_collection}`);
      
      return {
        status: 'success',
        message: `Created one-to-many relationship between ${one_collection} and ${many_collection}`,
        details: {
          one_collection,
          many_collection,
          foreign_key_field,
          one_field_name
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

  /**
   * Roll back created resources in case of failure
   * @param resources Object tracking which resources were created
   * @param many_collection Name of the "many" collection
   * @param one_collection Name of the "one" collection
   * @param foreign_key_field Name of the foreign key field
   * @param one_field_name Name of the virtual field in the one collection
   */
  async function rollbackResources(
    resources: {
      foreign_key_field: boolean;
      relation: boolean;
      one_field: boolean;
    },
    many_collection: string,
    one_collection: string,
    foreign_key_field: string,
    one_field_name?: string
  ) {
    const rollbackLogger = createLogger({ component: 'createOneToManyRelation:rollback' });
    
    rollbackLogger.info('Starting rollback of created resources');
    
    try {
      // Delete the virtual field in the "one" collection if created
      if (resources.one_field && one_field_name) {
        try {
          await directusClient.delete(`/fields/${one_collection}/${one_field_name}`);
          rollbackLogger.info(`Deleted virtual field "${one_field_name}" in one_collection`);
        } catch (error) {
          rollbackLogger.error(`Failed to delete virtual field in one_collection during rollback`);
        }
      }
      
      // Delete the relation (implicitly by deleting the field)
      
      // Delete the foreign key field in the "many" collection
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