import { useEffect, useRef, useState } from 'react'

const LOADER_SCRIPT_URL = 'https://embed.autostaff.cn/sdk/digi-employee.js'

function ensureLoaderScript() {
  return new Promise((resolve, reject) => {
    if (window.DigiEmployee) {
      resolve()
      return
    }

    const existing = document.querySelector(`script[src="${LOADER_SCRIPT_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', reject, { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = LOADER_SCRIPT_URL
    script.async = true
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', reject, { once: true })
    document.head.appendChild(script)
  })
}

export default function App() {
  const mountRef = useRef(null)
  const workerRef = useRef(null)
  const documentTextRef = useRef('')
  const [documentText, setDocumentText] = useState(`React example document

- Pull current CRM summary
- Draft the next follow-up
- Save edits back to host`)

  documentTextRef.current = documentText

  useEffect(() => {
    let disposed = false

    async function boot() {
      await ensureLoaderScript()
      if (disposed || !mountRef.current) return

      workerRef.current = new window.DigiEmployee({
        stationId: import.meta.env.VITE_STATION_ID,
        externalConversationId: import.meta.env.VITE_EXTERNAL_CONVERSATION_ID,
        layout: {
          mode: 'inline',
          mountTarget: mountRef.current,
        },
        getEmbedAccessToken: async () => {
          const response = await fetch(import.meta.env.VITE_EMBED_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              externalConversationId: import.meta.env.VITE_EXTERNAL_CONVERSATION_ID,
            }),
          })
          const data = await response.json()
          return data.embedAccessToken
        },
        extendsUiTools: [
          {
            name: 'readCurrentDocument',
            description: 'Read the current host-side document',
            execute: async () => ({ content: documentTextRef.current }),
          },
          {
            name: 'saveCurrentDocument',
            description: 'Save document content back into the host application',
            execute: async (payload) => {
              if (payload && typeof payload === 'object' && 'content' in payload) {
                setDocumentText(String(payload.content ?? ''))
              }
              return { ok: true }
            },
          },
        ],
      })

      workerRef.current.init()
    }

    boot().catch((error) => {
      console.error('Failed to initialize octopus embed example', error)
    })

    return () => {
      disposed = true
      if (workerRef.current && typeof workerRef.current.close === 'function') {
        workerRef.current.close()
      }
    }
  }, [])

  return (
    <main className="page">
      <section className="host-pane">
        <h1>React Host App</h1>
        <p>octopus can read and write the current document through browser-side UI tools.</p>
        <textarea value={documentText} onChange={(event) => setDocumentText(event.target.value)} />
      </section>
      <aside className="embed-pane">
        <div ref={mountRef} className="embed-surface" />
      </aside>
    </main>
  )
}
