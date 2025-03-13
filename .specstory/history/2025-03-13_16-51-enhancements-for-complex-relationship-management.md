## SpecStory

## Enhancements for Complex Relationship Management (3/13/2025, 4:51:24 PM)

_**User**_

Please implement the proposed enhancements from the following plan:
```
<think>The user wants a detailed plan for enhancing the codebase to handle complex relations properly and avoid failures. This is considered the highest priority since the main goal of the application is to enable users to create data models seamlessly without dealing with the underlying complexities.

Based on the test results we just saw and the provided code, there are several issues with creating and managing complex relationships in Directus, particularly Many-to-Many (M2M) relationships. Let me analyze the key issues and then create a comprehensive plan to address them.

Key issues identified:
1. When creating items in collections with M2M relationships, the system tries to access relationship fields that don't exist or aren't properly set up yet.
2. The order of operations is critical for relationship creation (collections -> fields -> relationships).
3. Error handling and recovery mechanisms need improvement.
4. ID extraction from various response formats is inconsistent.
5. There are issues with the parameters used in relationship creation functions.

I'll create a detailed plan for enhancing the codebase to address these issues, focusing on making relationship creation and management more robust and user-friendly.</think># Enhancement Plan for Robust Relationship Management in Directus MCP

Based on our comprehensive testing, I've identified several critical areas where we need to enhance the codebase to ensure complex relationships work seamlessly. The current implementation encounters issues particularly with Many-to-Many relationships and has several points of failure that need to be addressed.

## 1. Relationship Creation Workflow Improvements

### 1.1 Two-Phase Relationship Creation

**Issue:** Currently, we attempt to create relationships and their dependent fields in a single operation, which can lead to failures when the database state doesn't match expectations.

**Proposed Solution:**
- Implement a two-phase relationship creation process:
  - **Phase 1**: Create/validate all collections and basic fields
  - **Phase 2**: Establish relationships between validated collections

```typescript
// Example implementation structure
export async function createRelationshipSafely(params) {
  // Phase 1: Validate collections exist
  await validateCollectionsExist([params.collection_a, params.collection_b]);
  
  // Phase 2: Create relationship with appropriate error handling
  return createRelationship(params);
}
```

### 1.2 Progressive Relationship Builder

**Issue:** Users need to understand complex relationship parameters upfront.

**Proposed Solution:**
- Create a fluent builder pattern for relationships:

```typescript
// Example usage
const relationshipBuilder = new RelationshipBuilder()
  .fromCollection('products')
  .toCollection('categories')
  .asType('manyToOne')
  .withForeignKey('category_id')
  .build();
```

## 2. Robust Error Handling and Recovery

### 2.1 Transaction-Based Operations

**Issue:** Failed relationship operations leave the database in an inconsistent state.

**Proposed Solution:**
- Implement transaction support for multi-step operations:

```typescript
export async function createComplexRelationship(params) {
  // Begin transaction
  const transaction = await beginTransaction();
  
  try {
    // Perform multi-step operation
    // ...
    
    // Commit if successful
    await commitTransaction(transaction);
    return result;
  } catch (error) {
    // Rollback on failure
    await rollbackTransaction(transaction);
    throw enhancedError(error, 'Failed to create relationship');
  }
}
```

### 2.2 Enhanced Error Reporting

**Issue:** Error messages don't provide actionable guidance to users.

**Proposed Solution:**
- Create a domain-specific error system for relationships:

```typescript
class RelationshipError extends Error {
  constructor(message, relationshipType, collections, originalError) {
    super(`${relationshipType} relationship error between ${collections.join(' and ')}: ${message}`);
    this.originalError = originalError;
    this.relationshipType = relationshipType;
    this.collections = collections;
    this.suggestions = generateSuggestions(originalError, relationshipType);
  }
}
```

## 3. Relationship Integrity Verification

### 3.1 Pre-Operation Validation

**Issue:** Operations fail because prerequisites aren't met.

**Proposed Solution:**
- Implement comprehensive pre-operation validation:

```typescript
async function validateRelationshipPrerequisites(params) {
  // Check collections exist
  const collectionsExist = await validateCollectionsExist([params.collection_a, params.collection_b]);
  if (!collectionsExist.success) return collectionsExist;
  
  // Check required fields exist
  const fieldsExist = await validateFieldsExist(params.required_fields);
  if (!fieldsExist.success) return fieldsExist;
  
  // Check for circular dependencies
  const circularCheck = await checkForCircularDependencies(params);
  if (!circularCheck.success) return circularCheck;
  
  return { success: true };
}
```

### 3.2 Post-Operation Verification

**Issue:** Operations appear successful but don't achieve the desired result.

**Proposed Solution:**
- Add post-operation verification for each relationship type:

```typescript
async function verifyRelationshipCreation(params, result) {
  // Verify relationship exists in schema
  const schemaCheck = await checkSchemaForRelationship(params);
  
  // Verify relationship works with test data
  const testDataCheck = await testRelationshipWithData(params);
  
  return {
    success: schemaCheck.success && testDataCheck.success,
    issues: [...schemaCheck.issues, ...testDataCheck.issues]
  };
}
```

## 4. M2M Relationship-Specific Enhancements

### 4.1 Junction Collection Manager

**Issue:** M2M relationships fail because junction collections aren't properly managed.

**Proposed Solution:**
- Create a dedicated junction collection management system:

```typescript
class JunctionCollectionManager {
  async createOrValidate(params) {
    const { collectionA, collectionB, junctionName = `${collectionA}_${collectionB}` } = params;
    
    // Check if junction exists
    if (await this.exists(junctionName)) {
      return this.validate(junctionName, params);
    }
    
    // Create junction with proper fields
    return this.create(junctionName, params);
  }
  
  // Additional methods for creating proper foreign key fields, etc.
}
```

### 4.2 Deferred M2M Field Creation

**Issue:** Creating an item with M2M fields fails because the relationship isn't fully established.

**Proposed Solution:**
- Implement a two-step item creation process for M2M relationships:

```typescript
async function createItemWithM2MRelationships(params) {
  // Step 1: Create base item without M2M fields
  const baseFields = filterOutM2MFields(params.item);
  const newItem = await createItem({ ...params, item: baseFields });
  
  // Step 2: Add M2M relationships after item creation
  if (newItem.success) {
    const m2mFields = extractM2MFields(params.item);
    await addM2MRelationshipsToItem(newItem.id, m2mFields);
  }
  
  return newItem;
}
```

## 5. Consistent Response Handling

### 5.1 Response Normalizer

**Issue:** Different operation responses have inconsistent formats.

**Proposed Solution:**
- Create a response normalization layer:

```typescript
function normalizeResponse(response) {
  // Extract standard fields regardless of source format
  const id = extractId(response);
  const data = extractData(response);
  const errors = extractErrors(response);
  
  return {
    success: errors.length === 0,
    id,
    data,
    errors,
    originalResponse: response
  };
}

// Extractors handle different response formats
function extractId(response) {
  return response.result?.id || 
         response.result?.data?.id || 
         response.details?.item?.id || 
         null;
}
```

### 5.2 Enhanced Result Objects

**Issue:** Result objects don't contain enough information about the operation.

**Proposed Solution:**
- Create enhanced result objects with operation context:

```typescript
class RelationshipResult {
  constructor(success, data, operation) {
    this.success = success;
    this.data = data;
    this.operation = operation;
    this.timestamp = new Date();
    this.warnings = [];
  }
  
  addWarning(warning) {
    this.warnings.push(warning);
    return this;
  }
  
  isComplete() {
    return this.success && this.warnings.length === 0;
  }
}
```

## 6. Implementation Plan and Timeline

### Phase 1: Foundation (1-2 weeks)
1. Implement the Response Normalizer
2. Create enhanced error handling system
3. Add comprehensive validation utilities

### Phase 2: Relationship Core (2-3 weeks)
1. Implement two-phase relationship creation
2. Create the JunctionCollectionManager
3. Develop the RelationshipBuilder pattern

### Phase 3: Advanced Features (3-4 weeks)
1. Implement transaction support
2. Add comprehensive verification systems
3. Create deferred M2M field handling

### Phase 4: Testing and Documentation (1-2 weeks)
1. Update comprehensive test plan to validate enhancements
2. Create documentation for relationship creation patterns
3. Develop examples for common relationship scenarios

## 7. Code Structure Improvements

### 7.1 Relationship Module Organization

```
src/
  tools/
    relationships/
      builders/           # Builder patterns for each relationship type
      validators/         # Validation utilities 
      managers/           # Collection and field managers
      transactions/       # Transaction handling
      results/            # Result and error handling
  utils/
    normalizers/          # Response normalization
    extractors/           # Data extraction utilities
```

### 7.2 Centralized Relationship Configuration

Create a centralized configuration for relationship types, field naming conventions, and verification strategies to ensure consistency across the codebase.

## 8. User Experience Improvements

### 8.1 Relationship Status Monitoring

Implement a system to monitor and report the status of relationships, allowing users to see which relationships are functioning correctly and which need attention.

### 8.2 Guided Relationship Creation

Create a step-by-step guided process for users to create relationships, with appropriate validation at each step and clear feedback on requirements.

```

---

_**Assistant**_

<think>Let me analyze what I need to do. The user wants me to implement the enhancement plan for their Directus MCP server to improve relationship management. This is a comprehensive plan with multiple components.

First, I need to understand the current codebase structure to determine where to make these changes. I should:
1. Explore the directory structure
2. Find the current relationship management code
3. Implement the proposed enhancements

Let's start by exploring the directory structure to get a better understanding of the codebase.</think>I'll help you implement the proposed enhancements for robust relationship management in your Directus MCP server. Let's start by exploring the current codebase structure to understand where and how to implement these changes.

---

_****_

<details>
            <summary>Listed current directory • **16** results</summary>
        
| Name |
|-------|
| 📁 `.git` |
| 📁 `src` |
| 📄 `CHANGELOG.md` |
| 📁 `docs` |
| 📄 `README.md` |
| 📁 `dist` |
| 📄 `.gitignore` |
| 📄 `claude_desktop_config.json` |
| 📁 `node_modules` |
| 📄 `package-lock.json` |
| 📄 `package.json` |
| 📄 `.env` |
| 📄 `.cursorignore` |
| 📁 `.specstory` |
| 📁 `.cursor` |
| 📄 `tsconfig.json` |

</details>

---

_****_

Let's look at the source code directory to understand the current implementation:

---

_****_

<details>
            <summary>Listed directory src • **7** results</summary>
        
| Name |
|-------|
| 📄 `comprehensive-test-plan.ts` |
| 📄 `directusMCPServer.ts` |
| 📄 `test-hash-validated-m2m.ts` |
| 📁 `tools` |
| 📁 `utils` |
| 📄 `test-mcp-server.ts` |
| 📄 `index.ts` |

</details>

---

_****_

Now, let's examine the tools directory where the relationship management code is likely to be:

---

_****_

<details>
            <summary>Listed directory src/tools • **21** results</summary>
        
| Name |
|-------|
| 📄 `createHashValidatedM2M.ts` |
| 📄 `uploadFile.ts` |
| 📄 `validateSchema.ts` |
| 📄 `searchItems.ts` |
| 📄 `testConnection.ts` |
| 📄 `updateItem.ts` |
| 📄 `getItems.ts` |
| 📄 `diagnoseMCPPermissions.ts` |
| 📄 `getItem.ts` |
| 📄 `deleteItem.ts` |
| 📄 `createOneToManyRelation.ts` |
| 📄 `createOneToOneRelation.ts` |
| 📄 `createRelation.ts` |
| 📄 `createItem.ts` |
| 📄 `createManyToOneRelation.ts` |
| 📄 `createCollection.ts` |
| 📄 `deleteField.ts` |
| 📄 `createField.ts` |
| 📄 `createManyToManyRelation.ts` |
| 📄 `deleteCollection.ts` |
| 📄 `validateCollection.ts` |

</details>

---

_****_

Let's also check the utils directory:

---

_****_

<details>
            <summary>Listed directory src/utils • **7** results</summary>
        
| Name |
|-------|
| 📄 `schemaApplyWithHash.ts` |
| 📄 `create-test-m2m-alt.ts` |
| 📄 `create-test-m2m-directly.ts` |
| 📄 `setup-test-permissions.ts` |
| 📄 `permissionChecker.ts` |
| 📄 `logger.ts` |
| 📄 `paramValidation.ts` |

</details>

---

_****_

