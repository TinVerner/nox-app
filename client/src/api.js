// Тот же адрес, что у страницы: nginx на 8081 отдаёт и сайт, и /api, и /ws.
export const api = typeof window !== 'undefined' ? window.location.origin : ''

export function apiFetch(path, options = {}) {
  return fetch(api + path, {
    ...options,
    credentials: 'include',
  })
}
