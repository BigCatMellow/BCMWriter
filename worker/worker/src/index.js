export default {
  async fetch(request, env) {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://bigcatmellow.github.io',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const data = await request.json();
      
      if (data.action === 'store') {
        // Store refresh token
        const sessionId = crypto.randomUUID();
        await env.SESSIONS.put(sessionId, JSON.stringify({
          refresh_token: data.refresh_token,
          client_id: data.clientId,
          client_secret: data.clientSecret,
          created: Date.now()
        }), {
          expirationTtl: 7776000 // 90 days
        });
        
        return jsonResponse({ sessionId });
      }
      
      if (data.action === 'refresh') {
        // Get stored refresh token
        const sessionData = await env.SESSIONS.get(data.sessionId);
        
        if (!sessionData) {
          return jsonResponse({ error: 'Session not found' }, 404);
        }
        
        const session = JSON.parse(sessionData);
        
        // Exchange refresh token for new access token
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
        
        return jsonResponse({ access_token: tokenData.access_token });
      }
      
      return jsonResponse({ error: 'Invalid action' }, 400);
      
    } catch (error) {
      return jsonResponse({ error: error.message }, 500);
    }
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