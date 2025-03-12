# Building a Directus MCP Server: Comprehensive Implementation Guide

Directus, a powerful headless CMS, can be extended with Model Context Protocol (MCP) server capabilities to enable seamless AI integrations. This guide provides detailed steps to build a custom MCP server that interfaces with your Directus instance, enabling AI models like Claude to interact directly with your content management system. As of March 2025, this integration represents the cutting edge of AI-CMS interoperability.

## Introduction to Directus and MCP Integration

Model Context Protocol (MCP) was introduced by Anthropic to standardize how AI models interact with external systems. An MCP server for Directus would allow AI assistants to retrieve content, manage collections, upload media, and perform administrative tasks within your Directus instance. This integration opens possibilities for AI-assisted content management, automated workflows, and intelligent data processing.

MCP follows a client-server architecture where MCP clients create communication links between hosts and MCP servers[^5]. In this implementation, we'll build a custom MCP server that exposes Directus functionality as callable functions that AI models can use.

## Prerequisites

Before beginning, ensure you have:

1. Node.js version 18 or higher installed
2. Docker and Docker Compose for running Directus
3. Basic familiarity with TypeScript and RESTful APIs
4. An understanding of the Directus data model
5. Git for version control
6. npm or pnpm package manager

## Setting Up a Directus Instance

First, let's set up a Directus instance using Docker Compose, which will serve as the CMS our MCP server will interact with.

### Create the Directory Structure

Create a new directory for your project and set up the necessary subdirectories:

```
mkdir directus-mcp
cd directus-mcp
mkdir directus
cd directus
mkdir database uploads extensions
```


### Configure Docker Compose

Create a `docker-compose.yml` file in the `directus` directory with the following content:

```
services:
  directus:
    image: directus/directus:11.3.2
    ports:
      - 8055:8055
    volumes:
      - ./database:/directus/database
      - ./uploads:/directus/uploads
      - ./extensions:/directus/extensions
    environment:
      SECRET: "replace-with-random-value"
      ADMIN_EMAIL: "admin@example.com"
      ADMIN_PASSWORD: "d1r3ctu5"
      DB_CLIENT: "sqlite3"
      DB_FILENAME: "/directus/database/data.db"
      WEBSOCKETS_ENABLED: "true"
```

This Docker Compose configuration sets up Directus with SQLite as the database for simplicity. The configuration maps the database, uploads, and extensions directories to local folders for persistence and includes essential environment variables[^2].

### Start Directus

Navigate to the `directus` directory and start the container:

```
docker compose up -d
```

Once running, Directus should be accessible at http://localhost:8055. Log in with the admin credentials specified in the Docker Compose file to ensure everything is working correctly.

## Setting Up the MCP Server Project

With Directus running, we'll now set up our MCP server project structure.

### Create Project Directory

Return to the root directory and create a new directory for the MCP server:

```
cd ..
mkdir directus-mcp-server
cd directus-mcp-server
```


### Initialize the Project

Initialize a new Node.js project:

```
npm init -y
```

Install the necessary dependencies:

```
npm install --save-dev typescript @types/node ts-node nodemon
npm install axios dotenv express
```

Create a `tsconfig.json` file:

```
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "**/*.test.ts"]
}
```


## Implementing the MCP Server

Now we'll create the core files for our MCP server that will interface with Directus.

### Create the Directory Structure

Set up the source directory structure:

```
mkdir -p src/tools src/resources src/utils
```


### Create the MCP Server Core

Create a file `src/index.ts` as the entry point:

```typescript
import express from 'express';
import dotenv from 'dotenv';
import { DirectusMCPServer } from './directusMCPServer';

dotenv.config();

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8055';
const directusToken = process.env.DIRECTUS_ADMIN_TOKEN || '';

if (!directusToken) {
  console.error('DIRECTUS_ADMIN_TOKEN is required');
  process.exit(1);
}

const mcpServer = new DirectusMCPServer(directusUrl, directusToken);

// MCP list endpoint
app.get('/mcp/v1/tools', (req, res) => {
  res.json(mcpServer.listTools());
});

// MCP invoke endpoint
app.post('/mcp/v1/tools/:tool', async (req, res) => {
  const { tool } = req.params;
  const params = req.body;
  
  try {
    const result = await mcpServer.invokeTool(tool, params);
    res.json(result);
  } catch (error) {
    console.error(`Error invoking tool ${tool}:`, error);
    res.status(500).json({ error: 'Failed to invoke tool' });
  }
});

app.listen(port, () => {
  console.log(`Directus MCP server running at http://localhost:${port}`);
});
```


### Create the MCP Server Class

Create a file `src/directusMCPServer.ts`:

```typescript
import axios from 'axios';
import { getItems } from './tools/getItems';
import { getItem } from './tools/getItem';
import { createItem } from './tools/createItem';
import { updateItem } from './tools/updateItem';
import { deleteItem } from './tools/deleteItem';
import { uploadFile } from './tools/uploadFile';
import { searchItems } from './tools/searchItems';

