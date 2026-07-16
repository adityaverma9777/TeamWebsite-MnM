import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Config
const APP_ID = process.env.GITHUB_APP_ID;
// We decode the private key from base64 to avoid formatting issues in .env files
const PRIVATE_KEY = process.env.GITHUB_PRIVATE_KEY_BASE64 ? Buffer.from(process.env.GITHUB_PRIVATE_KEY_BASE64, 'base64').toString('ascii') : null;

// Cache the installation token to avoid hitting the rate limit on the token creation endpoint
let cachedToken = null;
let tokenExpiry = null;

// Helper: Generate JWT for the GitHub App
function generateAppJWT() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60, // Issued 60 seconds ago to handle clock drift
    exp: now + (10 * 60), // Expires in 10 minutes (maximum allowed)
    iss: APP_ID
  };
  return jwt.sign(payload, PRIVATE_KEY, { algorithm: 'RS256' });
}

// Helper: Get an Installation Access Token (which has the 15,000 req/hr limit)
async function getInstallationToken(owner, repo) {
  // Return cached token if valid
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const appJwt = generateAppJWT();

  // 1. Get the Installation ID for this repository
  const installRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/installation`, {
    headers: {
      'Authorization': `Bearer ${appJwt}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!installRes.ok) {
    throw new Error(`Failed to get installation ID: ${installRes.statusText}`);
  }

  const installData = await installRes.json();
  const installationId = installData.id;

  // 2. Create the Installation Access Token
  const tokenRes = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appJwt}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!tokenRes.ok) {
    throw new Error(`Failed to create installation token: ${tokenRes.statusText}`);
  }

  const tokenData = await tokenRes.json();
  
  cachedToken = tokenData.token;
  // Token expires in 1 hour usually, we cache it for 55 minutes
  tokenExpiry = Date.now() + (55 * 60 * 1000); 

  return cachedToken;
}

// --- WAKE ENDPOINT ---
// Used by the frontend to spin up the Render instance immediately on page load
app.get('/wake', (req, res) => {
  res.status(200).send('Backend is awake and ready.');
});

// --- API COMMITS ENDPOINT ---
app.get('/api/commits', async (req, res) => {
  const { owner, repo, author } = req.query;

  if (!owner || !repo || !author) {
    return res.status(400).json({ error: 'Missing owner, repo, or author query parameters.' });
  }

  try {
    let fetchOpts = {};

    // If Enterprise GitHub App is configured, use it for 15,000 req/hr
    if (APP_ID && PRIVATE_KEY) {
      try {
        const token = await getInstallationToken(owner, repo);
        fetchOpts.headers = { 'Authorization': `token ${token}` };
      } catch (e) {
        console.error("GitHub App Auth Failed, falling back to unauthenticated:", e.message);
      }
    } 
    // Fallback to standard PAT if App isn't configured but PAT is
    else if (process.env.GITHUB_PAT) {
      fetchOpts.headers = { 'Authorization': `token ${process.env.GITHUB_PAT}` };
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits?author=${author}&per_page=100`;
    
    const githubRes = await fetch(apiUrl, fetchOpts);
    
    if (!githubRes.ok) {
      return res.status(githubRes.status).json({ error: `GitHub API error: ${githubRes.statusText}` });
    }

    const commits = await githubRes.json();
    res.json(commits);

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error fetching commits.' });
  }
});

// --- VALIDATE FORK ENDPOINT ---
app.post('/api/validate-fork', async (req, res) => {
  const { forkUrl, expectedUsername, expectedRepoName } = req.body;

  if (!forkUrl || !expectedUsername || !expectedRepoName) {
    return res.status(400).json({ valid: false, error: 'Missing parameters.' });
  }

  // 1. Check basic URL format
  const match = forkUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    return res.status(400).json({ valid: false, error: 'Invalid GitHub URL format.' });
  }

  const submittedUsername = match[1];
  const submittedRepoName = match[2].replace('.git', '');

  // 2. Validate Username
  if (submittedUsername.toLowerCase() !== expectedUsername.toLowerCase()) {
    return res.status(400).json({ valid: false, error: `URL username (${submittedUsername}) does not match your locked GitHub username (${expectedUsername}).` });
  }

  // 3. Validate Repo Name matches the official one
  if (submittedRepoName.toLowerCase() !== expectedRepoName.toLowerCase()) {
    return res.status(400).json({ valid: false, error: `You must not rename the repository. Expected "${expectedRepoName}", got "${submittedRepoName}".` });
  }

  // 4. Ping GitHub API to physically verify it exists and is a fork
  try {
    let fetchOpts = {};
    if (APP_ID && PRIVATE_KEY) {
      try {
        const token = await getInstallationToken(submittedUsername, submittedRepoName);
        fetchOpts.headers = { 'Authorization': `token ${token}` };
      } catch (e) {
        // Silent fallback
      }
    } else if (process.env.GITHUB_PAT) {
      fetchOpts.headers = { 'Authorization': `token ${process.env.GITHUB_PAT}` };
    }

    const githubRes = await fetch(`https://api.github.com/repos/${submittedUsername}/${submittedRepoName}`, fetchOpts);

    if (githubRes.status === 404) {
      return res.status(404).json({ valid: false, error: 'Repository does not exist on GitHub or is private.' });
    }

    if (!githubRes.ok) {
      return res.status(githubRes.status).json({ valid: false, error: `GitHub API error: ${githubRes.statusText}` });
    }

    const repoData = await githubRes.json();

    if (repoData.fork !== true) {
      return res.status(400).json({ valid: false, error: 'This repository is not a fork! You must fork the original repository.' });
    }

    // Success!
    res.json({ valid: true });

  } catch (error) {
    console.error('Server error validating fork:', error);
    res.status(500).json({ valid: false, error: 'Internal server error validating repository.' });
  }
});

app.listen(PORT, () => {
  console.log(`MnM Enterprise Backend running on port ${PORT}`);
});
