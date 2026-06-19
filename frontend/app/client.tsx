/// <reference types="vinxi/types/client" />
import { hydrateRoot } from 'react-dom/client'
import { StartClient } from '@tanstack/start'
import { createRouter } from './router'

const router = createRouter()
const StartClientAny = StartClient as any

hydrateRoot(document.getElementById('root')!, <StartClientAny router={router} />)
