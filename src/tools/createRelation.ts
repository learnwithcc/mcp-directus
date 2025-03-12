import { AxiosInstance } from 'axios';

export function createRelation(directusClient: AxiosInstance) {
  /**
   * Create a relationship between collections
   * @param collection The name of the collection containing the relation field
   * @param field The name of the field to use for the relation
   * @param related_collection The name of the related collection
   * @param meta Optional metadata for the relation
   * @returns The created relation
   */
  const fn = async ({ 
    collection, 
    field, 
    related_collection, 
    meta = {} 
  }: { 
    collection: string; 
    field: string;
    related_collection: string;
    meta?: Record<string, any>; 
  }) => {
    try {
      // Validate we're not modifying system collections
      if (collection.startsWith('directus_') || related_collection.startsWith('directus_')) {
        throw new Error('Cannot create relations for system collections. Only user collections are allowed.');
      }

      // Create the relation using the updated endpoint format for Directus 11.5
      const response = await directusClient.post(`/relations`, {
        collection,
        field,
        related_collection,
        meta
      });

      return response.data.data;
    } catch (error) {
      console.error('Error creating relation:', error);
      throw error;
    }
  };
  
  fn.description = 'Create a relationship between collections in Directus';
  fn.parameters = {
    type: 'object',
    required: ['collection', 'field', 'related_collection'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection containing the relation field'
      },
      field: {
        type: 'string',
        description: 'The name of the field to use for the relation'
      },
      related_collection: {
        type: 'string',
        description: 'The name of the related collection'
      },
      meta: {
        type: 'object',
        description: 'Metadata for the relation, including many_collection, many_field for M2M',
        properties: {
          one_field: { type: 'string', description: 'Name of the field on the related collection that holds this relation' },
          junction_field: { type: 'string', description: 'For M2M, the field on the junction collection pointing to the related collection' },
          many_collection: { type: 'string', description: 'For M2M, the name of the junction collection' },
          many_field: { type: 'string', description: 'For M2M, the field on the junction collection pointing to this collection' }
        }
      }
    }
  };
  
  return fn;
} 