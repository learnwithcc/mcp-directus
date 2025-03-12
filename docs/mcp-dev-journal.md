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