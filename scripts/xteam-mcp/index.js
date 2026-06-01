// index.js — megingjord-xteam-mcp server entrypoint (Epic #2486)
// MCP server exposing /xteam, /xteam-status, /xteam-create as prompts.
'use strict';

const path = require('node:path');
const { handleXteam, handleXteamCreate, handleXteamStatus } = require('./handlers');
const ghClient = require('./gh-client');
const fs = require('node:fs');

const PERSPECTIVES_PATH = process.env.MEGINGJORD_XTEAM_PERSPECTIVES
  || path.resolve(__dirname, '..', '..', 'inventory', 'team-perspectives.json');

const TEAM = process.env.MEGINGJORD_XTEAM_TEAM || 'claude-code';

const PROMPTS = [
  {
    name: 'xteam',
    description: 'Join cross-team synthesis on an existing Epic',
    arguments: [{ name: 'epic', description: 'Epic ticket number', required: true }],
    handler: async ({ epic }) => handleXteam({
      ticket: parseInt(epic, 10), team: TEAM, perspectivesPath: PERSPECTIVES_PATH, ghClient, fs,
    }),
  },
  {
    name: 'xteam-create',
    description: 'Create new Epic and kick off cross-team synthesis',
    arguments: [{ name: 'description', description: 'Epic description (10+ chars)', required: true }],
    handler: async ({ description }) => handleXteamCreate({
      description, team: TEAM, perspectivesPath: PERSPECTIVES_PATH, ghClient, fs,
    }),
  },
  {
    name: 'xteam-status',
    description: 'Query progress of an in-flight synthesis',
    arguments: [{ name: 'epic', description: 'Epic ticket number', required: true }],
    handler: async ({ epic }) => handleXteamStatus({
      ticket: parseInt(epic, 10), ghClient,
    }),
  },
];

async function main() {
  try {
    const { z } = require('zod');
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
    const server = new McpServer(
      { name: 'megingjord-xteam-mcp', version: '0.1.0' },
      { capabilities: { prompts: {} } },
    );
    for (const prompt of PROMPTS) {
      const shape = {};
      for (const arg of prompt.arguments || []) {
        let field = z.string().describe(arg.description || arg.name);
        if (!arg.required) field = field.optional();
        shape[arg.name] = field;
      }
      const argsSchema = z.object(shape);
      server.registerPrompt(
        prompt.name,
        { description: prompt.description, argsSchema },
        async (args) => {
          const result = await prompt.handler(args || {});
          return {
            messages: [{ role: 'user', content: { type: 'text', text: JSON.stringify(result, null, 2) } }],
          };
        },
      );
    }
    await server.connect(new StdioServerTransport());
  } catch (err) {
    process.stderr.write(`[xteam-mcp] startup failed: ${err.message}\n`);
    process.stderr.write('Install @modelcontextprotocol/sdk: npm install @modelcontextprotocol/sdk\n');
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { PROMPTS, PERSPECTIVES_PATH, TEAM, main };
