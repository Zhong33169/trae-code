import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '~/app/api'
import type {
  SeedRecord, SeedRecordDetail, PaginatedRecords, Statistics,
} from '~/app/api'

export interface MsgState { type: 'ok' | 'err'; text: string }

function useBaseLoader<T>(
  fetcher: () => Promise<{ success: boolean; message: string; data?: T }>,
  deps: any[] = [],
  autoLoad = true,
) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<T | null>(null)
  const [msg, setMsg] = useState<MsgState | null>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const load = useCallback(async () => {
    setLoading(true)
    setMsg(null)
    const r = await fetcherRef.current()
    setLoading(false)
    if (r.success && r.data !== undefined) setData(r.data)
    else setMsg({ type: 'err', text: r.message })
    return r
  }, [])

  useEffect(() => {
    if (autoLoad) load()
  }, [...deps, autoLoad])

  const showMsg = useCallback((type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
  }, [])

  const refresh = useCallback(() => {
    setMsg(null)
    return load()
  }, [load])

  return { loading, data, msg, setData, load, showMsg, refresh, setMsg }
}

export function useRecordList(params: {
  status?: string; node?: string; keyword?: string; page: number; page_size: number
}) {
  return useBaseLoader<PaginatedRecords>(
    () => api.listRecords(params),
    [params.status, params.node, params.keyword, params.page, params.page_size],
    true,
  )
}

export function useRecordDetail(id: string) {
  return useBaseLoader<SeedRecordDetail>(
    () => api.getRecord(id),
    [id],
    true,
  )
}

export function useStats() {
  return useBaseLoader<Statistics>(
    () => api.stats(),
    [],
    true,
  )
}
