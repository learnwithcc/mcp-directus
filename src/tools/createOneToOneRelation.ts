/**
 * CREATING ONE-TO-ONE RELATIONSHIPS IN DIRECTUS 11.5.1
 * 
 * This tool provides a dedicated function for creating one-to-one (O2O)
 * relationships between two collections in Directus.
 * 
 * In a one-to-one relationship:
 * - One record from Collection A can be associated with only one record from Collection B
 * - One record from Collection B can be associated with only one record from Collection A
 * 
 * The implementation creates a foreign key field in one collection that references the other,
 * and optionally applies a uniqueness constraint to enforce the one-to-one relationship.
 */

import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'createOneToOneRelation' });

export function createOneToOneRelation(directusClient: AxiosInstance) {
  /**
   * Create a one-to-one relationship between two collections
   * @param collection_a First collection in the relationship
   * @param collection_b Second collection in the relationship
   * @param field_name Name of the field in collection_a that references collection_b
   * @param enforce_uniqueness Whether to enforce uniqueness constraint (default: true)
   * @returns Information about the created O2O relationship
   */
  const fn = async ({ 
    collection_a,
    collection_b,
    field_name,
    enforce_uniqueness = true
  }: { 
    collection_a: string;
    collection_b: string;
    field_name: string;
    enforce_uniqueness?: boolean;
  }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'createOneToOneRelation', 
      collection_a,
      collection_b,
      field_name
    });

    // Track resources created for potential rollback
    const createdResources = {
      field: false,
      relation: false
    };

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for O2O relationship creation`);
      validateParams({ collection_a, collection_b, field_name }, {
        collection_a: { required: true, type: 'string', customValidator: validateCollectionName },
        collection_b: { required: true, type: 'string', customValidator: validateCollectionName },
        field_name: { required: true, type: 'string' }
      });

      // Validate we're not modifying system collections
      if (collection_a.startsWith('directus_') || collection_b.startsWith('directus_')) {
        throw new Error('Cannot create relations for system collections. Only user collections are allowed.');
      }

      opLogger.info(`Creating O2O relationship between ${collection_a} and ${collection_b}`);
      opLogger.info(`Uniqueness enforcement: ${enforce_uniqueness ? 'Enabled' : 'Disabled'}`);

      // Step 1: Create the foreign key field in collection_a that references collection_b
      opLogger.info(`Creating foreign key field "${field_name}" in ${collection_a}`);
      
      try {
        await directusClient.post(`/fields/${collection_a}`, {
          field: field_name,
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
            is_nullable: true,
            is_unique: enforce_uniqueness
          }
        });
        
        createdResources.field = true;
        opLogger.info(`Foreign key field "${field_name}" created successfully`);
      } catch (error: any) {
        await rollbackResources(createdResources, collection_a, field_name);
        opLogger.error(`Error creating foreign key field in collection_a`, error);
        throw new Error(`Failed to create foreign key field: ${error.message}`);
      }

      // Step 2: Create the relation between the collections
      opLogger.info(`Creating relation between collections`);
      
      try {
        await directusClient.post('/relations', {
          collection: collection_a,
          field: field_name,
          related_collection: collection_b
        });
        
        createdResources.relation = true;
        opLogger.info(`Relation created successfully`);
      } catch (error: any) {
        await rollbackResources(createdResources, collection_a, field_name);
        opLogger.error(`Error creating relation between collections`, error);
        throw new Error(`Failed to create relation: ${error.message}`);
      }

      opLogger.info(`Successfully created O2O relationship between ${collection_a} and ${collection_b}`);

      return {
        status: 'success',
        message: `Created one-to-one relationship between ${collection_a} and ${collection_b}`,
        details: {
          collection_a,
          collection_b,
          field_name,
          enforce_uniqueness
        }
      };
    } catch (error: any) {
      opLogger.error(`Error creating O2O relationship`, error);
      return {
        status: 'error',
        message: error.message,
        details: {
          collection_a,
          collection_b,
          field_name,
          enforce_uniqueness
        }
      };
    }
  };

  /**
   * Roll back created resources in case of failure
   * @param resources Object tracking which resources were created
   * @param collection_a Name of the collection containing the field
   * @param field_name Name of the field
   */
  async function rollbackResources(
    resources: {
      field: boolean;
      relation: boolean;
    },
    collection_a: string,
    field_name: string
  ) {
    const rollbackLogger = createLogger({ component: 'createOneToOneRelation:rollback' });
    
    rollbackLogger.info('Starting rollback of created resources');
    
    try {
      // Delete the field in collection_a (this will also implicitly delete the relation)
      if (resources.field) {
        try {
          await directusClient.delete(`/fields/${collection_a}/${field_name}`);
          rollbackLogger.info(`Deleted field "${field_name}" in collection_a`);
        } catch (error) {
          rollbackLogger.error(`Failed to delete field in collection_a during rollback`);
        }
      }
      
      rollbackLogger.info('Rollback completed');
    } catch (error: any) {
      rollbackLogger.error(`Error during rollback: ${error.message}`);
    }
  }

  fn.description = 'Create a one-to-one relationship between two Directus collections';
  fn.parameters = {
    type: 'object',
    required: ['collection_a', 'collection_b', 'field_name'],
    properties: {
      collection_a: {
        type: 'string',
        description: 'First collection in the relationship (contains the foreign key)'
      },
      collection_b: {
        type: 'string',
        description: 'Second collection in the relationship (referenced by the foreign key)'
      },
      field_name: {
        type: 'string',
        description: 'Name of the field in collection_a that references collection_b'
      },
      enforce_uniqueness: {
        type: 'boolean',
        description: 'Whether to enforce uniqueness constraint (default: true)'
      }
    }
  };
  
  return fn;
} 