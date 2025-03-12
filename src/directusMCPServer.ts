import axios, { AxiosInstance } from 'axios';
import { getItems } from './tools/getItems';
import { getItem } from './tools/getItem';
import { createItem } from './tools/createItem';
import { updateItem } from './tools/updateItem';
import { deleteItem } from './tools/deleteItem';
import { uploadFile } from './tools/uploadFile';
import { searchItems } from './tools/searchItems';
import { createCollection } from './tools/createCollection';
import { createField } from './tools/createField';
import { createRelation } from './tools/createRelation';
import { createManyToManyRelation } from './tools/createManyToManyRelation';
import { testConnection } from './tools/testConnection';
import { diagnoseMCPPermissions } from './tools/diagnoseMCPPermissions';
import { validateCollection } from './tools/validateCollection';

interface Tool {
  (params: any): Promise<any>;
  description?: string;
  parameters?: any;
}

export class DirectusMCPServer {
  private directusUrl: string;
  private directusToken: string;
  private tools: Record<string, Tool>;

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
      searchItems: searchItems(directusClient),
      createCollection: createCollection(directusClient),
      createField: createField(directusClient),
      createRelation: createRelation(directusClient),
      createManyToManyRelation: createManyToManyRelation(directusClient),
      testConnection: testConnection(directusClient),
      diagnoseMCPPermissions: diagnoseMCPPermissions(directusClient),
      validateCollection: validateCollection(directusClient)
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