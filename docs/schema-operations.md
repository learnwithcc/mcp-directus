# Schema Operations in the Directus MCP Server

This document explains how schema operations are handled in the Directus MCP Server, with a focus on our improved approach for complex operations like creating many-to-many (M2M) relationships.

## Hash-Validated Schema Operations

When applying schema changes to a Directus instance, it's critical to ensure that the schema hasn't changed between when a diff is generated and when that diff is applied. This is particularly important in environments where multiple users or processes might be making schema changes concurrently.

Our implementation uses schema hash validation to ensure schema integrity:

1. Get the current schema snapshot from Directus
2. Generate a cryptographic hash of the schema
3. Create a schema diff based on desired changes
4. Apply the schema changes with the hash included
5. If a hash mismatch occurs, retry the operation

This approach provides several benefits:
- Prevents accidental data corruption from concurrent schema modifications
- Allows for safe retries in case of conflicts
- Better error handling with specific messages for different failure scenarios

## Improved M2M Relationship Creation

Creating many-to-many relationships is one of the most complex schema operations in Directus. Our improved implementation provides a more robust approach:

### The `createHashValidatedM2M` Tool

This tool creates a proper many-to-many relationship between two collections with the following steps:

1. **Input Validation**: Validates all input parameters and checks that collections exist
2. **Junction Collection Creation**: Creates the junction collection if it doesn't exist
3. **Field Creation**: Creates ID fields in the junction collection for both sides of the relationship
4. **Relation Creation**: Creates the relational connections between collections
5. **Visualization Fields**: Creates the M2M alias fields in both parent collections

### Fallback Mechanism

While we aim to use the schema/apply endpoint for optimal consistency, our implementation includes a fallback to direct API calls when needed. This ensures reliability across different Directus versions and configurations.

### Error Handling and Idempotency

The implementation handles errors gracefully:
- Provides detailed error messages with context
- Is idempotent - can be called multiple times safely
- Warns about existing fields/relations rather than failing
- Cleans up partial creations in case of failure

## When to Use Which Tool

We provide multiple tools for relationship creation to suit different needs:

- **createHashValidatedM2M**: Use for mission-critical M2M relationships where schema integrity is paramount
- **createManyToManyRelation**: Use for standard M2M relationship creation in non-concurrent environments
- **createRelation**: Use for simple relation creation between just two fields

## Implementation Details

The hash validation mechanism works as follows:

```typescript
async function applySchemaChanges(directusClient, schemaChanges, options = {}) {
  // Get current schema and generate hash
  const currentSchema = await getSchemaSnapshot(directusClient);
  const schemaHash = generateSchemaHash(currentSchema);
  
  // Generate diff with hash
  const diff = await generateSchemaDiff(directusClient, schemaChanges);
  
  // Apply the diff with hash validation
  const payload = {
    ...diff,
    hash: schemaHash
  };
  
  await directusClient.post('/schema/apply', payload);
}
```

## Future Improvements

We're continuously working to improve schema operations in the MCP server:

- **Snapshot-based schema operations**: Using schema snapshots for complete schema configuration management
- **Schema migrations**: Support for creating and running schema migrations
- **Database-specific optimizations**: Tailoring schema operations for specific database engines
- **Transaction support**: Adding transaction support for operations where database supports it 