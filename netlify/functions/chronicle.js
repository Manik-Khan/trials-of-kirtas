// netlify/functions/chronicle.js
// Handles reading and writing chronicle.json via GitHub API
// The GITHUB_TOKEN env variable is set in Netlify dashboard — never in code

const OWNER  = 'Manik-Khan';
const REPO   = 'trials-of-kirtas';
const FILE   = 'data/chronicle.json';
const BRANCH = 'main';

const githubHeaders = {
  'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
  'Accept':        'application/vnd.github.v3+json',
  'Content-Type':  'application/json',
};

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // ── GET — return all entries ──
  if (event.httpMethod === 'GET') {
    try {
      const res  = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}?ref=${BRANCH}`,
        { headers: githubHeaders }
      );
      if (!res.ok) throw new Error(`GitHub ${res.status}`);
      const data    = await res.json();
      const entries = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, sha: data.sha }),
      };
    } catch(e) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: e.message }),
      };
    }
  }

  // ── POST — append a new entry ──
  if (event.httpMethod === 'POST') {
    try {
      const newEntry = JSON.parse(event.body);

      // Validate required fields
      if (!newEntry.text || !newEntry.author) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing required fields: text, author' }),
        };
      }

      // Ensure entry has an id and timestamp
      newEntry.id        = newEntry.id        || Date.now().toString();
      newEntry.timestamp = newEntry.timestamp || new Date().toISOString();

      // Fetch current file + SHA
      const getRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}?ref=${BRANCH}`,
        { headers: githubHeaders }
      );
      if (!getRes.ok) throw new Error(`GitHub GET ${getRes.status}`);
      const getData = await getRes.json();
      const current = JSON.parse(Buffer.from(getData.content, 'base64').toString('utf8'));

      // Prepend new entry
      const updated = [newEntry, ...current];
      const encoded = Buffer.from(JSON.stringify(updated, null, 2)).toString('base64');

      // Write back to GitHub
      const putRes = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE}`,
        {
          method:  'PUT',
          headers: githubHeaders,
          body: JSON.stringify({
            message: `Chronicle: ${newEntry.author} — Session ${newEntry.session || '?'}`,
            content: encoded,
            sha:     getData.sha,
            branch:  BRANCH,
          }),
        }
      );
      if (!putRes.ok) {
        const err = await putRes.json();
        throw new Error(err.message || `GitHub PUT ${putRes.status}`);
      }

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, entry: newEntry }),
      };
    } catch(e) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: e.message }),
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
