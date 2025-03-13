/**
 * Comprehensive schema validation tool for Directus
 * 
 * This tool validates the Directus schema for integrity, constraints,
 * optimization opportunities, and validates relationships between collections.
 */

import { AxiosInstance } from 'axios';

// Define interfaces for the schema components
interface Collection {
  collection: string;
  meta: {
    icon?: string;
    note?: string;
    display_template?: string;
    hidden?: boolean;
    singleton?: boolean;
    collection?: string;
    group?: string | null;
    sort_field?: string | null;
    accountability?: string;
    item_duplication_fields?: string[];
    archive_field?: string | null;
    archive_value?: string | null;
    unarchive_value?: string | null;
    archive_app_filter?: boolean;
    sort?: number;
    collapse?: string;
  };
  schema: {
    name: string;
  };
}

interface Field {
  collection: string;
  field: string;
  type: string;
  meta: {
    id?: number;
    collection: string;
    field: string;
    special?: string[];
    interface?: string;
    options?: Record<string, any>;
    display?: string;
    display_options?: Record<string, any>;
    readonly?: boolean;
    hidden?: boolean;
    sort?: number;
    width?: string;
    translations?: Record<string, any>[];
    note?: string;
    conditions?: Record<string, any>[];
    required?: boolean;
    group?: string | null;
    validation?: Record<string, any>;
    validation_message?: string;
  };
  schema: {
    name: string;
    table: string;
    data_type: string;
    default_value?: any;
    max_length?: number;
    numeric_precision?: number;
    numeric_scale?: number;
    is_nullable?: boolean;
    is_unique?: boolean;
    is_primary_key?: boolean;
    has_auto_increment?: boolean;
    foreign_key_column?: string;
    foreign_key_table?: string;
  };
}

interface Relation {
  collection: string;
  field: string;
  related_collection: string | null;
  schema: {
    constraint_name?: string;
    on_update?: string;
    on_delete?: string;
  };
  meta: {
    id?: number;
    many_collection: string;
    many_field: string;
    one_collection?: string | null;
    one_field?: string | null;
    one_collection_field?: string | null;
    one_allowed_collections?: string[] | null;
    junction_field?: string | null;
    sort_field?: string | null;
    one_deselect_action?: string;
  };
}

// Define interface for validation issue
interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  message: string;
  details?: any;
  collection?: string;
  field?: string;
  relation?: string;
  recommendation?: string;
}

// Define interface for validation result
interface SchemaValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  statistics: {
    collections: number;
    fields: number;
    relations: number;
    systemCollections: number;
    userCollections: number;
    primaryKeys: number;
    foreignKeys: number;
    junctionTables: number;
    singletons: number;
  };
  optimizationOpportunities: ValidationIssue[];
  metadataCompleteness: {
    collectionsWithIcons: number;
    collectionsWithNotes: number;
    fieldsWithNotes: number;
    collectionsWithDisplayTemplates: number;
  };
  relationshipAnalysis: {
    manyToOneCount: number;
    oneToManyCount: number;
    manyToManyCount: number;
    selfReferentialCount: number;
    missingRelations: ValidationIssue[];
    inconsistentRelations: ValidationIssue[];
  };
}

