import { type PageProps } from "$fresh/server.ts";

const API_BASE_URL = Deno.env.get("API_BASE_URL") || "http://localhost:8005/api";

export default function App({ Component }: PageProps) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>签约服务单管理系统</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <script dangerouslySetInnerHTML={{ __html: `window.API_BASE_URL = "${API_BASE_URL}";` }} />
      </head>
      <body class="bg-gray-50">
        <Component />
      </body>
    </html>
  );
}
