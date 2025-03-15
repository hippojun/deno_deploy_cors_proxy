import { Application } from "https://deno.land/x/oak@v10.1.0/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { CSS, render } from "https://deno.land/x/gfm@0.1.22/mod.ts";

function addCorsHeaders(headers) {
  if (!headers.has("access-control-allow-origin")) {
    headers.set("access-control-allow-origin", "*");
  }
  return headers;
}

function isUrl(url) {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return false;
  }

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

const app = new Application();

// 应用CORS中间件
app.use(oakCors());

// 处理请求的中间件
app.use(async (ctx) => {
  const pathname = ctx.request.url.pathname;
  const search = ctx.request.url.search || "";
  const url = pathname.substring(1) + search;

  if (isUrl(url)) {
    console.log("proxy to %s", url);
    
    if (ctx.request.method.toUpperCase() === "OPTIONS") {
      ctx.response.status = 204;
      addCorsHeaders(ctx.response.headers);
      return;
    }

    try {
      const response = await fetch(url, {
        method: ctx.request.method,
        headers: ctx.request.headers,
        body: ctx.request.method !== "GET" && ctx.request.method !== "HEAD" ? ctx.request.body({ type: "stream" }).value : undefined
      });
      
      // 设置状态码
      ctx.response.status = response.status;
      
      // 复制所有响应头
      for (const [key, value] of response.headers.entries()) {
        ctx.response.headers.set(key, value);
      }
      
      // 添加CORS头
      addCorsHeaders(ctx.response.headers);
      
      // 设置响应体
      ctx.response.body = response.body;
    } catch (error) {
      console.error("Proxy error:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to proxy request" };
    }
    return;
  }

  // 如果不是代理请求，显示README
  try {
    const readme = await Deno.readTextFile("./README.md");
    const body = render(readme);
    const html = `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>CORS Proxy</title>
          <style>
            body {
              margin: 0;
              background-color: var(--color-canvas-default);
              color: var(--color-fg-default);
            }
            main {
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem 1rem;
            }
            ${CSS}
          </style>
        </head>
        <body data-color-mode="auto" data-light-theme="light" data-dark-theme="dark">
          <main class="markdown-body">
            ${body}
          </main>
        </body>
      </html>`;
    
    ctx.response.type = "html";
    ctx.response.body = html;
  } catch (error) {
    console.error("Error serving README:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to serve README" };
  }
});

const port = Number(Deno.env.get("PORT") || "8000");
console.log(`Starting server on port ${port}`);

await app.listen({ port });
