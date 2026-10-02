import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

async function start() {
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '/config.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Runtime configuration could not be loaded'))
    document.head.append(script)
  })
  const { App } = await import('./App')
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void start()
