import { type PageProps } from "$fresh/server.ts";

export default function App({ Component }: PageProps) {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>处方流转单系统</title>
      </head>
      <body class="bg-gray-50">
        <Component />
      </body>
    </html>
  );
}
