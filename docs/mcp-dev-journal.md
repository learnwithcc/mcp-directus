# Directus MCP Server Development Journal

## March 2025: Resolving Collection and Field Creation Permission Issues

### Initial Problem

When developing the MCP (Model Context Protocol) server for Directus 11.5.1, we encountered persistent permission issues when attempting to create collections and fields through the API. These issues occurred despite using an admin token with what should have been full administrative privileges.

The error messages suggested that our requests were being rejected due to insufficient permissions, even though the token was correctly authenticated and belonged to an admin user. What made this particularly puzzling was that:

1. The admin token was valid and could successfully be used for retrieving data
2. The API documentation suggested our approach should work
3. We tried multiple endpoints and approaches without success

### Investigation

We conducted a systematic investigation to understand the root cause of the permission issues:

#### 1. Admin Token Verification

We confirmed that our token was valid by retrieving user information:

```bash
curl -X GET "http://localhost:8077/users/me" -H "Authorization: Bearer [token]"
```

The response confirmed we were authenticated as an admin user with appropriate roles and policies:

```json
{
  "data": {
    "id": "7a6819b5-900f-48cb-8eb1-724b5a1ba596",
    "email": "admin@example.com",
    "role": "6342966a-607f-4959-8d42-1654636a46f0",
    "status": "active",
    "policies": ["8dbe1c9b-60e0-4362-85f8-71df24b0df22", "cd0a8702-f2c4-4fb0-b00b-4c26f8bdd119"]
  }
}
```

#### 2. API Endpoint Analysis

We identified several potential issues with our API implementation:

1. **Request Format**: The request format for collection/field creation wasn't matching Directus 11.5.1's expectations. The Directus API had specific requirements for the structure of the request bodies.

2. **Multiple Fallback Approaches**: Our implementation was using multiple approaches with complex fallback logic, which made debugging difficult and could lead to unexpected behavior.

3. **Policy-Based Permissions in Directus 11.5.1**: Directus 11.5.1 uses a policy-based permission system, which requires specific settings even for admin users. We needed to ensure our admin token had the appropriate policies attached.

4. **Error Handling**: Our error handling wasn't providing sufficient details to diagnose the exact issue with API requests.

### Solution Implemented

We implemented a comprehensive solution addressing each aspect of the problem:

#### 1. Request Format Correction

We updated the collection creation endpoint to use the correct request format for Directus 11.5.1:

```typescript
// Prepare the request body according to Directus 11.5.1 schema
const requestBody = {
  collection: name,
  meta: {
    display_template: null,
    accountability: 'all',
    icon: 'box',
    note: null,
    translations: {},
    ...meta
  },
  schema: {
    name: name
  },
  fields: fields
};
```

Similarly, we updated the field creation endpoint to use the correct format:

```typescript
// Prepare the request payload according to Directus 11.5.1 API
const fieldData = {
  collection,
  field,
  type,
  meta: defaultMeta,
  schema: defaultSchema
};
```

#### 2. Simplified Implementation

We removed the complex fallback approaches in the field creation tool, focusing on one correct approach based on Directus 11.5.1 documentation. This made the code more maintainable and easier to debug.

#### 3. Enhanced Error Handling

We improved error handling to provide more detailed diagnostic information:

```typescript
if (error.response) {
  statusCode = error.response.status;
  
  console.error('Response error data:', JSON.stringify(error.response.data, null, 2));
  console.error('Response error status:', error.response.status);
  console.error('Response error headers:', error.response.headers);
  
  // Extract Directus API error details
  const directusErrors = error.response.data?.errors || [];
  errorMessage = directusErrors[0]?.message || errorMessage;
  
  // Build detailed error information
  errorDetails = {
    code: directusErrors[0]?.extensions?.code,
    path: error.response.config?.url,
    method: error.response.config?.method,
    status: error.response.status,
    statusText: error.response.statusText
  };
}
```

#### 4. Diagnostic Tool

We created a comprehensive diagnostic tool (`testConnection`) that can:
- Verify connectivity to the Directus instance
- Check authentication status
- Test permissions for collection and field operations
- Perform actual test operations to validate API access

This tool proved invaluable for diagnosing the exact permission issues and verifying that our solutions worked.

### Results and Verification

After implementing these changes, we successfully tested both collection and field creation:

```bash
# Test creating a collection
curl -X POST -H "Content-Type: application/json" -d '{"name": "test_collection_curl"}' http://localhost:3000/mcp/v1/tools/createCollection

# Test creating a field
curl -X POST -H "Content-Type: application/json" -d '{"collection": "test_collection_curl", "field": "title", "type": "string"}' http://localhost:3000/mcp/v1/tools/createField
```

Both operations completed successfully, confirming our changes had resolved the permission issues.

### Key Learnings

1. **Directus API Format Specificity**: Directus 11.5.1 requires specific request formats for schema operations. Using the exact format is critical for successful API interactions.

