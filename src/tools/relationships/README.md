# Relationship Management Module

## Overview

The Relationship Management Module provides a comprehensive solution for creating, managing, and verifying relationships in Directus. It addresses many of the challenges and edge cases encountered when working with relationships in the Directus API, particularly for Many-to-Many relationships.

This module is part of the Directus MCP (Model Context Protocol) server implementation and provides a more robust approach to relationship management compared to direct API calls.

## Key Features

- **Fluent Builder Pattern**: Easy-to-use API for creating relationships
- **Junction Collection Management**: Simplified creation and configuration of junction collections
- **Two-Phase M2M Creation**: Reliable creation of items with M2M relationships
- **Comprehensive Validation**: Pre-validation of all relationship prerequisites
- **Robust Error Handling**: Detailed error reporting and suggestions
- **Relationship Verification**: Runtime testing of relationships with sample data
- **Transaction Support**: (Planned) Safe rollback of failed operations

## Directory Structure

```
src/tools/relationships/
├── README.md                          # This file
├── builders/                          # Relationship builder components
│   └── relationshipBuilder.ts         # Fluent builder pattern implementation
├── managers/                          # Specialized component managers
│   ├── deferredM2MFields.ts           # Two-phase M2M field creation
│   └── junctionCollectionManager.ts   # Junction collection handling
├── results/                           # Result and error handling
│   ├── relationshipErrors.ts          # Specialized error classes
│   └── relationshipResult.ts          # Standardized result objects
├── transactions/                      # Transaction support components
│   └── ...                            # (Planned)
└── validators/                        # Validation utilities
    ├── relationshipValidators.ts      # Pre-operation validation
    └── relationshipVerification.ts    # Post-operation verification
```

## Usage Examples

### Creating a Many-to-Many Relationship

```typescript
import { RelationshipBuilder } from './tools/relationships/builders/relationshipBuilder';

// Initialize the builder with a Directus client
const builder = new RelationshipBuilder()
  .withClient(directusClient)
  .fromCollection('products')
  .toCollection('categories')
  .asType('manyToMany')
  .withJunctionCollection('products_categories')
  .withFieldAName('categories')
  .withFieldBName('products');

// Execute the relationship creation
const result = await builder.execute();

if (result.success) {
  console.log('M2M relationship created successfully');
  console.log('Created resources:', result.resources.created);
} else {
  console.error('Failed to create relationship:', result.errors);
}
```

### Creating an Item with M2M Relationships

```typescript
import { createItemWithM2MRelationships } from './tools/relationships/managers/deferredM2MFields';

const result = await createItemWithM2MRelationships(directusClient, {
  collection: 'products',
  item: {
    name: 'New Product',
    description: 'Product description',
    price: 99.99
  },
  m2mFields: [
    {
      field: 'categories',
      ids: ['category1-id', 'category2-id']
    }
  ]
});

if (result.success) {
  console.log(`Product created with ID: ${result.id}`);
} else {
  console.error('Failed to create product:', result.errors);
}
```

### Verifying a Relationship

```typescript
import { verifyRelationshipWithData } from './tools/relationships/validators/relationshipVerification';

const verificationResult = await verifyRelationshipWithData(directusClient, {
  relationshipType: 'manyToMany',
  collectionA: 'products',
  collectionB: 'categories',
  fieldA: 'categories',
  fieldB: 'products',
  junctionCollection: 'products_categories',
  testData: {
    itemA: { id: 'product-id' },
    itemB: { id: 'category-id' }
  }
});

if (verificationResult.success) {
  console.log('Relationship verified successfully');
} else {
  console.log('Relationship verification found issues:');
  verificationResult.issues.forEach(issue => {
    console.log(`- ${issue.type}: ${issue.message}`);
  });
}
```

## Common Challenges Addressed

This module addresses several common challenges when working with Directus relationships:

1. **Junction Collection Creation**: Automating the creation of junction collections with proper configuration.
2. **Field Order Dependencies**: Handling the order of operations when creating related fields.
3. **M2M Field Creation Timing**: Solving the issue where M2M fields can't be set during initial item creation.
4. **Relationship Verification**: Testing relationships with actual data to ensure they work as expected.
5. **Error Diagnostics**: Providing detailed error information and suggestions when things go wrong.

## Best Practices

- Always validate prerequisites before creating relationships
- Use the two-phase approach for creating items with M2M relationships
- Verify relationships with test data after creation
- Use meaningful junction collection and field names
- Consider adding proper cascade behaviors for your use case
- Clean up test data after verification

## Future Enhancements

- Full transaction support for safe rollback
- Support for additional relationship types and configurations
- Integration with schema snapshot/migration tools
- Performance optimizations for bulk operations
- Enhanced validation for complex relationship structures

## Contributing

When enhancing this module, please follow these guidelines:

1. Maintain comprehensive documentation
2. Add tests for new functionality
3. Follow the existing architectural patterns
4. Handle edge cases and provide detailed error reporting
5. Consider backward compatibility 