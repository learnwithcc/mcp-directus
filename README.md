# Directus MCP Server

A Model Context Protocol (MCP) server implementation for Directus CMS, enabling AI assistants like Claude to interact directly with your Directus content management system.

## Overview

This project creates a bridge between AI assistants and your Directus instance through the Model Context Protocol (MCP). It allows AI models to:

- Retrieve content from collections
- Create and update items
- Delete content
- Upload files
- Search across collections
- Create and manage collections and fields
- Validate collection types and structures

The server exposes Directus functionality as callable tools that AI models can use to perform operations on your behalf.

## Recent Improvements

The MCP server has been enhanced with several key improvements:

- **TypeScript Strict Mode**: Enhanced type safety with enabled strict mode and additional type checking
- **Policy Management Tools**: New comprehensive tooling for managing access policies and roles
- **Standardized Tool Implementation**: All tools now follow a consistent pattern with proper validation, logging, and response formatting
- **Transaction-like Rollback**: Complex operations like creating relationships now have rollback capabilities if any step fails
- **Improved Error Handling**: Detailed error messages with specific guidance based on HTTP status codes
- **Enhanced Logging**: Comprehensive logging throughout each operation's lifecycle, with two specialized logging utilities:
  - **Context-Aware Logger** (`logger.ts`): Advanced logging for tools and components with context tracking, debug mode, and structured formatting
  - **File-Based Logger** (`logging.ts`): Simple but effective file-based logging for server operations and tests
- **Special Collection Handling**: Proper handling of Directus system collections (users, files, roles)
- **Robust Schema Operations**: New hash-validated approach for schema changes with proper retry logic and idempotent operations
- **Better M2M Relationship Creation**: Enhanced support for complex relationships using the schema/apply endpoint

See the [Implementation Improvements](./docs/implementation-improvements.md) document for more details.

## Logging System

The MCP server implements a dual-logging system to handle different logging needs:

### Context-Aware Logger (`logger.ts`)

The advanced logging utility designed for internal tools and components:

- Context-aware logging with support for requestId, tool, and component tracking
- Debug mode configuration based on environment
- Structured log formatting with timestamps
- Specialized logging functions (debug, info, warn, error)
- Object logging with proper JSON formatting
- Logger factory for creating component-specific loggers

Example usage:
```typescript
// Basic usage
import { info, error } from './utils/logger';
info('Operation completed');
error('Operation failed', new Error('Details'));

// With context
import { createLogger } from './utils/logger';
const logger = createLogger({ component: 'MyTool' });
logger.info('Starting operation', { requestId: 'req123' });
```

### File-Based Logger (`logging.ts`)

A simpler logging utility focused on server-level and test output:

- Automatic log directory creation and management
- Configurable file and console output
- Basic log levels (info, warn, error, debug)
- Timestamp-based log formatting
- Multiple log files support (server.log, server_output.log)

Example usage:
```typescript
import { log, logToFile, clearLogFile } from './utils/logging';

// Basic logging
log('Server started');

// With log level
log('error', 'Operation failed');

// With options
log('Processing request', {
  level: 'info',
  console: true,
  file: true,
  logFile: 'custom.log'
});

// Direct file logging
logToFile('Custom message', 'custom.log', 'info');
```

The dual-logging system ensures that both application-level events and tool-specific operations are properly tracked and logged in the most appropriate format.

## Prerequisites

- Node.js version 18 or higher
- A running Directus instance (local or remote)
- Admin token for your Directus instance

## Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/directus-mcp-server.git
   cd directus-mcp-server
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Configure your environment variables by creating a `.env` file:
   ```
   PORT=3000
   DIRECTUS_URL=http://localhost:8077
   DIRECTUS_ADMIN_TOKEN=your_admin_token_here
   ```

   Replace `your_admin_token_here` with your actual Directus admin token. You can obtain this from your Directus admin panel under Settings > API Access Tokens.

4. Build the project:
   ```
   npm run build
   ```

