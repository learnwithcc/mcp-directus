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
| testConnection | Test connection to Directus and check permissions | - |
| diagnoseMCPPermissions | Diagnose permission issues with the MCP server | - |
| validateCollection | Validate if a collection is a true database table or a pseudo-collection | collection, invasive_test (optional) |

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