Now, let's look at the existing relationship management files to understand how they're currently implemented. Let's start with examining the createManyToManyRelation.ts file since M2M relationships seem to be a significant pain point:

---

_****_

Read file: undefined

---

_****_

Let's look at the complete rollback function:

---

_****_

Read file: undefined

---

_****_

Let's also look at the hash-validated M2M implementation which seems to be a more recent approach:

---

_****_

Read file: undefined

---

_****_

Let's also check the schema apply with hash implementation that is referenced:

---

_****_

Read file: undefined

---

_****_

Now, let's look at the implementation of the createM2MRelationWithHash function from the same file:

---

_****_

Read file: undefined

---

_****_

Let's continue reading the createM2MRelationWithHash function:

---

_****_

Read file: undefined

---

_****_

Let's continue reading the function to the end:

---

_****_

Read file: undefined

---

_****_

Let's also check the validation utilities to understand how they currently work:

---

_****_

Read file: undefined

---

_****_

Great, I now have a good understanding of the current implementation. Based on the enhancement plan and the existing code, I'll implement the proposed improvements. Let's start with creating the necessary directory structure for the relationship module organization:

---

_****_

```bash
mkdir -p src/tools/relationships/builders src/tools/relationships/validators src/tools/relationships/managers src/tools/relationships/transactions src/tools/relationships/results
```

```
relmkdir -p src/tools/relationships/builders src/tools/relationships/validators src/tools/relationships/managers s
<ationships/transactions src/tools/relationships/results


╭─     ~/dev/projects/mcp-directus     improvements !1 ?1 ···························· ✔  16:53:11   
╰─
```

---

_****_

Now, let's create the foundation modules as described in the enhancement plan. Let's start with creating the response normalizer:

---

_****_

```diff
- 
+ /**
+  * Response Normalizer for Directus API Calls
+  * 
+  * This module provides utilities for normalizing response objects from various Directus API endpoints,
+  * ensuring a consistent format for processing responses regardless of the operation.
+  */
+ 
+ import { createLogger } from '../logger';
+ 
+ const logger = createLogger({ component: 'responseNormalizer' });
+ 
+ /**
+  * Standardized response interface that all normalized responses will follow
+  */
+ export interface NormalizedResponse<T = any> {
+   success: boolean;
+   id?: string | number | null;
+   data?: T;
+   errors: string[];
+   warnings: string[];
+   originalResponse?: any;
+   operation?: string;
+   timestamp: Date;
+ }
+ 
+ /**
+  * Extracts the ID from various response formats
+  * 
+  * @param response The response object from a Directus API call
+  * @returns The extracted ID or null if no ID can be found
+  */
+ export function extractId(response: any): string | number | null {
+   if (!response) return null;
+   
+   // Try various common locations for IDs in Directus responses
+   return response.id || 
+          response.data?.id || 
+          response.result?.id || 
+          response.result?.data?.id || 
+          response.details?.item?.id || 
+          null;
+ }
+ 
+ /**
+  * Extracts the data from various response formats
+  * 
+  * @param response The response object from a Directus API call
+  * @returns The extracted data or null if no data can be found
+  */
+ export function extractData(response: any): any {
+   if (!response) return null;
+   
+   // Try various common locations for data in Directus responses
+   if (response.data) return response.data;
+   if (response.result?.data) return response.result.data;
+   if (response.result) return response.result;
+   if (response.details) return response.details;
+   
+   // If the response itself looks like data (not an error object), return it
+   if (typeof response === 'object' && !response.error && !response.errors && !response.status) {
+     return response;
+   }
+   
+   return null;
+ }
+ 
+ /**
+  * Extracts error information from various response formats
+  * 
+  * @param response The response object or error from a Directus API call
+  * @returns An array of error messages
+  */
+ export function extractErrors(response: any): string[] {
+   const errors: string[] = [];
+   
+   if (!response) return errors;
+   
+   // Handle Axios error objects
+   if (response.isAxiosError) {
+     if (response.response?.data?.errors) {
+       // Directus usually returns an errors array
+       return response.response.data.errors.map((err: any) => 
+         err.message || err.toString()
+       );
+     } else if (response.response?.data?.error) {
+       // Sometimes it returns a single error
+       return [response.response.data.error.message || response.response.data.error];
+     } else if (response.message) {
+       return [response.message];
+     }
+   }
+   
+   // Handle Directus error formats
+   if (response.errors) {
+     return Array.isArray(response.errors) 
+       ? response.errors.map((err: any) => typeof err === 'string' ? err : err.message || JSON.stringify(err))
+       : [response.errors.toString()];
+   }
+   
+   if (response.error) {
+     return [typeof response.error === 'string' ? response.error : response.error.message || JSON.stringify(response.error)];
+   }
+   
+   // Handle status-based errors
+   if (response.status === 'error' && response.message) {
+     return [response.message];
+   }
+   
+   return errors;
+ }
+ 
+ /**
+  * Normalizes a response from any Directus API call into a standardized format
+  * 
+  * @param response The response object from a Directus API call
+  * @param operation Optional description of the operation that generated this response
+  * @returns A normalized response object
+  */
+ export function normalizeResponse<T = any>(response: any, operation?: string): NormalizedResponse<T> {
+   const errors = extractErrors(response);
+   const data = extractData(response);
+   const id = extractId(response);
+   
+   // Determine success based on errors and status
+   const success = errors.length === 0 && 
+                  (!response.status || response.status === 'success' || response.status === 200);
+   
+   // Extract warnings if they exist
+   const warnings: string[] = [];
+   if (response.warnings) {
+     Array.isArray(response.warnings) 
+       ? warnings.push(...response.warnings) 
+       : warnings.push(response.warnings.toString());
+   }
+   
+   return {
+     success,
+     id,
+     data: data as T,
+     errors,
+     warnings,
+     originalResponse: response,
+     operation,
+     timestamp: new Date()
+   };
+ }
+ 
+ /**
+  * Creates a normalized error response when an exception is caught
+  * 
+  * @param error The caught error object
+  * @param operation Description of the operation that generated this error
+  * @returns A normalized error response
+  */
+ export function normalizeError<T = any>(error: any, operation?: string): NormalizedResponse<T> {
+   logger.error(`Error in operation: ${operation || 'unknown'}`, { error });
+   
+   return {
+     success: false,
+     id: null,
+     data: undefined,
+     errors: extractErrors(error) || [error.message || 'Unknown error occurred'],
+     warnings: [],
+     originalResponse: error,
+     operation,
+     timestamp: new Date()
+   };
+ } 
```

---

_****_

Now, let's create the enhanced error handling system:

---

_****_

```diff
- 
+ /**
+  * Relationship Error Handling System
+  * 
+  * This module provides specialized error classes and error handling utilities
+  * for relationship operations in Directus.
+  */
+ 
+ import { createLogger } from '../../../utils/logger';
+ 
+ const logger = createLogger({ component: 'relationshipErrors' });
+ 
+ /**
+  * The types of relationships supported in Directus
+  */
+ export type RelationshipType = 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
+ 
+ /**
+  * The different stages of a relationship creation operation
+  */
+ export type RelationshipStage = 
+   | 'validation'
+   | 'collectionCreation'
+   | 'fieldCreation'
+   | 'relationDefinition'
+   | 'verification';
+ 
+ /**
+  * Error suggestion interface for providing actionable guidance
+  */
+ export interface ErrorSuggestion {
+   message: string;
+   actionable: boolean;
+   action?: string;
+ }
+ 
+ /**
+  * Base error class for relationship errors
+  */
+ export class RelationshipError extends Error {
+   public relationshipType: RelationshipType;
+   public collections: string[];
+   public stage: RelationshipStage;
+   public originalError?: any;
+   public suggestions: ErrorSuggestion[];
+ 
+   constructor(
+     message: string,
+     relationshipType: RelationshipType,
+     collections: string[],
+     stage: RelationshipStage,
+     originalError?: any
+   ) {
+     super(`${relationshipType} relationship error between ${collections.join(' and ')} during ${stage}: ${message}`);
+     
+     this.name = 'RelationshipError';
+     this.relationshipType = relationshipType;
+     this.collections = collections;
+     this.stage = stage;
+     this.originalError = originalError;
+     this.suggestions = generateSuggestions(originalError, relationshipType, stage);
+     
+     // Log the error when it's created
+     logger.error(`${this.name}: ${this.message}`, {
+       relationshipType,
+       collections,
+       stage,
+       originalError,
+       suggestions: this.suggestions
+     });
+   }
+ }
+ 
+ /**
+  * Error class for validation-specific errors
+  */
+ export class ValidationError extends RelationshipError {
+   constructor(
+     message: string,
+     relationshipType: RelationshipType,
+     collections: string[],
+     originalError?: any
+   ) {
+     super(message, relationshipType, collections, 'validation', originalError);
+     this.name = 'ValidationError';
+   }
+ }
+ 
+ /**
+  * Error class for collection creation errors
+  */
+ export class CollectionCreationError extends RelationshipError {
+   constructor(
+     message: string,
+     relationshipType: RelationshipType,
+     collections: string[],
+     originalError?: any
+   ) {
+     super(message, relationshipType, collections, 'collectionCreation', originalError);
+     this.name = 'CollectionCreationError';
+   }
+ }
+ 
+ /**
+  * Error class for field creation errors
+  */
+ export class FieldCreationError extends RelationshipError {
+   constructor(
+     message: string,
+     relationshipType: RelationshipType,
+     collections: string[],
+     originalError?: any
+   ) {
+     super(message, relationshipType, collections, 'fieldCreation', originalError);
+     this.name = 'FieldCreationError';
+   }
+ }
+ 
+ /**
+  * Error class for relation definition errors
+  */
+ export class RelationDefinitionError extends RelationshipError {
+   constructor(
+     message: string,
+     relationshipType: RelationshipType,
+     collections: string[],
+     originalError?: any
+   ) {
+     super(message, relationshipType, collections, 'relationDefinition', originalError);
+     this.name = 'RelationDefinitionError';
+   }
+ }
+ 
+ /**
+  * Error class for verification errors
+  */
+ export class VerificationError extends RelationshipError {
+   constructor(
+     message: string,
+     relationshipType: RelationshipType,
+     collections: string[],
+     originalError?: any
+   ) {
+     super(message, relationshipType, collections, 'verification', originalError);
+     this.name = 'VerificationError';
+   }
+ }
+ 
+ /**
+  * Generates helpful suggestions based on the error
+  */
+ function generateSuggestions(
+   error: any,
+   relationshipType: RelationshipType,
+   stage: RelationshipStage
+ ): ErrorSuggestion[] {
+   const suggestions: ErrorSuggestion[] = [];
+   const errorMessage = error?.message || error?.toString() || '';
+   
+   // Common suggestions for all relationship types
+   suggestions.push({
+     message: 'Verify that the collections exist before creating a relationship',
+     actionable: true,
+     action: 'Run a collection existence check first'
+   });
+   
+   // Specific suggestions based on error message patterns
+   if (errorMessage.includes('already exists')) {
+     suggestions.push({
+       message: 'The resource already exists, which may indicate a concurrent operation or partial previous attempt',
+       actionable: true,
+       action: 'Consider using an idempotent approach or cleaning up before retrying'
+     });
+   }
+   
+   if (errorMessage.includes('foreign key constraint')) {
+     suggestions.push({
+       message: 'There is a foreign key constraint issue, likely due to missing or invalid referenced collections',
+       actionable: true,
+       action: 'Ensure that the related collections are created first and contain the required fields'
+     });
+   }
+   
+   if (errorMessage.includes('SQLITE_CONSTRAINT')) {
+     suggestions.push({
+       message: 'SQLite has strict constraints on schema modifications, especially when data exists',
+       actionable: true,
+       action: 'Consider using a transaction or backing up and recreating the collection structure'
+     });
+   }
+   
+   if (errorMessage.includes('unknown field')) {
+     suggestions.push({
+       message: 'A referenced field does not exist in the collection',
+       actionable: true,
+       action: 'Create the field before establishing the relationship'
+     });
+   }
+   
+   // Relationship-specific suggestions
+   if (relationshipType === 'manyToMany') {
+     suggestions.push({
+       message: 'Many-to-many relationships require a junction collection that may need to be created first',
+       actionable: true,
+       action: 'Ensure the junction collection exists and has the proper fields for foreign keys'
+     });
+     
+     if (stage === 'fieldCreation') {
+       suggestions.push({
+         message: 'The M2M relationship fields must be created after the junction collection and its fields',
+         actionable: true,
+         action: 'Create the junction collection and its foreign key fields before creating the relationship fields'
+       });
+     }
+   }
+   
+   if (stage === 'verification') {
+     suggestions.push({
+       message: 'The relationship structure was created but verification failed, indicating a configuration issue',
+       actionable: true,
+       action: 'Check the field configuration and options for proper interface and display settings'
+     });
+   }
+   
+   return suggestions;
+ }
+ 
+ /**
+  * Enhances an error object with more context
+  * 
+  * @param error The original error
+  * @param context Additional context information
+  * @returns A more descriptive error message
+  */
+ export function enhancedError(error: any, context: string): Error {
+   // If it's already a RelationshipError, just return it
+   if (error instanceof RelationshipError) {
+     return error;
+   }
+   
+   // Otherwise, enhance the error message
+   const enhancedMessage = `${context}: ${error.message || error.toString()}`;
+   const enhancedError = new Error(enhancedMessage);
+   
+   // Preserve the original stack if available
+   if (error.stack) {
+     enhancedError.stack = error.stack;
+   }
+   
+   return enhancedError;
+ } 
```