2. **Policy-Based Permissions**: Even admin users in Directus are governed by policies. Understanding and properly configuring these policies is essential for administrative operations.

3. **Error Handling Importance**: Detailed error handling that captures full Directus API responses is crucial for debugging permission issues.

4. **Value of Diagnostic Tools**: Creating a dedicated diagnostic tool that tests various permissions is invaluable when troubleshooting API integration issues.

5. **Code Simplicity**: Keeping the implementation simple with a single, well-documented approach is more maintainable than complex fallback strategies.

### Next Steps

Based on our learnings, we've identified several follow-up tasks:

1. **Extend Diagnostics**: Apply similar error handling improvements to the remaining tools for consistent behavior.

2. **Schema Management Tool**: Create a unified schema management tool that can handle bulk operations using the Directus schema apply endpoint.

3. **Documentation**: Create comprehensive documentation on Directus integration, including token requirements and troubleshooting advice.

4. **Error Handling Standardization**: Standardize error handling across all tools to provide consistent, detailed error information.

5. **Testing Framework**: Develop automated tests to verify API behavior against different Directus versions.

### Conclusion

The permission issues were primarily due to incorrect request formats and insufficient error diagnostics rather than actual permission configuration problems. By carefully aligning our implementation with Directus 11.5.1's API expectations and improving our error handling, we were able to successfully create collections and fields using the MCP server.

These learnings have significantly improved the robustness of the Directus MCP server implementation and established patterns for addressing similar issues in the future. 

## March 2025: Resolving the Pseudo-Collection Bug

### Issue Description

After resolving the initial field creation permission issues, we encountered a second problem that appeared to be similar to the permission issues but had a different root cause. We observed that attempting to create fields in a specific collection (`test_collection`) consistently failed with permission errors, while creating fields in other collections worked correctly.

The error messages were identical to previous permission issues, suggesting that the admin token lacked appropriate schema modification privileges. However, we had already verified that the token was correct and had the necessary permissions. The fact that field creation worked in some collections but not others hinted at a more specific issue.

### Investigation and Hypothesis

After careful analysis, we formed a hypothesis: the problematic `test_collection` was not actually a proper database collection but rather a "pseudo-collection" or folder that had been created through an incorrect method or API call. This would explain why attempts to create fields in it were failing despite having the necessary permissions.

In Directus, there's a distinction between:
1. **True collections**: Actual database tables that can store data and have fields
2. **Collection folders**: Organizational structures in the Directus UI that aren't actual database tables

Our hypothesis was that `test_collection` was created as a folder rather than a true collection, explaining why it couldn't accept field definitions.

### Testing the Hypothesis

We conducted several tests to confirm our theory:

1. **Created New Test Collections**: We created two new collections (`test_collection_2` and `test_collection_3`) using our corrected collection creation implementation.

```bash
curl -X POST -H "Content-Type: application/json" -d '{"name":"test_collection_2"}' \
  http://localhost:3000/mcp/v1/tools/createCollection
```

2. **Tested Field Creation on New Collections**: We attempted to create fields in these new collections and succeeded without any permission issues.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"collection":"test_collection_2", "field":"test_field", "type":"string"}' \
  http://localhost:3000/mcp/v1/tools/createField
```

3. **Deleted and Recreated the Original Collection**: We deleted the problematic `test_collection` using a direct API call and recreated it using our corrected implementation.

```bash
# Delete the collection
curl -X DELETE -H "Content-Type: application/json" \
  'http://localhost:8077/collections/test_collection' \
  -H "Authorization: Bearer $DIRECTUS_ADMIN_TOKEN"

# Recreate it
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"test_collection"}' \
  http://localhost:3000/mcp/v1/tools/createCollection
```

4. **Tested Field Creation on Recreated Collection**: Finally, we tested field creation on the newly recreated `test_collection`.

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"collection":"test_collection", "field":"test_field", "type":"string"}' \
  http://localhost:3000/mcp/v1/tools/createField
```

### Results and Confirmation

Our tests confirmed the hypothesis:

1. Field creation worked successfully in both newly created test collections.
2. After deleting and properly recreating the original `test_collection`, we were able to add fields to it without any permission issues.

This confirmed that the problem was not with permissions but with the nature of the collection itself. The original `test_collection` was not a valid database table but some other type of entity that couldn't accept field definitions.

### Resolution

We successfully resolved the issue by:

1. Deleting the problematic pseudo-collection using a direct API call to the Directus server.
2. Creating a new collection with the same name using our properly implemented `createCollection` tool.
3. Verifying that field creation now works correctly on the new collection.

### Key Learnings

1. **Collection Type Matters**: In Directus, entities that appear as collections in the UI may not all be true database tables. Some might be organizational folders or other types of entities.

2. **Validation Before Field Creation**: It's important to validate that a collection is actually a proper database table before attempting to add fields to it.

3. **Look Beyond the Error Message**: The error messages suggested permission issues, but the root cause was something entirely different. Always consider alternative explanations when troubleshooting.

