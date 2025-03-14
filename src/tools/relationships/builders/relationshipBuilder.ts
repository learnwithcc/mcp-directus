/**
 * Relationship Builder
 * 
 * This module provides a fluent builder pattern for creating relationships in Directus,
 * making it easier for users to specify the parameters for different relationship types.
 */

import { AxiosInstance } from 'axios';
import { createLogger } from '../../../utils/logger';
import { RelationshipType } from '../results/relationshipErrors';
import { RelationshipResult } from '../results/relationshipResult';
import { JunctionCollectionManager } from '../managers/junctionCollectionManager';
import { validateRelationshipPrerequisites } from '../validators/relationshipValidators';

const logger = createLogger({ component: 'relationshipBuilder' });

/**
 * Base relationship parameters interface
 */
export interface BaseRelationshipParams {
  relationshipType: RelationshipType;
  collectionA: string;
  collectionB: string;
  fieldName?: string;
  foreignKeyField?: string;
  junctionCollection?: string;
  fieldOptions?: Record<string, any>;
}

/**
 * Many-to-many relationship parameters interface
 */
export interface ManyToManyParams extends BaseRelationshipParams {
  relationshipType: 'manyToMany';
  junctionCollection: string;
  fieldAName?: string;
  fieldBName?: string;
  fieldAOptions?: Record<string, any>;
  fieldBOptions?: Record<string, any>;
}

/**
 * One-to-many relationship parameters interface
 */
export interface OneToManyParams extends BaseRelationshipParams {
  relationshipType: 'oneToMany';
  fieldName: string;
  foreignKeyField: string;
}

/**
 * Many-to-one relationship parameters interface
 */
export interface ManyToOneParams extends BaseRelationshipParams {
  relationshipType: 'manyToOne';
  fieldName: string;
  foreignKeyField: string;
}

/**
 * One-to-one relationship parameters interface
 */
export interface OneToOneParams extends BaseRelationshipParams {
  relationshipType: 'oneToOne';
  fieldName: string;
  foreignKeyField: string;
}

/**
 * Union type of all relationship parameter types
 */
export type RelationshipParams = 
  | ManyToManyParams
  | OneToManyParams
  | ManyToOneParams
  | OneToOneParams;

/**
 * Fluent builder for relationships
 */
export class RelationshipBuilder {
  private params: Partial<RelationshipParams> = {};
  private directusClient?: AxiosInstance;
  
  /**
   * Initialize the builder with a Directus client
   * @param directusClient The Axios instance for the Directus API
   */
  public withClient(directusClient: AxiosInstance): this {
    this.directusClient = directusClient;
    return this;
  }
  
  /**
   * Set the first collection in the relationship
   * @param collection The name of the first collection
   */
  public fromCollection(collection: string): this {
    this.params.collectionA = collection;
    return this;
  }
  
  /**
   * Set the second collection in the relationship
   * @param collection The name of the second collection
   */
  public toCollection(collection: string): this {
    this.params.collectionB = collection;
    return this;
  }
  
  /**
   * Set the type of relationship
   * @param type The relationship type
   */
  public asType(type: RelationshipType): this {
    this.params.relationshipType = type;
    return this;
  }
  
  /**
   * Set the field name in the "from" collection
   * @param fieldName The name of the field
   */
  public withFieldName(fieldName: string): this {
    this.params.fieldName = fieldName;
    return this;
  }
  
  /**
   * Set the foreign key field name
   * @param foreignKeyField The name of the foreign key field
   */
  public withForeignKey(foreignKeyField: string): this {
    this.params.foreignKeyField = foreignKeyField;
    return this;
  }
  
  /**
   * Set the junction collection name for M2M relationships
   * @param junctionCollection The name of the junction collection
   */
  public withJunctionCollection(junctionCollection: string): this {
    this.params.junctionCollection = junctionCollection;
    return this;
  }
  
  /**
   * Set field options for the relationship
   * @param options Field options
   */
  public withFieldOptions(options: Record<string, any>): this {
    this.params.fieldOptions = options;
    return this;
  }
  
  /**
   * For M2M: Set the field name in collection A
   * @param fieldName The field name
   */
  public withFieldAName(fieldName: string): this {
    if (this.params.relationshipType === 'manyToMany') {
      (this.params as ManyToManyParams).fieldAName = fieldName;
    } else {
      logger.warn('withFieldAName is only applicable for Many-to-Many relationships');
    }
    return this;
  }
  