---

_****_

Now, let's create the enhanced result objects:

---

_****_

```diff
- 
+ /**
+  * Relationship Operation Result
+  * 
+  * This module provides a standardized result object for relationship operations,
+  * including rich context about the operation and any warnings or issues.
+  */
+ 
+ import { createLogger } from '../../../utils/logger';
+ import { NormalizedResponse } from '../../../utils/normalizers/responseNormalizer';
+ 
+ const logger = createLogger({ component: 'relationshipResult' });
+ 
+ /**
+  * Interface for relationship operation details
+  */
+ export interface RelationshipOperationDetails {
+   type: 'oneToOne' | 'oneToMany' | 'manyToOne' | 'manyToMany';
+   collections: string[];
+   fields: string[];
+   junctionCollection?: string;
+ }
+ 
+ /**
+  * Enhanced result object for relationship operations
+  */
+ export class RelationshipResult<T = any> {
+   public success: boolean;
+   public data?: T;
+   public operation: RelationshipOperationDetails;
+   public timestamp: Date;
+   public warnings: string[];
+   public errors: string[];
+   public resources: {
+     created: string[];
+     modified: string[];
+     unchanged: string[];
+     failed: string[];
+   };
+   public originalResponse?: any;
+   
+   constructor(
+     success: boolean,
+     data: T | undefined,
+     operation: RelationshipOperationDetails,
+     originalResponse?: any
+   ) {
+     this.success = success;
+     this.data = data;
+     this.operation = operation;
+     this.timestamp = new Date();
+     this.warnings = [];
+     this.errors = [];
+     this.resources = {
+       created: [],
+       modified: [],
+       unchanged: [],
+       failed: []
+     };
+     this.originalResponse = originalResponse;
+     
+     logger.info(`Relationship operation result: ${success ? 'success' : 'failure'}`, {
+       operation,
+       timestamp: this.timestamp
+     });
+   }
+   
+   /**
+    * Adds a warning message to the result
+    */
+   public addWarning(warning: string): this {
+     this.warnings.push(warning);
+     logger.warn(`Relationship operation warning: ${warning}`, {
+       operation: this.operation
+     });
+     return this;
+   }
+   
+   /**
+    * Adds an error message to the result
+    */
+   public addError(error: string): this {
+     this.errors.push(error);
+     this.success = false; // Any error means the operation is not fully successful
+     logger.error(`Relationship operation error: ${error}`, {
+       operation: this.operation
+     });
+     return this;
+   }
+   
+   /**
+    * Records a created resource
+    */
+   public addCreatedResource(resource: string): this {
+     this.resources.created.push(resource);
+     logger.debug(`Created resource: ${resource}`, {
+       operation: this.operation
+     });
+     return this;
+   }
+   
+   /**
+    * Records a modified resource
+    */
+   public addModifiedResource(resource: string): this {
+     this.resources.modified.push(resource);
+     logger.debug(`Modified resource: ${resource}`, {
+       operation: this.operation
+     });
+     return this;
+   }
+   
+   /**
+    * Records an unchanged resource (already existed)
+    */
+   public addUnchangedResource(resource: string): this {
+     this.resources.unchanged.push(resource);
+     logger.debug(`Unchanged resource: ${resource}`, {
+       operation: this.operation
+     });
+     return this;
+   }
+   
+   /**
+    * Records a failed resource operation
+    */
+   public addFailedResource(resource: string): this {
+     this.resources.failed.push(resource);
+     logger.debug(`Failed resource: ${resource}`, {
+       operation: this.operation
+     });
+     return this;
+   }
+   
+   /**
+    * Checks if the operation completed without warnings or errors
+    */
+   public isComplete(): boolean {
+     return this.success && this.warnings.length === 0;
+   }
+   
+   /**
+    * Creates a serializable version of the result for response
+    */
+   public toResponse(): any {
+     return {
+       status: this.success ? 'success' : 'error',
+       message: this.success 
+         ? `Relationship operation completed successfully${this.warnings.length > 0 ? ' with warnings' : ''}`
+         : `Relationship operation failed: ${this.errors[0] || 'Unknown error'}`,
+       details: {
+         operation: this.operation,
+         timestamp: this.timestamp,
+         warnings: this.warnings,
+         errors: this.errors,
+         resources: this.resources,
+         data: this.data
+       }
+     };
+   }
+   
+   /**
+    * Creates a RelationshipResult from a NormalizedResponse
+    */
+   public static fromNormalizedResponse<T>(
+     response: NormalizedResponse<T>,
+     operation: RelationshipOperationDetails
+   ): RelationshipResult<T> {
+     const result = new RelationshipResult<T>(
+       response.success,
+       response.data,
+       operation,
+       response.originalResponse
+     );
+     
+     // Add any errors and warnings from the normalized response
+     response.errors.forEach(error => result.addError(error));
+     response.warnings.forEach(warning => result.addWarning(warning));
+     
+     return result;
+   }
+ } 
```

---

_****_

Now, let's create the comprehensive validation utilities:

---

_****_

```diff
- 
+ /**
+  * Relationship Validators
+  * 
+  * This module provides validation utilities specific to relationship operations,
+  * ensuring that all prerequisite conditions are met before proceeding with operations.
+  */
+ 
+ import { AxiosInstance } from 'axios';
+ import { createLogger } from '../../../utils/logger';
+ import { ValidationError } from '../results/relationshipErrors';
+ import { normalizeResponse } from '../../../utils/normalizers/responseNormalizer';
+ import { RelationshipType } from '../results/relationshipErrors';
+ 
+ const logger = createLogger({ component: 'relationshipValidators' });
+ 
+ /**
+  * Interface for validation result
+  */
+ export interface ValidationResult {
+   success: boolean;
+   message: string;
+   details?: any;
+ }
+ 
+ /**
+  * Validates that collections exist before creating relationships
+  * 
+  * @param directusClient The Axios instance for Directus API
+  * @param collections Array of collection names to validate
+  * @returns Validation result
+  */
+ export async function validateCollectionsExist(
+   directusClient: AxiosInstance,
+   collections: string[]
+ ): Promise<ValidationResult> {
+   logger.info(`Validating existence of collections: ${collections.join(', ')}`);
+   
+   const nonExistentCollections: string[] = [];
+   
+   // Check each collection
+   for (const collection of collections) {
+     try {
+       const response = await directusClient.get(`/collections/${collection}`);
+       const normalized = normalizeResponse(response, `Check collection existence: ${collection}`);
+       
+       if (!normalized.success) {
+         nonExistentCollections.push(collection);
+         logger.warn(`Collection verification failed: ${collection}`, { errors: normalized.errors });
+       }
+     } catch (error) {
+       nonExistentCollections.push(collection);
+       logger.warn(`Collection does not exist: ${collection}`, { error });
+     }
+   }
+   
+   // Return validation result
+   if (nonExistentCollections.length === 0) {
+     logger.info(`All collections exist: ${collections.join(', ')}`);
+     return {
+       success: true,
+       message: 'All collections exist'
+     };
+   } else {
+     const errorMessage = `Collections do not exist: ${nonExistentCollections.join(', ')}`;
+     logger.error(errorMessage);
+     return {
+       success: false,
+       message: errorMessage,
+       details: { nonExistentCollections }
+     };
+   }
+ }
+ 
+ /**
+  * Validates fields exist in collections
+  * 
+  * @param directusClient The Axios instance for Directus API
+  * @param fieldsMap Map of collection names to field names to check
+  * @returns Validation result
+  */
+ export async function validateFieldsExist(
+   directusClient: AxiosInstance,
+   fieldsMap: Record<string, string[]>
+ ): Promise<ValidationResult> {
+   logger.info(`Validating field existence across collections`);
+   
+   const nonExistentFields: Record<string, string[]> = {};
+   
+   // Check each collection's fields
+   for (const [collection, fields] of Object.entries(fieldsMap)) {
+     try {
+       // Get all fields for this collection
+       const response = await directusClient.get(`/fields/${collection}`);
+       const normalized = normalizeResponse(response, `Get fields for collection: ${collection}`);
+       
+       if (!normalized.success) {
+         // If we can't get fields, assume all requested fields don't exist
+         nonExistentFields[collection] = [...fields];
+         logger.warn(`Could not get fields for collection: ${collection}`, { errors: normalized.errors });
+         continue;
+       }
+       
+       // Get the list of existing field names
+       const existingFieldNames = normalized.data.map((field: any) => field.field);
+       
+       // Find which of our requested fields don't exist
+       const missingFields = fields.filter(field => !existingFieldNames.includes(field));
+       
+       if (missingFields.length > 0) {
+         nonExistentFields[collection] = missingFields;
+         logger.warn(`Missing fields in collection ${collection}: ${missingFields.join(', ')}`);
+       }
+     } catch (error) {
+       // If we can't get fields, assume all requested fields don't exist
+       nonExistentFields[collection] = [...fields];
+       logger.warn(`Error checking fields for collection: ${collection}`, { error });
+     }
+   }
+   
+   // Return validation result
+   const hasNonExistentFields = Object.keys(nonExistentFields).length > 0;
+   
+   if (!hasNonExistentFields) {
+     logger.info(`All required fields exist in their respective collections`);
+     return {
+       success: true,
+       message: 'All required fields exist'
+     };
+   } else {
+     const errorMessage = `Some required fields do not exist`;
+     logger.error(errorMessage, { nonExistentFields });
+     return {
+       success: false,
+       message: errorMessage,
+       details: { nonExistentFields }
+     };
+   }
+ }
+ 
+ /**
+  * Validates that there are no circular dependencies in a relationship
+  * 
+  * @param relationshipType The type of relationship being created
+  * @param collections The collections involved in the relationship
+  * @param fieldsMap The fields involved in the relationship
+  * @returns Validation result
+  */
+ export async function checkForCircularDependencies(
+   relationshipType: RelationshipType,
+   collections: string[],
+   fieldsMap: Record<string, string[]>
+ ): Promise<ValidationResult> {
+   // For M2M relationships, check that a collection doesn't reference itself
+   if (relationshipType === 'manyToMany' && collections[0] === collections[1]) {
+     return {
+       success: false,
+       message: `Self-referential M2M relationships require special handling`,
+       details: {
+         relationshipType,
+         collections
+       }
+     };
+   }
+   
+   // In the future, this could be extended to check for longer circular dependency chains
+   
+   return {
+     success: true,
+     message: 'No circular dependencies detected'
+   };
+ }
+ 
+ /**
+  * Validates that fields don't conflict with existing fields
+  * 
+  * @param directusClient The Axios instance for Directus API
+  * @param fieldsMap Map of collection names to field names to check
+  * @returns Validation result
+  */
+ export async function validateNoFieldConflicts(
+   directusClient: AxiosInstance,
+   fieldsMap: Record<string, string[]>
+ ): Promise<ValidationResult> {
+   logger.info(`Checking for field name conflicts`);
+   
+   const conflictingFields: Record<string, string[]> = {};
+   
+   // Check each collection's fields
+   for (const [collection, fields] of Object.entries(fieldsMap)) {
+     try {
+       // Get all fields for this collection
+       const response = await directusClient.get(`/fields/${collection}`);
+       const normalized = normalizeResponse(response, `Get fields for collection: ${collection}`);
+       
+       if (!normalized.success) {
+         // If we can't get fields, we can't check for conflicts
+         logger.warn(`Could not check field conflicts for collection: ${collection}`, { errors: normalized.errors });
+         continue;
+       }
+       
+       // Get the list of existing field names
+       const existingFieldNames = normalized.data.map((field: any) => field.field);
+       
+       // Find which of our fields already exist
+       const conflictFields = fields.filter(field => existingFieldNames.includes(field));
+       
+       if (conflictFields.length > 0) {
+         conflictingFields[collection] = conflictFields;
+         logger.warn(`Field name conflicts in collection ${collection}: ${conflictFields.join(', ')}`);
+       }
+     } catch (error) {
+       // If API error occurred but it's not a 404 (collection not found), log a warning
+       if (error.response && error.response.status !== 404) {
+         logger.warn(`Error checking field conflicts for collection: ${collection}`, { error });
+       }
+     }
+   }
+   
+   // Return validation result
+   const hasConflicts = Object.keys(conflictingFields).length > 0;
+   
+   if (!hasConflicts) {
+     logger.info(`No field name conflicts detected`);
+     return {
+       success: true,
+       message: 'No field name conflicts'
+     };
+   } else {
+     const errorMessage = `Field name conflicts detected`;
+     logger.error(errorMessage, { conflictingFields });
+     return {
+       success: false,
+       message: errorMessage,
+       details: { conflictingFields }
+     };
+   }
+ }
+ 
+ /**
+  * Comprehensive validation for relationship prerequisites
+  * 
+  * @param directusClient The Axios instance for Directus API
+  * @param params The relationship parameters
+  * @returns Validation result
+  */
+ export async function validateRelationshipPrerequisites(
+   directusClient: AxiosInstance,
+   params: {
+     relationshipType: RelationshipType;
+     collections: string[];
+     fields: Record<string, string[]>;
+     junctionCollection?: string;
+   }
+ ): Promise<ValidationResult> {
+   logger.info(`Validating prerequisites for ${params.relationshipType} relationship`);
+   
+   // Step 1: Validate collections exist
+   let allCollectionsToCheck = [...params.collections];
+   if (params.junctionCollection) {
+     allCollectionsToCheck.push(params.junctionCollection);
+   }
+   
+   const collectionsValidation = await validateCollectionsExist(directusClient, allCollectionsToCheck);
+   if (!collectionsValidation.success) {
+     throw new ValidationError(
+       collectionsValidation.message,
+       params.relationshipType,
+       params.collections
+     );
+   }
+   
+   // Step 2: Check for circular dependencies
+   const circularCheck = await checkForCircularDependencies(
+     params.relationshipType, 
+     params.collections,
+     params.fields
+   );
+   if (!circularCheck.success) {
+     throw new ValidationError(
+       circularCheck.message,
+       params.relationshipType,
+       params.collections
+     );
+   }
+   
+   // Step 3: Check for field conflicts if creating new fields
+   const fieldConflicts = await validateNoFieldConflicts(directusClient, params.fields);
+   if (!fieldConflicts.success) {
+     // Field conflicts are not immediately fatal, but should be noted
+     logger.warn(`Field conflicts detected, proceeding with caution`, fieldConflicts.details);
+   }
+   
+   return {
+     success: true,
+     message: 'All prerequisites validated successfully'
+   };
+ } 
```

