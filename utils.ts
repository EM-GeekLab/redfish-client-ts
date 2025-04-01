import * as https from "node:https"
import * as http from "node:http";
import { URL, urlToHttpOptions } from "node:url";


/**
 * 通过 fetch 获取数据，忽略SSL证书验证，支持Node环境和Bun环境
 * @param url 请求地址
 * @param options 请求选项
 */
export const fetchWithoutSSL = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (typeof Bun !== 'undefined') {
    // Bun环境 - 使用Bun特有的自定义选项来忽略SSL证书验证
    const bunOptions = {
      tls: { rejectUnauthorized: false }
    };
    return fetch(url, { ...options, ...bunOptions });
  } else {
    // Node环境 - 使用自定义的HTTP请求实现
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    // 准备请求选项
    const requestOptions = {
      ...urlToHttpOptions(parsedUrl),
      method: options.method || 'GET',
      headers: options.headers as any,
      agent: parsedUrl.protocol === 'https:' ? new https.Agent({
        rejectUnauthorized: false
      }) : undefined,
    };

    return new Promise((resolve, reject) => {
      const req = protocol.request(requestOptions, (res: http.IncomingMessage) => {
        const headers = new Headers();

        // 处理响应头
        for (const key in res.headers) {
          const value = res.headers[key];
          if (value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach(v => headers.append(key, v));
            } else {
              headers.set(key, value);
            }
          }
        }

        // 收集响应数据
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const body = Buffer.concat(chunks);

          // 创建符合 fetch Response 接口的对象
          const response = {
            ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: headers,
            url: url,
            json: async () => JSON.parse(body.toString()),
            text: async () => body.toString(),
            arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
            blob: async () => new Blob([body]),
            clone: function() { return this; },
            body: null,
            bodyUsed: false,
          } as Response;

          resolve(response);
        });
      });

      req.on('error', (error: Error) => {
        reject(error);
      });

      // 处理请求体
      if (options.body) {
        if (Buffer.isBuffer(options.body)) {
          req.write(options.body);
        } else if (typeof options.body === 'string') {
          req.write(options.body);
        } else if (options.body instanceof URLSearchParams) {
          req.write(options.body.toString());
        } else if (options.body instanceof FormData) {
          reject(new Error('暂不支持FormData请求体'));
        } else if (options.body instanceof Blob) {
          // 读取Blob内容并写入
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
              req.write(Buffer.from(reader.result));
              req.end();
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(options.body);
          return; // 防止下面的req.end()被调用
        } else if (typeof options.body === 'object') {
          try {
            req.write(JSON.stringify(options.body));
          } catch (e) {
            reject(new Error(`无法序列化请求体: ${e}`));
            return;
          }
        }
      }

      req.end();
    });
  }
};