export function validateSchema(directusClient: AxiosInstance) {
  /**
   * Validate the Directus schema for integrity and optimization
   * @returns Schema validation report
   */
  const fn = async () => {
    try {
      console.log('Starting schema validation...');
      
      // Initialize validation result
      const result: SchemaValidationResult = {
        valid: true,
        issues: [],
        statistics: {
          collections: 0,
          fields: 0,
          relations: 0,
          systemCollections: 0,
          userCollections: 0,
          primaryKeys: 0,
          foreignKeys: 0,
          junctionTables: 0,
          singletons: 0
        },
        optimizationOpportunities: [],
        metadataCompleteness: {
          collectionsWithIcons: 0,
          collectionsWithNotes: 0,
          fieldsWithNotes: 0,
          collectionsWithDisplayTemplates: 0
        },
        relationshipAnalysis: {
          manyToOneCount: 0,
          oneToManyCount: 0,
          manyToManyCount: 0,
          selfReferentialCount: 0,
          missingRelations: [],
          inconsistentRelations: []
        }
      };
      
      // Step 1: Fetch collections, fields, and relations
      console.log('Fetching schema components...');
      
      // Get collections
      const collectionsResponse = await directusClient.get('/collections');
      const collections: Collection[] = collectionsResponse.data.data;
      result.statistics.collections = collections.length;
      
      // Categorize collections
      collections.forEach(collection => {
        if (collection.collection.startsWith('directus_')) {
          result.statistics.systemCollections++;
        } else {
          result.statistics.userCollections++;
        }
        
        if (collection.meta?.singleton) {
          result.statistics.singletons++;
        }
        
        // Count collections with metadata
        if (collection.meta?.icon) {
          result.metadataCompleteness.collectionsWithIcons++;
        }
        
        if (collection.meta?.note) {
          result.metadataCompleteness.collectionsWithNotes++;
        }
        
        if (collection.meta?.display_template) {
          result.metadataCompleteness.collectionsWithDisplayTemplates++;
        }
      });
      
      // Get fields
      const fieldsResponse = await directusClient.get('/fields');
      const fields: Field[] = fieldsResponse.data.data;
      result.statistics.fields = fields.length;
      
      // Count fields with metadata and primary/foreign keys
      fields.forEach(field => {
        if (field.meta?.note) {
          result.metadataCompleteness.fieldsWithNotes++;
        }
        
        if (field.schema?.is_primary_key) {
          result.statistics.primaryKeys++;
        }
        
        if (field.schema?.foreign_key_table) {
          result.statistics.foreignKeys++;
        }
      });
      
      // Get relations
      const relationsResponse = await directusClient.get('/relations');
      const relations: Relation[] = relationsResponse.data.data;
      result.statistics.relations = relations.length;
      
      // Categorize relations
      relations.forEach(relation => {
        if (relation.meta?.junction_field) {
          result.relationshipAnalysis.manyToManyCount++;
          
          // Identify junction tables
          const junctionTable = relation.collection;
          if (!collections.find(c => c.collection === junctionTable)?.meta?.hidden) {
            // If the junction table is not hidden, suggest making it hidden
            result.optimizationOpportunities.push({
              level: 'info',
              message: 'Junction table could be hidden',
              collection: junctionTable,
              recommendation: `Consider setting the "${junctionTable}" collection as hidden in the meta data, as it appears to be a junction table.`
            });
          } else {
            result.statistics.junctionTables++;
          }
        } else if (relation.collection === relation.related_collection) {
          result.relationshipAnalysis.selfReferentialCount++;
        } else if (relation.meta?.one_field) {
          result.relationshipAnalysis.oneToManyCount++;
        } else {
          result.relationshipAnalysis.manyToOneCount++;
        }
      });
      
      // Step 2: Validate data integrity
      console.log('Validating data integrity...');
      
      // Check for collections without primary keys
      const collectionsWithoutPrimaryKey = collections.filter(collection => {
        // Skip system collections and junction tables
        if (collection.collection.startsWith('directus_')) return false;
        
        const hasPrimaryKey = fields.some(field => 
          field.collection === collection.collection && 
          field.schema?.is_primary_key
        );
        
        return !hasPrimaryKey;
      });
      
      collectionsWithoutPrimaryKey.forEach(collection => {
        result.issues.push({
          level: 'error',
          message: 'Collection has no primary key',
          collection: collection.collection,
          recommendation: 'Every collection should have a primary key defined for proper data integrity.'
        });
        result.valid = false;
      });
      
      // Step 3: Validate relationships
      console.log('Validating relationships...');
      
      // Check for missing or inconsistent relationships
      const fieldsByCollection: Record<string, Field[]> = {};
      fields.forEach(field => {
        if (!fieldsByCollection[field.collection]) {
          fieldsByCollection[field.collection] = [];
        }
        fieldsByCollection[field.collection].push(field);
      });
      
      // Check for foreign key fields without relations
      const foreignKeyFieldsWithoutRelations = fields.filter(field => {
        if (!field.schema?.foreign_key_table) return false;
        
        const hasRelation = relations.some(relation => 
          (relation.collection === field.collection && relation.field === field.field) ||
          (relation.related_collection === field.collection && relation.meta?.one_field === field.field)
        );
        
        return !hasRelation;
      });
      
      foreignKeyFieldsWithoutRelations.forEach(field => {
        result.relationshipAnalysis.missingRelations.push({
          level: 'warning',
          message: 'Foreign key field has no defined relation',
          collection: field.collection,
          field: field.field,
          details: {
            foreign_key_table: field.schema.foreign_key_table,
            foreign_key_column: field.schema.foreign_key_column
          },
          recommendation: `Create a relation between "${field.collection}.${field.field}" and "${field.schema.foreign_key_table}.${field.schema.foreign_key_column || 'id'}".`
        });
      });
      
      // Check for relations with missing fields
      relations.forEach(relation => {
        const collectionExists = collections.some(c => c.collection === relation.collection);
        const relatedCollectionExists = relation.related_collection ? 
          collections.some(c => c.collection === relation.related_collection) : 
          true;
        
        if (!collectionExists || !relatedCollectionExists) {
          result.relationshipAnalysis.inconsistentRelations.push({
            level: 'error',
            message: 'Relation references non-existent collection',
            relation: `${relation.collection}.${relation.field} -> ${relation.related_collection}`,
            details: relation,
            recommendation: `Remove or fix the relation between "${relation.collection}" and "${relation.related_collection}".`
          });
          result.valid = false;
        }
        
        const fieldExists = fieldsByCollection[relation.collection]?.some(f => f.field === relation.field);
        if (!fieldExists) {
          result.relationshipAnalysis.inconsistentRelations.push({
            level: 'error',
            message: 'Relation references non-existent field',
            relation: `${relation.collection}.${relation.field} -> ${relation.related_collection}`,
            details: relation,
            recommendation: `Remove or fix the relation that references the missing field "${relation.field}" in collection "${relation.collection}".`
          });
          result.valid = false;
        }
      });
      
      // Step 4: Identify optimization opportunities
      console.log('Identifying optimization opportunities...');
      
      // Check for fields with unnecessarily large varchar sizes
      fields.forEach(field => {
        if (field.schema?.data_type === 'varchar' && field.schema?.max_length && field.schema.max_length > 255) {
          // Check if the field is likely to need a large varchar
          const fieldNameIndicatesLongText = /description|content|text|body|html|json|code|detail/i.test(field.field);
          
          if (!fieldNameIndicatesLongText) {
            result.optimizationOpportunities.push({
              level: 'info',
              message: 'Field has a very large varchar size',
              collection: field.collection,
              field: field.field,
              details: {
                current_max_length: field.schema.max_length
              },
              recommendation: `Consider reducing the max length of "${field.collection}.${field.field}" from ${field.schema.max_length} to 255 characters or less if the field doesn't need to store large text.`
            });
          }
        }
      });
      
      // Check for collections without timestamps (created_at, updated_at)
      collections.forEach(collection => {
        // Skip system collections
        if (collection.collection.startsWith('directus_')) return;
        
        const hasTimestamps = fieldsByCollection[collection.collection]?.some(field => 
          ['date_created', 'date_updated', 'created_at', 'updated_at'].includes(field.field)
        );
        
        if (!hasTimestamps) {
          result.optimizationOpportunities.push({
            level: 'info',
            message: 'Collection lacks timestamp fields',
            collection: collection.collection,
            recommendation: `Consider adding "date_created" and "date_updated" fields to "${collection.collection}" for better record-keeping.`
          });
        }
      });
      
      // Check for nullable unique fields (can cause unexpected behavior)
      fields.forEach(field => {
        if (field.schema?.is_unique && field.schema?.is_nullable) {
          result.optimizationOpportunities.push({
            level: 'warning',
            message: 'Unique field is nullable',
            collection: field.collection,
            field: field.field,
            recommendation: `Consider making "${field.collection}.${field.field}" not nullable, as nullable unique fields can behave unexpectedly with multiple null values.`
          });
        }
      });
      
      // Check for collections without proper indexes
      collections.forEach(collection => {
        // Skip system collections
        if (collection.collection.startsWith('directus_')) return;
        
        const collectionFields = fieldsByCollection[collection.collection] || [];
        const hasSortField = collection.meta?.sort_field;
        
        if (hasSortField) {
          const sortFieldExists = collectionFields.some(field => field.field === hasSortField);
          
          if (!sortFieldExists) {
            result.issues.push({
              level: 'warning',
              message: 'Collection references non-existent sort field',
              collection: collection.collection,
              details: {
                sort_field: hasSortField
              },
              recommendation: `Fix the sort_field reference in "${collection.collection}" metadata, as "${hasSortField}" does not exist.`
            });
          }
        }
      });
      
      // Step 5: Check for inconsistent or unused schema components
      // Check for orphaned fields (fields without collections)
      const orphanedFields = fields.filter(field => 
        !collections.some(collection => collection.collection === field.collection)
      );
      
      orphanedFields.forEach(field => {
        result.issues.push({
          level: 'warning',
          message: 'Orphaned field without parent collection',
          field: field.field,
          collection: field.collection,
          recommendation: `Remove the field "${field.field}" or create its parent collection "${field.collection}".`
        });
      });
      
      // Count issues by severity
      const errorCount = result.issues.filter(issue => issue.level === 'error').length;
      const warningCount = result.issues.filter(issue => issue.level === 'warning').length;
      const infoCount = result.issues.filter(issue => issue.level === 'info').length;
      
      // Generate summary
      console.log(`Schema validation complete.`);
      console.log(`Found ${errorCount} errors, ${warningCount} warnings, and ${infoCount} info items.`);
      console.log(`Identified ${result.optimizationOpportunities.length} optimization opportunities.`);
      
      // Add all optimization opportunities to the issues list for a complete report
      result.issues = [...result.issues, ...result.optimizationOpportunities];
      
      return result;
    } catch (error: any) {
      console.error('Error validating schema:', error.message);
      
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      return {
        valid: false,
        issues: [{
          level: 'error',
          message: 'Failed to validate schema',
          details: error.message
        }],
        error: error.message
      };
    }
  };
  
  fn.description = 'Validate the Directus schema for integrity, constraints, optimization opportunities, and relationship consistency';
  fn.parameters = {
    type: 'object',
    properties: {}
  };
  
  return fn;
}
