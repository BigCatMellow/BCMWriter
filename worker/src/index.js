export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://bigcatmellow.github.io',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    // Route: Initiate OAuth flow
    if (url.pathname === '/auth/start' && request.method === 'GET') {
      const clientId = url.searchParams.get('client_id');
      const clientSecret = url.searchParams.get('client_secret');
      const state = url.searchParams.get('state');
      
      if (!clientId || !clientSecret) {
        return jsonResponse({ error: 'Missing credentials' }, 400);
      }
      
      // Store temporarily (5 minutes)
      await env.SESSIONS.put(`pending:${state}`, JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        created: Date.now()
      }), { expirationTtl: 300 });
      
      // Redirect to Google OAuth
      const redirectUri = `${url.origin}/auth/callback`;
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent('https://www.googleapis.com/auth/drive')}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${state}`;
      
      return Response.redirect(authUrl, 302);
    }

    // Route: Handle OAuth callback from Google
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      
      if (error) {
        return redirectToApp({ error: error });
      }
      
      if (!code || !state) {
        return redirectToApp({ error: 'Missing code or state' });
      }
      
      // Retrieve stored credentials
      const pendingData = await env.SESSIONS.get(`pending:${state}`);
      if (!pendingData) {
        return redirectToApp({ error: 'Session expired' });
      }
      
      const pending = JSON.parse(pendingData);
      await env.SESSIONS.delete(`pending:${state}`);
      
      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code,
          client_id: pending.client_id,
          client_secret: pending.client_secret,
          redirect_uri: `${url.origin}/auth/callback`,
          grant_type: 'authorization_code'
        })
      });
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        return redirectToApp({ error: tokenData.error });
      }
      
      // Store refresh token
      const sessionId = crypto.randomUUID();
      await env.SESSIONS.put(sessionId, JSON.stringify({
        refresh_token: tokenData.refresh_token,
        client_id: pending.client_id,
        client_secret: pending.client_secret,
        created: Date.now()
      }), {
        expirationTtl: 7776000 // 90 days
      });
      
      // Redirect back to app
      return redirectToApp({
        session_id: sessionId,
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in
      });
    }

    // Route: Refresh access token
    if (url.pathname === '/auth/refresh' && request.method === 'POST') {
      const data = await request.json();
      
      const sessionData = await env.SESSIONS.get(data.session_id);
      if (!sessionData) {
        return jsonResponse({ error: 'Session not found' }, 404);
      }
      
      const session = JSON.parse(sessionData);
      
      // Get new access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: session.client_id,
          client_secret: session.client_secret,
          refresh_token: session.refresh_token,
          grant_type: 'refresh_token'
        })
      });
      
      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        return jsonResponse({ error: tokenData.error }, 400);
      }
      
      return jsonResponse({
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in || 3600
      });
    }
    
    return jsonResponse({ error: 'Not found' }, 404);
  }
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://bigcatmellow.github.io',
    }
  });
}

function redirectToApp(params) {
  const url = new URL('https://bigcatmellow.github.io/BCMWriter/');
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return Response.redirect(url.toString(), 302);
}