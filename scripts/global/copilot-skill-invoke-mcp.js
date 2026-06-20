// copilot-skill-invoke-mcp.js — MCP server exposing wired harness skills as
// Copilot-invocable prompts (#3047). Mirrors xteam-mcp/index.js pattern.
// Each wired skill becomes an MCP prompt; Copilot calls it via the MCP tool
// surface and receives a ready-to-use runSubagent prompt string.
'use strict';

const { WIRED_SKILLS, buildInvocation } = require('./copilot-skill-invoke');

const SERVER_NAME = 'megingjord-skill-invoke';
const SERVER_VERSION = '0.1.0';

// buildPromptDef(skillName) -> MCP prompt definition object.
function buildPromptDef(skillName) {
  return {
    name: `skill-${skillName}`,
    description: `Invoke harness skill: ${skillName}`,
    arguments: [
      { name: 'args', description: 'Optional skill arguments (see SKILL.md argument-hint)', required: false },
    ],
    handler: async ({ args } = {}) => {
      const result = buildInvocation(skillName, args || '');
      if (!result.ok) throw new Error(result.reason);
      return result.invocation;
    },
  };
}

const PROMPTS = WIRED_SKILLS.map(buildPromptDef);

// Lazily load the MCP SDK; exit with an install hint if it is not present.
function loadMcpSdk() {
  try {
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
    const { z } = require('zod');
    return { McpServer, StdioServerTransport, z };
  } catch (err) {
    process.stderr.write(
      `[skill-invoke-mcp] SDK not installed: ${err.message}\n` +
      'Run: cd scripts/xteam-mcp && npm install @modelcontextprotocol/sdk zod\n',
    );
    return process.exit(1);
  }
}

async function main() {
  const { McpServer, StdioServerTransport, z } = loadMcpSdk();
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { prompts: {} } },
  );
  for (const prompt of PROMPTS) {
    const argsSchema = z.object({
      args: z.string().describe('Optional skill arguments').optional(),
    });
    server.registerPrompt(
      prompt.name,
      { description: prompt.description, argsSchema },
      async (callArgs) => {
        const result = await prompt.handler(callArgs || {});
        return {
          messages: [{
            role: 'user',
            content: { type: 'text', text: JSON.stringify(result, null, 2) },
          }],
        };
      },
    );
  }
  await server.connect(new StdioServerTransport());
}

if (require.main === module) main();

module.exports = { PROMPTS, SERVER_NAME, SERVER_VERSION, buildPromptDef, main };