---

_****_

Let's fix the linter errors in the file:

---

_****_

```diff
          logger.warn(`Collection verification failed: ${collection}`, { errors: normalized.errors });
        }
-     } catch (error) {
+     } catch (error: any) {
        nonExistentCollections.push(collection);
        logger.warn(`Collection does not exist: ${collection}`, { error });
          logger.warn(`Missing fields in collection ${collection}: ${missingFields.join(', ')}`);
        }
-     } catch (error) {
+     } catch (error: any) {
        // If we can't get fields, assume all requested fields don't exist
        nonExistentFields[collection] = [...fields];
          logger.warn(`Field name conflicts in collection ${collection}: ${conflictFields.join(', ')}`);
        }
-     } catch (error) {
+     } catch (error: any) {
        // If API error occurred but it's not a 404 (collection not found), log a warning
        if (error.response && error.response.status !== 404) {
```

---

_****_

Now let's implement the Junction Collection Manager:

---

_****_

```diff
- 
+ /**
+  * Junction Collection Manager
+  * 
+  * This module provides a dedicated management system for junction collections
+  * used in many-to-many relationships. It handles creation, validation, and field
+  * management for these specialized collections.
+  */
+ 
+ import { AxiosInstance } from 'axios';
+ import { createLogger } from '../../../utils/logger';
+ import { normalizeResponse } from '../../../utils/normalizers/responseNormalizer';
+ import { CollectionCreationError, FieldCreationError } from '../results/relationshipErrors';
+ import { RelationshipResult } from '../results/relationshipResult';
+ 
+ const logger = createLogger({ component: 'junctionCollectionManager' });
+ 
+ /**
+  * Options for junction collection creation
+  */
+ export interface JunctionCollectionOptions {
+   /**
+    * Name of the first collection in the M2M relationship
+    */
+   collectionA: string;
+   
+   /**
+    * Name of the second collection in the M2M relationship
+    */
+   collectionB: string;
+   
+   /**
+    * Name for the junction collection (optional, defaults to collectionA_collectionB)
+    */
+   junctionName?: string;
+   
+   /**
+    * Whether to hide the junction collection in the admin UI (defaults to true)
+    */
+   hidden?: boolean;
+   
+   /**
+    * Icon to use for the junction collection
+    */
+   icon?: string;
+   
+   /**
+    * Display template for the junction collection
+    */
+   displayTemplate?: string;
+   
+   /**
+    * Sort field for the junction collection (defaults to null)
+    */
+   sortField?: string | null;
+   
+   /**
+    * Additional options for the junction collection
+    */
+   collectionOptions?: Record<string, any>;
+   
+   /**
+    * Options for fieldA (the foreign key to collectionA)
+    */
+   fieldAOptions?: Record<string, any>;
+   
+   /**
+    * Options for fieldB (the foreign key to collectionB)
+    */
+   fieldBOptions?: Record<string, any>;
+ }
+ 
+ /**
+  * Result of junction collection operations
+  */
+ export interface JunctionCollectionResult {
+   /**
+    * Whether the operation was successful
+    */
+   success: boolean;
+   
+   /**
+    * The name of the junction collection
+    */
+   junctionCollection: string;
+   
+   /**
+    * Whether the junction collection was newly created or existed already
+    */
+   created: boolean;
+   
+   /**
+    * The names of the foreign key fields in the junction collection
+    */
+   junctionFields: {
+     fieldA: string;
+     fieldB: string;
+   };
+   
+   /**
+    * Whether the foreign key fields were newly created
+    */
+   fieldsCreated: {
+     fieldA: boolean;
+     fieldB: boolean;
+   };
+   
+   /**
+    * Any error that occurred during the operation
+    */
+   error?: any;
+ }
+ 
+ /**
+  * Junction Collection Manager Class
+  * 
+  * Manages the lifecycle and operations for junction collections in M2M relationships
+  */
+ export class JunctionCollectionManager {
+   private directusClient: AxiosInstance;
+   
+   constructor(directusClient: AxiosInstance) {
+     this.directusClient = directusClient;
+   }
+   
+   /**
+    * Create or validate a junction collection for an M2M relationship
+    * 
+    * This method will:
+    * 1. Check if the junction collection exists
+    * 2. Create it if it doesn't exist
+    * 3. Ensure it has the proper foreign key fields
+    * 
+    * @param options Configuration options for the junction collection
+    * @returns Result of the operation
+    */
+   public async createOrValidate(options: JunctionCollectionOptions): Promise<JunctionCollectionResult> {
+     const {
+       collectionA,
+       collectionB,
+       junctionName = `${collectionA}_${collectionB}`,
+       hidden = true,
+       icon = 'import_export',
+       displayTemplate = `{{${collectionA}_id}} - {{${collectionB}_id}}`,
+       sortField = null,
+       collectionOptions = {},
+       fieldAOptions = {},
+       fieldBOptions = {}
+     } = options;
+     
+     const opLogger = createLogger({
+       component: 'junctionCollectionManager.createOrValidate',
+       collectionA,
+       collectionB,
+       junctionName
+     });
+     
+     const result: JunctionCollectionResult = {
+       success: false,
+       junctionCollection: junctionName,
+       created: false,
+       junctionFields: {
+         fieldA: `${collectionA}_id`,
+         fieldB: `${collectionB}_id`
+       },
+       fieldsCreated: {
+         fieldA: false,
+         fieldB: false
+       }
+     };
+     
+     try {
+       // Step 1: Check if the junction collection exists
+       opLogger.info(`Checking if junction collection ${junctionName} exists`);
+       const junctionExists = await this.collectionExists(junctionName);
+       
+       // Step 2: Create the junction collection if needed
+       if (!junctionExists) {
+         opLogger.info(`Junction collection ${junctionName} does not exist, creating it`);
+         try {
+           const createResult = await this.createJunctionCollection({
+             name: junctionName,
+             collectionA,
+             collectionB,
+             hidden,
+             icon,
+             displayTemplate,
+             sortField,
+             options: collectionOptions
+           });
+           
+           if (!createResult.success) {
+             throw new CollectionCreationError(
+               `Failed to create junction collection: ${createResult.error}`,
+               'manyToMany',
+               [collectionA, collectionB]
+             );
+           }
+           
+           result.created = true;
+           opLogger.info(`Junction collection ${junctionName} created successfully`);
+         } catch (error: any) {
+           opLogger.error(`Failed to create junction collection ${junctionName}`, { error });
+           result.error = error;
+           return result;
+         }
+       } else {
+         opLogger.info(`Junction collection ${junctionName} already exists`);
+       }
+       
+       // Step 3: Create or validate the foreign key fields
+       opLogger.info(`Creating or validating foreign key fields in junction collection`);
+       
+       // Field A - Foreign key to collection A
+       try {
+         const fieldAResult = await this.createForeignKeyField(
+           junctionName,
+           collectionA,
+           result.junctionFields.fieldA,
+           fieldAOptions
+         );
+         
+         result.fieldsCreated.fieldA = fieldAResult.created;
+         
+         if (!fieldAResult.success) {
+           throw new FieldCreationError(
+             `Failed to create foreign key field to ${collectionA}: ${fieldAResult.error}`,
+             'manyToMany',
+             [collectionA, collectionB]
+           );
+         }
+       } catch (error: any) {
+         opLogger.error(`Failed to create foreign key field to ${collectionA}`, { error });
+         result.error = error;
+         return result;
+       }
+       
+       // Field B - Foreign key to collection B
+       try {
+         const fieldBResult = await this.createForeignKeyField(
+           junctionName,
+           collectionB,
+           result.junctionFields.fieldB,
+           fieldBOptions
+         );
+         
+         result.fieldsCreated.fieldB = fieldBResult.created;
+         
+         if (!fieldBResult.success) {
+           throw new FieldCreationError(
+             `Failed to create foreign key field to ${collectionB}: ${fieldBResult.error}`,
+             'manyToMany',
+             [collectionA, collectionB]
+           );
+         }
+       } catch (error: any) {
+         opLogger.error(`Failed to create foreign key field to ${collectionB}`, { error });
+         result.error = error;
+         return result;
+       }
+       
+       // Success!
+       result.success = true;
+       opLogger.info(`Junction collection ${junctionName} is ready with proper foreign key fields`);
+       return result;
+     } catch (error: any) {
+       opLogger.error(`Unexpected error in junction collection creation process`, { error });
+       result.error = error;
+       return result;
+     }
+   }
+   
+   /**
+    * Check if a collection exists
+    * 
+    * @param collectionName The name of the collection to check
+    * @returns True if the collection exists
+    */
+   private async collectionExists(collectionName: string): Promise<boolean> {
+     try {
+       const response = await this.directusClient.get(`/collections/${collectionName}`);
+       const normalized = normalizeResponse(response, `Check collection existence: ${collectionName}`);
+       return normalized.success;
+     } catch (error) {
+       return false;
+     }
+   }
+   
+   /**
+    * Create a junction collection
+    * 
+    * @param params Parameters for the junction collection
+    * @returns Result of the operation
+    */
+   private async createJunctionCollection(params: {
+     name: string;
+     collectionA: string;
+     collectionB: string;
+     hidden?: boolean;
+     icon?: string;
+     displayTemplate?: string;
+     sortField?: string | null;
+     options?: Record<string, any>;
+   }): Promise<{ success: boolean; error?: any }> {
+     const {
+       name,
+       collectionA,
+       collectionB,
+       hidden = true,
+       icon = 'import_export',
+       displayTemplate = `{{${collectionA}_id}} - {{${collectionB}_id}}`,
+       sortField = null,
+       options = {}
+     } = params;
+     
+     try {
+       const response = await this.directusClient.post('/collections', {
+         collection: name,
+         meta: {
+           hidden,
+           icon,
+           display_template: displayTemplate,
+           sort_field: sortField,
+           ...options
+         },
+         schema: {
+           name
+         }
+       });
+       
+       const normalized = normalizeResponse(response, `Create junction collection: ${name}`);
+       return { success: normalized.success, error: normalized.errors.join(', ') };
+     } catch (error: any) {
+       return { success: false, error };
+     }
+   }
+   
+   /**
+    * Create a foreign key field in the junction collection
+    * 
+    * @param junctionCollection The name of the junction collection
+    * @param targetCollection The name of the collection this field references
+    * @param fieldName The name of the field to create
+    * @param options Additional options for the field
+    * @returns Result of the operation
+    */
+   private async createForeignKeyField(
+     junctionCollection: string,
+     targetCollection: string,
+     fieldName: string,
+     options: Record<string, any> = {}
+   ): Promise<{ success: boolean; created: boolean; error?: any }> {
+     // First check if the field already exists
+     try {
+       const response = await this.directusClient.get(`/fields/${junctionCollection}/${fieldName}`);
+       const normalized = normalizeResponse(response, `Check if field exists: ${junctionCollection}.${fieldName}`);
+       
+       if (normalized.success) {
+         logger.info(`Field ${fieldName} already exists in ${junctionCollection}`);
+         return { success: true, created: false };
+       }
+     } catch (error) {
+       // Field doesn't exist, we'll create it
+     }
+     
+     // Create the field
+     try {
+       const response = await this.directusClient.post(`/fields/${junctionCollection}`, {
+         field: fieldName,
+         type: 'uuid',
+         meta: {
+           hidden: false,
+           interface: 'select-dropdown-m2o',
+           display: 'related-values',
+           special: ['m2o'],
+           required: true,
+           options: options
+         },
+         schema: {
+           name: fieldName,
+           table: junctionCollection,
+           data_type: 'uuid',
+           is_nullable: false
+         }
+       });
+       
+       const normalized = normalizeResponse(response, `Create field: ${junctionCollection}.${fieldName}`);
+       
+       // Create the relation
+       if (normalized.success) {
+         try {
+           await this.directusClient.post('/relations', {
+             collection: junctionCollection,
+             field: fieldName,
+             related_collection: targetCollection,
+             schema: {
+               on_delete: 'CASCADE'
+             },
+             meta: {
+               junction_field: null
+             }
+           });
+           
+           logger.info(`Created relation from ${junctionCollection}.${fieldName} to ${targetCollection}`);
+           return { success: true, created: true };
+         } catch (relationError: any) {
+           logger.error(`Failed to create relation for ${fieldName}`, { relationError });
+           return { success: false, created: true, error: relationError };
+         }
+       } else {
+         return { success: false, created: false, error: normalized.errors.join(', ') };
+       }
+     } catch (error: any) {
+       return { success: false, created: false, error };
+     }
+   }
+   
+   /**
+    * Create a test item in the junction collection to verify it works correctly
+    * 
+    * @param params Parameters for the test item
+    * @returns Result of the verification
+    */
+   public async verifyJunctionWithTestData(params: {
+     junctionCollection: string;
+     collectionA: string;
+     collectionB: string;
+     itemIdA?: string;
+     itemIdB?: string;
+   }): Promise<{ success: boolean; message: string; details?: any }> {
+     const {
+       junctionCollection,
+       collectionA,
+       collectionB,
+       itemIdA,
+       itemIdB
+     } = params;
+     
+     // Skip test if no test IDs are provided
+     if (!itemIdA || !itemIdB) {
+       return {
+         success: true,
+         message: 'Junction verification skipped (no test item IDs provided)',
+         details: { skipped: true }
+       };
+     }
+     
+     try {
+       // Create a test junction item
+       const createResponse = await this.directusClient.post(`/items/${junctionCollection}`, {
+         [`${collectionA}_id`]: itemIdA,
+         [`${collectionB}_id`]: itemIdB
+       });
+       
+       const normalized = normalizeResponse(createResponse, `Create test junction item`);
+       
+       if (!normalized.success) {
+         return {
+           success: false,
+           message: `Failed to create test junction item: ${normalized.errors.join(', ')}`,
+           details: { errors: normalized.errors }
+         };
+       }
+       
+       // Get the created item ID
+       const junctionItemId = normalized.id;
+       
+       // Clean up after verification
+       try {
+         await this.directusClient.delete(`/items/${junctionCollection}/${junctionItemId}`);
+       } catch (cleanupError) {
+         logger.warn(`Could not clean up test junction item ${junctionItemId}`, { cleanupError });
+       }
+       
+       return {
+         success: true,
+         message: 'Junction collection successfully verified with test data',
+         details: { junctionItemId }
+       };
+     } catch (error: any) {
+       return {
+         success: false,
+         message: `Junction verification failed: ${error.message}`,
+         details: { error }
+       };
+     }
+   }
+ } 
```

