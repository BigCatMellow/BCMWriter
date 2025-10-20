// Cloudflare Worker: OAuth + Google Drive Proxy
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': env.FRONTEND_URL || 'https://bigcatmellow.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
};

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Health check
    if (path === '/health') {
      return jsonResponse({ ok: true, timestamp: Date.now() }, 200, corsHeaders);
    }

    // OAuth routes
    if (path === '/auth/google/start' || path === '/auth/start') {
      return handleAuthStart(request, env, corsHeaders);
    }
    
    if (path === '/auth/google/callback' || path === '/auth/callback') {
      return handleAuthCallback(request, env, corsHeaders);
    }
    
    if (path === '/auth/token' || path === '/auth/refresh') {
      return handleGetToken(request, env, corsHeaders);
    }

    // Drive API routes
    if (path === '/drive/upload') {
      return handleDriveUpload(request, env, corsHeaders);
    }
    
    if (path === '/drive/download') {
      return handleDriveDownload(request, env, corsHeaders);
    }
    
    if (path === '/drive/list') {
      return handleDriveList(request, env, corsHeaders);
    }

    // Session info
    if (path === '/session') {
      return handleGetSession(request, env, corsHeaders);
    }

    return jsonResponse({ error: 'not_found', path }, 404, corsHeaders);

  } catch (error) {
    console.error('Worker error:', error);
    return jsonResponse({ 
      error: 'internal_error', 
      message: error.message 
    }, 500, corsHeaders);
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });
}

function randomId(length = 24) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function getSession(env, sessionId) {
  const data = await env.SESSIONS.get(sessionId);
  return data ? JSON.parse(data) : null;
}

async function saveSession(env, sessionId, data, ttlSeconds = 15552000) { // 180 days
  await env.SESSIONS.put(sessionId, JSON.stringify(data), {
    expirationTtl: ttlSeconds
  });
}

// ========================================
// OAUTH: START FLOW
// ========================================

async function handleAuthStart(request, env, corsHeaders) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || randomId(16);

if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return Response.redirect(`${frontendUrl}?error=missing_credentials`, 302);
}

  const redirectUri = `${url.origin}/auth/callback`;
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.file');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  // Store state for validation
  await saveSession(env, `state:${state}`, { created: Date.now() }, 600);

  return Response.redirect(authUrl.toString(), 302);
}

// ========================================
// OAUTH: CALLBACK
// ========================================

async function handleAuthCallback(request, env, corsHeaders) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const frontendUrl = env.FRONTEND_URL || 'http://localhost:8788';

  if (error) {
    return Response.redirect(`${frontendUrl}?error=${error}`, 302);
  }

  if (!code || !state) {
    return Response.redirect(`${frontendUrl}?error=missing_code_or_state`, 302);
  }

  // Verify state
  const storedState = await getSession(env, `state:${state}`);
  if (!storedState) {
    return Response.redirect(`${frontendUrl}?error=invalid_state`, 302);
  }

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return Response.redirect(`${frontendUrl}?error=missing_credentials`, 302);
  }

  const redirectUri = `${url.origin}/auth/callback`;

  // Exchange code for tokens
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return Response.redirect(`${frontendUrl}?error=token_exchange_failed`, 302);
    }

    const tokens = await tokenResponse.json();

    if (!tokens.access_token) {
      return Response.redirect(`${frontendUrl}?error=no_access_token`, 302);
    }

    // Generate session ID
    const sessionId = randomId(32);

    // Store session with tokens
    await saveSession(env, sessionId, {
      provider: 'google',
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expires_at: Date.now() + (tokens.expires_in * 1000),
      created: Date.now()
    });

    // Redirect back to app with ONLY session_id
    return Response.redirect(`${frontendUrl}?session_id=${sessionId}&state=${state}`, 302);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return Response.redirect(`${frontendUrl}?error=internal_error`, 302);
  }
}

// ========================================
// TOKEN MANAGEMENT
// ========================================

async function handleGetToken(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, corsHeaders);
  }

  try {
    const body = await request.json();
    const sessionId = body.session_id;

    if (!sessionId) {
      return jsonResponse({ error: 'missing_session_id' }, 400, corsHeaders);
    }

    const session = await getSession(env, sessionId);

    if (!session) {
      return jsonResponse({ error: 'invalid_session' }, 401, corsHeaders);
    }

    // Check if access token is still valid
    if (session.access_token && Date.now() < session.expires_at) {
      return jsonResponse({
        access_token: session.access_token,
        expires_in: Math.floor((session.expires_at - Date.now()) / 1000)
      }, 200, corsHeaders);
    }

    // Need to refresh token
    if (!session.refresh_token) {
      return jsonResponse({ error: 'no_refresh_token' }, 401, corsHeaders);
    }

    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: session.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error('Token refresh failed:', errorText);
      return jsonResponse({ error: 'token_refresh_failed' }, 502, corsHeaders);
    }

    const newTokens = await refreshResponse.json();

    // Update session
    session.access_token = newTokens.access_token;
    session.expires_at = Date.now() + (newTokens.expires_in * 1000);
    if (newTokens.refresh_token) {
      session.refresh_token = newTokens.refresh_token;
    }

    await saveSession(env, sessionId, session);

    return jsonResponse({
      access_token: newTokens.access_token,
      expires_in: newTokens.expires_in
    }, 200, corsHeaders);

  } catch (error) {
    console.error('Get token error:', error);
    return jsonResponse({ error: 'internal_error' }, 500, corsHeaders);
  }
}

