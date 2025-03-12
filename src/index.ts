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