  /**
   * For M2M: Set the field name in collection B
   * @param fieldName The field name
   */
  public withFieldBName(fieldName: string): this {
    if (this.params.relationshipType === 'manyToMany') {
      (this.params as ManyToManyParams).fieldBName = fieldName;
    } else {
      logger.warn('withFieldBName is only applicable for Many-to-Many relationships');
    }
    return this;
  }
  
  /**
   * For M2M: Set field options for field A
   * @param options Field options
   */
  public withFieldAOptions(options: Record<string, any>): this {
    if (this.params.relationshipType === 'manyToMany') {
      (this.params as ManyToManyParams).fieldAOptions = options;
    } else {
      logger.warn('withFieldAOptions is only applicable for Many-to-Many relationships');
    }
    return this;
  }
  
  /**
   * For M2M: Set field options for field B
   * @param options Field options
   */
  public withFieldBOptions(options: Record<string, any>): this {
    if (this.params.relationshipType === 'manyToMany') {
      (this.params as ManyToManyParams).fieldBOptions = options;
    } else {
      logger.warn('withFieldBOptions is only applicable for Many-to-Many relationships');
    }
    return this;
  }
  
  /**
   * Validate the parameters for the relationship
   * @returns True if the parameters are valid
   */
  public validateParams(): boolean {
    // Common validations
    if (!this.params.collectionA || !this.params.collectionB) {
      logger.error('Both collections must be specified');
      return false;
    }
    
    if (!this.params.relationshipType) {
      logger.error('Relationship type must be specified');
      return false;
    }
    
    // Type-specific validations
    switch (this.params.relationshipType) {
      case 'manyToMany':
        // M2M requires a junction collection
        if (!this.params.junctionCollection) {
          this.params.junctionCollection = `${this.params.collectionA}_${this.params.collectionB}`;
          logger.info(`Auto-generated junction collection name: ${this.params.junctionCollection}`);
        }
        break;
        
      case 'oneToMany':
      case 'manyToOne':
      case 'oneToOne':
        // These types require field name and foreign key
        if (!this.params.fieldName) {
          logger.error('Field name must be specified for this relationship type');
          return false;
        }
        if (!this.params.foreignKeyField) {
          logger.error('Foreign key field must be specified for this relationship type');
          return false;
        }
        break;
    }
    
    return true;
  }
  
  /**
   * Build the relationship parameters object
   * @returns The validated relationship parameters
   */
  public build(): RelationshipParams {
    if (!this.validateParams()) {
      throw new Error('Invalid relationship parameters. Check the logs for details.');
    }
    
    // Cast to appropriate type based on relationshipType
    switch (this.params.relationshipType) {
      case 'manyToMany':
        return this.params as ManyToManyParams;
      case 'oneToMany':
        return this.params as OneToManyParams;
      case 'manyToOne':
        return this.params as ManyToOneParams;
      case 'oneToOne':
        return this.params as OneToOneParams;
      default:
        // This should never happen if validateParams passes, but TypeScript needs it
        throw new Error(`Unknown relationship type: ${(this.params as BaseRelationshipParams).relationshipType || 'undefined'}`);
    }
  }
  
  /**
   * Execute the relationship creation
   * @returns Promise resolving to the relationship result
   */
  public async execute(): Promise<RelationshipResult> {
    if (!this.directusClient) {
      throw new Error('Directus client must be set using withClient() before executing');
    }
    
    const params = this.build();
    
    // Validate prerequisites
    try {
      await validateRelationshipPrerequisites(this.directusClient, {
        relationshipType: params.relationshipType,
        collections: [params.collectionA, params.collectionB],
        fields: this.getFieldsMap(params),
        junctionCollection: params.junctionCollection
      });
    } catch (error: any) {
      return new RelationshipResult(
        false,
        undefined,
        {
          type: params.relationshipType,
          collections: [params.collectionA, params.collectionB],
          fields: [],
          junctionCollection: params.junctionCollection
        }
      ).addError(`Validation failed: ${error.message}`);
    }
    
    // Implement relationship creation strategies
    switch (params.relationshipType) {
      case 'manyToMany':
        return this.createManyToManyRelationship(params as ManyToManyParams);
      case 'oneToMany':
        return this.createOneToManyRelationship(params as OneToManyParams);
      case 'manyToOne':
        return this.createManyToOneRelationship(params as ManyToOneParams);
      case 'oneToOne':
        return this.createOneToOneRelationship(params as OneToOneParams);
      default:
        // This should never happen due to the validation above, but TypeScript needs it
        return new RelationshipResult(
          false,
          undefined,
          {
            type: 'manyToMany', // Default to a valid type for the result
            collections: [
              this.params.collectionA || 'unknown',
              this.params.collectionB || 'unknown'
            ],
            fields: []
          }
        ).addError(`Unknown relationship type: ${String(params)}`);
    }
  }
  
