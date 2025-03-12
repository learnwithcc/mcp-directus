## SpecStory

## Building a Directus MCP Server (3/11/2025, 11:24:24 PM)

_**User**_

Please follow the included guide to scaffold and build the complete Directus MCP server. You may disregard the beginning section about first installing and confguring a Directus instance. We're going to skip that since we've already got a complete directus build to test with. For future reference, we can access it at https://directus-dev.learnwith.cc

---

_**Assistant**_

<think>The user wants me to scaffold and build a complete Directus MCP server following the guide in the attached file. They've indicated that they already have a Directus instance running at https://directus-dev.learnwith.cc, so we can skip the section about installing and configuring Directus.

I'll focus on creating the MCP server part of the project. From the guide, it looks like I need to:

1. Create the project directory structure
2. Initialize the Node.js project
3. Set up the TypeScript configuration
4. Create the MCP server core files
5. Implement the MCP tool functions to interact with Directus
6. Create a configuration file
7. Set up the build and run scripts

Let's start by creating the project structure and initializing the Node.js project.</think># Building a Directus MCP Server

I'll help you scaffold and build the complete Directus MCP server based on the guide. As you mentioned, we'll skip the Directus installation part since you already have a running instance at https://directus-dev.learnwith.cc.

Let's start by setting up the project structure and implementing the server.

## 1. Create the Project Directory and Initialize

First, let's create the project directory and set up the initial structure:

---

_****_

```bash
mkdir -p directus-mcp-server
```

```
❯ mkdir -p directus-mcp-server

╭─     ~/dev/projects/mcp-directus ······················································ ✔  23:30:37   
╰─
```

---

_****_

Now let's navigate to the new directory and initialize the Node.js project:

---

_****_

```bash
cd directus-mcp-server && npm init -y
```

```
❯ cd directus-mcp-server && npm init -y
Wrote to /Users/cryophobic/dev/projects/mcp-directus/directus-mcp-server/package.json:

{
  "name": "directus-mcp-server",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "description": ""
}




╭─     ~/dev/projects/mcp-directus/directus-mcp-server ·································· ✔  23:30:40   
╰─
```

---

_****_

## 2. Install Dependencies

Let's install the necessary dependencies:

---

_****_

```bash
npm install --save-dev typescript @types/node ts-node nodemon
```

```


╭─     ~/dev/projects/mcp-directus/directus-mcp-server ·································· ✔  23:30:40   
❯ npm install --save-dev typescript @types/node ts-node nodemon

added 49 packages, and audited 50 packages in 5s

4 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

╭─     ~/dev/projects/mcp-directus/directus-mcp-server ·························· ✔  6s    23:30:49   
╰─
```

---

_****_

```bash
npm install axios dotenv express
```

```
❯ npm install axios dotenv express

added 85 packages, and audited 135 packages in 3s

21 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

╭─     ~/dev/projects/mcp-directus/directus-mcp-server ·························· ✔  3s    23:30:57   
╰─
```

---

_****_

Let's add the Express type definitions:

---

_****_

```bash
npm install --save-dev @types/express
```

```
❯ npm install --save-dev @types/express

added 10 packages, and audited 145 packages in 2s

21 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

╭─     ~/dev/projects/mcp-directus/directus-mcp-server ·································· ✔  23:31:01   
╰─
```

---

_****_

## 3. Create TypeScript Configuration

Let's create the TypeScript configuration file:

---

_****_

```diff
- 
+ {
+   "compilerOptions": {
+     "target": "ES2020",
+     "module": "commonjs",
+     "outDir": "./dist",
+     "strict": true,
+     "esModuleInterop": true,
+     "skipLibCheck": true,
+     "forceConsistentCasingInFileNames": true
+   },
+   "include": ["src/**/*"],
+   "exclude": ["node_modules", "**/*.test.ts"]
+ } 
```

---

_****_

## 4. Set Up Directory Structure

Now let's create the source directory structure:

---

_****_

```bash
mkdir -p src/tools src/resources src/utils
```

```
❯ mkdir -p src/tools src/resources src/utils

╭─     ~/dev/projects/mcp-directus/directus-mcp-server ·································· ✔  23:31:14   
╰─
```

---

_****_

## 5. Create MCP Server Core Files

Let's create the main server file:

---

_****_