// ========================================
// GOOGLE DRIVE: UPLOAD
// ========================================

async function handleDriveUpload(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, corsHeaders);
  }

  try {
    const body = await request.json();
    const { session_id, content, file_name, file_id } = body;

    if (!session_id || !content) {
      return jsonResponse({ error: 'missing_required_fields' }, 400, corsHeaders);
    }

    // Get fresh access token
    const tokenRequest = new Request(`${new URL(request.url).origin}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id })
    });

    const tokenResponse = await handleGetToken(tokenRequest, env, corsHeaders);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return jsonResponse(tokenData, tokenResponse.status, corsHeaders);
    }

    const accessToken = tokenData.access_token;

    // Upload or update file
    let driveResponse;

    if (file_id) {
      // Update existing file
      driveResponse = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${file_id}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'text/plain'
          },
          body: content
        }
      );
    } else {
      // Create new file
      const metadata = {
        name: file_name || 'focus-writer-backup.txt',
        mimeType: 'text/plain'
      };

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: text/plain\r\n\r\n' +
        content +
        closeDelimiter;

      driveResponse = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: multipartBody
        }
      );
    }

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      console.error('Drive upload failed:', errorText);
      return jsonResponse({ 
        error: 'drive_upload_failed',
        status: driveResponse.status,
        detail: errorText
      }, 502, corsHeaders);
    }

    const result = await driveResponse.json();
    return jsonResponse(result, 200, corsHeaders);

  } catch (error) {
    console.error('Upload error:', error);
    return jsonResponse({ error: 'internal_error', message: error.message }, 500, corsHeaders);
  }
}

// ========================================
// GOOGLE DRIVE: DOWNLOAD
// ========================================

async function handleDriveDownload(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, corsHeaders);
  }

  try {
    const body = await request.json();
    const { session_id, file_id } = body;

    if (!session_id || !file_id) {
      return jsonResponse({ error: 'missing_required_fields' }, 400, corsHeaders);
    }

    // Get fresh access token
    const tokenRequest = new Request(`${new URL(request.url).origin}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id })
    });

    const tokenResponse = await handleGetToken(tokenRequest, env, corsHeaders);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return jsonResponse(tokenData, tokenResponse.status, corsHeaders);
    }

    const accessToken = tokenData.access_token;

    // Download file
    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!driveResponse.ok) {
      const errorText = await driveResponse.text();
      return jsonResponse({ 
        error: 'drive_download_failed',
        status: driveResponse.status
      }, 502, corsHeaders);
    }

    const content = await driveResponse.text();
    return jsonResponse({ content }, 200, corsHeaders);

  } catch (error) {
    console.error('Download error:', error);
    return jsonResponse({ error: 'internal_error' }, 500, corsHeaders);
  }
}

// ========================================
// GOOGLE DRIVE: LIST FILES
// ========================================

async function handleDriveList(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, corsHeaders);
  }

  try {
    const body = await request.json();
    const { session_id, file_name } = body;

    if (!session_id) {
      return jsonResponse({ error: 'missing_session_id' }, 400, corsHeaders);
    }

    // Get fresh access token
    const tokenRequest = new Request(`${new URL(request.url).origin}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id })
    });

    const tokenResponse = await handleGetToken(tokenRequest, env, corsHeaders);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return jsonResponse(tokenData, tokenResponse.status, corsHeaders);
    }

    const accessToken = tokenData.access_token;

    // Search for file
    const query = file_name 
      ? `name='${file_name}' and trashed=false`
      : 'trashed=false';

    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&pageSize=10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!driveResponse.ok) {
      return jsonResponse({ 
        error: 'drive_list_failed',
        status: driveResponse.status
      }, 502, corsHeaders);
    }

    const result = await driveResponse.json();
    return jsonResponse(result, 200, corsHeaders);

  } catch (error) {
    console.error('List error:', error);
    return jsonResponse({ error: 'internal_error' }, 500, corsHeaders);
  }
}

// ========================================
// SESSION INFO
// ========================================

async function handleGetSession(request, env, corsHeaders) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('id') || url.searchParams.get('session_id');

  if (!sessionId) {
    return jsonResponse({ error: 'missing_session_id' }, 400, corsHeaders);
  }

  const session = await getSession(env, sessionId);

  if (!session) {
    return jsonResponse({ error: 'session_not_found' }, 404, corsHeaders);
  }

  // Don't expose sensitive tokens
  const safeSession = {
    provider: session.provider,
    created: session.created,
    has_refresh_token: !!session.refresh_token,
    has_access_token: !!session.access_token
  };

  return jsonResponse({ session: safeSession, session_id: sessionId }, 200, corsHeaders);
}
