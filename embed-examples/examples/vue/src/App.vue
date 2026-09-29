<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

const LOADER_SCRIPT_URL = 'https://embed.autostaff.cn/sdk/digi-employee.js'

const mountEl = ref(null)
const worker = ref(null)
const documentText = ref(`Vue example document

- Read current ticket context
- Propose a reply draft
- Save edits back into the host view`)

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

onMounted(async () => {
  await ensureLoaderScript()
  if (!mountEl.value) return

  worker.value = new window.DigiEmployee({
    stationId: import.meta.env.VITE_STATION_ID,
    externalConversationId: import.meta.env.VITE_EXTERNAL_CONVERSATION_ID,
    layout: {
      mode: 'inline',
      mountTarget: mountEl.value,
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
        execute: async () => ({ content: documentText.value }),
      },
      {
        name: 'saveCurrentDocument',
        description: 'Save document content back into the host application',
        execute: async (payload) => {
          if (payload && typeof payload === 'object' && 'content' in payload) {
            documentText.value = String(payload.content ?? '')
          }
          return { ok: true }
        },
      },
    ],
  })

  worker.value.init()
})

onBeforeUnmount(() => {
  if (worker.value && typeof worker.value.close === 'function') {
    worker.value.close()
  }
})
</script>

<template>
  <main class="page">
    <section class="host-pane">
      <h1>Vue Host App</h1>
      <p>octopus can use browser-side UI tools to read and update the current document.</p>
      <textarea v-model="documentText" />
    </section>
    <aside class="embed-pane">
      <div ref="mountEl" class="embed-surface" />
    </aside>
  </main>
</template>