---

_****_

Now, let's create the Relationship Builder pattern implementation:

---

_****_

```diff
- 
+ /**
+  * Relationship Builder
+  * 
+  * This module provides a fluent builder pattern for creating relationships in Directus,
+  * making it easier for users to specify the parameters for different relationship types.
+  */
+ 
+ import { AxiosInstance } from 'axios';
+ import { createLogger } from '../../../utils/logger';
+ import { RelationshipType } from '../results/relationshipErrors';
+ import { RelationshipResult } from '../results/relationshipResult';
+ import { JunctionCollectionManager } from '../managers/junctionCollectionManager';
+ import { validateRelationshipPrerequisites } from '../validators/relationshipValidators';
+ 
+ const logger = createLogger({ component: 'relationshipBuilder' });
+ 
+ /**
+  * Base relationship parameters interface
+  */
+ export interface BaseRelationshipParams {
+   relationshipType: RelationshipType;
+   collectionA: string;
+   collectionB: string;
+   fieldName?: string;
+   foreignKeyField?: string;
+   junctionCollection?: string;
+   fieldOptions?: Record<string, any>;
+ }
+ 
+ /**
+  * Many-to-many relationship parameters interface
+  */
+ export interface ManyToManyParams extends BaseRelationshipParams {
+   relationshipType: 'manyToMany';
+   junctionCollection: string;
+   fieldAName?: string;
+   fieldBName?: string;
+   fieldAOptions?: Record<string, any>;
+   fieldBOptions?: Record<string, any>;
+ }
+ 
+ /**
+  * One-to-many relationship parameters interface
+  */
+ export interface OneToManyParams extends BaseRelationshipParams {
+   relationshipType: 'oneToMany';
+   fieldName: string;
+   foreignKeyField: string;
+ }
+ 
+ /**
+  * Many-to-one relationship parameters interface
+  */
+ export interface ManyToOneParams extends BaseRelationshipParams {
+   relationshipType: 'manyToOne';
+   fieldName: string;
+   foreignKeyField: string;
+ }
+ 
+ /**
+  * One-to-one relationship parameters interface
+  */
+ export interface OneToOneParams extends BaseRelationshipParams {
+   relationshipType: 'oneToOne';
+   fieldName: string;
+   foreignKeyField: string;
+ }
+ 
+ /**
+  * Union type of all relationship parameter types
+  */
+ export type RelationshipParams = 
+   | ManyToManyParams
+   | OneToManyParams
+   | ManyToOneParams
+   | OneToOneParams;
+ 
+ /**
+  * Fluent builder for relationships
+  */
+ export class RelationshipBuilder {
+   private params: Partial<RelationshipParams> = {};
+   private directusClient?: AxiosInstance;
+   
+   /**
+    * Initialize the builder with a Directus client
+    * @param directusClient The Axios instance for the Directus API
+    */
+   public withClient(directusClient: AxiosInstance): this {
+     this.directusClient = directusClient;
+     return this;
+   }
+   
+   /**
+    * Set the first collection in the relationship
+    * @param collection The name of the first collection
+    */
+   public fromCollection(collection: string): this {
+     this.params.collectionA = collection;
+     return this;
+   }
+   
+   /**
+    * Set the second collection in the relationship
+    * @param collection The name of the second collection
+    */
+   public toCollection(collection: string): this {
+     this.params.collectionB = collection;
+     return this;
+   }
+   
+   /**
+    * Set the type of relationship
+    * @param type The relationship type
+    */
+   public asType(type: RelationshipType): this {
+     this.params.relationshipType = type;
+     return this;
+   }
+   
+   /**
+    * Set the field name in the "from" collection
+    * @param fieldName The name of the field
+    */
+   public withFieldName(fieldName: string): this {
+     this.params.fieldName = fieldName;
+     return this;
+   }
+   
+   /**
+    * Set the foreign key field name
+    * @param foreignKeyField The name of the foreign key field
+    */
+   public withForeignKey(foreignKeyField: string): this {
+     this.params.foreignKeyField = foreignKeyField;
+     return this;
+   }
+   
+   /**
+    * Set the junction collection name for M2M relationships
+    * @param junctionCollection The name of the junction collection
+    */
+   public withJunctionCollection(junctionCollection: string): this {
+     this.params.junctionCollection = junctionCollection;
+     return this;
+   }
+   
+   /**
+    * Set field options for the relationship
+    * @param options Field options
+    */
+   public withFieldOptions(options: Record<string, any>): this {
+     this.params.fieldOptions = options;
+     return this;
+   }
+   
+   /**
+    * For M2M: Set the field name in collection A
+    * @param fieldName The field name
+    */
+   public withFieldAName(fieldName: string): this {
+     if (this.params.relationshipType === 'manyToMany') {
+       (this.params as ManyToManyParams).fieldAName = fieldName;
+     } else {
+       logger.warn('withFieldAName is only applicable for Many-to-Many relationships');
+     }
+     return this;
+   }
+   
+   /**
+    * For M2M: Set the field name in collection B
+    * @param fieldName The field name
+    */
+   public withFieldBName(fieldName: string): this {
+     if (this.params.relationshipType === 'manyToMany') {
+       (this.params as ManyToManyParams).fieldBName = fieldName;
+     } else {
+       logger.warn('withFieldBName is only applicable for Many-to-Many relationships');
+     }
+     return this;
+   }
+   
+   /**
+    * For M2M: Set field options for field A
+    * @param options Field options
+    */
+   public withFieldAOptions(options: Record<string, any>): this {
+     if (this.params.relationshipType === 'manyToMany') {
+       (this.params as ManyToManyParams).fieldAOptions = options;
+     } else {
+       logger.warn('withFieldAOptions is only applicable for Many-to-Many relationships');
+     }
+     return this;
+   }
+   
+   /**
+    * For M2M: Set field options for field B
+    * @param options Field options
+    */
+   public withFieldBOptions(options: Record<string, any>): this {
+     if (this.params.relationshipType === 'manyToMany') {
+       (this.params as ManyToManyParams).fieldBOptions = options;
+     } else {
+       logger.warn('withFieldBOptions is only applicable for Many-to-Many relationships');
+     }
+     return this;
+   }
+   
+   /**
+    * Validate the parameters for the relationship
+    * @returns True if the parameters are valid
+    */
+   public validateParams(): boolean {
+     // Common validations
+     if (!this.params.collectionA || !this.params.collectionB) {
+       logger.error('Both collections must be specified');
+       return false;
+     }
+     
+     if (!this.params.relationshipType) {
+       logger.error('Relationship type must be specified');
+       return false;
+     }
+     
+     // Type-specific validations
+     switch (this.params.relationshipType) {
+       case 'manyToMany':
+         // M2M requires a junction collection
+         if (!this.params.junctionCollection) {
+           this.params.junctionCollection = `${this.params.collectionA}_${this.params.collectionB}`;
+           logger.info(`Auto-generated junction collection name: ${this.params.junctionCollection}`);
+         }
+         break;
+         
+       case 'oneToMany':
+       case 'manyToOne':
+       case 'oneToOne':
+         // These types require field name and foreign key
+         if (!this.params.fieldName) {
+           logger.error('Field name must be specified for this relationship type');
+           return false;
+         }
+         if (!this.params.foreignKeyField) {
+           logger.error('Foreign key field must be specified for this relationship type');
+           return false;
+         }
+         break;
+     }
+     
+     return true;
+   }
+   
+   /**
+    * Build the relationship parameters object
+    * @returns The validated relationship parameters
+    */
+   public build(): RelationshipParams {
+     if (!this.validateParams()) {
+       throw new Error('Invalid relationship parameters. Check the logs for details.');
+     }
+     
+     // Cast to appropriate type based on relationshipType
+     switch (this.params.relationshipType) {
+       case 'manyToMany':
+         return this.params as ManyToManyParams;
+       case 'oneToMany':
+         return this.params as OneToManyParams;
+       case 'manyToOne':
+         return this.params as ManyToOneParams;
+       case 'oneToOne':
+         return this.params as OneToOneParams;
+       default:
+         throw new Error(`Unknown relationship type: ${this.params.relationshipType}`);
+     }
+   }
+   
+   /**
+    * Execute the relationship creation
+    * @returns Promise resolving to the relationship result
+    */
+   public async execute(): Promise<RelationshipResult> {
+     if (!this.directusClient) {
+       throw new Error('Directus client must be set using withClient() before executing');
+     }
+     
+     const params = this.build();
+     
+     // Validate prerequisites
+     try {
+       await validateRelationshipPrerequisites(this.directusClient, {
+         relationshipType: params.relationshipType,
+         collections: [params.collectionA, params.collectionB],
+         fields: this.getFieldsMap(params),
+         junctionCollection: params.junctionCollection
+       });
+     } catch (error: any) {
+       return new RelationshipResult(
+         false,
+         undefined,
+         {
+           type: params.relationshipType,
+           collections: [params.collectionA, params.collectionB],
+           fields: [],
+           junctionCollection: params.junctionCollection
+         }
+       ).addError(`Validation failed: ${error.message}`);
+     }
+     
+     // Implement relationship creation strategies
+     switch (params.relationshipType) {
+       case 'manyToMany':
+         return this.createManyToManyRelationship(params as ManyToManyParams);
+       case 'oneToMany':
+         return this.createOneToManyRelationship(params as OneToManyParams);
+       case 'manyToOne':
+         return this.createManyToOneRelationship(params as ManyToOneParams);
+       case 'oneToOne':
+         return this.createOneToOneRelationship(params as OneToOneParams);
+       default:
+         return new RelationshipResult(
+           false,
+           undefined,
+           {
+             type: params.relationshipType as RelationshipType,
+             collections: [params.collectionA, params.collectionB],
+             fields: []
+           }
+         ).addError(`Unknown relationship type: ${params.relationshipType}`);
+     }
+   }
+   
+   /**
+    * Get a map of collections to fields for validation
+    * @param params The relationship parameters
+    * @returns A map of collection names to field names
+    */
+   private getFieldsMap(params: RelationshipParams): Record<string, string[]> {
+     const result: Record<string, string[]> = {};
+     
+     switch (params.relationshipType) {
+       case 'manyToMany':
+         const m2mParams = params as ManyToManyParams;
+         
+         const fieldAName = m2mParams.fieldAName || params.collectionB;
+         const fieldBName = m2mParams.fieldBName || params.collectionA;
+         
+         result[params.collectionA] = [fieldAName];
+         result[params.collectionB] = [fieldBName];
+         result[params.junctionCollection] = [
+           `${params.collectionA}_id`,
+           `${params.collectionB}_id`
+         ];
+         break;
+         
+       case 'oneToMany':
+         result[params.collectionA] = [params.fieldName!];
+         result[params.collectionB] = [params.foreignKeyField!];
+         break;
+         
+       case 'manyToOne':
+         result[params.collectionA] = [params.foreignKeyField!];
+         result[params.collectionB] = [params.fieldName!];
+         break;
+         
+       case 'oneToOne':
+         result[params.collectionA] = [params.fieldName!];
+         result[params.collectionB] = [params.foreignKeyField!];
+         break;
+     }
+     
+     return result;
+   }
+   
+   /**
+    * Create a Many-to-Many relationship
+    * @param params The M2M relationship parameters
+    * @returns Promise resolving to the relationship result
+    */
+   private async createManyToManyRelationship(params: ManyToManyParams): Promise<RelationshipResult> {
+     logger.info(`Creating Many-to-Many relationship between ${params.collectionA} and ${params.collectionB}`);
+     
+     const result = new RelationshipResult(
+       false,
+       undefined,
+       {
+         type: 'manyToMany',
+         collections: [params.collectionA, params.collectionB],
+         fields: [
+           params.fieldAName || params.collectionB,
+           params.fieldBName || params.collectionA
+         ],
+         junctionCollection: params.junctionCollection
+       }
+     );
+     
+     try {
+       // Step 1: Create the junction collection and fields
+       const junctionManager = new JunctionCollectionManager(this.directusClient!);
+       const junctionResult = await junctionManager.createOrValidate({
+         collectionA: params.collectionA,
+         collectionB: params.collectionB,
+         junctionName: params.junctionCollection,
+         fieldAOptions: params.fieldAOptions,
+         fieldBOptions: params.fieldBOptions
+       });
+       
+       if (!junctionResult.success) {
+         return result
+           .addError(`Failed to create junction collection: ${junctionResult.error?.message || 'Unknown error'}`)
+           .addFailedResource(`Junction collection: ${params.junctionCollection}`);
+       }
+       
+       // Record created resources
+       if (junctionResult.created) {
+         result.addCreatedResource(`Junction collection: ${params.junctionCollection}`);
+       } else {
+         result.addUnchangedResource(`Junction collection: ${params.junctionCollection}`);
+       }
+       
+       if (junctionResult.fieldsCreated.fieldA) {
+         result.addCreatedResource(`Field: ${params.junctionCollection}.${junctionResult.junctionFields.fieldA}`);
+       } else {
+         result.addUnchangedResource(`Field: ${params.junctionCollection}.${junctionResult.junctionFields.fieldA}`);
+       }
+       
+       if (junctionResult.fieldsCreated.fieldB) {
+         result.addCreatedResource(`Field: ${params.junctionCollection}.${junctionResult.junctionFields.fieldB}`);
+       } else {
+         result.addUnchangedResource(`Field: ${params.junctionCollection}.${junctionResult.junctionFields.fieldB}`);
+       }
+       
+       // Step 2: Create the M2M alias fields in the parent collections
+       const fieldAName = params.fieldAName || params.collectionB;
+       try {
+         const response = await this.directusClient!.post(`/fields/${params.collectionA}`, {
+           field: fieldAName,
+           type: 'alias',
+           meta: {
+             interface: 'list-m2m',
+             special: ['m2m'],
+             options: {
+               template: '{{id}}',
+               ...(params.fieldAOptions || {})
+             },
+             junction_field: `${params.collectionA}_id`,
+             many_collection: params.junctionCollection,
+             many_field: `${params.collectionB}_id`
+           },
+           schema: null
+         });
+         
+         result.addCreatedResource(`M2M Field: ${params.collectionA}.${fieldAName}`);
+       } catch (error: any) {
+         // If field exists, just note it
+         if (error.response?.status === 400 && error.response?.data?.errors?.some((e: any) => e.message?.includes('already exists'))) {
+           result.addUnchangedResource(`M2M Field: ${params.collectionA}.${fieldAName}`);
+           result.addWarning(`Field ${fieldAName} already exists in ${params.collectionA}`);
+         } else {
+           result.addWarning(`Could not create field ${fieldAName} in ${params.collectionA}: ${error.message}`);
+           logger.warn(`Error creating M2M field in ${params.collectionA}`, { error });
+         }
+       }
+       
+       const fieldBName = params.fieldBName || params.collectionA;
+       try {
+         const response = await this.directusClient!.post(`/fields/${params.collectionB}`, {
+           field: fieldBName,
+           type: 'alias',
+           meta: {
+             interface: 'list-m2m',
+             special: ['m2m'],
+             options: {
+               template: '{{id}}',
+               ...(params.fieldBOptions || {})
+             },
+             junction_field: `${params.collectionB}_id`,
+             many_collection: params.junctionCollection,
+             many_field: `${params.collectionA}_id`
+           },
+           schema: null
+         });
+         
+         result.addCreatedResource(`M2M Field: ${params.collectionB}.${fieldBName}`);
+       } catch (error: any) {
+         // If field exists, just note it
+         if (error.response?.status === 400 && error.response?.data?.errors?.some((e: any) => e.message?.includes('already exists'))) {
+           result.addUnchangedResource(`M2M Field: ${params.collectionB}.${fieldBName}`);
+           result.addWarning(`Field ${fieldBName} already exists in ${params.collectionB}`);
+         } else {
+           result.addWarning(`Could not create field ${fieldBName} in ${params.collectionB}: ${error.message}`);
+           logger.warn(`Error creating M2M field in ${params.collectionB}`, { error });
+         }
+       }
+       
+       // Success!
+       result.success = true;
+       logger.info(`Successfully created M2M relationship between ${params.collectionA} and ${params.collectionB}`);
+       return result;
+     } catch (error: any) {
+       logger.error(`Failed to create M2M relationship`, { error });
+       return result.addError(`Unexpected error: ${error.message}`);
+     }
+   }
+   
+   /**
+    * Create a One-to-Many relationship
+    * @param params The O2M relationship parameters
+    * @returns Promise resolving to the relationship result
+    */
+   private async createOneToManyRelationship(params: OneToManyParams): Promise<RelationshipResult> {
+     // Placeholder - to be implemented
+     // This is a simplified demonstration of the pattern
+     return new RelationshipResult(
+       false,
+       undefined,
+       {
+         type: 'oneToMany',
+         collections: [params.collectionA, params.collectionB],
+         fields: [params.fieldName, params.foreignKeyField]
+       }
+     ).addError('One-to-Many relationship creation not yet implemented');
+   }
+   
+   /**
+    * Create a Many-to-One relationship
+    * @param params The M2O relationship parameters
+    * @returns Promise resolving to the relationship result
+    */
+   private async createManyToOneRelationship(params: ManyToOneParams): Promise<RelationshipResult> {
+     // Placeholder - to be implemented
+     // This is a simplified demonstration of the pattern
+     return new RelationshipResult(
+       false,
+       undefined,
+       {
+         type: 'manyToOne',
+         collections: [params.collectionA, params.collectionB],
+         fields: [params.fieldName, params.foreignKeyField]
+       }
+     ).addError('Many-to-One relationship creation not yet implemented');
+   }
+   
+   /**
+    * Create a One-to-One relationship
+    * @param params The O2O relationship parameters
+    * @returns Promise resolving to the relationship result
+    */
+   private async createOneToOneRelationship(params: OneToOneParams): Promise<RelationshipResult> {
+     // Placeholder - to be implemented
+     // This is a simplified demonstration of the pattern
+     return new RelationshipResult(
+       false,
+       undefined,
+       {
+         type: 'oneToOne',
+         collections: [params.collectionA, params.collectionB],
+         fields: [params.fieldName, params.foreignKeyField]
+       }
+     ).addError('One-to-One relationship creation not yet implemented');
+   }
+ } 
```

