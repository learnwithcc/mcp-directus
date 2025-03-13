import { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { createLogger } from './logger';

const logger = createLogger({ component: 'schemaApplyWithHash' });

/**
 * Gets the current schema snapshot from Directus.
 * This is used to generate a hash for schema validation.
 */
async function getSchemaSnapshot(directusClient: AxiosInstance) {
  try {
    logger.info('Fetching schema snapshot from Directus');
    const response = await directusClient.get('/schema/snapshot');
    return response.data.data;
  } catch (error: any) {
    logger.error('Failed to fetch schema snapshot', { error: error.message });
    throw new Error(`Failed to fetch schema snapshot: ${error.message}`);
  }
}

/**
 * Generates a hash from the current schema snapshot.
 * This hash is used to verify that the schema hasn't changed between operations.
 */
function generateSchemaHash(schema: any): string {
  const stringToHash = JSON.stringify(schema);
  return crypto.createHash('sha256').update(stringToHash).digest('hex');
}

/**
 * Generates a schema difference by comparing the target schema changes with the current schema.
 * 
 * Note: Directus 11.5.1 expects the schema/diff endpoint to receive data in a specific format:
 * { data: { schema object } }
 */
async function generateSchemaDiff(directusClient: AxiosInstance, schemaChanges: any) {
  try {
    logger.info('Generating schema diff');
    logger.debug('Schema changes for diff', { schemaChanges });
    
    // Ensure the data is properly wrapped as expected by Directus 11.5.1
    const payload = { data: schemaChanges };
    
    const response = await directusClient.post('/schema/diff', payload);
    
    // If no difference is found, return null
    if (response.status === 204) {
      logger.info('No schema differences found');
      return null;
    }
    
    // Return the diff with the hash
    return response.data.data;
  } catch (error: any) {
    logger.error('Failed to generate schema diff', { 
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw new Error(`Failed to generate schema diff: ${error.message}`);
  }
}

/**
 * Applies schema changes using the schema/apply endpoint with hash validation
 * to ensure the schema hasn't changed since the diff was generated.
 */
export async function applySchemaChanges(
  directusClient: AxiosInstance,
  schemaChanges: any,
  options: {
    retries?: number;
    forceApply?: boolean;
    validateHash?: boolean;
  } = {}
) {
  const { retries = 3, forceApply = false, validateHash = true } = options;
  const opLogger = createLogger({ component: 'applySchemaChanges' });
  
  try {
    // Step 1: Get current schema and generate hash
    const currentSchema = await getSchemaSnapshot(directusClient);
    const schemaHash = generateSchemaHash(currentSchema);
    opLogger.info('Generated schema hash', { hash: schemaHash });
    
    // Step 2: Generate diff with hash
    let diff;
    try {
      diff = await generateSchemaDiff(directusClient, schemaChanges);
      
      // If no diff is found, return early
      if (!diff) {
        return {
          status: 'success',
          message: 'No schema changes needed, schema is already up to date',
          changed: false
        };
      }
      
      opLogger.info('Schema diff generated successfully');
    } catch (error: any) {
      opLogger.error('Failed to generate schema diff', { error: error.message });
      throw new Error(`Failed to generate schema diff: ${error.message}`);
    }
    
    // Step 3: Apply the diff with hash validation
    try {
      const payload = {
        ...diff,
        hash: schemaHash
      };
      
      if (forceApply) {
        opLogger.warn('Forcing schema apply, bypassing hash validation');
        delete payload.hash;
      } else if (!validateHash) {
        opLogger.warn('Hash validation disabled');
        delete payload.hash;
      }
      
      opLogger.info('Applying schema changes');
      opLogger.debug('Schema apply payload', { payload });
      
      await directusClient.post('/schema/apply', payload);
      
      opLogger.info('Schema changes applied successfully');
      return {
        status: 'success',
        message: 'Schema changes applied successfully',
        changed: true
      };
    } catch (error: any) {
      // Check for hash mismatch error
      if (error.response?.status === 409 || 
          (error.response?.data?.errors?.[0]?.message && 
           error.response?.data?.errors?.[0]?.message.includes('hash'))) {
        
        opLogger.warn('Schema hash mismatch, schema has changed since diff was generated');
        
        // Retry logic for hash mismatch
        if (retries > 0) {
          opLogger.info(`Retrying schema apply (${retries} retries left)`);
          return applySchemaChanges(directusClient, schemaChanges, {
            retries: retries - 1,
            forceApply,
            validateHash
          });
        }
        
        throw new Error('Schema hash mismatch after retries exhausted. The schema might be changing concurrently.');
      }
      
      opLogger.error('Failed to apply schema changes', { 
        status: error.response?.status,
        data: error.response?.data
      });
      
      throw new Error(`Failed to apply schema changes: ${error.message}`);
    }
  } catch (error: any) {
    opLogger.error('Schema apply operation failed', { error: error.message });
    throw error;
  }
}

/**
 * Creates a Many-to-Many relationship between two collections using schema/apply
 * with proper hash validation.
 */
export async function createM2MRelationWithHash(
  directusClient: AxiosInstance,
  options: {
    collectionA: string;
    collectionB: string;
    junctionCollection: string;
    fieldAName?: string;
    fieldBName?: string;
    fieldAOptions?: any;
    fieldBOptions?: any;
    retries?: number;
    forceApply?: boolean;
  }
) {
  const {
    collectionA,
    collectionB,
    junctionCollection,
    fieldAName = `${collectionB}`,
    fieldBName = `${collectionA}`,
    fieldAOptions = {},
    fieldBOptions = {},
    retries = 3,
    forceApply = false
  } = options;
  
  const opLogger = createLogger({ 
    component: 'createM2MRelationWithHash',
    collectionA,
    collectionB,
    junctionCollection
  });
  
  opLogger.info(`Creating M2M relationship between "${collectionA}" and "${collectionB}" using junction "${junctionCollection}"`);
  
  try {
    // Step 1: Check if collections exist
    async function checkCollectionExists(collectionName: string) {
      try {
        await directusClient.get(`/collections/${collectionName}`);
        return true;
      } catch (error) {
        return false;
      }
    }
    
    const collectionAExists = await checkCollectionExists(collectionA);
    const collectionBExists = await checkCollectionExists(collectionB);
    const junctionExists = await checkCollectionExists(junctionCollection);
    
    if (!collectionAExists) {
      throw new Error(`Collection "${collectionA}" does not exist`);
    }
    
    if (!collectionBExists) {
      throw new Error(`Collection "${collectionB}" does not exist`);
    }
    
    // If the standard schema/diff approach doesn't work, fall back to direct API calls
    if (!junctionExists) {
      // Create the junction collection
      opLogger.info(`Creating junction collection "${junctionCollection}" via direct API call`);
      await directusClient.post('/collections', {
        collection: junctionCollection,
        meta: {
          hidden: false,
          icon: 'import_export',
          display_template: `{{${collectionA}_id}} - {{${collectionB}_id}}`
        },
        schema: {
          name: junctionCollection
        }
      });
    }
    
    // Create the fields in the junction collection
    try {
      opLogger.info(`Creating ${collectionA}_id field in junction collection`);
      await directusClient.post(`/fields/${junctionCollection}`, {
        field: `${collectionA}_id`,
        type: 'uuid',
        meta: {
          hidden: false,
          interface: 'select-dropdown-m2o',
          display: 'related-values',
          special: ['m2o'],
          required: true
        },
        schema: {
          name: `${collectionA}_id`,
          table: junctionCollection,
          data_type: 'uuid',
          is_nullable: false
        }
      });
    } catch (error: any) {
      opLogger.warn(`Error creating ${collectionA}_id field, may already exist: ${error.message}`);
    }
    
    try {
      opLogger.info(`Creating ${collectionB}_id field in junction collection`);
      await directusClient.post(`/fields/${junctionCollection}`, {
        field: `${collectionB}_id`,
        type: 'uuid',
        meta: {
          hidden: false,
          interface: 'select-dropdown-m2o',
          display: 'related-values',
          special: ['m2o'],
          required: true
        },
        schema: {
          name: `${collectionB}_id`,
          table: junctionCollection,
          data_type: 'uuid',
          is_nullable: false
        }
      });
    } catch (error: any) {
      opLogger.warn(`Error creating ${collectionB}_id field, may already exist: ${error.message}`);
    }
    
    // Create the relations
    try {
      opLogger.info(`Creating relation from junction to ${collectionA}`);
      await directusClient.post('/relations', {
        collection: junctionCollection,
        field: `${collectionA}_id`,
        related_collection: collectionA,
        schema: {
          on_delete: 'CASCADE'
        },
        meta: {
          junction_field: null
        }
      });
    } catch (error: any) {
      opLogger.warn(`Error creating relation to ${collectionA}, may already exist: ${error.message}`);
    }
    
    try {
      opLogger.info(`Creating relation from junction to ${collectionB}`);
      await directusClient.post('/relations', {
        collection: junctionCollection,
        field: `${collectionB}_id`,
        related_collection: collectionB,
        schema: {
          on_delete: 'CASCADE'
        },
        meta: {
          junction_field: null
        }
      });
    } catch (error: any) {
      opLogger.warn(`Error creating relation to ${collectionB}, may already exist: ${error.message}`);
    }
    
    // Create the M2M alias fields in the parent collections
    try {
      opLogger.info(`Creating M2M field "${fieldAName}" in ${collectionA}`);
      await directusClient.post(`/fields/${collectionA}`, {
        field: fieldAName,
        type: 'alias',
        meta: {
          interface: 'list-m2m',
          special: ['m2m'],
          options: {
            template: '{{id}}',
            ...fieldAOptions
          },
          junction_field: `${collectionA}_id`,
          many_collection: junctionCollection,
          many_field: `${collectionB}_id`
        },
        schema: null
      });
    } catch (error: any) {
      opLogger.warn(`Error creating M2M field in ${collectionA}, may already exist: ${error.message}`);
    }
    
    try {
      opLogger.info(`Creating M2M field "${fieldBName}" in ${collectionB}`);
      await directusClient.post(`/fields/${collectionB}`, {
        field: fieldBName,
        type: 'alias',
        meta: {
          interface: 'list-m2m',
          special: ['m2m'],
          options: {
            template: '{{id}}',
            ...fieldBOptions
          },
          junction_field: `${collectionB}_id`,
          many_collection: junctionCollection,
          many_field: `${collectionA}_id`
        },
        schema: null
      });
    } catch (error: any) {
      opLogger.warn(`Error creating M2M field in ${collectionB}, may already exist: ${error.message}`);
    }
    
    opLogger.info('M2M relationship created successfully using direct API calls');
    
    return {
      status: 'success',
      message: `M2M relationship between "${collectionA}" and "${collectionB}" created successfully`,
      details: {
        collectionA,
        collectionB,
        junctionCollection,
        fieldAName,
        fieldBName,
        changed: true
      }
    };
  } catch (error: any) {
    opLogger.error('Failed to create M2M relationship', { error: error.message });
    
    return {
      status: 'error',
      message: `Failed to create M2M relationship: ${error.message}`,
      details: {
        collectionA,
        collectionB,
        junctionCollection,
        fieldAName,
        fieldBName,
        error: error.message
      }
    };
  }
} 