```diff
- 
+ import express from 'express';
+ import dotenv from 'dotenv';
+ import { DirectusMCPServer } from './directusMCPServer';
+ 
+ dotenv.config();
+ 
+ const app = express();
+ app.use(express.json());
+ 
+ const port = process.env.PORT || 3000;
+ const directusUrl = process.env.DIRECTUS_URL || 'http://localhost:8055';
+ const directusToken = process.env.DIRECTUS_ADMIN_TOKEN || '';
+ 
+ if (!directusToken) {
+   console.error('DIRECTUS_ADMIN_TOKEN is required');
+   process.exit(1);
+ }
+ 
+ const mcpServer = new DirectusMCPServer(directusUrl, directusToken);
+ 
+ // MCP list endpoint
+ app.get('/mcp/v1/tools', (req, res) => {
+   res.json(mcpServer.listTools());
+ });
+ 
+ // MCP invoke endpoint
+ app.post('/mcp/v1/tools/:tool', async (req, res) => {
+   const { tool } = req.params;
+   const params = req.body;
+   
+   try {
+     const result = await mcpServer.invokeTool(tool, params);
+     res.json(result);
+   } catch (error) {
+     console.error(`Error invoking tool ${tool}:`, error);
+     res.status(500).json({ error: 'Failed to invoke tool' });
+   }
+ });
+ 
+ app.listen(port, () => {
+   console.log(`Directus MCP server running at http://localhost:${port}`);
+ }); 
```

---

_****_

Let's create the DirectusMCPServer class:

---

_****_

```diff
- 
+ import axios, { AxiosInstance } from 'axios';
+ import { getItems } from './tools/getItems';
+ import { getItem } from './tools/getItem';
+ import { createItem } from './tools/createItem';
+ import { updateItem } from './tools/updateItem';
+ import { deleteItem } from './tools/deleteItem';
+ import { uploadFile } from './tools/uploadFile';
+ import { searchItems } from './tools/searchItems';
+ 
+ interface Tool {
+   (params: any): Promise<any>;
+   description?: string;
+   parameters?: any;
+ }
+ 
+ export class DirectusMCPServer {
+   private directusUrl: string;
+   private directusToken: string;
+   private tools: Record<string, Tool>;
+ 
+   constructor(directusUrl: string, directusToken: string) {
+     this.directusUrl = directusUrl;
+     this.directusToken = directusToken;
+     
+     // Initialize the Directus client
+     const directusClient = axios.create({
+       baseURL: this.directusUrl,
+       headers: {
+         'Authorization': `Bearer ${this.directusToken}`,
+         'Content-Type': 'application/json'
+       }
+     });
+     
+     // Register tools
+     this.tools = {
+       getItems: getItems(directusClient),
+       getItem: getItem(directusClient),
+       createItem: createItem(directusClient),
+       updateItem: updateItem(directusClient),
+       deleteItem: deleteItem(directusClient),
+       uploadFile: uploadFile(directusClient),
+       searchItems: searchItems(directusClient)
+     };
+   }
+ 
+   listTools() {
+     // Format the tools according to MCP specification
+     return {
+       tools: Object.entries(this.tools).map(([name, fn]) => ({
+         name,
+         description: fn.description || `Directus ${name} operation`,
+         parameters: fn.parameters || {}
+       }))
+     };
+   }
+ 
+   async invokeTool(toolName: string, params: any) {
+     if (!this.tools[toolName]) {
+       throw new Error(`Tool ${toolName} not found`);
+     }
+     
+     try {
+       const result = await this.tools[toolName](params);
+       return { result };
+     } catch (error) {
+       console.error(`Error in ${toolName}:`, error);
+       throw error;
+     }
+   }
+ } 
```

---

_****_

## 6. Implement MCP Tool Functions

Now let's implement each of the MCP tool functions. First, let's create the getItems function:

---

_****_

```diff
- 
+ import { AxiosInstance } from 'axios';
+ 
+ export function getItems(directusClient: AxiosInstance) {
+   /**
+    * Get multiple items from a collection
+    * @param collection The collection name to retrieve items from
+    * @param query Optional query parameters (limit, filter, sort, etc.)
+    * @returns Array of items from the specified collection
+    */
+   const fn = async ({ collection, query = {} }: { collection: string; query?: Record<string, any> }) => {
+     try {
+       const response = await directusClient.get(`/items/${collection}`, { params: query });
+       return response.data.data;
+     } catch (error) {
+       console.error('Error getting items:', error);
+       throw error;
+     }
+   };
+   
+   fn.description = 'Get multiple items from a Directus collection';
+   fn.parameters = {
+     type: 'object',
+     required: ['collection'],
+     properties: {
+       collection: {
+         type: 'string',
+         description: 'The name of the collection to retrieve items from'
+       },
+       query: {
+         type: 'object',
+         description: 'Optional query parameters (limit, filter, sort, etc.)',
+         properties: {
+           limit: { type: 'number' },
+           offset: { type: 'number' },
+           sort: { type: 'string' },
+           filter: { type: 'object' }
+         }
+       }
+     }
+   };
+   
+   return fn;
+ } 
```

---

_****_

Let's create the getItem function:

---

_****_

```diff
- 
+ import { AxiosInstance } from 'axios';
+ 
+ export function getItem(directusClient: AxiosInstance) {
+   /**
+    * Get a single item from a collection by ID
+    * @param collection The collection name
+    * @param id The unique identifier of the item
+    * @returns A single item with the specified ID
+    */
+   const fn = async ({ collection, id }: { collection: string; id: string }) => {
+     try {
+       const response = await directusClient.get(`/items/${collection}/${id}`);
+       return response.data.data;
+     } catch (error) {
+       console.error('Error getting item:', error);
+       throw error;
+     }
+   };
+   
+   fn.description = 'Get a single item from a Directus collection by ID';
+   fn.parameters = {
+     type: 'object',
+     required: ['collection', 'id'],
+     properties: {
+       collection: {
+         type: 'string',
+         description: 'The name of the collection'
+       },
+       id: {
+         type: 'string',
+         description: 'The unique identifier of the item'
+       }
+     }
+   };
+   
+   return fn;
+ } 
```

---

_****_

Now let's create the createItem function:

---

_****_

```diff
- 
+ import { AxiosInstance } from 'axios';
+ 
+ export function createItem(directusClient: AxiosInstance) {
+   /**
+    * Create a new item in a collection
+    * @param collection The collection name
+    * @param item The item data to create
+    * @returns The created item
+    */
+   const fn = async ({ collection, item }: { collection: string; item: Record<string, any> }) => {
+     try {
+       const response = await directusClient.post(`/items/${collection}`, item);
+       return response.data.data;
+     } catch (error) {
+       console.error('Error creating item:', error);
+       throw error;
+     }
+   };
+   
+   fn.description = 'Create a new item in a Directus collection';
+   fn.parameters = {
+     type: 'object',
+     required: ['collection', 'item'],
+     properties: {
+       collection: {
+         type: 'string',
+         description: 'The name of the collection'
+       },
+       item: {
+         type: 'object',
+         description: 'The item data to create'
+       }
+     }
+   };
+   
+   return fn;
+ } 
```

---

_****_

Let's create the updateItem function:

---

_****_

```diff
- 
+ import { AxiosInstance } from 'axios';
+ 
+ export function updateItem(directusClient: AxiosInstance) {
+   /**
+    * Update an existing item in a collection
+    * @param collection The collection name
+    * @param id The unique identifier of the item
+    * @param item The updated item data
+    * @returns The updated item
+    */
+   const fn = async ({ collection, id, item }: { collection: string; id: string; item: Record<string, any> }) => {
+     try {
+       const response = await directusClient.patch(`/items/${collection}/${id}`, item);
+       return response.data.data;
+     } catch (error) {
+       console.error('Error updating item:', error);
+       throw error;
+     }
+   };
+   
+   fn.description = 'Update an existing item in a Directus collection';
+   fn.parameters = {
+     type: 'object',
+     required: ['collection', 'id', 'item'],
+     properties: {
+       collection: {
+         type: 'string',
+         description: 'The name of the collection'
+       },
+       id: {
+         type: 'string',
+         description: 'The unique identifier of the item'
+       },
+       item: {
+         type: 'object',
+         description: 'The updated item data'
+       }
+     }
+   };
+   
+   return fn;
+ } 
```

---

_****_

Let's create the deleteItem function:

---

_****_

```diff
- 
+ import { AxiosInstance } from 'axios';
+ 
+ export function deleteItem(directusClient: AxiosInstance) {
+   /**
+    * Delete an item from a collection
+    * @param collection The collection name
+    * @param id The unique identifier of the item
+    * @returns The deleted item or an empty object
+    */
+   const fn = async ({ collection, id }: { collection: string; id: string }) => {
+     try {
+       const response = await directusClient.delete(`/items/${collection}/${id}`);
+       return response.data.data || {};
+     } catch (error) {
+       console.error('Error deleting item:', error);
+       throw error;
+     }
+   };
+   
+   fn.description = 'Delete an item from a Directus collection';
+   fn.parameters = {
+     type: 'object',
+     required: ['collection', 'id'],
+     properties: {
+       collection: {
+         type: 'string',
+         description: 'The name of the collection'
+       },
+       id: {
+         type: 'string',
+         description: 'The unique identifier of the item'
+       }
+     }
+   };
+   
+   return fn;
+ } 
```

---

_****_

Let's create the uploadFile function:

---

_****_

```diff
- 
+ import { AxiosInstance } from 'axios';
+ 
+ export function uploadFile(directusClient: AxiosInstance) {
+   /**
+    * Upload a file to Directus
+    * @param fileContent Base64 encoded file content
+    * @param fileName Name of the file
+    * @param title Optional title for the file
+    * @param description Optional description for the file
+    * @returns The uploaded file metadata
+    */
+   const fn = async ({ 
+     fileContent, 
+     fileName, 
+     title, 
+     description 
+   }: { 
+     fileContent: string; 
+     fileName: string; 
+     title?: string; 
+     description?: string 
+   }) => {
+     try {
+       // Decode the base64 content
+       const buffer = Buffer.from(fileContent, 'base64');
+       
+       // Create form data
+       const formData = new FormData();
+       formData.append('file', new Blob([buffer]), fileName);
+       
+       if (title) {
+         formData.append('title', title);
+       }
+       
+       if (description) {
+         formData.append('description', description);
+       }
+       
+       const response = await directusClient.post('/files', formData, {
+         headers: {
+           'Content-Type': 'multipart/form-data',
+         },
+       });
+       
+       return response.data.data;
+     } catch (error) {
+       console.error('Error uploading file:', error);
+       throw error;
+     }
+   };
+   
+   fn.description = 'Upload a file to Directus';
+   fn.parameters = {
+     type: 'object',
+     required: ['fileContent', 'fileName'],
+     properties: {
+       fileContent: {
+         type: 'string',
+         description: 'Base64 encoded file content'
+       },
+       fileName: {
+         type: 'string',
+         description: 'Name of the file'
+       },
+       title: {
+         type: 'string',
+         description: 'Optional title for the file'
+       },
+       description: {
+         type: 'string',
+         description: 'Optional description for the file'
+       }
+     }
+   };
+   
+   return fn;
+ } 
```

---

_****_

Let's create the searchItems function:

---

_****_

```diff
- 
+ import { AxiosInstance } from 'axios';
+ 
+ export function searchItems(directusClient: AxiosInstance) {
+   /**
+    * Search for items in a collection
+    * @param collection The collection name
+    * @param searchQuery The search query string
+    * @param fields Optional array of fields to search in
+    * @param limit Optional limit for the number of results
+    * @returns Array of matching items
+    */
+   const fn = async ({ 
+     collection, 
+     searchQuery, 
+     fields = [], 
+     limit = 10 
+   }: { 
+     collection: string; 
+     searchQuery: string; 
+     fields?: string[]; 
+     limit?: number 
+   }) => {
+     try {
+       // Build the filter object
+       const filter: Record<string, any> = { _or: [] };
+       
+       // If fields are specified, search in those fields
+       if (fields.length > 0) {
+         for (const field of fields) {
+           filter._or.push({
+             [field]: {
+               _contains: searchQuery
+             }
+           });
+         }
+       } else {
+         // If no fields are specified, search will be done against default search fields
+         filter._or.push({
+           _search: searchQuery
+         });
+       }
+       
+       const response = await directusClient.get(`/items/${collection}`, {
+         params: {
+           filter,
+           limit
+         }
+       });
+       
+       return response.data.data;
+     } catch (error) {
+       console.error('Error searching items:', error);
+       throw error;
+     }
+   };
+   
+   fn.description = 'Search for items in a Directus collection';
+   fn.parameters = {
+     type: 'object',
+     required: ['collection', 'searchQuery'],
+     properties: {
+       collection: {
+         type: 'string',
+         description: 'The name of the collection to search in'
+       },
+       searchQuery: {
+         type: 'string',
+         description: 'The search query string'
+       },
+       fields: {
+         type: 'array',
+         items: {
+           type: 'string'
+         },
+         description: 'Optional array of fields to search in. If not provided, default search fields will be used.'
+       },
+       limit: {
+         type: 'number',
+         description: 'Optional limit for the number of results. Default is 10.'
+       }
+     }
+   };
+   
+   return fn;
+ } 
```

---

_****_

## 7. Create the Configuration File

Let's create the .env file with configuration:

---

_****_

```diff
- 
+  
```

---

_****_

Let's try again:

---

_****_



---

_****_

Let's try a different approach:

---

_****_

Command contains newline characters.

---

_****_

Let's try without newlines:

---

_****_

```bash
echo 'PORT=3000\nDIRECTUS_URL=https://directus-dev.learnwith.cc\nDIRECTUS_ADMIN_TOKEN=your_admin_token_here' > .env
```

```
╰─ echo 'PORT=3000\nDIRECTUS_URL=https://directus-dev.learnwith.cc\nDIRECTUS_ADMIN_TOKEN=your_admin_token_here' > 
.enecho 'PORT=3000\nDIRECTUS_URL=https://directus-dev.learnwith.cc\nDIRECTUS_ADMIN_TOKEN=your_admin_token_here' > 
<.cc\nDIRECTUS_ADMIN_TOKEN=your_admin_token_here' > .env