5. Start the server:
   ```
   npm start
   ```

The server will start running at http://localhost:3000 (or whatever port you specified).

## Available Tools

The MCP server exposes the following tools:

| Tool Name | Description | Required Parameters |
|-----------|-------------|---------------------|
| getItems | Get multiple items from a collection | collection, query (optional) |
| getItem | Get a single item by ID | collection, id |
| createItem | Create a new item | collection, item |
| updateItem | Update an existing item | collection, id, item |
| deleteItem | Delete an item | collection, id |
| uploadFile | Upload a file to Directus | fileContent, fileName |
| searchItems | Search for items in a collection | collection, searchQuery |
| createCollection | Create a new collection | name, fields (optional) |
| createField | Create a new field in a collection | collection, field, type |
| createRelation | Create a relation between collections | collection, field, related_collection |
| createManyToManyRelation | Create a many-to-many relation | collections, fields |
| createHashValidatedM2M | Create a many-to-many relation with hash validation | collection_a, collection_b, junction_collection (optional), field_a_name (optional), field_b_name (optional) |
| createOneToManyRelation | Create a one-to-many relation | one_collection, many_collection, foreign_key_field, one_field_name (optional) |
| createManyToOneRelation | Create a many-to-one relation | many_collection, one_collection, foreign_key_field |
| createOneToOneRelation | Create a one-to-one relation | collection_a, collection_b, field_name, enforce_uniqueness (optional) |
| createAccessPolicy | Create a new access policy | name, description (optional), app_access, admin_access (optional) |
| createRole | Create a new role | name, description (optional), icon (optional) |
| assignPolicyToRole | Assign policies to a role | roleId, policyIds |
| improvedAssignPolicyToRole | Enhanced policy assignment with multiple approaches | roleId, policyIds, useExperimentalApproaches (optional) |
| deleteCollection | Delete a collection from Directus | name, force (optional) |
| deleteField | Delete a field from a collection | collection, field |
| testConnection | Test connection to Directus and check permissions | - |
| diagnoseMCPPermissions | Diagnose permission issues with the MCP server | - |
| validateCollection | Validate if a collection is a true database table or a pseudo-collection | collection, invasive_test (optional) |

## Standardized Response Format

All tools now return responses in a consistent format:

### Success Response
```json
{
  "status": "success",
  "message": "Human-readable success message",
  "details": {
    "collection": "example_collection",
    "id": "1234",
    "item": {...}
  }
}
```

### Error Response
```json
{
  "status": "error",
  "message": "Permission denied. Ensure your token has appropriate read permissions for 'example_collection'.",
  "details": {
    "collection": "example_collection",
    "statusCode": 403,
    "errorDetails": {...}
  }
}
```

## Collection Validation

The `validateCollection` tool is a powerful addition that helps prevent issues when working with Directus collections. It can determine whether a collection is a true database table (that can accept field definitions) or just a pseudo-collection/folder (that cannot accept fields but appears in the UI).

### Usage

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"collection": "your_collection_name"}' \
  http://localhost:3000/mcp/v1/tools/validateCollection
```

Optional parameters:
- `invasive_test` (boolean): Whether to use potentially destructive tests like creating a test field. Default: false.

### Response

The tool returns detailed validation results:

```json
{
  "result": {
    "collection": "your_collection_name",
    "tests": {
      "schema_check": { "status": "passed", "details": "Schema information is available" },
      "items_retrieval": { "status": "passed", "details": "Items retrieval is supported" },
      "metadata_analysis": { "status": "passed", "details": "Metadata includes schema information" }
    },
    "is_valid_collection": true,
    "collection_type": "table",
    "confidence": "high",
    "message": "\"your_collection_name\" is a valid database table",
    "validation_score": 3,
    "validation_max": 3,
    "validation_ratio": 1.0
  }
}
```

## Collection Deletion

The `deleteCollection` tool allows you to safely delete collections from your Directus instance.

### Usage

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name": "your_collection_name"}' \
  http://localhost:3000/mcp/v1/tools/deleteCollection
```

