import { AxiosInstance } from 'axios';
import { createLogger } from '../utils/logger';
import { validateParams, validateCollectionName } from '../utils/paramValidation';

// Create a module-specific logger
const logger = createLogger({ component: 'createManyToManyRelation' });

export function createManyToManyRelation(directusClient: AxiosInstance) {
  /**
   * Create a many-to-many relationship between two collections
   * @param collection_a First collection in the relationship
   * @param collection_b Second collection in the relationship
   * @param junction_collection Name for the junction collection (optional, will be auto-generated if not provided)
   * @param field_a_name Name of the field in collection_a (optional)
   * @param field_b_name Name of the field in collection_b (optional)
   * @returns Information about the created M2M relationship
   */
  const fn = async ({ 
    collection_a,
    collection_b,
    junction_collection = `${collection_a}_${collection_b}`,
    field_a_name = `${collection_b}`,
    field_b_name = `${collection_a}`
  }: { 
    collection_a: string;
    collection_b: string;
    junction_collection?: string;
    field_a_name?: string;
    field_b_name?: string;
  }) => {
    // Create an operation-specific logger to track this specific request
    const opLogger = createLogger({ 
      component: 'createManyToManyRelation', 
      collection_a, 
      collection_b, 
      junction_collection 
    });

    // Track resources created for potential rollback
    const createdResources = {
      junction_collection: false,
      field_a_id: false,
      field_b_id: false,
      relation_a: false,
      relation_b: false,
      field_a: false,
      field_b: false
    };

    try {
      // Validate input parameters
      opLogger.info(`Validating parameters for M2M relationship creation`);
      validateParams({ collection_a, collection_b, junction_collection, field_a_name, field_b_name }, {
        collection_a: { required: true, type: 'string', customValidator: validateCollectionName },
        collection_b: { required: true, type: 'string', customValidator: validateCollectionName },
        junction_collection: { required: true, type: 'string', customValidator: validateCollectionName },
        field_a_name: { type: 'string' },
        field_b_name: { type: 'string' }
      });

      // Validate we're not modifying system collections
      if (collection_a.startsWith('directus_') || collection_b.startsWith('directus_') || junction_collection.startsWith('directus_')) {
        throw new Error('Cannot create relations for system collections. Only user collections are allowed.');
      }

      opLogger.info(`Starting creation of M2M relationship between ${collection_a} and ${collection_b}`);

      // Step 1: Create the junction collection if it doesn't exist
      try {
        // Check if junction collection already exists
        await directusClient.get(`/collections/${junction_collection}`);
        opLogger.info(`Junction collection ${junction_collection} already exists, using existing collection.`);
      } catch (error: any) {
        // Create the junction collection if it doesn't exist
        opLogger.info(`Junction collection ${junction_collection} doesn't exist, creating it.`);
        try {
          await directusClient.post('/collections', {
            collection: junction_collection,
            meta: {
              hidden: true,
              icon: 'import_export',
              display_template: `{{${collection_a}_id}} - {{${collection_b}_id}}`
            }
          });
          createdResources.junction_collection = true;
          opLogger.info(`Created junction collection: ${junction_collection}`);
        } catch (createError: any) {
          opLogger.error(`Failed to create junction collection: ${junction_collection}`, createError);
          throw new Error(`Failed to create junction collection: ${createError.message}`);
        }
      }

      // Step 2: Create fields in the junction collection for both sides of the relation
      try {
        // First field - pointing to collection_a
        opLogger.info(`Creating field ${collection_a}_id in junction collection`);
        await directusClient.post(`/fields/${junction_collection}`, {
          field: `${collection_a}_id`,
          type: 'uuid',
          meta: {
            special: ["m2o"],
            interface: "select-dropdown-m2o",
            width: "half"
          },
          schema: {
            is_nullable: false
          }
        });
        createdResources.field_a_id = true;
      } catch (error: any) {
        await rollbackResources(createdResources);
        opLogger.error(`Error creating field ${collection_a}_id in junction collection`, error);
        throw new Error(`Error creating field ${collection_a}_id: ${error.message}`);
      }

      try {
        // Second field - pointing to collection_b
        opLogger.info(`Creating field ${collection_b}_id in junction collection`);
        await directusClient.post(`/fields/${junction_collection}`, {
          field: `${collection_b}_id`,
          type: 'uuid',
          meta: {
            special: ["m2o"],
            interface: "select-dropdown-m2o",
            width: "half"
          },
          schema: {
            is_nullable: false
          }
        });
        createdResources.field_b_id = true;
      } catch (error: any) {
        await rollbackResources(createdResources);
        opLogger.error(`Error creating field ${collection_b}_id in junction collection`, error);
        throw new Error(`Error creating field ${collection_b}_id: ${error.message}`);
      }

      // Step 3: Create relations
      try {
        // Relation from junction to collection_a
        opLogger.info(`Creating relation from junction to ${collection_a}`);
        await directusClient.post('/relations', {
          collection: junction_collection,
          field: `${collection_a}_id`,
          related_collection: collection_a
        });
        createdResources.relation_a = true;
      } catch (error: any) {
        await rollbackResources(createdResources);
        opLogger.error(`Error creating relation from junction to ${collection_a}`, error);
        throw new Error(`Error creating relation to ${collection_a}: ${error.message}`);
      }

      try {
        // Relation from junction to collection_b
        opLogger.info(`Creating relation from junction to ${collection_b}`);
        await directusClient.post('/relations', {
          collection: junction_collection,
          field: `${collection_b}_id`,
          related_collection: collection_b
        });
        createdResources.relation_b = true;
      } catch (error: any) {
        await rollbackResources(createdResources);
        opLogger.error(`Error creating relation from junction to ${collection_b}`, error);
        throw new Error(`Error creating relation to ${collection_b}: ${error.message}`);
      }

      // Step 4: Create o2m relation fields in the parent collections if they don't already exist
      // Collection A - create field to represent the M2M relationship
      try {
        opLogger.info(`Creating virtual M2M field "${field_a_name}" in ${collection_a}`);
        await directusClient.post(`/fields/${collection_a}`, {
          field: field_a_name,
          type: 'alias',
          meta: {
            special: ["o2m"],
            interface: "list-o2m",
            options: {
              enableSelect: true
            },
            display: "related-values"
          },
          schema: null
        });
        createdResources.field_a = true;
      } catch (error: any) {
        // If this fails, we don't roll back everything, as this is a non-critical part
        opLogger.warn(`Could not create virtual field in ${collection_a}: ${error.message}`);
        opLogger.warn(`This is not critical, as the relationship is established at the database level`);
      }

      // Collection B - create field to represent the M2M relationship
      try {
        opLogger.info(`Creating virtual M2M field "${field_b_name}" in ${collection_b}`);
        await directusClient.post(`/fields/${collection_b}`, {
          field: field_b_name,
          type: 'alias',
          meta: {
            special: ["o2m"],
            interface: "list-o2m",
            options: {
              enableSelect: true
            },
            display: "related-values"
          },
          schema: null
        });
        createdResources.field_b = true;
      } catch (error: any) {
        // If this fails, we don't roll back everything, as this is a non-critical part
        opLogger.warn(`Could not create virtual field in ${collection_b}: ${error.message}`);
        opLogger.warn(`This is not critical, as the relationship is established at the database level`);
      }

      opLogger.info(`Successfully created M2M relationship between ${collection_a} and ${collection_b}`);

      return {
        status: 'success',
        message: `Created many-to-many relationship between ${collection_a} and ${collection_b}`,
        details: {
          junction_collection,
          collection_a,
          collection_b,
          field_a_name,
          field_b_name,
          junction_fields: [`${collection_a}_id`, `${collection_b}_id`]
        }
      };
    } catch (error: any) {
      opLogger.error(`Error creating M2M relationship`, error);
      return {
        status: 'error',
        message: error.message,
        details: {
          collection_a,
          collection_b,
          junction_collection,
          field_a_name,
          field_b_name
        }
      };
    }
  };

  /**
   * Roll back created resources in case of failure
   * @param resources Object tracking which resources were created
   */
  async function rollbackResources(resources: {
    junction_collection: boolean;
    field_a_id: boolean;
    field_b_id: boolean;
    relation_a: boolean;
    relation_b: boolean;
    field_a: boolean;
    field_b: boolean;
  }) {
    const rollbackLogger = createLogger({ component: 'createManyToManyRelation:rollback' });
    
    rollbackLogger.info('Starting rollback of created resources');
    
    try {
      // Delete created virtual fields if they exist
      if (resources.field_a) {
        try {
          await directusClient.delete(`/fields/${resources.field_a}`);
          rollbackLogger.info(`Deleted virtual field in collection_a`);
        } catch (error) {
          rollbackLogger.error(`Failed to delete virtual field in collection_a during rollback`);
        }
      }
      
      if (resources.field_b) {
        try {
          await directusClient.delete(`/fields/${resources.field_b}`);
          rollbackLogger.info(`Deleted virtual field in collection_b`);
        } catch (error) {
          rollbackLogger.error(`Failed to delete virtual field in collection_b during rollback`);
        }
      }
      
      // Delete created fields in junction
      if (resources.field_a_id) {
        try {
          await directusClient.delete(`/fields/${resources.field_a_id}`);
          rollbackLogger.info(`Deleted field_a_id in junction collection`);
        } catch (error) {
          rollbackLogger.error(`Failed to delete field_a_id in junction collection during rollback`);
        }
      }
      
      if (resources.field_b_id) {
        try {
          await directusClient.delete(`/fields/${resources.field_b_id}`);
          rollbackLogger.info(`Deleted field_b_id in junction collection`);
        } catch (error) {
          rollbackLogger.error(`Failed to delete field_b_id in junction collection during rollback`);
        }
      }
      
      // Delete the junction collection itself (if we created it)
      if (resources.junction_collection) {
        try {
          await directusClient.delete(`/collections/${resources.junction_collection}`);
          rollbackLogger.info(`Deleted junction collection`);
        } catch (error) {
          rollbackLogger.error(`Failed to delete junction collection during rollback`);
        }
      }
      
      rollbackLogger.info('Rollback completed');
    } catch (error: any) {
      rollbackLogger.error(`Error during rollback: ${error.message}`);
    }
  }

  fn.description = 'Create a many-to-many relationship between two collections in Directus';
  fn.parameters = {
    type: 'object',
    required: ['collection_a', 'collection_b'],
    properties: {
      collection_a: {
        type: 'string',
        description: 'The name of the first collection in the relationship'
      },
      collection_b: {
        type: 'string',
        description: 'The name of the second collection in the relationship'
      },
      junction_collection: {
        type: 'string',
        description: 'Optional name for the junction collection (defaults to collection_a_collection_b)'
      },
      field_a_name: {
        type: 'string',
        description: 'Optional name for the relation field in collection_a (defaults to collection_b)'
      },
      field_b_name: {
        type: 'string',
        description: 'Optional name for the relation field in collection_b (defaults to collection_a)'
      }
    }
  };
  
  return fn;
} 