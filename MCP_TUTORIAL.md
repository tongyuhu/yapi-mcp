# MCP 教程：从 Node.js 基础到编写你自己的 MCP 服务器

本教程以一个真实的 MCP 项目 —— [yapi-mcp](https://github.com/tongyuhu/yapi-mcp) 为示例，带你从 Node.js 工具链基础开始，逐步掌握 MCP 的使用和开发。

`yapi-mcp` 是一个 MCP 服务器，它让 Claude 能够直接查询 YApi 接口文档信息。项目使用 TypeScript + Node.js 开发，代码量不到 500 行，非常适合作为学习模板。

**目录**

- [第一部分：Node.js 工具开发基础](#第一部分nodejs-工具开发基础)
- [第二部分：MCP 的使用](#第二部分mcp-的使用)
- [第三部分：MCP 服务器的编写](#第三部分mcp-服务器的编写)

---

# 第一部分：Node.js 工具开发基础

编写 MCP 服务器之前，需要先了解 Node.js 生态中与工具开发相关的基础知识。本部分以 yapi-mcp 项目的配置为例，逐一介绍。

## 1.1 package.json 核心字段

`package.json` 是 Node.js 项目的"身份证"，定义了项目的基本信息、依赖和行为。以下是 yapi-mcp 的完整配置：

```json
{
  "name": "@tongyuhu/yapi-mcp",
  "version": "1.0.0",
  "description": "MCP 服务器 - 提供 YApi 接口信息查询功能",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "yapi-mcp": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch"
  },
  "keywords": ["mcp", "yapi", "api", "documentation", "claude"],
  "author": "tongyuhu",
  "license": "MIT",
  "files": ["dist", "README.md", "LICENSE"],
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

逐字段说明：

| 字段 | 说明 |
|------|------|
| `name` | 包名。`@tongyuhu/` 前缀叫做 **scope**，用于在 npm 上避免命名冲突。格式为 `@组织名/包名` |
| `version` | 语义化版本号（主版本.次版本.修订号）。发布新版时必须递增 |
| `type` | 设为 `"module"` 表示项目使用 **ES Module** 模块系统（后文详述） |
| `main` | 包的入口文件。当别人 `import` 你的包时，默认导入这个文件 |
| `bin` | **将包注册为命令行工具**。这里表示安装后可以通过 `yapi-mcp` 命令运行 `dist/index.js`。这是 MCP 服务器能被 `npx` 启动的关键 |
| `scripts` | 定义快捷命令。`npm run build` 执行 `tsc`（TypeScript 编译），`npm run dev` 启动监听模式 |
| `files` | **发布白名单**。`npm publish` 时只会包含 `dist/`、`README.md` 和 `LICENSE`，源码和配置文件不会发布 |
| `dependencies` | 运行时依赖。`@modelcontextprotocol/sdk` 是 MCP 官方 SDK，用户安装你的包时会一并安装 |
| `devDependencies` | 开发时依赖。TypeScript 编译器和类型定义只在开发时需要，不会被最终用户安装 |
| `engines` | 声明最低 Node.js 版本。MCP SDK 需要 Node.js 18+（因为用到了内置的 `fetch` API） |

## 1.2 TypeScript 配置

TypeScript 通过 `tsconfig.json` 文件配置编译行为：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

关键配置项：

| 配置 | 值 | 说明 |
|------|------|------|
| `target` | `ES2022` | 编译目标。ES2022 支持 top-level await、`Array.at()` 等现代特性 |
| `module` | `NodeNext` | 模块系统。配合 `package.json` 的 `"type": "module"`，使用 Node.js 原生 ESM |
| `moduleResolution` | `NodeNext` | 模块解析策略。告诉 TypeScript 按照 Node.js 的规则查找模块 |
| `outDir` / `rootDir` | `./dist` / `./src` | 源码放 `src/`，编译产物输出到 `dist/`，实现源码和产物分离 |
| `strict` | `true` | 启用严格类型检查，能在编译时发现更多潜在问题 |
| `declaration` | `true` | 生成 `.d.ts` 类型声明文件，方便其他 TypeScript 项目使用你的包 |
| `sourceMap` | `true` | 生成 source map，调试时能定位到 TypeScript 源码而非编译后的 JavaScript |

## 1.3 ES Module vs CommonJS

Node.js 有两种模块系统：

| | ES Module (ESM) | CommonJS (CJS) |
|--|-----------------|----------------|
| 导入 | `import { Server } from 'xxx'` | `const { Server } = require('xxx')` |
| 导出 | `export class Foo {}` | `module.exports = { Foo }` |
| 触发条件 | `package.json` 中 `"type": "module"` | 默认，或 `"type": "commonjs"` |
| 文件扩展名 | `.mjs` 或在 ESM 项目中的 `.js` | `.cjs` 或在 CJS 项目中的 `.js` |

MCP SDK（`@modelcontextprotocol/sdk`）是一个 ESM 包，因此 MCP 项目推荐使用 ESM。

### ESM 中的两个注意点

**1. `__dirname` 不可用**

CommonJS 中常用的 `__dirname`（当前文件所在目录）在 ESM 中不存在，需要用 `import.meta.url` 替代。yapi-mcp 的客户端文件中就用到了这个技巧：

```typescript
// src/client.ts 第 1-8 行
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);  // 当前文件的绝对路径
const __dirname = dirname(__filename);               // 当前文件所在目录
const COOKIE_FILE = join(__dirname, '..', '.cookie'); // 拼接文件路径
```

**2. 导入路径必须包含扩展名**

在 ESM 中，导入文件时必须写完整的扩展名。注意：即使源码是 `.ts` 文件，导入路径也要写 `.js`（因为编译后就是 `.js`）：

```typescript
// src/index.ts 第 3-9 行
import { Server } from '@modelcontextprotocol/sdk/server/index.js';       // 注意 .js
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { YApiClient } from './client.js';  // 导入本地文件也要写 .js
```

## 1.4 Shebang 行

yapi-mcp 的入口文件第一行是：

```
#!/usr/bin/env node
```

这叫做 **shebang**（也写作 hashbang），它告诉操作系统："用 `node` 来执行这个文件"。

**为什么需要？** 当用户通过 `npx yapi-mcp` 或全局安装后直接运行 `yapi-mcp` 命令时，操作系统需要知道用什么程序来执行它。没有 shebang 行，系统会尝试用 shell 解释器运行 JavaScript 代码，导致报错。

在 TypeScript 源码（`src/index.ts`）中写上 shebang，编译后会自动保留到 `dist/index.js` 的第一行。

## 1.5 npm 与 npx

### npm —— 包管理器

- `npm install`：安装 `package.json` 中声明的所有依赖
- `npm run build`：运行 `scripts` 中定义的 `build` 命令（这里是 `tsc` 编译 TypeScript）
- `npm publish`：将包发布到 npm 仓库

### npx —— 临时运行远程包

`npx` 是 npm 自带的工具，核心能力是：**临时下载一个 npm 包并立即运行它**，无需全局安装。

执行流程：

```
npx @tongyuhu/yapi-mcp
    ↓
1. 从 npm 下载 @tongyuhu/yapi-mcp 包
2. 找到 package.json 中的 bin 字段："yapi-mcp": "dist/index.js"
3. 执行 node dist/index.js
```

常用参数：

| 参数 | 说明 |
|------|------|
| `-y` | 自动确认安装，不弹出提示 |
| `-q` | 静默模式，减少安装过程的输出信息 |
| `@latest` | 强制使用最新版本（否则可能使用本地缓存） |

**这正是 MCP 客户端启动 MCP 服务器的方式**。看 yapi-mcp 的 `.mcp.json` 配置：

```json
{
  "mcpServers": {
    "yapi": {
      "command": "npx",
      "args": ["-y", "-q", "@tongyuhu/yapi-mcp@latest"],
      "env": {
        "YAPI_URL": "http://your-yapi-server.com",
        "YAPI_USERNAME": "your_username",
        "YAPI_PASSWORD": "your_password"
      }
    }
  }
}
```

Claude Desktop / Claude Code 读取这个配置后，会执行 `npx -y -q @tongyuhu/yapi-mcp@latest`，同时把 `env` 中定义的环境变量注入到子进程中。

## 1.6 npm publish 发布

将你的 MCP 服务器发布到 npm，其他人就可以通过 `npx` 直接使用。

### 控制发布内容

有两种方式控制 `npm publish` 打包哪些文件：

**方式一：`files` 白名单**（推荐）

在 `package.json` 中声明要包含的文件：

```json
"files": ["dist", "README.md", "LICENSE"]
```

只有列出的文件会被发布。源码、配置文件、敏感信息都不会被包含。

**方式二：`.npmignore` 黑名单**

类似 `.gitignore`，列出不想发布的文件：

```
src/
tsconfig.json
.env
.env.example
.cookie
.gitignore
API_DOCUMENTATION.md
```

两种方式可以同时使用。当 `files` 字段存在时，它的优先级更高。

### 发布命令

```bash
# 1. 确保已登录 npm
npm login

# 2. 构建项目
npm run build

# 3. 发布（scoped 包默认是私有的，需要加 --access public）
npm publish --access public

# 4. 更新版本后重新发布
npm version patch    # 1.0.0 → 1.0.1
npm run build
npm publish --access public
```

---

# 第二部分：MCP 的使用

## 2.1 MCP 是什么

**MCP（Model Context Protocol）** 是 Anthropic 提出的开放协议，让 AI 模型能够安全地连接外部工具和数据源。

你可以把 MCP 理解为 **"AI 的 USB 接口"**：

- USB 让电脑能连接各种外设（键盘、鼠标、硬盘）
- MCP 让 AI 能连接各种工具（数据库查询、API 调用、文件操作）

### 核心架构

```
┌─────────────────┐                    ┌─────────────────┐
│   MCP 客户端     │   JSON-RPC/stdio   │   MCP 服务器     │
│                 │ ◄════════════════► │                 │
│ Claude Desktop  │                    │ yapi-mcp        │
│ Claude Code     │                    │ （你编写的工具）  │
└─────────────────┘                    └─────────────────┘
```

- **MCP 客户端**：Claude Desktop、Claude Code 等 AI 应用，负责发送工具调用请求
- **MCP 服务器**：你编写的程序，接收请求、执行操作、返回结果
- **通信方式**：通过 stdio（标准输入/输出）传输 JSON-RPC 格式的消息

### MCP 服务器能提供的能力

| 能力 | 说明 | 示例 |
|------|------|------|
| **Tools**（工具） | 让 AI 能执行操作 | 查询接口文档、搜索数据库、发送请求 |
| **Resources**（资源） | 让 AI 能读取数据 | 读取文件内容、获取配置信息 |
| **Prompts**（提示模板） | 预定义的对话模板 | 代码审查模板、文档生成模板 |

本教程聚焦最常用的 **Tools** 能力。

## 2.2 在 Claude Desktop 中配置 MCP 服务器

### 配置文件位置

| 系统 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

### 配置示例

以 yapi-mcp 为例，在配置文件中添加：

```json
{
  "mcpServers": {
    "yapi": {
      "command": "npx",
      "args": ["-y", "@tongyuhu/yapi-mcp"],
      "env": {
        "YAPI_URL": "http://your-yapi-server.com",
        "YAPI_USERNAME": "your_username",
        "YAPI_PASSWORD": "your_password"
      }
    }
  }
}
```

配置字段说明：

| 字段 | 说明 |
|------|------|
| `"yapi"` | 服务器名称，可以自定义，用于在 Claude 中标识这个服务器 |
| `command` | 启动命令。用 `npx` 可以自动下载运行远程包，也可以用 `node` 运行本地文件 |
| `args` | 命令参数。`-y` 表示自动确认安装 |
| `env` | 环境变量。MCP 客户端启动服务器时会注入这些变量 |

配置完成后**重启 Claude Desktop**，在对话界面中应该能看到新增的工具图标。

## 2.3 在 Claude Code 中配置 MCP 服务器

Claude Code 支持三级配置，优先级从高到低：

### 项目级配置：`.mcp.json`

在项目根目录创建 `.mcp.json` 文件：

```json
{
  "mcpServers": {
    "yapi": {
      "command": "npx",
      "args": ["-y", "-q", "@tongyuhu/yapi-mcp@latest"],
      "env": {
        "YAPI_URL": "http://your-yapi-server.com",
        "YAPI_USERNAME": "your_username",
        "YAPI_PASSWORD": "your_password"
      }
    }
  }
}
```

**优点**：可以提交到 Git，团队成员 clone 后开箱即用（注意不要提交包含密码的配置）。

### 用户级配置：`~/.claude/settings.json`

在全局设置文件中添加相同的 `mcpServers` 配置，对所有项目生效。

### 推荐做法

- 将 MCP 服务器配置（不含敏感信息）放在 `.mcp.json` 中，提交到 Git 供团队共享
- 敏感信息（密码、Token）通过环境变量注入，不写入配置文件
- 如果 `.mcp.json` 中包含密码，应将其加入 `.gitignore`

## 2.4 环境变量配置

### 为什么用环境变量

MCP 服务器通常需要连接外部服务（API 地址、登录凭据等）。这些信息不应硬编码在代码中，而应通过环境变量传入：

- **安全性**：密码不会出现在代码仓库中
- **灵活性**：不同环境（开发/生产）可以使用不同配置
- **标准化**：这是 12-Factor App 的推荐做法

### 注入方式

MCP 配置中的 `env` 字段会在启动服务器进程时作为环境变量注入。服务器端通过 `process.env` 读取：

```typescript
// src/index.ts 第 11-24 行
const YAPI_URL = process.env.YAPI_URL;
const YAPI_USERNAME = process.env.YAPI_USERNAME;
const YAPI_PASSWORD = process.env.YAPI_PASSWORD;

if (!YAPI_URL || !YAPI_USERNAME || !YAPI_PASSWORD) {
  console.error('错误: 缺少必需的环境变量');
  console.error('请设置以下环境变量:');
  console.error('  YAPI_URL      - YApi 服务器地址 (如: http://yapi.example.com)');
  console.error('  YAPI_USERNAME - YApi 用户名');
  console.error('  YAPI_PASSWORD - YApi 密码');
  process.exit(1);
}
```

### `.env.example` 模板

在项目中提供 `.env.example` 文件，告知使用者需要配置哪些环境变量：

```bash
# YApi 服务器地址 (如: http://yapi.example.com)
YAPI_URL=http://yapi.example.com

# YApi 用户名 (LDAP 账号)
YAPI_USERNAME=your_username

# YApi 密码
YAPI_PASSWORD=your_password
```

## 2.5 使用 MCP 工具

配置完成后，在 Claude 中用自然语言就可以触发工具调用：

```
用户：帮我查一下 YApi 接口 ID 为 12345 的接口详情

Claude：我来查询一下这个接口的信息。
        [调用工具 get_interface，参数 interface_id: 12345]

        这个接口的详情如下：
        - 接口名称：获取用户信息
        - 请求方法：GET
        - 请求路径：/api/user/info
        - ...（格式化的接口文档）
```

整个流程是：

1. 你用自然语言描述需求
2. Claude 理解你的意图，判断需要调用哪个工具
3. Claude 构造参数，调用 MCP 服务器提供的工具
4. MCP 服务器执行操作，返回结果
5. Claude 将结果整合到回答中

---

# 第三部分：MCP 服务器的编写

现在进入核心部分：如何从零编写一个 MCP 服务器。

## 3.1 项目初始化

### 创建项目

```bash
mkdir my-mcp-server
cd my-mcp-server
npm init -y
```

### 安装依赖

```bash
# 运行时依赖：MCP 官方 SDK
npm install @modelcontextprotocol/sdk

# 开发依赖：TypeScript 编译器和 Node.js 类型定义
npm install -D typescript @types/node
```

### 配置 package.json 关键字段

确保以下字段正确设置：

```json
{
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "my-mcp-server": "dist/index.js"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 配置 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

### 目录结构

```
my-mcp-server/
├── src/
│   └── index.ts       # MCP 服务器主文件
├── dist/              # 编译输出（自动生成）
├── package.json
└── tsconfig.json
```

## 3.2 MCP SDK 核心概念

MCP SDK 提供了三个核心组件：

### Server —— 服务器实例

```typescript
// src/index.ts 第 34-44 行
const server = new Server(
  {
    name: 'yapi-mcp',       // 服务器名称，用于标识
    version: '1.0.0',        // 版本号
  },
  {
    capabilities: {
      tools: {},              // 声明支持 Tools 能力
    },
  }
);
```

`capabilities` 声明了服务器支持的能力类型。这里只声明了 `tools`，表示这个服务器提供工具调用功能。

### StdioServerTransport —— 传输层

负责通过 stdin/stdout 收发 JSON-RPC 消息。

### setRequestHandler —— 请求处理器

通过 `server.setRequestHandler(schema, handler)` 注册处理函数，处理特定类型的请求。

### 启动服务器

```typescript
// src/index.ts 第 232-241 行
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('YApi MCP 服务器已启动');  // ⚠️ 必须用 console.error
}

main().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});
```

> **重要**：MCP 协议通过 stdout 通信，因此所有日志必须输出到 stderr（使用 `console.error`）。如果误用 `console.log`，日志会混入 JSON-RPC 消息流，导致通信异常。

## 3.3 定义工具（ListToolsRequestSchema）

第一步是告诉 MCP 客户端："我这个服务器有哪些工具可用"。

```typescript
// src/index.ts 第 47-66 行
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
```

工具定义的三个关键字段：

| 字段 | 说明 |
|------|------|
| `name` | 工具的唯一标识。MCP 客户端通过它来调用对应的工具 |
| `description` | **非常重要**。Claude 通过这段描述来判断何时应该调用这个工具。写得越准确，Claude 的意图识别就越准确 |
| `inputSchema` | 基于 [JSON Schema](https://json-schema.org/) 的参数定义。声明了参数名、类型、描述和是否必填 |

如果你的服务器有多个工具，在 `tools` 数组中添加更多对象即可。

## 3.4 实现工具调用（CallToolRequestSchema）

第二步是实现工具被调用时的逻辑：

```typescript
// src/index.ts 第 69-124 行
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_interface') {
    const interfaceId = args?.interface_id as number;

    // 参数验证（见 3.5）
    if (typeof interfaceId !== 'number') {
      return {
        content: [{ type: 'text', text: '错误: interface_id 必须是数字' }],
        isError: true,
      };
    }

    try {
      // 调用业务逻辑
      const interfaceData = await yapiClient.getInterface(interfaceId);
      const output = formatInterfaceData(interfaceData);

      return {
        content: [{ type: 'text', text: output }],
      };
    } catch (error) {
      // 错误处理（见 3.6）
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text', text: `获取接口信息失败: ${errorMessage}` }],
        isError: true,
      };
    }
  }

  // 未知工具兜底
  return {
    content: [{ type: 'text', text: `未知工具: ${name}` }],
    isError: true,
  };
});
```

### 返回值格式

工具调用的返回值是一个包含 `content` 数组的对象：

```typescript
// 成功返回
{
  content: [
    { type: 'text', text: '这里是返回给 Claude 的文本内容' }
  ]
}

// 失败返回
{
  content: [
    { type: 'text', text: '错误信息' }
  ],
  isError: true  // 告诉 Claude 这次调用失败了
}
```

`content` 数组中的元素类型可以是 `text`（文本）或 `image`（图片，base64 编码）。大多数场景使用 `text` 就够了。

## 3.5 参数验证

MCP SDK **不会自动校验**客户端传入的参数类型。虽然 `inputSchema` 声明了参数是 `number` 类型，但客户端可能传入其他类型。因此需要手动验证：

```typescript
// src/index.ts 第 73-85 行
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
```

对于更复杂的参数验证，可以考虑使用 [zod](https://github.com/colinhacks/zod) 库来做 schema 验证。

## 3.6 错误处理

yapi-mcp 使用三层错误处理策略：

**第一层：参数验证**
检查必填参数是否存在、类型是否正确（如上节所示）。

**第二层：业务逻辑 try-catch**
捕获 API 调用过程中可能发生的异常：

```typescript
// src/index.ts 第 101-112 行
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
```

`error instanceof Error ? error.message : String(error)` 是一种安全的错误信息提取模式。因为 JavaScript 中 `throw` 可以抛出任何类型的值，不一定是 `Error` 对象。

**第三层：未知工具兜底**
当客户端请求了一个不存在的工具时，返回有意义的错误信息：

```typescript
// src/index.ts 第 115-123 行
return {
  content: [
    {
      type: 'text',
      text: `未知工具: ${name}`,
    },
  ],
  isError: true,
};
```

## 3.7 Stdio 传输层详解

MCP 目前最常用的传输方式是 **Stdio**（标准输入/输出）：

```
MCP 客户端（Claude）                 MCP 服务器（你的程序）
      │                                    │
      │ ──── stdin (JSON-RPC 请求) ─────► │
      │                                    │
      │ ◄──── stdout (JSON-RPC 响应) ──── │
      │                                    │
      │        stderr (日志输出)           │
```

- MCP 客户端启动服务器作为**子进程**
- 通过子进程的 **stdin** 发送 JSON-RPC 请求
- 通过子进程的 **stdout** 接收 JSON-RPC 响应
- **stderr** 用于日志输出，不影响协议通信

这就是为什么必须用 `console.error` 而不是 `console.log`——后者会写入 stdout，破坏 JSON-RPC 消息流。

启动传输层只需要两行代码：

```typescript
const transport = new StdioServerTransport();
await server.connect(transport);
```

## 3.8 业务逻辑实现

MCP 服务器的核心价值是将外部系统的能力暴露给 AI。yapi-mcp 将 YApi 的接口查询能力封装成了工具。

### 定义数据接口

首先用 TypeScript 接口定义数据结构：

```typescript
// src/client.ts 第 10-20 行
export interface YApiConfig {
  url: string;       // YApi 服务器地址
  username: string;  // 用户名
  password: string;  // 密码
}

export interface YApiResponse<T = unknown> {
  errcode: number;   // 0 表示成功
  errmsg?: string;   // 错误信息
  data: T;           // 响应数据
}
```

### 封装客户端类

将与外部系统的交互封装成一个独立的类，与 MCP 协议层分离：

```typescript
// src/client.ts 第 47-53 行
export class YApiClient {
  private config: YApiConfig;
  private cookie: string | null = null;

  constructor(config: YApiConfig) {
    this.config = config;
  }

  // ... 各种方法
}
```

### 认证管理

yapi-mcp 实现了完整的认证流程，包括 Cookie 缓存：

```typescript
// src/client.ts 第 178-194 行
async ensureAuthenticated(): Promise<void> {
  // 1. 尝试加载缓存的 cookie
  if (!this.cookie) {
    this.cookie = await this.loadCookie();
  }

  // 2. 验证 cookie 是否仍然有效
  if (this.cookie) {
    const isValid = await this.getUserStatus();
    if (isValid) {
      return;  // cookie 有效，直接使用
    }
  }

  // 3. cookie 无效或不存在，重新登录
  await this.login();
}
```

### 数据格式化

从 API 获取到的原始数据需要格式化成 Claude 容易理解的文本。yapi-mcp 将数据转为 Markdown 格式：

```typescript
// src/index.ts 第 129-229 行（关键片段）
function formatInterfaceData(data: Record<string, unknown>): string {
  const lines: string[] = [];

  lines.push(`# ${data.title || '未命名接口'}`);
  lines.push('');
  lines.push(`**接口 ID**: ${data._id}`);
  lines.push(`**请求方法**: ${data.method}`);
  lines.push(`**请求路径**: ${data.path}`);
  lines.push(`**状态**: ${data.status}`);

  // ... 依次格式化请求头、路径参数、Query 参数、请求体、响应体

  return lines.join('\n');
}
```

Markdown 格式的优点是：Claude 能很好地理解其结构，并在回答中以格式化方式呈现。

## 3.9 测试和调试

### 本地构建

```bash
npm run build  # 编译 TypeScript → JavaScript
```

### 手动测试（JSON-RPC）

设置环境变量后直接运行服务器，通过 stdin 发送 JSON-RPC 请求：

```bash
# 设置环境变量并启动
YAPI_URL=http://your-yapi.com YAPI_USERNAME=user YAPI_PASSWORD=pass node dist/index.js
```

然后在 stdin 中输入 JSON-RPC 请求：

```json
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

服务器会在 stdout 返回工具列表。

调用工具：

```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_interface","arguments":{"interface_id":12345}}}
```

### 使用 MCP Inspector

MCP 官方提供了一个可视化调试工具：

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

它会启动一个 Web 界面，让你可以图形化地查看工具列表、发送请求、查看响应。

### 在 Claude Code 中集成测试

在项目根目录创建 `.mcp.json`，指向本地构建产物：

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "YAPI_URL": "http://your-yapi.com",
        "YAPI_USERNAME": "your_username",
        "YAPI_PASSWORD": "your_password"
      }
    }
  }
}
```

然后在 Claude Code 中直接使用，验证工具是否正常工作。

### 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| MCP 服务器连接失败 | `console.log` 污染了 stdout | 将所有 `console.log` 改为 `console.error` |
| 模块找不到 | ESM 导入路径缺少 `.js` 扩展名 | 导入路径加上 `.js`，如 `'./client.js'` |
| npx 执行报错 | `dist/index.js` 缺少 shebang 行 | 在 `src/index.ts` 第一行加上 `#!/usr/bin/env node` |
| 环境变量为空 | MCP 配置中未设置 `env` | 检查 `.mcp.json` 或 `claude_desktop_config.json` 中的 `env` 字段 |
| TypeScript 编译报错 | `module` 和 `moduleResolution` 不匹配 | 确保两者都设为 `NodeNext`，且 `package.json` 中有 `"type": "module"` |

## 3.10 发布到 npm

### 发布前检查清单

1. `package.json` 中 `name`、`version`、`bin`、`files`、`main` 字段正确
2. `tsconfig.json` 中 `outDir` 指向 `dist`
3. 执行 `npm run build` 编译通过
4. 检查 `dist/index.js` 第一行是否有 `#!/usr/bin/env node`
5. `README.md` 包含使用说明和配置示例

### 发布流程

```bash
# 登录 npm（首次）
npm login

# 构建
npm run build

# 发布 scoped 包（需要 --access public，否则默认私有）
npm publish --access public
```

### 发布后验证

```bash
# 通过 npx 测试是否能正常启动
YAPI_URL=http://test.com YAPI_USERNAME=test YAPI_PASSWORD=test npx @your-scope/your-mcp-server
```

### 版本更新

```bash
# 修改代码后...
npm version patch   # 1.0.0 → 1.0.1（修复）
# 或
npm version minor   # 1.0.0 → 1.1.0（新功能）
# 或
npm version major   # 1.0.0 → 2.0.0（不兼容变更）

npm run build
npm publish --access public
```

---

## 总结

本教程以 yapi-mcp 项目为例，介绍了 MCP 开发的完整流程：

1. **Node.js 基础**：理解 `package.json`（特别是 `bin` 和 `type`）、TypeScript 配置、ES Module、shebang、npx 运行机制
2. **MCP 使用**：在 Claude Desktop / Claude Code 中配置 MCP 服务器，通过自然语言触发工具调用
3. **MCP 编写**：创建 `Server` 实例、定义工具（`ListToolsRequestSchema`）、实现工具调用（`CallToolRequestSchema`）、参数验证、错误处理、Stdio 传输、业务逻辑封装

MCP 的核心思想很简单：**用一个标准化的协议，把外部系统的能力桥接给 AI**。掌握了这个模式，你可以将任何 API、数据库、内部工具都封装成 MCP 服务器，让 Claude 成为你的全能助手。