╭─     ~/dev/projects/mcp-directus/directus-mcp-server ·································· ✔  23:33:10   
╰─
```

---

_****_

It seems like there was an issue with the echo command. Let's try a more straightforward approach:

---

_****_

Command contains newline characters.

---

_****_

Let's create it with nano:

---

_****_

```bash
nano .env
```

```
[1]    86339 segmentation fault  nano .env
                                          %


```

---

_****_

Let's try with touch:

---

_****_

```bash
touch .env
```

```
❯ touch .env

╭─     ~/dev/projects/mcp-directus/directus-mcp-server ·································· ✔  23:33:22   
╰─
```

---

_****_

Now let's add the content to the .env file:

---

_****_



---

_****_

Let's try another approach:

---

_****_

```bash
echo 'PORT=3000' > .env && echo 'DIRECTUS_URL=https://directus-dev.learnwith.cc' >> .env && echo 'DIRECTUS_ADMIN_TOKEN=your_admin_token_here' >> .env
```

```

<ho 'DIRECTUS_ADMIN_TOKEN=your_admin_token_here' >> .env

╭─     ~/dev/projects/mcp-directus/directus-mcp-server ·································· ✔  23:33:35   
╰─
```

---

_****_

## 8. Update package.json with Build and Run Scripts

Now let's update the package.json to add the build and run scripts:

---

_****_

```diff
- 
+ {
+   "name": "directus-mcp-server",
+   "version": "1.0.0",
+   "main": "dist/index.js",
+   "scripts": {
+     "build": "tsc",
+     "start": "node dist/index.js",
+     "dev": "nodemon --exec ts-node src/index.ts",
+     "test": "echo \"Error: no test specified\" && exit 1"
+   },
+   "keywords": [],
+   "author": "",
+   "license": "ISC",
+   "description": "MCP server for Directus",
+   "dependencies": {
+     "axios": "^1.6.0",
+     "dotenv": "^16.3.1",
+     "express": "^4.18.2"
+   },
+   "devDependencies": {
+     "@types/express": "^4.17.21",
+     "@types/node": "^20.10.0",
+     "nodemon": "^3.0.1",
+     "ts-node": "^10.9.1",
+     "typescript": "^5.3.2"
+   }
+ } 
```

---

_****_





---

_**User**_

I've set up a new dev instance of Directus for us to work with. I've now added the appropriate creds to my .env file.

---

_**Assistant**_

<think>The user is informing me that they've set up a new dev instance of Directus and have added the appropriate credentials to their .env file. Let's look at what we can see in the attached files to understand what they've done.

Looking at the attached .env file:
```
PORT=3000
DIRECTUS_URL=http://localhost:8077
DIRECTUS_ADMIN_TOKEN=sAkELUjsqTu4J3qg0FyI_7mFnV9BPX8a
```

The user has:
1. Set PORT=3000 for the MCP server
2. Set DIRECTUS_URL to http://localhost:8077 (different from what was mentioned in their initial message, which was https://directus-dev.learnwith.cc)
3. Added an admin token

It seems like they've taken the initiative to add credentials to access a Directus instance, but they're pointing to a local instance rather than the dev instance mentioned in their query. 

I should acknowledge their update and clarify if they want to continue using the local instance at http://localhost:8077 or if they want to switch to the remote instance at https://directus-dev.learnwith.cc that they mentioned.

I should also check that all the source files are in place and let them know that we can try running the server.</think>That's great! I can see you've updated your .env file with the credentials for a local Directus instance at http://localhost:8077:

```
PORT=3000
DIRECTUS_URL=http://localhost:8077
DIRECTUS_ADMIN_TOKEN=sAkELUjsqTu4J3qg0FyI_7mFnV9BPX8a
```

All of our files for the Directus MCP server look good. Let's test if we can build and run the server to connect to your Directus instance.

First, let's build the TypeScript code:

---

_****_

```bash
npm run build
```

```
❯ npm run build
npm error Missing script: "build"
                                 npm error
                                          npm error To see a list of scripts, run:
                                                                                  npm error   npm run
                                                                                                     npm error A c
