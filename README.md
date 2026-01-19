# yapi-mcp

YApi 接口查询 MCP 服务器，让 Claude 能够直接获取 YApi 接口文档信息。

## 功能

- 根据接口 ID 获取 YApi 接口详情
- 支持普通登录和 LDAP 登录
- 自动缓存登录状态

## 安装使用

### Claude Desktop 配置

在 `claude_desktop_config.json` 中添加:

```json
{
  "mcpServers": {
    "yapi": {
      "command": "npx",
      "args": ["-y", "yapi-mcp"],
      "env": {
        "YAPI_URL": "http://your-yapi-server.com",
        "YAPI_USERNAME": "your_username",
        "YAPI_PASSWORD": "your_password"
      }
    }
  }
}
```

### Claude Code 配置

在 `~/.claude/settings.json` 中添加相同的配置。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| YAPI_URL | 是 | YApi 服务器地址 |
| YAPI_USERNAME | 是 | YApi 用户名 |
| YAPI_PASSWORD | 是 | YApi 密码 |

## MCP 工具

### get_interface

根据接口 ID 获取 YApi 接口的详细信息。

**参数：**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `interface_id` | number | 是 | YApi 接口 ID |

**返回信息包括：**

- 接口名称、请求方法、请求路径
- 请求头、路径参数、Query 参数
- 请求体（支持 form 和 JSON 格式）
- 响应体结构

## 许可证

MIT
