import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const COOKIE_FILE = join(__dirname, '..', '.cookie');

export interface YApiConfig {
  url: string;
  username: string;
  password: string;
}

export interface YApiResponse<T = unknown> {
  errcode: number;
  errmsg?: string;
  data: T;
}

export interface InterfaceData {
  _id: number;
  title: string;
  method: string;
  path: string;
  project_id: number;
  catid: number;
  status: string;
  tag: string[];
  desc?: string;
  markdown?: string;
  req_headers?: Array<{ name: string; value: string; required?: string }>;
  req_params?: Array<{ name: string; desc?: string; example?: string }>;
  req_query?: Array<{ name: string; required?: string; desc?: string; example?: string }>;
  req_body_type?: string;
  req_body_form?: Array<{ name: string; type: string; required?: string; desc?: string }>;
  req_body_other?: string;
  res_body_type?: string;
  res_body?: string;
  res_body_is_json_schema?: boolean;
  add_time: number;
  up_time: number;
  [key: string]: unknown;
}

export class YApiClient {
  private config: YApiConfig;
  private cookie: string | null = null;

  constructor(config: YApiConfig) {
    this.config = config;
  }

  /**
   * 从文件加载缓存的 cookie
   */
  private async loadCookie(): Promise<string | null> {
    try {
      if (existsSync(COOKIE_FILE)) {
        const cookie = await readFile(COOKIE_FILE, 'utf-8');
        return cookie.trim() || null;
      }
    } catch {
      // 忽略读取错误
    }
    return null;
  }

  /**
   * 保存 cookie 到文件
   */
  private async saveCookie(cookie: string): Promise<void> {
    await writeFile(COOKIE_FILE, cookie, 'utf-8');
  }

  /**
   * 从响应头中提取 cookie
   */
  private extractCookie(response: Response): string | null {
    // 使用 getSetCookie() 获取所有 set-cookie 头
    const setCookies = response.headers.getSetCookie?.() || [];

    if (setCookies.length > 0) {
      // 提取每个 cookie 的名称和值部分
      const cookies = setCookies.map(c => c.split(';')[0].trim());
      return cookies.join('; ');
    }

    // 降级处理：尝试 get('set-cookie')
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const cookies = setCookie.split(',').map(c => c.split(';')[0].trim());
      return cookies.join('; ');
    }

    return null;
  }

  /**
   * 尝试登录（先普通登录，再 LDAP 登录）
   */
  async login(): Promise<boolean> {
    // 先尝试普通登录
    const normalResult = await this.tryLogin('/api/user/login');
    if (normalResult) {
      return true;
    }

    // 再尝试 LDAP 登录
    const ldapResult = await this.tryLogin('/api/user/login_by_ldap');
    if (ldapResult) {
      return true;
    }

    throw new Error('登录失败: 普通登录和 LDAP 登录均失败');
  }

  /**
   * 尝试特定方式登录
   */
  private async tryLogin(endpoint: string): Promise<boolean> {
    const url = `${this.config.url}${endpoint}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.config.username,
          password: this.config.password,
        }),
      });

      const data = await response.json() as YApiResponse;

      if (data.errcode === 0) {
        const cookie = this.extractCookie(response);
        if (cookie) {
          this.cookie = cookie;
          await this.saveCookie(cookie);
          return true;
        }
      }
    } catch {
      // 忽略单个登录方式的错误
    }

    return false;
  }

  /**
   * 获取用户状态，验证 cookie 是否有效
   */
  async getUserStatus(): Promise<boolean> {
    if (!this.cookie) {
      return false;
    }

    const url = `${this.config.url}/api/user/status`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': this.cookie,
      },
    });

    const data = await response.json() as YApiResponse;
    return data.errcode === 0;
  }

  /**
   * 确保已登录，如果 cookie 无效则重新登录
   */
  async ensureAuthenticated(): Promise<void> {
    // 尝试加载缓存的 cookie
    if (!this.cookie) {
      this.cookie = await this.loadCookie();
    }

    // 验证 cookie 是否有效
    if (this.cookie) {
      const isValid = await this.getUserStatus();
      if (isValid) {
        return;
      }
    }

    // 重新登录
    await this.login();
  }

  /**
   * 发送带认证的 GET 请求
   */
  private async authenticatedGet<T>(endpoint: string): Promise<YApiResponse<T>> {
    await this.ensureAuthenticated();

    const url = `${this.config.url}${endpoint}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': this.cookie!,
      },
    });

    return response.json() as Promise<YApiResponse<T>>;
  }

  /**
   * 根据接口 ID 获取接口详情
   */
  async getInterface(interfaceId: number): Promise<InterfaceData> {
    const data = await this.authenticatedGet<InterfaceData>(
      `/api/interface/get?id=${interfaceId}`
    );

    if (data.errcode !== 0) {
      throw new Error(`获取接口失败: ${data.errmsg || `errcode=${data.errcode}`}`);
    }

    return data.data;
  }
}