export class DirectusMCPServer {
  private directusUrl: string;
  private directusToken: string;
  private tools: Record<string, Function>;

  constructor(directusUrl: string, directusToken: string) {
    this.directusUrl = directusUrl;
    this.directusToken = directusToken;
    
    // Initialize the Directus client
    const directusClient = axios.create({
      baseURL: this.directusUrl,
      headers: {
        'Authorization': `Bearer ${this.directusToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Register tools
    this.tools = {
      getItems: getItems(directusClient),
      getItem: getItem(directusClient),
      createItem: createItem(directusClient),
      updateItem: updateItem(directusClient),
      deleteItem: deleteItem(directusClient),
      uploadFile: uploadFile(directusClient),
      searchItems: searchItems(directusClient)
    };
  }

  listTools() {
    // Format the tools according to MCP specification
    return {
      tools: Object.entries(this.tools).map(([name, fn]) => ({
        name,
        description: fn.description || `Directus ${name} operation`,
        parameters: fn.parameters || {}
      }))
    };
  }

  async invokeTool(toolName: string, params: any) {
    if (!this.tools[toolName]) {
      throw new Error(`Tool ${toolName} not found`);
    }
    
    try {
      const result = await this.tools[toolName](params);
      return { result };
    } catch (error) {
      console.error(`Error in ${toolName}:`, error);
      throw error;
    }
  }
}
```


### Implement MCP Tool Functions

Now, let's implement each tool function to interact with Directus. Create the following files:

**src/tools/getItems.ts**:

```typescript
import { AxiosInstance } from 'axios';

export function getItems(directusClient: AxiosInstance) {
  /**
   * Get multiple items from a collection
   * @param collection The collection name to retrieve items from
   * @param query Optional query parameters (limit, filter, sort, etc.)
   * @returns Array of items from the specified collection
   */
  const fn = async ({ collection, query = {} }) => {
    try {
      const response = await directusClient.get(`/items/${collection}`, { params: query });
      return response.data.data;
    } catch (error) {
      console.error('Error getting items:', error);
      throw error;
    }
  };
  
  fn.description = 'Get multiple items from a Directus collection';
  fn.parameters = {
    type: 'object',
    required: ['collection'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection to retrieve items from'
      },
      query: {
        type: 'object',
        description: 'Optional query parameters (limit, filter, sort, etc.)',
        properties: {
          limit: { type: 'number' },
          offset: { type: 'number' },
          sort: { type: 'string' },
          filter: { type: 'object' }
        }
      }
    }
  };
  
  return fn;
}
```

**src/tools/getItem.ts**:

```typescript
import { AxiosInstance } from 'axios';

export function getItem(directusClient: AxiosInstance) {
  /**
   * Get a single item from a collection by ID
   * @param collection The collection name
   * @param id The unique identifier of the item
   * @returns A single item with the specified ID
   */
  const fn = async ({ collection, id }) => {
    try {
      const response = await directusClient.get(`/items/${collection}/${id}`);
      return response.data.data;
    } catch (error) {
      console.error('Error getting item:', error);
      throw error;
    }
  };
  
  fn.description = 'Get a single item from a Directus collection by ID';
  fn.parameters = {
    type: 'object',
    required: ['collection', 'id'],
    properties: {
      collection: {
        type: 'string',
        description: 'The name of the collection'
      },
      id: {
        type: 'string',
        description: 'The unique identifier of the item'
      }
    }
  };
  
  return fn;
}
```

Create similar files for the remaining tools (createItem, updateItem, deleteItem, uploadFile, searchItems) following the same pattern.

## Creating a Configuration File

Create a `.env` file in the project root:

```
PORT=3000
DIRECTUS_URL=http://localhost:8055
DIRECTUS_ADMIN_TOKEN=your_admin_token_here
```

You'll need to generate an admin token in Directus by going to Settings > API Access Tokens and creating a new token with appropriate permissions.

## Building and Running the MCP Server

Add scripts to `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "nodemon --exec ts-node src/index.ts",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

Build and run the server:

```
npm run build
npm start
```

For development, you can use:

```
npm run dev
```


## Connecting to the MCP Server from AI Clients

Now that our MCP server is running, we need to configure AI clients to use it. Let's look at how to connect it to different AI platforms, using Claude as an example.

### Configuring Claude Desktop

To configure the Claude Desktop application to use our custom Directus MCP server:

1. Locate the Claude Desktop configuration file (`claude_desktop_config.json`).
2. Add the MCP server configuration to the `mcpServers` section:
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

3. Restart the Claude Desktop application for changes to take effect[^4].

### Configuring Cursor

For Cursor integration:

1. Open the Command Palette (Cmd+Shift+P on Mac).
2. Go to Cursor Settings > MCP.
3. Click "Add a new MCP server".
4. Enter a name like "Directus MCP".
5. For the command, enter: `node path/to/your/directus-mcp-server/dist/index.js`.
6. For the URL, enter: `http://localhost:3000/mcp/v1`.
7. Click "Add" to save the configuration[^4].

### Configuring Windsurf

For Windsurf integration:

1. Go to the Cascade panel on the right-hand side.
2. Click "Configure MCP".
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

4. Save and refresh servers[^4].

## Testing the Integration

To test if the integration is working correctly:

1. Open Claude Desktop, Cursor, or Windsurf.
2. Ask the AI to list available tools for the Directus MCP server.
3. Test individual tools by asking the AI to perform simple operations:
    - "Get items from the 'users' collection in Directus"
    - "Create a new article in Directus with the title 'Test Article'"
    - "Search for content containing 'example' in Directus"

The AI should be able to invoke the appropriate tools and return results from your Directus instance.

## Deployment Considerations

For production deployments:

1. Use a proper database for Directus instead of SQLite (PostgreSQL recommended).
2. Secure the MCP server with proper authentication.
3. Deploy behind a reverse proxy with HTTPS.
4. Set up monitoring and logging.
5. Consider containerizing both Directus and the MCP server.

A production Docker Compose file might look like:

```
services:
  postgres:
    image: postgres:13
    volumes:
      - ./data/database:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: "directus"
      POSTGRES_USER: "directus"
      POSTGRES_DB: "directus"

  directus:
    image: directus/directus:11.3.2
    depends_on:
      - postgres
    ports:
      - 8055:8055
    volumes:
      - ./uploads:/directus/uploads
      - ./extensions:/directus/extensions
    environment:
      SECRET: "your-secure-secret-key"
      KEY: "your-secure-api-key"
      DB_CLIENT: "pg"
      DB_HOST: "postgres"
      DB_PORT: "5432"
      DB_DATABASE: "directus"
      DB_USER: "directus"
      DB_PASSWORD: "directus"
      ADMIN_EMAIL: "admin@example.com"
      ADMIN_PASSWORD: "secure-password"
      WEBSOCKETS_ENABLED: "true"

  mcp-server:
    build: ./directus-mcp-server
    depends_on:
      - directus
    ports:
      - 3000:3000
    environment:
      PORT: 3000
      DIRECTUS_URL: "http://directus:8055"
      DIRECTUS_ADMIN_TOKEN: "your-admin-token"
```


## Conclusion

This guide has walked through the process of building a custom MCP server for Directus, enabling AI assistants to interact with your content management system. By following these steps, you've created a bridge between AI and your content platform, opening up possibilities for intelligent content management and automation.

The MCP standard continues to evolve, so stay informed about updates from Anthropic and the broader AI community. As of March 2025, this implementation represents current best practices, but be prepared to adapt as the technology advances.

By combining the power of Directus as a flexible headless CMS with the intelligence of large language models through MCP, you're well-positioned to build sophisticated, AI-enhanced content management workflows.

<div style="text-align: center">⁂</div>

[^1]: https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/9315053/67452cf7-9566-40e6-ba11-d6db843d1cc3/Designing-a-Scalable-MCP-Server-for-Directus-11.4.md

[^2]: https://directus.io/docs/getting-started/create-a-project

[^3]: https://directus.io/docs/community/codebase/dev-environment

[^4]: https://www.youtube.com/watch?v=3Jsh4brTjE0

[^5]: https://www.devshorts.in/p/how-to-build-your-own-mcp-server

[^6]: https://github.com/qpd-v/mcp-guide