omplete log of this run can be found in: /Users/cryophobic/.npm/_logs/2025-03-12T14_10_58_922Z-debug-0.log

╭─     ~/dev/projects/mcp-directus/directus-mcp-server ································ 1 ✘  10:10:59   
╰─
```

---

_****_

It seems that the package.json scripts aren't properly registered. Let's check the content of package.json:

---

_****_

```bash
cat package.json | grep scripts -A 10
```

```
  "scripts": {
                  "test": "echo \"Error: no test specified\" && exit 1"
                                                                         },
                                                                             "keywords": [],
                                                                                              "author": "",
                                                                                                             "lice
nse": "ISC",
              "description": "",
                                  "devDependencies": {
                                                          "@types/express": "^5.0.0",
                                                                                         "@types/node": "^22.13.10
",
      "nodemon": "^3.1.9",
                          %


```

---

_****_

It looks like your package.json file doesn't have the build, start, and dev scripts that we created in our previous session. Let's update it:

---

_****_



---

_****_

Let's check the full content of package.json and update it correctly:

---

_****_

```bash
cat package.json
```

```
{
   "name": "directus-mcp-server",
                                   "version": "1.0.0",
                                                        "main": "index.js",
                                                                             "scripts": {
                                                                                             "test": "echo \"Error
: no test specified\" && exit 1"
                                  },
                                      "keywords": [],
                                                       "author": "",
                                                                      "license": "ISC",
                                                                                         "description": "",
                                                                                                             "devD
ependencies": {
                   "@types/express": "^5.0.0",
                                                  "@types/node": "^22.13.10",
                                                                                 "nodemon": "^3.1.9",
                                                                                                         "ts-node"
: "^10.9.2",
                "typescript": "^5.8.2"
                                        },
                                            "dependencies": {
                                                                 "axios": "^1.8.2",
                                                                                       "dotenv": "^16.4.7",
                                                                                                               "ex
press": "^4.21.2"
                   }
                    }
                     %