Optional parameters:
- `force` (boolean): Whether to attempt force deletion even if the collection isn't empty. Default: false.

### Response

The tool returns a deletion status:

```json
{
  "result": {
    "status": "success",
    "message": "Collection \"your_collection_name\" deleted successfully",
    "collection": "your_collection_name"
  }
}
```

### Error Handling

The tool provides helpful error messages for common situations:

- Attempting to delete system collections (starting with `directus_`)
- Permission denied (403)
- Collection not found (404)
- Dependencies or constraints preventing deletion (409)

If you encounter constraint errors, you may need to delete related fields or collections first, or modify your schema to remove constraints.

## Connecting to AI Clients

### Claude Desktop

1. Locate your Claude Desktop configuration file
2. Add the following configuration:

```json
{
  "mcpServers": {
    "directus-mcp": {
      "url": "http://localhost:3000/mcp/v1",
      "description": "Directus CMS Integration",
      "enabled": true
    }
  }
}
```

3. Restart Claude Desktop

### Cursor

1. Open the Command Palette (Cmd+Shift+P on Mac, Ctrl+Shift+P on Windows/Linux)
2. Go to Cursor Settings > MCP
3. Click "Add a new MCP server"
4. Enter a name like "Directus MCP"
5. For the command, enter: `node path/to/your/directus-mcp-server/dist/index.js`
6. For the URL, enter: `http://localhost:3000/mcp/v1`
7. Click "Add" to save the configuration

### Windsurf

1. Go to the Cascade panel on the right-hand side
2. Click "Configure MCP"
3. Add your MCP server configuration to the JSON file:
```json
{
  "mcpServers": {
    "directus-mcp": {
      "url": "http://localhost:3000/mcp/v1",
      "description": "Directus CMS Integration"
    }
  }
}
```
4. Save and refresh servers

## Usage Examples

Once connected, you can ask Claude or any other AI assistant that supports MCP to interact with your Directus instance. Here are some example prompts:

- "Get me the first 5 users from my Directus instance"
- "Create a new article in the 'articles' collection with the title 'Hello World'"
- "Update the user with ID '123' to have the first name 'John'"
- "Delete the article with ID '456'"
- "Search for articles containing the keyword 'technology'"
- "Create a new collection called 'products' in Directus"
- "Add a 'price' field of type 'decimal' to the 'products' collection"
- "Check if 'products' is a valid database collection or just a folder"

## Development

For development, you can use the following commands:

- `npm run dev` - Start the server in development mode with hot reloading
- `npm run build` - Build the project
- `npm start` - Start the built server

## Troubleshooting

### 403 Forbidden Errors

If you encounter 403 Forbidden errors when making requests to Directus:

1. Check that your admin token is correct and has the necessary permissions
2. Verify that the token has not expired
3. Ensure that the collection you're trying to access exists and is accessible

### Pseudo-Collection Issues

If you encounter permission errors when trying to create fields in a collection, it might be a "pseudo-collection" or folder rather than a true database table. Use the `validateCollection` tool to verify:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"collection": "problematic_collection"}' \
  http://localhost:3000/mcp/v1/tools/validateCollection
```

If validation confirms it's not a valid database table, you'll need to:

1. Delete the pseudo-collection using a direct API call to Directus
2. Recreate it properly using the createCollection tool
3. Verify that field creation now works correctly

### Connection Issues

If you're having trouble connecting to your Directus instance:

1. Make sure your Directus instance is running
2. Verify that the URL in your .env file is correct
3. Check for any network issues or firewalls that might be blocking connections

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Acknowledgements

This project builds on the work of the Directus team and the Model Context Protocol (MCP) specification by Anthropic.

## Recent Updates and Improvements

### New Specialized Relationship Tools

The MCP server now includes dedicated tools for creating specific types of relationships:

#### One-to-Many (O2M) Relationships
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "one_collection": "departments",
    "many_collection": "employees",
    "foreign_key_field": "department_id",
    "one_field_name": "employees"
  }' \
  http://localhost:3000/mcp/v1/tools/createOneToManyRelation
```

