# Directus MCP Server

A Model Context Protocol (MCP) server implementation for Directus CMS, enabling AI assistants like Claude to interact directly with your Directus content management system.

## Overview

This project creates a bridge between AI assistants and your Directus instance through the Model Context Protocol (MCP). It allows AI models to:

- Retrieve content from collections
- Create and update items
- Delete content
- Upload files
- Search across collections

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