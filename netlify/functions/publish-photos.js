const { requireAdmin } = require('./_auth');

const OWNER  = 'DubbleJay31';
const REPO   = 'TheHeartOfCB';
const BRANCH = 'main';
const PATH   = 'photos.json';

// Commits the new photos.json straight to GitHub, which triggers Netlify's existing
// auto-deploy-on-push — no local git commands needed from the admin dashboard.
exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  if (!requireAdmin(event)) {
    return { statusCode: 401, body: JSON.stringify({ message: 'Not authorized' }) };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { statusCode: 500, body: JSON.stringify({ message: 'GITHUB_TOKEN not configured' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  if (!body.content || typeof body.content !== 'string') {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing content' }) };
  }

  const GH_H = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;

  try {
    // GitHub's Contents API requires the current file's SHA to update it (prevents
    // clobbering a change made outside this flow without noticing).
    const getResp = await fetch(`${apiUrl}?ref=${BRANCH}`, { headers: GH_H });
    if (!getResp.ok) {
      const err = await getResp.text();
      return { statusCode: 502, body: JSON.stringify({ message: `Could not read current photos.json from GitHub: ${err}` }) };
    }
    const current = await getResp.json();

    const putResp = await fetch(apiUrl, {
      method: 'PUT',
      headers: GH_H,
      body: JSON.stringify({
        message: 'Update photos.json via admin dashboard',
        content: Buffer.from(body.content, 'utf8').toString('base64'),
        sha: current.sha,
        branch: BRANCH
      })
    });
    if (!putResp.ok) {
      const err = await putResp.text();
      return { statusCode: 502, body: JSON.stringify({ message: `GitHub commit failed: ${err}` }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(e) }) };
  }
};
