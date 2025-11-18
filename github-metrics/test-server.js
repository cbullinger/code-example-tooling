import http from 'http';

const PORT = process.env.PORT || 8080;

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    // Health check endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy' }));
    return;
  }

  if (req.url === '/secrets') {
    // Secrets check endpoint - shows if env vars are loaded
    const atlasConnString = process.env.ATLAS_CONNECTION_STRING;
    const githubToken = process.env.GITHUB_TOKEN;

    const secretsStatus = {
      timestamp: new Date().toISOString(),
      environment: {
        ATLAS_CONNECTION_STRING: atlasConnString ? {
          exists: true,
          length: atlasConnString.length,
          preview: atlasConnString.substring(0, 20) + '...' // Show first 20 chars only
        } : {
          exists: false,
          error: 'Environment variable not set'
        },
        GITHUB_TOKEN: githubToken ? {
          exists: true,
          length: githubToken.length,
          preview: githubToken.substring(0, 10) + '...' // Show first 10 chars only
        } : {
          exists: false,
          error: 'Environment variable not set'
        }
      },
      allEnvVars: Object.keys(process.env).sort()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(secretsStatus, null, 2));
    return;
  }

  if (req.url === '/') {
    // Root endpoint with instructions
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>GitHub Metrics Test Server</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          h1 { color: #00684A; }
          .endpoint { background: #f4f4f4; padding: 10px; margin: 10px 0; border-radius: 5px; }
          code { background: #e0e0e0; padding: 2px 6px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>🧪 GitHub Metrics Test Server</h1>
        <p>This is a test server to verify Kubernetes secrets are properly injected.</p>
        
        <h2>Available Endpoints:</h2>
        
        <div class="endpoint">
          <h3>GET /health</h3>
          <p>Health check endpoint</p>
          <p><a href="/health">Try it →</a></p>
        </div>
        
        <div class="endpoint">
          <h3>GET /secrets</h3>
          <p>Check if environment variables (secrets) are loaded</p>
          <p><a href="/secrets">Try it →</a></p>
        </div>
        
        <div class="endpoint">
          <h3>GET /</h3>
          <p>This page</p>
        </div>

        <h2>Testing Instructions:</h2>
        <ol>
          <li>Visit <code>/secrets</code> to verify your secrets are loaded</li>
          <li>Check that <code>ATLAS_CONNECTION_STRING</code> and <code>GITHUB_TOKEN</code> exist</li>
          <li>Once verified, switch back to the cron job by updating the Dockerfile</li>
        </ol>

        <p><strong>Server Status:</strong> Running on port ${PORT}</p>
      </body>
      </html>
    `);
    return;
  }

  // 404 for unknown routes
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📍 Endpoints:`);
  console.log(`   - http://localhost:${PORT}/`);
  console.log(`   - http://localhost:${PORT}/health`);
  console.log(`   - http://localhost:${PORT}/secrets`);
  console.log(`\n🔍 Checking environment variables...`);
  console.log(`   ATLAS_CONNECTION_STRING: ${process.env.ATLAS_CONNECTION_STRING ? '✅ Set' : '❌ Not set'}`);
  console.log(`   GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? '✅ Set' : '❌ Not set'}`);
});

