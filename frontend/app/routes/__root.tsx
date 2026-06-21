import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import React from 'react'
import { QueryClient } from '@tanstack/react-query'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <html lang="zh-CN">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>供应链金融平台</title>
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  ),
})