#### Many-to-One (M2O) Relationships
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "many_collection": "employees",
    "one_collection": "departments",
    "foreign_key_field": "department_id"
  }' \
  http://localhost:3000/mcp/v1/tools/createManyToOneRelation
```

#### One-to-One (O2O) Relationships
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "collection_a": "user",
    "collection_b": "profile",
    "field_name": "profile_id",
    "enforce_uniqueness": true
  }' \
  http://localhost:3000/mcp/v1/tools/createOneToOneRelation
```

#### Many-to-Many (M2M) Relationships
The M2M relationship tool has been improved with:
- Better error handling and validation
- Automatic rollback on failure
- Improved junction collection management
- Support for custom field names
- Proper cleanup of resources on failure

#### Hash-Validated M2M Relationships
A new approach for creating M2M relationships with schema hash validation:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "collection_a": "products",
    "collection_b": "categories",
    "junction_collection": "products_categories",
    "field_a_name": "products",
    "field_b_name": "categories"
  }' \
  http://localhost:3000/mcp/v1/tools/createHashValidatedM2M
```

This tool provides:
- Schema integrity protection using hash validation
- Idempotent operations (safe to retry)
- Proper schema diff generation
- Comprehensive error handling
- Detailed logging throughout the process
- Fallback to direct API calls if needed

See the [Schema Operations](./docs/schema-operations.md) document for more details on the hash validation approach.

### Enhanced Error Handling and Logging

- Comprehensive error handling with detailed error messages
- Transaction-like operations with rollback capability
- Improved logging with context-specific information
- Better validation of collection and field names
- Proper resource tracking for rollback operations

### Field Management

New field management capabilities have been added:

#### Field Deletion
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{
    "collection": "your_collection",
    "field": "field_to_delete"
  }' \
  http://localhost:3000/mcp/v1/tools/deleteField
```

The field deletion tool includes:
- Safe deletion of fields with proper cleanup
- Validation of system collection access
- Detailed error reporting
- Permission verification

## Policy Management Tools

The MCP server now includes comprehensive tools for managing access policies and roles in Directus. These tools help automate the creation and assignment of policies to roles, with fallback options for manual configuration when needed.

### Available Policy Tools

- **createAccessPolicy**: Create new access policies with customizable permissions
- **createRole**: Create new roles for user management
- **assignPolicyToRole**: Basic tool for assigning policies to roles
- **improvedAssignPolicyToRole**: Enhanced tool that tries multiple approaches for policy assignment

### CLI Tool

A command-line interface tool is provided for interactive policy management:

```bash
# Run the CLI tool
npx ts-node src/cli/policy-management.ts
```

Available commands:
- `list-policies` - List all existing access policies
- `list-roles` - List all existing roles
- `create-policy` - Create a new access policy
- `create-role` - Create a new role
- `assign-policies` - Assign policies to a role

For detailed information about the policy management tools, see [README-policy-management.md](./README-policy-management.md).

### Known Issues

When assigning policies to roles programmatically, you may encounter `403 Forbidden` errors even with an admin token. The tools include fallback approaches and provide clear instructions for manual assignment through the Directus admin interface when needed.

## Changelog

This project follows [Semantic Versioning](https://semver.org/). For a complete list of changes, please see the [CHANGELOG.md](./CHANGELOG.md) file.

### Recent Updates

#### Version 1.1.1 (2025-03-15)
- Added comprehensive dual-logging system with context-aware and file-based loggers
- Improved documentation and code organization

#### Version 1.1.0 (2025-03-13)
- Added comprehensive policy management tools
- Implemented CLI tool for policy and role management
- Enhanced schema operations with hash validation

#### Version 1.0.0 (2025-03-12)
- Initial release with basic CRUD operations
- Collection and field management
- Relationship creation tools 