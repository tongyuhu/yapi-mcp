#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { YApiClient } from './client.js';

// 从环境变量获取配置
const YAPI_URL = process.env.YAPI_URL;
const YAPI_USERNAME = process.env.YAPI_USERNAME;
const YAPI_PASSWORD = process.env.YAPI_PASSWORD;

// 验证必需的环境变量
if (!YAPI_URL || !YAPI_USERNAME || !YAPI_PASSWORD) {
  console.error('错误: 缺少必需的环境变量');
  console.error('请设置以下环境变量:');
  console.error('  YAPI_URL      - YApi 服务器地址 (如: http://yapi.example.com)');
  console.error('  YAPI_USERNAME - YApi 用户名');
  console.error('  YAPI_PASSWORD - YApi 密码');
  process.exit(1);
}

// 创建 YApi 客户端
const yapiClient = new YApiClient({
  url: YAPI_URL,
  username: YAPI_USERNAME,
  password: YAPI_PASSWORD,
});

// 创建 MCP 服务器
const server = new Server(
  {
    name: 'yapi-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_interface',
        description: '根据接口 ID 获取 YApi 接口的详细信息，包括请求方法、路径、参数、请求体、响应体等',
        inputSchema: {
          type: 'object',
          properties: {
            interface_id: {
              type: 'number',
              description: 'YApi 接口 ID',
            },
          },
          required: ['interface_id'],
        },
      },
    ],
  };
});

// 注册工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_interface') {
    const interfaceId = args?.interface_id as number;

    if (typeof interfaceId !== 'number') {
      return {
        content: [
          {
            type: 'text',
            text: '错误: interface_id 必须是数字',
          },
        ],
        isError: true,
      };
    }

    try {
      const interfaceData = await yapiClient.getInterface(interfaceId);

      // 格式化输出
      const output = formatInterfaceData(interfaceData);

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `获取接口信息失败: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `未知工具: ${name}`,
      },
    ],
    isError: true,
  };
});

/**
 * 格式化接口数据为易读的文本
 */
function formatInterfaceData(data: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push(`# ${data.title || '未命名接口'}`);
  lines.push('');
  lines.push(`**接口 ID**: ${data._id}`);
  lines.push(`**请求方法**: ${data.method}`);
  lines.push(`**请求路径**: ${data.path}`);
  lines.push(`**状态**: ${data.status}`);

  if (data.desc) {
    lines.push('');
    lines.push(`## 接口描述`);
    lines.push(String(data.desc));
  }

  if (data.markdown) {
    lines.push('');
    lines.push(`## 详细说明`);
    lines.push(String(data.markdown));
  }

  // 请求头
  const reqHeaders = data.req_headers as Array<{ name: string; value: string; required?: string }> | undefined;
  if (reqHeaders && reqHeaders.length > 0) {
    lines.push('');
    lines.push(`## 请求头`);
    for (const header of reqHeaders) {
      const required = header.required === '1' ? '(必填)' : '(可选)';
      lines.push(`- **${header.name}**: ${header.value} ${required}`);
    }
  }

  // 路径参数
  const reqParams = data.req_params as Array<{ name: string; desc?: string; example?: string }> | undefined;
  if (reqParams && reqParams.length > 0) {
    lines.push('');
    lines.push(`## 路径参数`);
    for (const param of reqParams) {
      let line = `- **${param.name}**`;
      if (param.desc) line += `: ${param.desc}`;
      if (param.example) line += ` (示例: ${param.example})`;
      lines.push(line);
    }
  }

  // Query 参数
  const reqQuery = data.req_query as Array<{ name: string; required?: string; desc?: string; example?: string }> | undefined;
  if (reqQuery && reqQuery.length > 0) {
    lines.push('');
    lines.push(`## Query 参数`);
    for (const query of reqQuery) {
      const required = query.required === '1' ? '(必填)' : '(可选)';
      let line = `- **${query.name}** ${required}`;
      if (query.desc) line += `: ${query.desc}`;
      if (query.example) line += ` (示例: ${query.example})`;
      lines.push(line);
    }
  }

  // 请求体
  if (data.req_body_type) {
    lines.push('');
    lines.push(`## 请求体`);
    lines.push(`**类型**: ${data.req_body_type}`);

    if (data.req_body_type === 'form' && data.req_body_form) {
      const formFields = data.req_body_form as Array<{ name: string; type: string; required?: string; desc?: string }>;
      lines.push('');
      for (const field of formFields) {
        const required = field.required === '1' ? '(必填)' : '(可选)';
        let line = `- **${field.name}** [${field.type}] ${required}`;
        if (field.desc) line += `: ${field.desc}`;
        lines.push(line);
      }
    } else if (data.req_body_other) {
      lines.push('```json');
      lines.push(String(data.req_body_other));
      lines.push('```');
    }
  }

  // 响应体
  if (data.res_body) {
    lines.push('');
    lines.push(`## 响应体`);
    lines.push(`**类型**: ${data.res_body_type || 'json'}`);
    lines.push('```json');
    lines.push(String(data.res_body));
    lines.push('```');
  }

  // 标签
  const tags = data.tag as string[] | undefined;
  if (tags && tags.length > 0) {
    lines.push('');
    lines.push(`**标签**: ${tags.join(', ')}`);
  }

  return lines.join('\n');
}

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('YApi MCP 服务器已启动');
}

main().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