---

_****_

Let's fix the linter errors in the RelationshipBuilder file:

---

_****_

```diff
          return this.params as OneToOneParams;
        default:
+         // This should never happen if validateParams passes, but TypeScript needs it
          throw new Error(`Unknown relationship type: ${this.params.relationshipType}`);
      }
          return this.createOneToOneRelationship(params as OneToOneParams);
        default:
+         // This should never happen due to the validation above, but TypeScript needs it
+         const unknownType = params.relationshipType as string;
          return new RelationshipResult(
            false,
            undefined,
            {
-             type: params.relationshipType as RelationshipType,
-             collections: [params.collectionA, params.collectionB],
+             type: 'manyToMany', // Default to a valid type for the result
+             collections: [
+               this.params.collectionA || 'unknown',
+               this.params.collectionB || 'unknown'
+             ],
              fields: []
            }
-         ).addError(`Unknown relationship type: ${params.relationshipType}`);
+         ).addError(`Unknown relationship type: ${unknownType}`);
      }
    }
```

---

_****_

Let's fix the remaining linter error:

---

_****_

```diff
        default:
          // This should never happen due to the validation above, but TypeScript needs it
-         const unknownType = params.relationshipType as string;
          return new RelationshipResult(
            false,
              fields: []
            }
-         ).addError(`Unknown relationship type: ${unknownType}`);
+         ).addError(`Unknown relationship type: ${String(params)}`);
      }
    }
```

