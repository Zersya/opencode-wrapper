export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on server startup (not in edge runtime)
    console.log('[instrumentation] Server starting up...')
    
    const { ensureOpenCodeInstalled } = await import('./lib/server/opencode-installer')
    
    const result = await ensureOpenCodeInstalled()
    
    if (result.installed) {
      console.log(`[instrumentation] OpenCode CLI ready: ${result.version}`)
    } else {
      console.error(`[instrumentation] Warning: OpenCode CLI not available: ${result.error}`)
      console.error('[instrumentation] Executions will fail. Please install manually: npm install -g @anthropic/opencode')
    }
    
    // Check if Docker mode is enabled
    if (process.env.USE_DOCKER === 'true') {
      console.log('[instrumentation] Running in Docker mode')
      
      const { initializeDockerEnvironment } = await import('./lib/server/docker-manager')
      
      try {
        await initializeDockerEnvironment()
        console.log('[instrumentation] Docker environment initialized')
      } catch (error) {
        console.error('[instrumentation] Failed to initialize Docker environment:', error)
      }
    }
  }
}
