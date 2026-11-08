import { ParsedTool, OpenAPISpec, GatewayConfig } from '../types.js';

export function renderPlaygroundHtml(spec: OpenAPISpec, tools: ParsedTool[], config: GatewayConfig): string {
  const toolsJson = JSON.stringify(tools);
  const port = config.port || 3000;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(spec.info.title)} - OpenAPI to MCP Gateway</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --primary: #58a6ff;
      --primary-hover: #1f6feb;
      --green: #238636;
      --purple: #8957e5;
      --code-bg: #0b0e14;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding-bottom: 60px;
    }
    header {
      background: var(--card-bg);
      border-bottom: 1px solid var(--border);
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand h1 {
      font-size: 18px;
      font-weight: 600;
    }
    .badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-mock { background: rgba(137, 87, 229, 0.2); color: #d2a8ff; border: 1px solid rgba(137, 87, 229, 0.4); }
    .badge-live { background: rgba(35, 134, 54, 0.2); color: #7ee787; border: 1px solid rgba(35, 134, 54, 0.4); }
    .badge-method { font-family: 'JetBrains Mono', monospace; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
    .method-POST { background: #1f4028; color: #7ee787; }
    .method-GET { background: #163356; color: #79c0ff; }
    .method-DELETE { background: #49181c; color: #ff7b72; }
    .method-PUT { background: #432912; color: #ffa657; }
    
    .actions { display: flex; gap: 12px; align-items: center; }
    .btn {
      font-size: 13px;
      font-weight: 500;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    .btn-primary { background: var(--primary-hover); color: #fff; }
    .btn-primary:hover { background: var(--primary); }
    .btn-outline { background: transparent; border-color: var(--border); color: var(--text); }
    .btn-outline:hover { background: var(--border); }

    .container {
      max-width: 1200px;
      margin: 32px auto;
      padding: 0 20px;
    }
    .hero {
      background: linear-gradient(180deg, rgba(31, 111, 235, 0.1) 0%, rgba(22, 27, 34, 0.5) 100%);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .hero h2 { font-size: 22px; margin-bottom: 8px; }
    .hero p { color: var(--text-muted); font-size: 14px; margin-bottom: 16px; }
    .sse-box {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
    }
    .sse-box span { color: var(--primary); }

    .grid {
      display: grid;
      grid-template-columns: 360px 1fr;
      gap: 24px;
    }
    .tool-list {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      height: calc(100vh - 280px);
      display: flex;
      flex-direction: column;
    }
    .tool-list-header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
      font-weight: 600;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
    }
    .tool-items { overflow-y: auto; flex: 1; }
    .tool-item {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background 0.15s;
    }
    .tool-item:hover { background: rgba(255, 255, 255, 0.03); }
    .tool-item.active { background: rgba(88, 166, 255, 0.12); border-left: 3px solid var(--primary); }
    .tool-item-title { font-weight: 500; font-size: 14px; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
    .tool-item-desc { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    .workspace {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      height: calc(100vh - 280px);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    .workspace-header { margin-bottom: 20px; border-bottom: 1px solid var(--border); padding-bottom: 16px; }
    .workspace-title { font-size: 20px; font-weight: 600; display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
    .workspace-desc { color: var(--text-muted); font-size: 13px; }

    .form-group { margin-bottom: 16px; }
    .form-label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; color: var(--text); }
    .form-input {
      width: 100%;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      color: var(--text);
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
    }
    .form-input:focus { outline: none; border-color: var(--primary); }
    textarea.form-input { min-height: 120px; resize: vertical; }

    .response-card {
      margin-top: 24px;
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .response-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: #79c0ff;
      overflow-x: auto;
      max-height: 300px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <h1>🌐 OpenAPI-to-MCP Gateway</h1>
      <span class="badge ${config.mock ? 'badge-mock' : 'badge-live'}">${config.mock ? 'Mock Mode' : 'Live Gateway'}</span>
      ${config.biSnap?.enabled ? '<span class="badge badge-live">BI-SNAP Enabled</span>' : ''}
    </div>
    <div class="actions">
      <a href="https://glama.ai/mcp/inspector" target="_blank" class="btn btn-outline">
        🔍 Open Glama Inspector
      </a>
      <button onclick="copySseUrl()" class="btn btn-primary" id="copyBtn">
        📋 Copy SSE URL
      </button>
    </div>
  </header>

  <div class="container">
    <div class="hero">
      <h2>${escapeHtml(spec.info.title)} <span style="font-size: 14px; color: var(--text-muted); font-weight: normal;">v${escapeHtml(spec.info.version)}</span></h2>
      <p>${escapeHtml(spec.info.description || 'Enterprise REST API converted to Model Context Protocol (MCP) Tools.')}</p>
      <div class="sse-box">
        <div>SSE Endpoint: <span id="sseUrl">http://localhost:${port}/sse</span></div>
        <span style="font-size: 12px; color: var(--text-muted);">Paste this URL directly into Glama Inspector</span>
      </div>
    </div>

    <div class="grid">
      <div class="tool-list">
        <div class="tool-list-header">
          <span>CONVERTED TOOLS</span>
          <span>${tools.length} TOOLS</span>
        </div>
        <div class="tool-items" id="toolItems"></div>
      </div>

      <div class="workspace" id="workspace">
        <div style="text-align: center; color: var(--text-muted); margin-top: 100px;">
          Select a tool on the left to inspect parameters and execute test calls.
        </div>
      </div>
    </div>
  </div>

  <script>
    const tools = ${toolsJson};
    let activeTool = tools[0] || null;

    function renderToolList() {
      const listEl = document.getElementById('toolItems');
      listEl.innerHTML = tools.map((tool, idx) => \`
        <div class="tool-item \${activeTool && activeTool.name === tool.name ? 'active' : ''}" onclick="selectTool(\${idx})">
          <div class="tool-item-title">
            <span class="badge-method method-\${tool.method}">\${tool.method}</span>
            <span>\${tool.name}</span>
          </div>
          <div class="tool-item-desc">\${tool.path}</div>
        </div>
      \`).join('');
    }

    function selectTool(idx) {
      activeTool = tools[idx];
      renderToolList();
      renderWorkspace();
    }

    function renderWorkspace() {
      if (!activeTool) return;
      const ws = document.getElementById('workspace');

      const props = activeTool.inputSchema?.properties || {};
      const required = activeTool.inputSchema?.required || [];

      const formFields = Object.entries(props).map(([propName, propSchema]) => {
        const isReq = required.includes(propName);
        const placeholder = propSchema.example || propSchema.default || '';
        return \`
          <div class="form-group">
            <label class="form-label">
              \${propName} \${isReq ? '<span style="color: #f85149;">*</span>' : ''}
              <span style="font-size: 11px; color: var(--text-muted); font-weight: normal;">(\${propSchema.type || 'string'})</span>
            </label>
            <input class="form-input" id="field_\${propName}" value="\${placeholder}" placeholder="\${propSchema.description || ''}" />
          </div>
        \`;
      }).join('');

      ws.innerHTML = \`
        <div class="workspace-header">
          <div class="workspace-title">
            <span class="badge-method method-\${activeTool.method}">\${activeTool.method}</span>
            <span>\${activeTool.name}</span>
          </div>
          <div class="workspace-desc">\${activeTool.description.replace(/\\n/g, '<br/>')}</div>
        </div>

        <form onsubmit="runTool(event)">
          \${formFields || '<p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">This tool does not require parameters.</p>'}
          <button type="submit" class="btn btn-primary" id="execBtn">
            ⚡ Execute Tool Call
          </button>
        </form>

        <div class="response-card" id="responseCard" style="display: none;">
          <div class="response-header">
            <span>Live Response Output</span>
            <span id="responseStatus"></span>
          </div>
          <pre><code id="responseBody"></code></pre>
        </div>
      \`;
    }

    async function runTool(e) {
      e.preventDefault();
      const btn = document.getElementById('execBtn');
      btn.innerText = '⏳ Executing...';
      btn.disabled = true;

      const args = {};
      const props = activeTool.inputSchema?.properties || {};
      for (const propName of Object.keys(props)) {
        const input = document.getElementById('field_' + propName);
        if (input && input.value !== '') {
          args[propName] = input.value;
        }
      }

      try {
        const res = await fetch('/api/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: activeTool.name, arguments: args })
        });
        const data = await res.json();
        document.getElementById('responseCard').style.display = 'block';
        document.getElementById('responseStatus').innerText = 'HTTP ' + res.status;
        document.getElementById('responseBody').innerText = JSON.stringify(data, null, 2);
      } catch (err) {
        document.getElementById('responseCard').style.display = 'block';
        document.getElementById('responseStatus').innerText = 'ERROR';
        document.getElementById('responseBody').innerText = err.message;
      } finally {
        btn.innerText = '⚡ Execute Tool Call';
        btn.disabled = false;
      }
    }

    function copySseUrl() {
      const url = document.getElementById('sseUrl').innerText;
      navigator.clipboard.writeText(url);
      const btn = document.getElementById('copyBtn');
      btn.innerText = '✅ Copied!';
      setTimeout(() => btn.innerText = '📋 Copy SSE URL', 2000);
    }

    renderToolList();
    renderWorkspace();
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
