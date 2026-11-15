export const api = 'http://localhost:3000'

export function apiFetch(path, options = {}) {
  return fetch(api + path, {
    ...options,
    credentials: 'include',
  })
}