  /**
   * Get a map of collections to fields for validation
   * @param params The relationship parameters
   * @returns A map of collection names to field names
   */
  private getFieldsMap(params: RelationshipParams): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    
    switch (params.relationshipType) {
      case 'manyToMany':
        const m2mParams = params as ManyToManyParams;
        
        const fieldAName = m2mParams.fieldAName || params.collectionB;
        const fieldBName = m2mParams.fieldBName || params.collectionA;
        
        result[params.collectionA] = [fieldAName];
        result[params.collectionB] = [fieldBName];
        result[params.junctionCollection] = [
          `${params.collectionA}_id`,
          `${params.collectionB}_id`
        ];
        break;
        
      case 'oneToMany':
        result[params.collectionA] = [params.fieldName!];
        result[params.collectionB] = [params.foreignKeyField!];
        break;
        
      case 'manyToOne':
        result[params.collectionA] = [params.foreignKeyField!];
        result[params.collectionB] = [params.fieldName!];
        break;
        
      case 'oneToOne':
        result[params.collectionA] = [params.fieldName!];
        result[params.collectionB] = [params.foreignKeyField!];
        break;
    }
    
    return result;
  }
  
  /**
   * Create a Many-to-Many relationship
   * @param params The M2M relationship parameters
   * @returns Promise resolving to the relationship result
   */
  private async createManyToManyRelationship(params: ManyToManyParams): Promise<RelationshipResult> {
    logger.info(`Creating Many-to-Many relationship between ${params.collectionA} and ${params.collectionB}`);
    
    const result = new RelationshipResult(
      false,
      undefined,
      {
        type: 'manyToMany',
        collections: [params.collectionA, params.collectionB],
        fields: [
          params.fieldAName || params.collectionB,
          params.fieldBName || params.collectionA
        ],
        junctionCollection: params.junctionCollection
      }
    );
    
    try {
      // Step 1: Create the junction collection and fields
      const junctionManager = new JunctionCollectionManager(this.directusClient!);
      const junctionResult = await junctionManager.createOrValidate({
        collectionA: params.collectionA,
        collectionB: params.collectionB,
        junctionName: params.junctionCollection,
        fieldAOptions: params.fieldAOptions,
        fieldBOptions: params.fieldBOptions
      });
      
      if (!junctionResult.success) {
        return result
          .addError(`Failed to create junction collection: ${junctionResult.error?.message || 'Unknown error'}`)
          .addFailedResource(`Junction collection: ${params.junctionCollection}`);
      }
      
      // Record created resources
      if (junctionResult.created) {
        result.addCreatedResource(`Junction collection: ${params.junctionCollection}`);
      } else {
        result.addUnchangedResource(`Junction collection: ${params.junctionCollection}`);
      }
      
      if (junctionResult.fieldsCreated.fieldA) {
        result.addCreatedResource(`Field: ${params.junctionCollection}.${junctionResult.junctionFields.fieldA}`);
      } else {
        result.addUnchangedResource(`Field: ${params.junctionCollection}.${junctionResult.junctionFields.fieldA}`);
      }
      
      if (junctionResult.fieldsCreated.fieldB) {
        result.addCreatedResource(`Field: ${params.junctionCollection}.${junctionResult.junctionFields.fieldB}`);
      } else {
        result.addUnchangedResource(`Field: ${params.junctionCollection}.${junctionResult.junctionFields.fieldB}`);
      }
      
      // Step 2: Create the M2M alias fields in the parent collections
      const fieldAName = params.fieldAName || params.collectionB;
      try {
        const response = await this.directusClient!.post(`/fields/${params.collectionA}`, {
          field: fieldAName,
          type: 'alias',
          meta: {
            interface: 'list-m2m',
            special: ['m2m'],
            options: {
              template: '{{id}}',
              ...(params.fieldAOptions || {})
            },
            junction_field: `${params.collectionA}_id`,
            many_collection: params.junctionCollection,
            many_field: `${params.collectionB}_id`
          },
          schema: null
        });
        
        result.addCreatedResource(`M2M Field: ${params.collectionA}.${fieldAName}`);
      } catch (error: any) {
        // If field exists, just note it
        if (error.response?.status === 400 && error.response?.data?.errors?.some((e: any) => e.message?.includes('already exists'))) {
          result.addUnchangedResource(`M2M Field: ${params.collectionA}.${fieldAName}`);
          result.addWarning(`Field ${fieldAName} already exists in ${params.collectionA}`);
        } else {
          result.addWarning(`Could not create field ${fieldAName} in ${params.collectionA}: ${error.message}`);
          logger.warn(`Error creating M2M field in ${params.collectionA}`, { error });
        }
      }
      
      const fieldBName = params.fieldBName || params.collectionA;
      try {
        const response = await this.directusClient!.post(`/fields/${params.collectionB}`, {
          field: fieldBName,
          type: 'alias',
          meta: {
            interface: 'list-m2m',
            special: ['m2m'],
            options: {
              template: '{{id}}',
              ...(params.fieldBOptions || {})
            },
            junction_field: `${params.collectionB}_id`,
            many_collection: params.junctionCollection,
            many_field: `${params.collectionA}_id`
          },
          schema: null
        });
        
        result.addCreatedResource(`M2M Field: ${params.collectionB}.${fieldBName}`);
      } catch (error: any) {
        // If field exists, just note it
        if (error.response?.status === 400 && error.response?.data?.errors?.some((e: any) => e.message?.includes('already exists'))) {
          result.addUnchangedResource(`M2M Field: ${params.collectionB}.${fieldBName}`);
          result.addWarning(`Field ${fieldBName} already exists in ${params.collectionB}`);
        } else {
          result.addWarning(`Could not create field ${fieldBName} in ${params.collectionB}: ${error.message}`);
          logger.warn(`Error creating M2M field in ${params.collectionB}`, { error });
        }
      }
      
      // Success!
      result.success = true;
      logger.info(`Successfully created M2M relationship between ${params.collectionA} and ${params.collectionB}`);
      return result;
    } catch (error: any) {
      logger.error(`Failed to create M2M relationship`, { error });
      return result.addError(`Unexpected error: ${error.message}`);
    }
  }
  
  /**
   * Create a One-to-Many relationship
   * @param params The O2M relationship parameters
   * @returns Promise resolving to the relationship result
   */
  private async createOneToManyRelationship(params: OneToManyParams): Promise<RelationshipResult> {
    // Placeholder - to be implemented
    // This is a simplified demonstration of the pattern
    return new RelationshipResult(
      false,
      undefined,
      {
        type: 'oneToMany',
        collections: [params.collectionA, params.collectionB],
        fields: [params.fieldName, params.foreignKeyField]
      }
    ).addError('One-to-Many relationship creation not yet implemented');
  }
  
  /**
   * Create a Many-to-One relationship
   * @param params The M2O relationship parameters
   * @returns Promise resolving to the relationship result
   */
  private async createManyToOneRelationship(params: ManyToOneParams): Promise<RelationshipResult> {
    // Placeholder - to be implemented
    // This is a simplified demonstration of the pattern
    return new RelationshipResult(
      false,
      undefined,
      {
        type: 'manyToOne',
        collections: [params.collectionA, params.collectionB],
        fields: [params.fieldName, params.foreignKeyField]
      }
    ).addError('Many-to-One relationship creation not yet implemented');
  }
  
  /**
   * Create a One-to-One relationship
   * @param params The O2O relationship parameters
   * @returns Promise resolving to the relationship result
   */
  private async createOneToOneRelationship(params: OneToOneParams): Promise<RelationshipResult> {
    // Placeholder - to be implemented
    // This is a simplified demonstration of the pattern
    return new RelationshipResult(
      false,
      undefined,
      {
        type: 'oneToOne',
        collections: [params.collectionA, params.collectionB],
        fields: [params.fieldName, params.foreignKeyField]
      }
    ).addError('One-to-One relationship creation not yet implemented');
  }
} 