---

_****_

Now, let's create a simple wrapper function for deferred M2M field creation to address the issue when creating items with M2M fields:

---

_****_

```diff
- 
+ /**
+  * Deferred M2M Field Management
+  * 
+  * This module provides utilities for handling M2M fields during item creation,
+  * which often fails when trying to set M2M fields directly during initial item creation.
+  */
+ 
+ import { AxiosInstance } from 'axios';
+ import { createLogger } from '../../../utils/logger';
+ import { normalizeResponse } from '../../../utils/normalizers/responseNormalizer';
+ 
+ const logger = createLogger({ component: 'deferredM2MFields' });
+ 
+ /**
+  * Interface for deferred M2M field
+  */
+ export interface DeferredM2MField {
+   /**
+    * Field name in the item
+    */
+   field: string;
+   
+   /**
+    * IDs to associate with the item through the M2M relationship
+    */
+   ids: string[] | number[];
+ }
+ 
+ /**
+  * Interface for parameters for creating an item with M2M relationships
+  */
+ export interface CreateItemWithM2MParams {
+   /**
+    * Collection to create the item in
+    */
+   collection: string;
+   
+   /**
+    * Base item data without M2M fields
+    */
+   item: Record<string, any>;
+   
+   /**
+    * M2M fields to add after item creation
+    */
+   m2mFields?: DeferredM2MField[];
+ }
+ 
+ /**
+  * Create an item with M2M relationships using a two-step process
+  * 
+  * This function addresses the issue where creating items with M2M fields directly often fails
+  * because the relationship may not be fully established yet. It:
+  * 1. Creates the base item without M2M fields
+  * 2. Updates the item to add the M2M relationships
+  *
+  * @param directusClient The Axios instance for the Directus API
+  * @param params Parameters for item creation
+  * @returns Result of the operation with the created item
+  */
+ export async function createItemWithM2MRelationships(
+   directusClient: AxiosInstance,
+   params: CreateItemWithM2MParams
+ ): Promise<{ success: boolean; id?: string | number; data?: any; errors: string[] }> {
+   const { collection, item, m2mFields = [] } = params;
+   
+   // Step 1: Prepare base item by filtering out M2M fields
+   const baseFields = { ...item };
+   
+   // Remove any M2M fields from the base item to avoid creation failures
+   for (const m2mField of m2mFields) {
+     delete baseFields[m2mField.field];
+   }
+   
+   try {
+     // Step 2: Create the base item
+     logger.info(`Creating item in ${collection} without M2M fields`);
+     const createResponse = await directusClient.post(`/items/${collection}`, baseFields);
+     const createResult = normalizeResponse(createResponse, `Create base item in ${collection}`);
+     
+     if (!createResult.success || !createResult.id) {
+       logger.error(`Failed to create item in ${collection}`, { errors: createResult.errors });
+       return {
+         success: false,
+         errors: createResult.errors
+       };
+     }
+     
+     const newItemId = createResult.id;
+     logger.info(`Created item in ${collection} with ID: ${newItemId}`);
+     
+     // If no M2M fields, return the result directly
+     if (m2mFields.length === 0) {
+       return {
+         success: true,
+         id: newItemId,
+         data: createResult.data,
+         errors: []
+       };
+     }
+     
+     // Step 3: Add M2M relationships
+     const m2mUpdates: Record<string, any> = {};
+     let hasM2MFields = false;
+     
+     for (const m2mField of m2mFields) {
+       if (m2mField.ids && m2mField.ids.length > 0) {
+         m2mUpdates[m2mField.field] = m2mField.ids;
+         hasM2MFields = true;
+       }
+     }
+     
+     // If there are M2M fields to update
+     if (hasM2MFields) {
+       logger.info(`Updating item ${newItemId} with M2M fields: ${Object.keys(m2mUpdates).join(', ')}`);
+       
+       try {
+         const updateResponse = await directusClient.patch(`/items/${collection}/${newItemId}`, m2mUpdates);
+         const updateResult = normalizeResponse(updateResponse, `Update item with M2M fields`);
+         
+         if (!updateResult.success) {
+           logger.warn(`Item created but M2M fields could not be added`, { 
+             itemId: newItemId, 
+             errors: updateResult.errors 
+           });
+           
+           return {
+             success: true, // We consider this a partial success
+             id: newItemId,
+             data: createResult.data,
+             errors: [`M2M fields could not be added: ${updateResult.errors.join(', ')}`]
+           };
+         }
+         
+         logger.info(`Successfully added M2M fields to item ${newItemId}`);
+         return {
+           success: true,
+           id: newItemId,
+           data: updateResult.data,
+           errors: []
+         };
+       } catch (error: any) {
+         logger.warn(`Item created but M2M fields could not be added`, { 
+           itemId: newItemId, 
+           error: error.message 
+         });
+         
+         return {
+           success: true, // We consider this a partial success
+           id: newItemId,
+           data: createResult.data,
+           errors: [`M2M fields could not be added: ${error.message}`]
+         };
+       }
+     }
+     
+     // Return the result if no actual M2M fields to update
+     return {
+       success: true,
+       id: newItemId,
+       data: createResult.data,
+       errors: []
+     };
+   } catch (error: any) {
+     logger.error(`Error creating item with M2M relationships`, { error });
+     return {
+       success: false,
+       errors: [error.message || 'Unknown error occurred']
+     };
+   }
+ }
+ 
+ /**
+  * Helper function to extract M2M fields from an item
+  * 
+  * @param item The item data
+  * @param m2mFieldNames Names of fields that are M2M relationships
+  * @returns Array of deferred M2M fields
+  */
+ export function extractM2MFields(
+   item: Record<string, any>,
+   m2mFieldNames: string[]
+ ): DeferredM2MField[] {
+   const m2mFields: DeferredM2MField[] = [];
+   
+   for (const fieldName of m2mFieldNames) {
+     if (fieldName in item && Array.isArray(item[fieldName])) {
+       m2mFields.push({
+         field: fieldName,
+         ids: item[fieldName]
+       });
+     }
+   }
+   
+   return m2mFields;
+ }
+ 
+ /**
+  * Add M2M relationships to an existing item
+  * 
+  * @param directusClient The Axios instance for the Directus API
+  * @param collection Collection name
+  * @param itemId ID of the item to update
+  * @param m2mFields M2M fields to add
+  * @returns Result of the operation
+  */
+ export async function addM2MRelationshipsToItem(
+   directusClient: AxiosInstance,
+   collection: string,
+   itemId: string | number,
+   m2mFields: DeferredM2MField[]
+ ): Promise<{ success: boolean; data?: any; errors: string[] }> {
+   if (m2mFields.length === 0) {
+     return { success: true, errors: [] };
+   }
+   
+   const updates: Record<string, any> = {};
+   
+   for (const m2mField of m2mFields) {
+     if (m2mField.ids && m2mField.ids.length > 0) {
+       updates[m2mField.field] = m2mField.ids;
+     }
+   }
+   
+   if (Object.keys(updates).length === 0) {
+     return { success: true, errors: [] };
+   }
+   
+   try {
+     logger.info(`Adding M2M relationships to ${collection}/${itemId}: ${Object.keys(updates).join(', ')}`);
+     const response = await directusClient.patch(`/items/${collection}/${itemId}`, updates);
+     const result = normalizeResponse(response, `Add M2M relationships to item`);
+     
+     if (!result.success) {
+       return {
+         success: false,
+         errors: result.errors
+       };
+     }
+     
+     return {
+       success: true,
+       data: result.data,
+       errors: []
+     };
+   } catch (error: any) {
+     logger.error(`Error adding M2M relationships to item`, { error, collection, itemId });
+     return {
+       success: false,
+       errors: [error.message || 'Unknown error occurred']
+     };
+   }
+ } 
```

---

_****_

Now, let's also create a simple post-operation verification system to validate that the relationship works:

---

_****_

