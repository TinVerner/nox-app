import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

export function useGamesSocket(screen) {
  const [gamesReload, setGamesReload] = useState(0)
  const [notice, setNotice] = useState('')
  const [noticeKey, setNoticeKey] = useState(0)
  const screenRef = useRef(screen)
  screenRef.current = screen

  useEffect(() => {
    let socket
    try {
      socket = new WebSocket(api.replace(/^http/, 'ws') + '/ws')
      socket.onmessage = (event) => {
        let data
        try {
          data = JSON.parse(event.data)
        } catch {
          return
        }
        if (data?.type !== 'games') return
        if (data.notice) {
          setNotice(data.notice)
          setNoticeKey((key) => key + 1)
        }
        const current = screenRef.current
        if (current !== 'games' && current !== 'home') return
        setGamesReload((n) => n + 1)
      }
    } catch {
      return
    }
    return () => {
      try {
        socket.close()
      } catch {
        // the schedule still loads through the normal fetch
      }
    }
  }, [])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [notice, noticeKey])

  return { gamesReload, notice, setNotice }
}