4. **Test with Multiple Collections**: Testing the same operation on multiple collections helped identify that the issue was specific to one collection rather than a general permission problem.

5. **Recreation as Solution**: Sometimes the simplest solution is to delete and recreate the problematic entity properly rather than trying to fix it in place.

### Improvements for the Future

To prevent similar issues in the future, we should implement:

1. **Collection Validation**: Add validation to check if a collection is a true database table before attempting schema operations.

2. **Better Error Differentiation**: Enhance error handling to better differentiate between permission issues and invalid collection types.

3. **Collection Type Detection**: Implement a method to detect and report the type of a collection (true collection vs. folder) to provide clearer feedback to users.

4. **Delete Collection Tool**: Add a proper `deleteCollection` tool to the MCP server to make collection management easier.

These improvements will help ensure more robust and predictable behavior when working with Directus collections through the MCP server.

## March 2025: Implementing Collection Type Validation

### Implementation Overview

Following the discovery of the pseudo-collection bug, we've implemented a robust solution to prevent similar issues in the future. The key component is a new `validateCollection` tool that can determine whether a collection is a true database table or just a pseudo-collection/folder.

The implementation uses a multi-method approach to validation:

1. **Schema Verification**: Checking if the collection has retrievable schema information.
2. **Items Endpoint Test**: Verifying if the collection supports item retrieval operations.
3. **Metadata Analysis**: Examining collection metadata for characteristics that distinguish folders from tables.
4. **Field Creation Test (Optional)**: Creating and deleting a test field as the most definitive but invasive test.

### Tool API

The `validateCollection` tool can be invoked directly:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"collection": "test_collection"}' \
  http://localhost:3000/mcp/v1/tools/validateCollection
```

Sample response:
```json
{
  "result": {
    "collection": "test_collection",
    "tests": {
      "schema_check": { "status": "passed", "details": "Schema information is available" },
      "items_retrieval": { "status": "passed", "details": "Items retrieval is supported" },
      "metadata_analysis": { "status": "passed", "details": "Metadata includes schema information" }
    },
    "is_valid_collection": true,
    "collection_type": "table",
    "confidence": "high",
    "message": "\"test_collection\" is a valid database table",
    "validation_score": 3,
    "validation_max": 3,
    "validation_ratio": 1.0
  }
}
```

### Integration with Other Tools

The `validateCollection` tool has been integrated with the `createField` tool to automatically validate collections before attempting to create fields. This integration provides several benefits:

1. **Early Error Detection**: Identifies invalid collections before attempting schema operations.
2. **Clear Error Messages**: Provides specific error messages about collection validity instead of confusing permission errors.
3. **Prevention of Failed Operations**: Prevents operations that would fail due to collection type issues.
4. **Improved Developer Experience**: Gives clear guidance on what needs to be fixed when operations fail.

Example of integration in `createField`:

```typescript
// First, validate that this is a true collection
const validateCollectionFn = validateCollection(directusClient);
const validationResult = await validateCollectionFn({ collection });

if (validationResult.result && !validationResult.result.is_valid_collection) {
  throw new Error(
    `Cannot create field in "${collection}": ${validationResult.result.message}\n` +
    `This appears to be a pseudo-collection or folder, not a database table. ` +
    `Try deleting and recreating this collection.`
  );
}
```

### Benefits and Future Improvements

This implementation provides several key benefits:

1. **Proactive Prevention**: Issues are detected before they cause failures, improving the robustness of the MCP server.
2. **Non-Destructive Testing**: The default validation uses read-only methods that don't modify the database.
3. **Confidence Scoring**: The validation provides a confidence level about its determination.
4. **Detailed Diagnostics**: Each test produces detailed information to help diagnose issues.

Future improvements could include:

1. **Caching Results**: Implement caching of validation results to improve performance.
2. **Self-Healing**: Add automatic recreation of problematic collections when detected.
3. **Extension to Other Tools**: Integrate validation with all schema-related tools.
4. **Visual Indication**: Add visual indicators in the UI for collection types.

### Conclusion

The implementation of the `validateCollection` tool and its integration with other schema tools significantly enhances the robustness of the Directus MCP server. It prevents the recurrence of the pseudo-collection bug and provides developers with clear, actionable information when issues occur. This improvement aligns with our goals of creating a reliable, user-friendly schema management experience. 

## Session Key Takeaways

- Comprehensive error handling with detailed, structured logging is crucial for diagnosing and resolving permission and schema issues.
- Integrating collection validation into the workflow prevents pseudo-collection bugs and ensures only valid database tables are modified.
- Simplifying and aligning field and collection creation methods with Directus 11.5.1 specifications reduces complexity and improves maintainability.
- Centralized permission verification and consistent parameter validation across tools enhance overall system resilience.
- Environment configuration checks (for URL, tokens, etc.) are essential for robust operation in dev, test, and prod environments.
- Iterative improvements, thorough testing, and proactive diagnostics lead to a more reliable and user-friendly MCP server. 