```diff
- 
+ /**
+  * Relationship Verification
+  * 
+  * This module provides utilities for verifying relationships after they have been created,
+  * ensuring they work properly with test data.
+  */
+ 
+ import { AxiosInstance } from 'axios';
+ import { createLogger } from '../../../utils/logger';
+ import { normalizeResponse } from '../../../utils/normalizers/responseNormalizer';
+ import { RelationshipType } from '../results/relationshipErrors';
+ 
+ const logger = createLogger({ component: 'relationshipVerification' });
+ 
+ /**
+  * Interface for relationship verification issues
+  */
+ export interface VerificationIssue {
+   type: 'error' | 'warning';
+   message: string;
+   details?: any;
+ }
+ 
+ /**
+  * Interface for relationship verification result
+  */
+ export interface VerificationResult {
+   success: boolean;
+   issues: VerificationIssue[];
+   details: any;
+ }
+ 
+ /**
+  * Interface for test data used in verification
+  */
+ export interface RelationshipTestData {
+   itemA?: { id: string | number; [key: string]: any };
+   itemB?: { id: string | number; [key: string]: any };
+   junctionItems?: Array<{ [key: string]: any }>;
+ }
+ 
+ /**
+  * Verify a relationship by testing it with data
+  * 
+  * @param directusClient The Axios instance for the Directus API
+  * @param params Parameters for the verification
+  * @returns Verification result
+  */
+ export async function verifyRelationshipWithData(
+   directusClient: AxiosInstance,
+   params: {
+     relationshipType: RelationshipType;
+     collectionA: string;
+     collectionB: string;
+     fieldA?: string;
+     fieldB?: string;
+     junctionCollection?: string;
+     testData?: RelationshipTestData;
+   }
+ ): Promise<VerificationResult> {
+   const {
+     relationshipType,
+     collectionA,
+     collectionB,
+     fieldA,
+     fieldB,
+     junctionCollection,
+     testData
+   } = params;
+   
+   const result: VerificationResult = {
+     success: false,
+     issues: [],
+     details: {}
+   };
+   
+   // If no test data is provided, we can't verify with data
+   if (!testData) {
+     result.issues.push({
+       type: 'warning',
+       message: 'No test data provided for relationship verification'
+     });
+     return result;
+   }
+   
+   // Strategy depends on the relationship type
+   switch (relationshipType) {
+     case 'manyToMany':
+       return verifyManyToManyRelationship(directusClient, {
+         collectionA,
+         collectionB,
+         fieldA: fieldA!,
+         fieldB: fieldB!,
+         junctionCollection: junctionCollection!,
+         testData
+       });
+       
+     case 'oneToMany':
+       return verifyOneToManyRelationship(directusClient, {
+         collectionA,
+         collectionB,
+         fieldA: fieldA!,
+         fieldB: fieldB!,
+         testData
+       });
+       
+     case 'manyToOne':
+       return verifyManyToOneRelationship(directusClient, {
+         collectionA,
+         collectionB,
+         fieldA: fieldA!,
+         fieldB: fieldB!,
+         testData
+       });
+       
+     case 'oneToOne':
+       return verifyOneToOneRelationship(directusClient, {
+         collectionA,
+         collectionB,
+         fieldA: fieldA!,
+         fieldB: fieldB!,
+         testData
+       });
+       
+     default:
+       result.issues.push({
+         type: 'error',
+         message: `Unknown relationship type: ${relationshipType}`
+       });
+       return result;
+   }
+ }
+ 
+ /**
+  * Verify a Many-to-Many relationship
+  * 
+  * @param directusClient The Axios instance for the Directus API
+  * @param params Parameters for the verification
+  * @returns Verification result
+  */
+ async function verifyManyToManyRelationship(
+   directusClient: AxiosInstance,
+   params: {
+     collectionA: string;
+     collectionB: string;
+     fieldA: string;
+     fieldB: string;
+     junctionCollection: string;
+     testData: RelationshipTestData;
+   }
+ ): Promise<VerificationResult> {
+   const {
+     collectionA,
+     collectionB,
+     fieldA,
+     fieldB,
+     junctionCollection,
+     testData
+   } = params;
+   
+   const result: VerificationResult = {
+     success: true,
+     issues: [],
+     details: {}
+   };
+   
+   // Step 1: Check that we have test data
+   if (!testData.itemA || !testData.itemB) {
+     result.issues.push({
+       type: 'warning',
+       message: 'Missing test items for M2M relationship verification'
+     });
+     result.success = false;
+     return result;
+   }
+   
+   try {
+     // Step 2: Create a junction item to link the test items
+     const junctionData = {
+       [`${collectionA}_id`]: testData.itemA.id,
+       [`${collectionB}_id`]: testData.itemB.id
+     };
+     
+     let junctionItemId: string | number | undefined;
+     
+     try {
+       logger.info(`Creating test junction item between ${collectionA}/${testData.itemA.id} and ${collectionB}/${testData.itemB.id}`);
+       const createResponse = await directusClient.post(`/items/${junctionCollection}`, junctionData);
+       const createResult = normalizeResponse(createResponse, `Create test junction item`);
+       
+       if (!createResult.success || !createResult.id) {
+         result.issues.push({
+           type: 'error',
+           message: `Failed to create junction item: ${createResult.errors.join(', ')}`,
+           details: { createResult }
+         });
+         result.success = false;
+       } else {
+         junctionItemId = createResult.id;
+         result.details.junctionItemId = junctionItemId;
+         logger.info(`Created junction item with ID: ${junctionItemId}`);
+       }
+     } catch (error: any) {
+       result.issues.push({
+         type: 'error',
+         message: `Error creating junction item: ${error.message}`,
+         details: { error }
+       });
+       result.success = false;
+     }
+     
+     // If we successfully created a junction item, try to fetch related items
+     if (junctionItemId) {
+       // Step 3: Check if we can retrieve item A and see item B in its M2M field
+       try {
+         const itemAResponse = await directusClient.get(`/items/${collectionA}/${testData.itemA.id}`, {
+           params: {
+             fields: `*,${fieldA}.*`
+           }
+         });
+         
+         const itemAResult = normalizeResponse(itemAResponse, `Get item A with M2M field`);
+         
+         if (!itemAResult.success) {
+           result.issues.push({
+             type: 'error',
+             message: `Failed to retrieve item A with M2M field: ${itemAResult.errors.join(', ')}`,
+             details: { itemAResult }
+           });
+           result.success = false;
+         } else {
+           // Check if the M2M field contains item B
+           const m2mField = itemAResult.data[fieldA];
+           if (!m2mField || !Array.isArray(m2mField) || !m2mField.some((item: any) => item.id === testData.itemB.id)) {
+             result.issues.push({
+               type: 'error',
+               message: `Item A's M2M field does not contain item B`,
+               details: { m2mField }
+             });
+             result.success = false;
+           } else {
+             logger.info(`Item A's M2M field correctly contains item B`);
+             result.details.itemAVerified = true;
+           }
+         }
+       } catch (error: any) {
+         result.issues.push({
+           type: 'error',
+           message: `Error retrieving item A with M2M field: ${error.message}`,
+           details: { error }
+         });
+         result.success = false;
+       }
+       
+       // Step 4: Check if we can retrieve item B and see item A in its M2M field
+       try {
+         const itemBResponse = await directusClient.get(`/items/${collectionB}/${testData.itemB.id}`, {
+           params: {
+             fields: `*,${fieldB}.*`
+           }
+         });
+         
+         const itemBResult = normalizeResponse(itemBResponse, `Get item B with M2M field`);
+         
+         if (!itemBResult.success) {
+           result.issues.push({
+             type: 'error',
+             message: `Failed to retrieve item B with M2M field: ${itemBResult.errors.join(', ')}`,
+             details: { itemBResult }
+           });
+           result.success = false;
+         } else {
+           // Check if the M2M field contains item A
+           const m2mField = itemBResult.data[fieldB];
+           if (!m2mField || !Array.isArray(m2mField) || !m2mField.some((item: any) => item.id === testData.itemA.id)) {
+             result.issues.push({
+               type: 'error',
+               message: `Item B's M2M field does not contain item A`,
+               details: { m2mField }
+             });
+             result.success = false;
+           } else {
+             logger.info(`Item B's M2M field correctly contains item A`);
+             result.details.itemBVerified = true;
+           }
+         }
+       } catch (error: any) {
+         result.issues.push({
+           type: 'error',
+           message: `Error retrieving item B with M2M field: ${error.message}`,
+           details: { error }
+         });
+         result.success = false;
+       }
+       
+       // Step 5: Clean up the test junction item
+       try {
+         logger.info(`Cleaning up test junction item ${junctionItemId}`);
+         await directusClient.delete(`/items/${junctionCollection}/${junctionItemId}`);
+       } catch (cleanupError: any) {
+         logger.warn(`Could not clean up test junction item ${junctionItemId}`, { cleanupError });
+         result.issues.push({
+           type: 'warning',
+           message: `Could not clean up test junction item: ${cleanupError.message}`,
+           details: { cleanupError }
+         });
+       }
+     }
+     
+     // Final result
+     if (result.success) {
+       logger.info(`M2M relationship between ${collectionA} and ${collectionB} verified successfully`);
+     } else {
+       logger.warn(`M2M relationship verification has issues`, { issues: result.issues });
+     }
+     
+     return result;
+   } catch (error: any) {
+     logger.error(`Error verifying M2M relationship`, { error });
+     return {
+       success: false,
+       issues: [{
+         type: 'error',
+         message: `Error verifying M2M relationship: ${error.message}`,
+         details: { error }
+       }],
+       details: {}
+     };
+   }
+ }
+ 
+ /**
+  * Verify a One-to-Many relationship
+  * 
+  * @param directusClient The Axios instance for the Directus API
+  * @param params Parameters for the verification
+  * @returns Verification result
+  */
+ async function verifyOneToManyRelationship(
+   directusClient: AxiosInstance,
+   params: {
+     collectionA: string;
+     collectionB: string;
+     fieldA: string;
+     fieldB: string;
+     testData: RelationshipTestData;
+   }
+ ): Promise<VerificationResult> {
+   // Placeholder - to be implemented
+   // This is a simplified demonstration of the pattern
+   return {
+     success: false,
+     issues: [{
+       type: 'warning',
+       message: 'One-to-Many relationship verification not yet implemented'
+     }],
+     details: {}
+   };
+ }
+ 
+ /**
+  * Verify a Many-to-One relationship
+  * 
+  * @param directusClient The Axios instance for the Directus API
+  * @param params Parameters for the verification
+  * @returns Verification result
+  */
+ async function verifyManyToOneRelationship(
+   directusClient: AxiosInstance,
+   params: {
+     collectionA: string;
+     collectionB: string;
+     fieldA: string;
+     fieldB: string;
+     testData: RelationshipTestData;
+   }
+ ): Promise<VerificationResult> {
+   // Placeholder - to be implemented
+   // This is a simplified demonstration of the pattern
+   return {
+     success: false,
+     issues: [{
+       type: 'warning',
+       message: 'Many-to-One relationship verification not yet implemented'
+     }],
+     details: {}
+   };
+ }
+ 
+ /**
+  * Verify a One-to-One relationship
+  * 
+  * @param directusClient The Axios instance for the Directus API
+  * @param params Parameters for the verification
+  * @returns Verification result
+  */
+ async function verifyOneToOneRelationship(
+   directusClient: AxiosInstance,
+   params: {
+     collectionA: string;
+     collectionB: string;
+     fieldA: string;
+     fieldB: string;
+     testData: RelationshipTestData;
+   }
+ ): Promise<VerificationResult> {
+   // Placeholder - to be implemented
+   // This is a simplified demonstration of the pattern
+   return {
+     success: false,
+     issues: [{
+       type: 'warning',
+       message: 'One-to-One relationship verification not yet implemented'
+     }],
+     details: {}
+   };
+ } 
```

---

_****_

Let's fix the linter errors in the verification file:

---

_****_



---

_****_

Let's try to fix the linter errors again:

---

_****_

```diff
      return result;
    }
+   
+   // Now we know both itemA and itemB exist
+   const itemA = testData.itemA;
+   const itemB = testData.itemB;
    
    try {
      // Step 2: Create a junction item to link the test items
      const junctionData = {
-       [`${collectionA}_id`]: testData.itemA.id,
-       [`${collectionB}_id`]: testData.itemB.id
+       [`${collectionA}_id`]: itemA.id,
+       [`${collectionB}_id`]: itemB.id
      };
      
      let junctionItemId: string | number | undefined;
      
      try {
-       logger.info(`Creating test junction item between ${collectionA}/${testData.itemA.id} and ${collectionB}/${testData.itemB.id}`);
+       logger.info(`Creating test junction item between ${collectionA}/${itemA.id} and ${collectionB}/${itemB.id}`);
        const createResponse = await directusClient.post(`/items/${junctionCollection}`, junctionData);
        const createResult = normalizeResponse(createResponse, `Create test junction item`);
        // Step 3: Check if we can retrieve item A and see item B in its M2M field
        try {
-         const itemAResponse = await directusClient.get(`/items/${collectionA}/${testData.itemA.id}`, {
+         const itemAResponse = await directusClient.get(`/items/${collectionA}/${itemA.id}`, {
            params: {
              fields: `*,${fieldA}.*`
            // Check if the M2M field contains item B
            const m2mField = itemAResult.data[fieldA];
-           if (!m2mField || !Array.isArray(m2mField) || !m2mField.some((item: any) => item.id === testData.itemB.id)) {
+           if (!m2mField || !Array.isArray(m2mField) || !m2mField.some((item: any) => item.id === itemB.id)) {
              result.issues.push({
                type: 'error',
        // Step 4: Check if we can retrieve item B and see item A in its M2M field
        try {
-         const itemBResponse = await directusClient.get(`/items/${collectionB}/${testData.itemB.id}`, {
+         const itemBResponse = await directusClient.get(`/items/${collectionB}/${itemB.id}`, {
            params: {
              fields: `*,${fieldB}.*`
            // Check if the M2M field contains item A
            const m2mField = itemBResult.data[fieldB];
-           if (!m2mField || !Array.isArray(m2mField) || !m2mField.some((item: any) => item.id === testData.itemA.id)) {
+           if (!m2mField || !Array.isArray(m2mField) || !m2mField.some((item: any) => item.id === itemA.id)) {
              result.issues.push({
                type: 'error',
```

---

_****_



Great! The changes were successfully applied. I've fixed the linter errors by:

1. Adding a null check at the beginning of the function to verify that both `testData.itemA` and `testData.itemB` exist
2. Creating local variables `itemA` and `itemB` after the null check, which allows TypeScript to know these values are defined
3. Using these local variables throughout the rest of the function instead of directly accessing `testData.itemA` and `testData.itemB`

This approach ensures that:
- We properly handle cases where test data might be missing
- We return early with appropriate error messages if the test data is incomplete
- TypeScript can correctly infer that the variables are defined in the rest of the function
- The code is more readable with shorter variable names

Let's check if there are any other linter errors or issues we need to address in the relationship verification system.

---

_****_

```bash
cd /Users/cryophobic/dev/projects/mcp-directus && npm run lint
```

```


╭─     ~/dev/projects/mcp-directus     improvements !1 ?1 ···························· ✔  16:53:11   
❯ cd /Users/cryophobic/dev/projects/mcp-directus && npm run lint
npm error Missing script: "lint"
npm error
npm error Did you mean this?
npm error   npm link # Symlink a package folder
npm error
npm error To see a list of scripts, run:
npm error   npm run
npm error A complete log of this run can be found in: /Users/cryophobic/.npm/_logs/2025-03-13T21_13_09_915Z-debug-
0.log

╭─     ~/dev/projects/mcp-directus     improvements !1 ?3 ·························· 1 ✘  17:13:10   
╰─
```

---

_****_

I see that there's no `lint` script defined in the project. Let's check what scripts are available:

---

_****_

```bash
npm run
```

```
❯ npm run
Lifecycle scripts included in directus-mcp-server@1.0.0:
  start
    node dist/index.js
  test
    echo "Error: no test specified" && exit 1
available via `npm run-script`:
  build
    tsc
  dev
    nodemon --exec ts-node src/index.ts

╭─     ~/dev/projects/mcp-directus     improvements !1 ?3 ···························· ✔  17:13:13   
╰─
```

---

_****_

Let's check if TypeScript is showing any errors in our verification file:

---

_****_

```bash
npx tsc --noEmit src/tools/relationships/validators/relationshipVerification.ts
```

```


╭─     ~/dev/projects/mcp-directus     improvements !1 ?3 ···························· ✔  17:13:13   
❯ npx tsc --noEmit src/tools/relationships/validators/relationshipVerification.ts

╭─     ~/dev/projects/mcp-directus     improvements !1 ?3 ···························· ✔  17:13:18   
╰─
```

---

_****_



---



---