```

---

_****_

Now let's update the package.json file with the correct scripts:

---

_****_

```diff
    "license": "ISC",
    "description": "MCP server for Directus",
-   "dependencies": {
-     "axios": "^1.6.0",
-     "dotenv": "^16.3.1",
-     "express": "^4.18.2"
-   },
    "devDependencies": {
-     "@types/express": "^4.17.21",
-     "@types/node": "^20.10.0",
-     "nodemon": "^3.0.1",
-     "ts-node": "^10.9.1",
-     "typescript": "^5.3.2"
+     "@types/express": "^5.0.0",
+     "@types/node": "^22.13.10",
+     "nodemon": "^3.1.9",
+     "ts-node": "^10.9.2",
+     "typescript": "^5.8.2"
+   },
+   "dependencies": {
+     "axios": "^1.8.2",
+     "dotenv": "^16.4.7",
+     "express": "^4.21.2"
    }
  } 
```

---

_****_

Now let's try building the project again:

---

_****_

```bash
npm run build
```

```
❯ npm run build
npm error Missing script: "build"
                                 npm error
                                          npm error To see a list of scripts, run:
                                                                                  npm error   npm run
                                                                                                     npm error A c
omplete log of this run can be found in: /Users/cryophobic/.npm/_logs/2025-03-12T14_11_32_959Z-debug-0.log

╭─     ~/dev/projects/mcp-directus/directus-mcp-server ································ 1 ✘  10:11:33   
╰─
```

---

_****_

It seems like there might be an issue with the file format or the changes didn't save correctly. Let's try creating the package.json from scratch:

---

_****_

Command contains newline characters.

---

_****_

Let's try a different approach. Let's create a temporary file and then move it:

---

_****_



---

_****_



---



---

