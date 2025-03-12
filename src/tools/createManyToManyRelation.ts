import { AxiosInstance } from 'axios';

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
    field_a_name = `${collection_b}s`,
    field_b_name = `${collection_a}s`
  }: { 
    collection_a: string;
    collection_b: string;
    junction_collection?: string;
    field_a_name?: string;
    field_b_name?: string;
  }) => {
    try {
      // Validate we're not modifying system collections
      if (collection_a.startsWith('directus_') || collection_b.startsWith('directus_') || junction_collection.startsWith('directus_')) {
        throw new Error('Cannot create relations for system collections. Only user collections are allowed.');
      }

      // Step 1: Create the junction collection if it doesn't exist
      try {
        // Check if junction collection already exists
        await directusClient.get(`/collections/${junction_collection}`);
        console.log(`Junction collection ${junction_collection} already exists, using existing collection.`);
      } catch (error) {
        // Create the junction collection if it doesn't exist
        await directusClient.post('/collections', {
          collection: junction_collection,
          meta: {
            hidden: true,
            icon: 'import_export',
            display_template: `{{${collection_a}_id}} - {{${collection_b}_id}}`
          }
        });
        console.log(`Created junction collection: ${junction_collection}`);
      }

      // Step 2: Create fields in the junction collection for both sides of the relation
      try {
        // First field - pointing to collection_a
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
      } catch (error) {
        console.error(`Error creating field ${collection_a}_id in junction collection:`, error);
      }

      try {
        // Second field - pointing to collection_b
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
      } catch (error) {
        console.error(`Error creating field ${collection_b}_id in junction collection:`, error);
      }

      // Step 3: Create relations
      try {
        // Relation from junction to collection_a
        await directusClient.post('/relations', {
          collection: junction_collection,
          field: `${collection_a}_id`,
          related_collection: collection_a
        });
      } catch (error) {
        console.error(`Error creating relation from junction to ${collection_a}:`, error);
      }

      try {
        // Relation from junction to collection_b
        await directusClient.post('/relations', {
          collection: junction_collection,
          field: `${collection_b}_id`,
          related_collection: collection_b
        });
      } catch (error) {
        console.error(`Error creating relation from junction to ${collection_b}:`, error);
      }

      // Step 4: Create o2m relation fields in the parent collections if they don't already exist
      // Collection A - create field to represent the M2M relationship
      try {
        await directusClient.post(`/fields/${collection_a}`, {
          field: field_a_name,
          type: 'alias',
          meta: {
            special: ["o2m"],
            interface: "list-o2m",
            options: {
              enableSelect: true
            }
          }
        });

        // Set up the o2m relation
        await directusClient.post('/relations', {
          collection: collection_a,
          field: field_a_name,
          related_collection: junction_collection,
          meta: {
            one_field: null,
            junction_field: `${collection_b}_id`,
            sort_field: null
          }
        });
      } catch (error) {
        console.error(`Error creating o2m relation in ${collection_a}:`, error);
      }

      // Collection B - create field to represent the M2M relationship
      try {
        await directusClient.post(`/fields/${collection_b}`, {
          field: field_b_name,
          type: 'alias',
          meta: {
            special: ["o2m"],
            interface: "list-o2m",
            options: {
              enableSelect: true
            }
          }
        });

        // Set up the o2m relation
        await directusClient.post('/relations', {
          collection: collection_b,
          field: field_b_name,
          related_collection: junction_collection,
          meta: {
            one_field: null,
            junction_field: `${collection_a}_id`,
            sort_field: null
          }
        });
      } catch (error) {
        console.error(`Error creating o2m relation in ${collection_b}:`, error);
      }

      return {
        message: `Successfully created M2M relationship between ${collection_a} and ${collection_b}`,
        junction_collection,
        field_a_name,
        field_b_name
      };
    } catch (error) {
      console.error('Error creating M2M relation:', error);
      throw error;
    }
  };
  
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
        description: 'Optional name for the relation field in collection_a (defaults to collection_bs)'
      },
      field_b_name: {
        type: 'string',
        description: 'Optional name for the relation field in collection_b (defaults to collection_as)'
      }
    }
  };
  
  return fn;
} 