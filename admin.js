import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { sanityClient } from './sanity.js';
import { supabase } from './supabase.js';
import imageCompression from 'browser-image-compression';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

const ADMIN_EMAIL = 'contact.manikaditya@gmail.com';
let allUsers = [];
let allTeams = [];
let allRegistrations = [];
let allRepos = [];
let allProposals = [];

// --- AUTHENTICATION ---
let currentAdminUid = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (user.email === ADMIN_EMAIL) {
      currentAdminUid = user.uid;
      // Ensure admin name is set correctly
      try {
        await updateDoc(doc(db, 'users', user.uid), { name: "MnM Admin" });
      } catch (e) { }

      document.getElementById('preloader').style.display = 'none';
      initAdminDashboard();
    } else {
      document.getElementById('preloader').innerHTML = `
        <div style="text-align: center;">
          <h2 style="color: red;">Unauthorized Access</h2>
          <p>You are logged in as ${user.email}, which is not an admin.</p>
          <a href="/dashboard.html" style="color: #0d6efd; text-decoration: underline;">Go back to Dashboard</a>
        </div>
      `;
    }
  } else {
    document.getElementById('preloader').innerHTML = `
      <div style="text-align: center;">
        <h2 style="color: red;">Not Logged In</h2>
        <p>You must be logged in as an admin to view this page.</p>
        <a href="/index.html" style="color: #0d6efd; text-decoration: underline;">Go to Home to Login</a>
      </div>
    `;
  }
});

document.getElementById('btn-admin-logout').addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = '/index.html';
  });
});

// --- NAVIGATION ---
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.admin-section');

navItems.forEach(item => {
  item.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    sections.forEach(s => s.classList.remove('active'));

    item.classList.add('active');
    document.getElementById(item.getAttribute('data-target')).classList.add('active');
  });
});

// --- INITIALIZATION ---
async function initAdminDashboard() {
  await fetchAllData();
  renderOverview();
  renderUsers(allUsers);
  renderTeams(allTeams);
  renderSubmissions();
  loadCompetitions();
  initInbox();
  setupRefreshEngine();

  // Setup Search
  document.getElementById('user-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allUsers.filter(u =>
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.github && u.github.toLowerCase().includes(term))
    );
    renderUsers(filtered);
  });

  document.getElementById('team-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allTeams.filter(t =>
      t.name && t.name.toLowerCase().includes(term)
    );
    renderTeams(filtered);
  });
}

// --- DATA FETCHING ---
async function fetchAllData() {
  // Users
  const userSnap = await getDocs(collection(db, 'users'));
  allUsers = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Teams
  const teamSnap = await getDocs(collection(db, 'teams'));
  allTeams = teamSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Registrations
  const regSnap = await getDocs(collection(db, 'hackathon_registrations'));
  allRegistrations = regSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Repos (Real-time)
  onSnapshot(collection(db, 'repo_submissions'), (snapshot) => {
    allRepos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSubmissions();
    const metricRepos = document.getElementById('metric-repos');
    if (metricRepos) metricRepos.textContent = allRepos.length;
  });

  // Project Proposals (Real-time)
  onSnapshot(collection(db, 'project_proposals'), (snapshot) => {
    allProposals = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderProposals();
  });
}

// --- REFRESH POINTS ENGINE ---
function setupRefreshEngine() {
  const btn = document.getElementById('btn-refresh-points');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const container = document.getElementById('refresh-progress-container');
    const bar = document.getElementById('refresh-progress-bar');
    const logBox = document.getElementById('refresh-log');
    const statusText = document.getElementById('refresh-status-text');

    container.style.display = 'block';
    logBox.innerHTML = '';

    const log = (msg) => {
      const div = document.createElement('div');
      div.textContent = msg;
      logBox.appendChild(div);
      logBox.scrollTop = logBox.scrollHeight;
    };

    try {
      log('Starting Global Points Calculation Engine...');

      // Get all approved repos
      const approvedRepos = allRepos.filter(r => r.status === 'approved');
      log(`Found ${approvedRepos.length} approved repositories.`);

      // Group repos by user to minimize writes
      const userCommits = {};

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

      for (let i = 0; i < approvedRepos.length; i++) {
        const repo = approvedRepos[i];
        bar.style.width = `${((i) / approvedRepos.length) * 100}%`;

        const match = repo.repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
          const owner = match[1];
          const repoName = match[2].replace('.git', '');

          try {
            log(`Fetching commits for ${owner}/${repoName}...`);
            const apiUrl = `${backendUrl}/api/commits?owner=${owner}&repo=${repoName}&author=${owner}`;
            const res = await fetch(apiUrl);

            if (res.ok) {
              const commits = await res.json();
              if (!userCommits[repo.userId]) userCommits[repo.userId] = 0;
              userCommits[repo.userId] += commits.length;
              log(`+ ${commits.length} commits found for ${owner}.`);
            } else {
              log(`Error fetching ${owner}/${repoName}: ${res.statusText}`);
            }
          } catch (e) {
            log(`Network error fetching ${owner}/${repoName}.`);
          }
        }
      }

      // Final writes
      log('Saving calculated points to database...');
      const userIds = Object.keys(userCommits);

      for (let i = 0; i < userIds.length; i++) {
        const uid = userIds[i];
        const points = userCommits[uid] * 200;

        await updateDoc(doc(db, 'users', uid), { points: points });
        log(`User ID: ${uid} -> ${points} points.`);
      }

      bar.style.width = '100%';
      statusText.textContent = 'Calculation Complete!';
      statusText.style.color = '#28a745';
      log('Successfully updated all user points.');

      // Update local state
      await fetchAllData();
      renderUsers(allUsers);

    } catch (err) {
      log(`FATAL ERROR: ${err.message}`);
      statusText.textContent = 'Error occurred during calculation.';
      statusText.style.color = 'red';
    }

    setTimeout(() => {
      btn.disabled = false;
      container.style.display = 'none';
      statusText.textContent = 'Calculating points...';
      statusText.style.color = 'var(--text-main)';
      bar.style.width = '0%';
    }, 5000);
  });
}

// --- RENDERING OVERVIEW ---
function renderOverview() {
  document.getElementById('metric-users').textContent = allUsers.length;
  document.getElementById('metric-teams').textContent = allTeams.length;
  document.getElementById('metric-repos').textContent = allRepos.length;
}

// --- RENDERING USERS ---
function renderUsers(users) {
  const tbody = document.getElementById('admin-users-list');
  tbody.innerHTML = '';

  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No users found.</td></tr>';
    return;
  }

  users.forEach(user => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display:flex; align-items:center; gap:8px;">
          <img src="${user.photoURL || '/logo.png'}" style="width:24px; height:24px; border-radius:50%;">
          <strong class="clickable-name" id="user-name-${user.id}">${user.name || 'Unnamed'}</strong>
        </div>
      </td>
      <td>${user.email || 'N/A'}</td>
      <td>
        <div style="display:flex; gap:8px; align-items:center;">
          <span style="color:var(--text-muted);">@</span>
          <input type="text" class="form-control" id="un-${user.id}" value="${user.username || ''}" placeholder="Not set" style="width:120px;">
          <button class="btn btn-primary btn-sm" id="btn-save-un-${user.id}">Save</button>
        </div>
      </td>
      <td>
        <div style="display:flex; gap:8px;">
          <input type="text" class="form-control" id="gh-${user.id}" value="${user.github || ''}" placeholder="Not set">
          <button class="btn btn-primary btn-sm" id="btn-save-${user.id}">Save</button>
        </div>
      </td>
      <td>
        <button class="btn" style="background:#e9ecef;" id="btn-activity-${user.id}">View Activity</button>
      </td>
    `;
    tbody.appendChild(tr);

    // Save App Username Logic
    document.getElementById(`btn-save-un-${user.id}`).addEventListener('click', async (e) => {
      const btn = e.target;
      const newUsername = document.getElementById(`un-${user.id}`).value.trim();

      if (newUsername === (user.username || '')) return;

      btn.textContent = '...';

      try {
        if (newUsername !== '') {
          // Uniqueness check
          const q = query(collection(db, 'users'), where('username', '==', newUsername));
          const snap = await getDocs(q);
          const isTaken = !snap.empty && snap.docs.some(doc => doc.id !== user.id);
          if (isTaken) {
            alert(`Username "${newUsername}" is already taken by another user.`);
            btn.textContent = 'Save';
            return;
          }
        }

        await updateDoc(doc(db, 'users', user.id), { username: newUsername });
        btn.textContent = 'Saved';
        btn.style.background = 'green';
        setTimeout(() => { btn.textContent = 'Save'; btn.style.background = ''; }, 2000);

        const u = allUsers.find(x => x.id === user.id);
        if (u) u.username = newUsername;
      } catch (error) {
        console.error(error);
        alert('Error updating username: ' + error.message);
        btn.textContent = 'Error';
      }
    });

    // Save GitHub Logic
    document.getElementById(`btn-save-${user.id}`).addEventListener('click', async (e) => {
      const btn = e.target;
      const newGithub = document.getElementById(`gh-${user.id}`).value.trim();
      btn.textContent = '...';
      try {
        await updateDoc(doc(db, 'users', user.id), { github: newGithub });
        btn.textContent = 'Saved';
        btn.style.background = 'green';
        setTimeout(() => { btn.textContent = 'Save'; btn.style.background = ''; }, 2000);
        // update local state
        const u = allUsers.find(x => x.id === user.id);
        if (u) u.github = newGithub;
      } catch (error) {
        console.error(error);
        btn.textContent = 'Error';
      }
    });

    // View Activity Logic
    document.getElementById(`btn-activity-${user.id}`).addEventListener('click', () => {
      openActivityModal(user);
    });

    // Profile Panel Logic
    document.getElementById(`user-name-${user.id}`).addEventListener('click', () => {
      window.openUserProfilePanel(user.id);
    });
  });
}

// --- RENDERING TEAMS ---
function renderTeams(teams) {
  const tbody = document.getElementById('admin-teams-list');
  tbody.innerHTML = '';

  if (teams.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No teams found.</td></tr>';
    return;
  }

  teams.forEach(team => {
    const leader = allUsers.find(u => u.id === team.leaderId);
    const leaderNameHTML = leader ? `<span class="clickable-name" id="team-leader-${team.id}">${leader.name}</span>` : 'Unknown';
    const memberCount = (team.members && Array.isArray(team.members)) ? team.members.length : 0;

    // Attempt to format creation date
    let dateStr = 'Unknown';
    if (team.createdAt) {
      if (team.createdAt.seconds) {
        dateStr = new Date(team.createdAt.seconds * 1000).toLocaleDateString();
      } else if (typeof team.createdAt === 'string') {
        dateStr = new Date(team.createdAt).toLocaleDateString();
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${team.name || 'Unnamed Team'}</strong></td>
      <td>${leaderNameHTML}</td>
      <td>${memberCount} User(s)</td>
      <td>${dateStr}</td>
    `;
    tbody.appendChild(tr);

    if (leader) {
      document.getElementById(`team-leader-${team.id}`).addEventListener('click', () => {
        window.openUserProfilePanel(leader.id);
      });
    }
  });
}

// --- ACTIVITY MODAL ---
function openActivityModal(user) {
  document.getElementById('activity-modal-title').textContent = `Activity: ${user.name}`;

  const modalBody = document.getElementById('activity-modal-body');

  // Find team
  let teamHtml = `<p><strong>Team:</strong> Not in a team</p>`;
  if (user.teamId) {
    const team = allTeams.find(t => t.id === user.teamId);
    if (team) {
      teamHtml = `<p><strong>Team:</strong> ${team.name} (Joined)</p>`;
    }
  }

  // Find repos
  const userRepos = allRepos.filter(r => r.userId === user.id);
  let reposHtml = `<p><strong>Repositories Submitted:</strong> ${userRepos.length}</p>`;
  if (userRepos.length > 0) {
    reposHtml += `<ul>` + userRepos.map(r => `<li>${r.repoUrl} (${r.status})</li>`).join('') + `</ul>`;
  }

  // Find hackathons
  const userHacks = allRegistrations.filter(r => r.userId === user.id);
  let hacksHtml = `<p><strong>Hackathons Registered:</strong> ${userHacks.length}</p>`;
  if (userHacks.length > 0) {
    hacksHtml += `<ul>` + userHacks.map(r => `<li>${r.competitionTitle || 'Unknown'} - <em>"${r.projectIdea}"</em></li>`).join('') + `</ul>`;
  }

  modalBody.innerHTML = `
    ${teamHtml}
    <hr style="border:0; border-top:1px solid var(--border); margin:15px 0;">
    ${reposHtml}
    <hr style="border:0; border-top:1px solid var(--border); margin:15px 0;">
    ${hacksHtml}
  `;

  document.getElementById('activity-modal').classList.add('active');
}

document.getElementById('close-activity-modal').addEventListener('click', () => {
  document.getElementById('activity-modal').classList.remove('active');
});

// --- COMPETITIONS LOGIC ---
async function loadCompetitions() {
  const tbody = document.getElementById('admin-comps-list');
  tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Fetching from Sanity...</td></tr>';

  try {
    const comps = await sanityClient.fetch(`*[_type == "competition"] | order(_createdAt desc)`);
    tbody.innerHTML = '';

    if (comps.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No competitions found.</td></tr>';
      return;
    }

    comps.forEach(comp => {
      const regs = allRegistrations.filter(r => r.competitionId === comp._id);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${comp.title}</strong></td>
        <td>Stage ${comp.currentStageIndex}</td>
        <td>${regs.length} Teams</td>
        <td>
          <button class="btn btn-primary btn-sm" id="export-${comp._id}">Export CSV</button>
        </td>
      `;
      tbody.appendChild(tr);

      document.getElementById(`export-${comp._id}`).addEventListener('click', () => {
        exportRegistrationsToCSV(comp, regs);
      });
    });

  } catch (error) {
    console.error(error);
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error loading competitions from Sanity</td></tr>';
  }
}

// --- CSV EXPORT ---
function exportRegistrationsToCSV(comp, regs) {
  if (regs.length === 0) {
    alert("No registrations found for this competition.");
    return;
  }

  // CSV Headers
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += "Registration ID,Team Name,Project Idea,Motivation,Timestamp\n";

  regs.forEach(reg => {
    // Resolve team name
    const team = allTeams.find(t => t.id === reg.teamId);
    const teamName = team ? team.name : "Unknown Team";

    // Escape quotes and commas
    const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

    const row = [
      escapeCsv(reg.id),
      escapeCsv(teamName),
      escapeCsv(reg.projectIdea),
      escapeCsv(reg.motivation),
      escapeCsv(reg.timestamp ? new Date(reg.timestamp.seconds * 1000).toLocaleString() : '')
    ];
    csvContent += row.join(",") + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `registrations_${comp.title.replace(/\s+/g, '_')}.csv`);
  document.body.appendChild(link); // Required for FF

  link.click();
  document.body.removeChild(link);
}

// --- SUBMISSIONS LOGIC ---
function renderSubmissions() {
  const tbody = document.getElementById('admin-submissions-list');
  tbody.innerHTML = '';

  if (allRepos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No submissions found.</td></tr>';
    return;
  }

  // Sort newest first
  const sorted = [...allRepos].sort((a, b) => {
    return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
  });

  sorted.forEach(repo => {
    const user = allUsers.find(u => u.id === repo.userId);
    const tr = document.createElement('tr');

    let statusColor = repo.status === 'approved' ? 'green' : (repo.status === 'rejected' ? 'red' : 'orange');

    const urlToDisplay = repo.forkUrl || repo.repoUrl || 'No URL provided';
    const descToDisplay = repo.note || repo.description || 'No description';

    tr.innerHTML = `
      <td>
        <strong class="clickable-name" id="sub-user-${repo.id}">${user ? user.name : 'Unknown'}</strong><br>
        <span style="font-size:12px; color:gray;">${user ? user.email : ''}</span>
      </td>
      <td>
        <a href="${urlToDisplay}" target="_blank" style="color:#0d6efd;">${urlToDisplay}</a><br>
        <span style="font-size:12px;">${descToDisplay}</span>
      </td>
      <td>
        <span style="color:${statusColor}; font-weight:bold; text-transform:uppercase; font-size:12px;">${repo.status}</span>
      </td>
      <td>
        <button class="btn btn-sm" style="background:#28a745; color:white;" id="btn-approve-${repo.id}">Approve</button>
        <button class="btn btn-sm" style="background:#dc3545; color:white;" id="btn-reject-${repo.id}">Reject</button>
        <button class="btn btn-sm" style="background:#6c757d; color:white;" id="btn-msg-${repo.id}">Message User</button>
      </td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`btn-approve-${repo.id}`).addEventListener('click', () => updateRepoStatus(repo.id, 'approved'));
    document.getElementById(`btn-reject-${repo.id}`).addEventListener('click', () => updateRepoStatus(repo.id, 'rejected'));

    document.getElementById(`btn-msg-${repo.id}`).addEventListener('click', () => {
      // Switch to Inbox tab and open chat
      document.querySelector('.nav-item[data-target="sec-inbox"]').click();
      if (user) {
        openInboxChat(user.id, user.name);
      }
    });

    if (user) {
      document.getElementById(`sub-user-${repo.id}`).addEventListener('click', () => {
        window.openUserProfilePanel(user.id);
      });
    }
  });
}

async function updateRepoStatus(repoId, status) {
  try {
    await updateDoc(doc(db, 'repo_submissions', repoId), { status });
    // Update local and re-render
    const r = allRepos.find(x => x.id === repoId);
    if (r) r.status = status;
    renderSubmissions();
  } catch (e) {
    console.error("Failed to update status", e);
    alert("Error updating status");
  }
}

function renderProposals() {
  const tbody = document.getElementById('admin-proposals-list');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (allProposals.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No proposals found.</td></tr>';
    return;
  }

  // Sort newest first
  const sorted = [...allProposals].sort((a, b) => {
    return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
  });

  sorted.forEach(prop => {
    const user = allUsers.find(u => u.id === prop.userId);
    const tr = document.createElement('tr');

    let statusColor = prop.status === 'approved' ? 'green' : (prop.status === 'rejected' ? 'red' : 'orange');

    const urlToDisplay = prop.url || 'No URL provided';
    const descToDisplay = prop.description || 'No description';

    tr.innerHTML = `
      <td>
        <strong class="clickable-name" id="prop-user-${prop.id}">${user ? user.name : 'Unknown'}</strong><br>
        <span style="font-size:12px; color:gray;">${user ? user.email : ''}</span>
      </td>
      <td>
        <a href="${urlToDisplay}" target="_blank" style="color:#0d6efd;">${urlToDisplay}</a><br>
        <span style="font-size:12px;">${descToDisplay}</span>
      </td>
      <td>
        <span style="color:${statusColor}; font-weight:bold; text-transform:uppercase; font-size:12px;">${prop.status}</span>
      </td>
      <td>
        <button class="btn btn-sm" style="background:#28a745; color:white;" id="btn-prop-approve-${prop.id}">Approve</button>
        <button class="btn btn-sm" style="background:#dc3545; color:white;" id="btn-prop-reject-${prop.id}">Reject</button>
      </td>
    `;
    tbody.appendChild(tr);

    document.getElementById(`btn-prop-approve-${prop.id}`).addEventListener('click', () => updateProposalStatus(prop.id, 'approved'));
    document.getElementById(`btn-prop-reject-${prop.id}`).addEventListener('click', () => updateProposalStatus(prop.id, 'rejected'));

    if (user) {
      document.getElementById(`prop-user-${prop.id}`).addEventListener('click', () => {
        window.openUserProfilePanel(user.id);
      });
    }
  });
}

async function updateProposalStatus(propId, status) {
  try {
    await updateDoc(doc(db, 'project_proposals', propId), { status });
    const p = allProposals.find(x => x.id === propId);
    if (p) p.status = status;
    renderProposals();
  } catch (e) {
    console.error("Failed to update proposal status", e);
    alert("Error updating proposal status");
  }
}

// --- ADMIN INBOX LOGIC ---
import { onSnapshot, addDoc, orderBy } from 'firebase/firestore';

let inboxUnsubscribe = null;
let currentInboxTarget = null;

function initInbox() {
  renderInboxUsers(allUsers);

  document.getElementById('inbox-search').addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allUsers.filter(u =>
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term))
    );
    renderInboxUsers(filtered);
  });

  document.getElementById('inbox-chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentInboxTarget) return;

    const input = document.getElementById('inbox-chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';

    const chatId = [currentAdminUid, currentInboxTarget].sort().join('_');

    await addDoc(collection(db, 'messages'), {
      chatId: chatId,
      participants: [currentAdminUid, currentInboxTarget],
      senderId: currentAdminUid,
      receiverId: currentInboxTarget,
      text: text,
      timestamp: new Date()
    });
  });
}

function renderInboxUsers(users) {
  const container = document.getElementById('inbox-users-list');
  container.innerHTML = '';

  // Exclude self from list
  const targets = users.filter(u => u.id !== currentAdminUid);

  targets.forEach(user => {
    const div = document.createElement('div');
    div.style.padding = '15px';
    div.style.borderBottom = '1px solid var(--border)';
    div.style.cursor = 'pointer';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '10px';

    div.innerHTML = `
      <img src="${user.photoURL || '/logo.png'}" style="width:32px; height:32px; border-radius:50%;">
      <div>
        <strong style="display:block;">${user.name || 'Unnamed'}</strong>
        <span style="font-size:12px; color:gray;">${user.email}</span>
      </div>
    `;

    div.addEventListener('click', () => {
      // highlight active
      Array.from(container.children).forEach(c => c.style.background = 'transparent');
      div.style.background = '#e9ecef';
      openInboxChat(user.id, user.name);
    });

    container.appendChild(div);
  });
}

function openInboxChat(targetUid, targetName) {
  currentInboxTarget = targetUid;
  document.getElementById('inbox-target-name').textContent = `Chat with ${targetName}`;
  document.getElementById('inbox-chat-input').disabled = false;
  document.getElementById('inbox-chat-send').disabled = false;

  const messagesArea = document.getElementById('inbox-messages-area');
  messagesArea.innerHTML = 'Loading messages...';

  const chatId = [currentAdminUid, targetUid].sort().join('_');

  const q = query(
    collection(db, 'messages'),
    where('chatId', '==', chatId),
    orderBy('timestamp', 'asc')
  );

  if (inboxUnsubscribe) inboxUnsubscribe();

  inboxUnsubscribe = onSnapshot(q, (snapshot) => {
    messagesArea.innerHTML = '';

    if (snapshot.empty) {
      messagesArea.innerHTML = '<div style="margin:auto; color:gray;">No messages yet. Send a message to start the conversation!</div>';
      return;
    }

    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const isSent = msg.senderId === currentAdminUid;

      const bubble = document.createElement('div');
      bubble.style.maxWidth = '70%';
      bubble.style.padding = '10px 15px';
      bubble.style.borderRadius = '15px';
      bubble.style.marginBottom = '5px';
      bubble.style.alignSelf = isSent ? 'flex-end' : 'flex-start';
      bubble.style.background = isSent ? 'var(--primary)' : 'white';
      bubble.style.color = isSent ? 'white' : 'black';
      bubble.style.border = isSent ? 'none' : '1px solid var(--border)';
      bubble.textContent = msg.text;

      messagesArea.appendChild(bubble);
    });

    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
}

// --- USER PROFILE SIDE PANEL LOGIC ---
const sidepanel = document.getElementById('admin-user-sidepanel');
const btnCloseSidepanel = document.getElementById('close-sidepanel-btn');
let currentSidepanelUserId = null;

if (btnCloseSidepanel) {
  btnCloseSidepanel.addEventListener('click', () => {
    sidepanel.classList.remove('active');
  });
}

// Global function exposed to window so inline onclicks could work if needed, 
// though we will attach via JS class '.clickable-name'
window.openUserProfilePanel = async function (userId) {
  currentSidepanelUserId = userId;
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  // Populate basic data
  document.getElementById('sp-avatar').src = user.photoURL || '/logo.png';
  document.getElementById('sp-name').textContent = user.name || 'Unnamed User';
  document.getElementById('sp-email').textContent = user.email || 'No email provided';

  // Details
  document.getElementById('sp-username').textContent = user.username ? `@${user.username}` : 'Not set';
  document.getElementById('sp-github').textContent = user.github || 'Not set';
  document.getElementById('sp-phone').textContent = user.phone || 'Not set';
  document.getElementById('sp-college').textContent = user.college || 'Not set';
  document.getElementById('sp-bio').textContent = user.bio || 'No bio provided.';

  // Links
  const linksContainer = document.getElementById('sp-links');
  linksContainer.innerHTML = '';
  if (user.linkedin) {
    linksContainer.innerHTML += `<a href="${user.linkedin}" target="_blank" style="color:var(--primary);">${user.linkedin}</a>`;
  }
  if (user.extraLinks && user.extraLinks.length > 0) {
    user.extraLinks.forEach(link => {
      linksContainer.innerHTML += `<a href="${link}" target="_blank" style="color:var(--primary);">${link}</a>`;
    });
  }
  if (!user.linkedin && (!user.extraLinks || user.extraLinks.length === 0)) {
    linksContainer.innerHTML = '<span style="color:var(--text-muted); font-size:14px;">No links provided.</span>';
  }

  // Show panel
  sidepanel.classList.add('active');
};

document.getElementById('btn-sp-dm').addEventListener('click', () => {
  if (!currentSidepanelUserId) return;

  const user = allUsers.find(u => u.id === currentSidepanelUserId);
  if (!user) return;

  // 1. Close sidepanel
  sidepanel.classList.remove('active');

  // 2. Switch to Inbox Tab
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
  document.querySelector('[data-target="sec-inbox"]').classList.add('active');
  document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById('sec-inbox').classList.add('active');

  // 3. Open chat
  openInboxChat(user.id, user.name || 'Unnamed');
});

// --- ID CARD LOGIC ---

// Helper to generate a unique random string if needed
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const addIdCardForm = document.getElementById('add-idcard-form');
let finalIdCardPicBlob = null;

const idcardPicInput = document.getElementById('idcard-pic');
const cropperModal = document.getElementById('cropper-modal');
const cropperCanvas = document.getElementById('cropper-canvas');
const btnCloseCropper = document.getElementById('close-cropper-btn');
const btnApplyCrop = document.getElementById('btn-apply-crop');

let cropState = {
  img: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  cropX: 0,
  cropY: 0,
  cropSize: 0,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  cropStartX: 0,
  cropStartY: 0,
};

function drawCropper() {
  const cs = cropState;
  if (!cs.img) return;
  const ctx = cropperCanvas.getContext('2d');
  const W = cropperCanvas.width;
  const H = cropperCanvas.height;
  const imgW = cs.img.naturalWidth * cs.scale;
  const imgH = cs.img.naturalHeight * cs.scale;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(cs.img, cs.offsetX, cs.offsetY, imgW, imgH);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(cs.img,
    (cs.cropX - cs.offsetX) / cs.scale,
    (cs.cropY - cs.offsetY) / cs.scale,
    cs.cropSize / cs.scale,
    cs.cropSize / cs.scale,
    cs.cropX, cs.cropY, cs.cropSize, cs.cropSize
  );
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.strokeRect(cs.cropX, cs.cropY, cs.cropSize, cs.cropSize);
  const third = cs.cropSize / 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cs.cropX + i * third, cs.cropY);
    ctx.lineTo(cs.cropX + i * third, cs.cropY + cs.cropSize);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cs.cropX, cs.cropY + i * third);
    ctx.lineTo(cs.cropX + cs.cropSize, cs.cropY + i * third);
    ctx.stroke();
  }
}

function initCustomCropper(img) {
  const cs = cropState;
  cs.img = img;
  const wrapper = document.getElementById('cropper-wrapper');
  const W = wrapper.offsetWidth;
  const maxH = 500;
  const imgAspect = img.naturalWidth / img.naturalHeight;
  let dispW = W, dispH = W / imgAspect;
  if (dispH > maxH) { dispH = maxH; dispW = maxH * imgAspect; }
  cropperCanvas.width = W;
  cropperCanvas.height = maxH;
  cs.scale = dispW / img.naturalWidth;
  cs.offsetX = (W - dispW) / 2;
  cs.offsetY = (maxH - dispH) / 2;
  cs.cropSize = Math.min(dispW, dispH) * 0.7;
  cs.cropX = cs.offsetX + (dispW - cs.cropSize) / 2;
  cs.cropY = cs.offsetY + (dispH - cs.cropSize) / 2;
  drawCropper();
}

if (cropperCanvas) {
  cropperCanvas.addEventListener('mousedown', (e) => {
    const rect = cropperCanvas.getBoundingClientRect();
    const scaleX = cropperCanvas.width / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleX;
    const cs = cropState;
    if (mx >= cs.cropX && mx <= cs.cropX + cs.cropSize && my >= cs.cropY && my <= cs.cropY + cs.cropSize) {
      cs.dragging = true;
      cs.dragStartX = mx;
      cs.dragStartY = my;
      cs.cropStartX = cs.cropX;
      cs.cropStartY = cs.cropY;
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (!cropState.dragging) return;
    const rect = cropperCanvas.getBoundingClientRect();
    const scaleX = cropperCanvas.width / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleX;
    const cs = cropState;
    const W = cropperCanvas.width;
    const H = cropperCanvas.height;
    cs.cropX = Math.min(Math.max(cs.cropStartX + (mx - cs.dragStartX), 0), W - cs.cropSize);
    cs.cropY = Math.min(Math.max(cs.cropStartY + (my - cs.dragStartY), 0), H - cs.cropSize);
    drawCropper();
  });
  window.addEventListener('mouseup', () => { cropState.dragging = false; });
  cropperCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const cs = cropState;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    cs.scale *= delta;
    const imgW = cs.img.naturalWidth * cs.scale;
    const imgH = cs.img.naturalHeight * cs.scale;
    const W = cropperCanvas.width;
    const H = cropperCanvas.height;
    cs.offsetX = Math.min(Math.max(cs.offsetX, W - imgW), 0);
    cs.offsetY = Math.min(Math.max(cs.offsetY, H - imgH), 0);
    drawCropper();
  }, { passive: false });
}

if (idcardPicInput) {
  idcardPicInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      cropperModal.classList.add('active');
      const img = new Image();
      img.onload = () => initCustomCropper(img);
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

if (btnCloseCropper) {
  btnCloseCropper.addEventListener('click', () => {
    cropperModal.classList.remove('active');
    if (!finalIdCardPicBlob) idcardPicInput.value = '';
  });
}

if (btnApplyCrop) {
  btnApplyCrop.addEventListener('click', async () => {
    const cs = cropState;
    if (!cs.img) return;
    btnApplyCrop.textContent = 'Compressing...';
    btnApplyCrop.disabled = true;
    try {
      const out = document.createElement('canvas');
      out.width = 500;
      out.height = 500;
      const ctx = out.getContext('2d');
      ctx.drawImage(cs.img,
        (cs.cropX - cs.offsetX) / cs.scale,
        (cs.cropY - cs.offsetY) / cs.scale,
        cs.cropSize / cs.scale,
        cs.cropSize / cs.scale,
        0, 0, 500, 500
      );
      out.toBlob(async (blob) => {
        try {
          const options = { maxSizeMB: 1, maxWidthOrHeight: 800, useWebWorker: false };
          finalIdCardPicBlob = await imageCompression(blob, options);
          cropperModal.classList.remove('active');
        } catch (err) {
          console.error('Compression error:', err);
          alert('Error compressing image.');
        } finally {
          btnApplyCrop.textContent = 'Apply Crop & Compress';
          btnApplyCrop.disabled = false;
        }
      }, 'image/jpeg', 0.9);
    } catch (err) {
      console.error(err);
      btnApplyCrop.textContent = 'Apply Crop & Compress';
      btnApplyCrop.disabled = false;
    }
  });
}

if (addIdCardForm) {
  addIdCardForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!supabase) {
      alert("Supabase client is not initialized. Please check your environment variables.");
      return;
    }

    if (!finalIdCardPicBlob) {
      alert("Please select and crop a profile picture first.");
      return;
    }

    const btn = document.getElementById('btn-generate-idcard');
    btn.textContent = 'Generating...';
    btn.disabled = true;

    try {
      const name = document.getElementById('idcard-name').value;
      const role = document.getElementById('idcard-role').value;
      const age = document.getElementById('idcard-age').value;
      const city = document.getElementById('idcard-city').value;
      const state = document.getElementById('idcard-state').value;
      const college = document.getElementById('idcard-college').value;
      const joiningDate = document.getElementById('idcard-joining').value;
      const validTill = document.getElementById('idcard-valid').value;
      let uniqueId = document.getElementById('idcard-unique-id').value.trim();

      // Ensure uniqueId is URL friendly
      uniqueId = uniqueId.replace(/[^a-zA-Z0-9_-]/g, '');

      // 1. Upload image to Supabase Storage
      // Always upload as .jpg since we converted it via Canvas
      const fileName = `${uniqueId}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, finalIdCardPicBlob, {
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // 2. Insert record into Supabase Database
      const { error: dbError } = await supabase
        .from('id_cards')
        .insert([{
          unique_id: uniqueId,
          name,
          role,
          age,
          city,
          state,
          college,
          joining_date: joiningDate,
          valid_till: validTill,
          profile_pic_url: publicUrl,
          status: 'active'
        }]);

      if (dbError) throw dbError;

      // 3. Show Result
      const resultDiv = document.getElementById('idcard-result');
      const resultUrl = document.getElementById('idcard-result-url');
      const generatedUrl = `${window.location.origin}/id/${uniqueId}`;

      resultUrl.href = generatedUrl;
      resultUrl.textContent = generatedUrl;
      resultDiv.style.display = 'block';

      // Reset form
      addIdCardForm.reset();
      finalIdCardPicBlob = null;
      idcardPicInput.value = '';

      // Auto-refresh the list
      loadManageIdCards();

    } catch (err) {
      console.error(err);
      alert(`Error generating ID Card: ${err.message}`);
    } finally {
      btn.textContent = 'Generate ID Card';
      btn.disabled = false;
    }
  });
}

// Manage ID Cards
async function loadManageIdCards() {
  const tbody = document.getElementById('manage-idcards-list');
  if (!tbody || !supabase) return;

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading...</td></tr>';

  try {
    const { data, error } = await supabase
      .from('id_cards')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    tbody.innerHTML = '';
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No ID Cards generated yet.</td></tr>';
      return;
    }

    data.forEach(card => {
      const tr = document.createElement('tr');
      const statusColor = card.status === 'active' ? 'green' : 'red';

      tr.innerHTML = `
        <td><img src="${card.profile_pic_url}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;"></td>
        <td><strong>${card.name}</strong></td>
        <td>${card.role}</td>
        <td><a href="/id/${card.unique_id}" target="_blank" style="color:var(--primary);">${card.unique_id}</a></td>
        <td><span style="color:${statusColor}; font-weight:bold; text-transform:uppercase; font-size:12px;">${card.status || 'active'}</span></td>
        <td>
          <button class="btn btn-sm btn-primary" id="btn-edit-idcard-${card.id}">Edit</button>
          ${card.status !== 'revoked'
          ? `<button class="btn btn-sm" style="background:#dc3545; color:white;" id="btn-revoke-idcard-${card.id}">Revoke</button>`
          : `<button class="btn btn-sm" style="background:#28a745; color:white;" id="btn-activate-idcard-${card.id}">Activate</button>`
        }
        </td>
      `;
      tbody.appendChild(tr);

      document.getElementById(`btn-edit-idcard-${card.id}`).addEventListener('click', () => {
        document.getElementById('edit-idcard-db-id').value = card.id;
        document.getElementById('edit-idcard-unique-id').value = card.unique_id || '';
        document.getElementById('edit-idcard-name').value = card.name || '';
        document.getElementById('edit-idcard-role').value = card.role || '';
        document.getElementById('edit-idcard-age').value = card.age || '';
        document.getElementById('edit-idcard-city').value = card.city || '';
        document.getElementById('edit-idcard-state').value = card.state || '';
        document.getElementById('edit-idcard-college').value = card.college || '';
        document.getElementById('edit-idcard-joining').value = card.joining_date || '';
        document.getElementById('edit-idcard-valid').value = card.valid_till || '';
        document.getElementById('edit-idcard-modal').classList.add('active');
      });

      const toggleBtn = document.getElementById(card.status !== 'revoked' ? `btn-revoke-idcard-${card.id}` : `btn-activate-idcard-${card.id}`);
      if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
          const newStatus = card.status === 'revoked' ? 'active' : 'revoked';
          if (confirm(`Are you sure you want to change status to ${newStatus}?`)) {
            toggleBtn.textContent = '...';
            const { error } = await supabase
              .from('id_cards')
              .update({ status: newStatus })
              .eq('id', card.id);
            if (error) {
              alert('Error updating status: ' + error.message);
              toggleBtn.textContent = 'Error';
            } else {
              loadManageIdCards();
            }
          }
        });
      }
    });

  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading ID Cards</td></tr>';
  }
}

const btnRefreshIdCards = document.getElementById('btn-refresh-idcards');
if (btnRefreshIdCards) {
  btnRefreshIdCards.addEventListener('click', loadManageIdCards);
}

// Load initially when Manage tab is clicked
document.querySelector('.nav-item[data-target="sec-manage-idcards"]').addEventListener('click', loadManageIdCards);

// Edit ID Card Logic
document.getElementById('close-edit-idcard-btn')?.addEventListener('click', () => {
  document.getElementById('edit-idcard-modal').classList.remove('active');
});

document.getElementById('form-edit-idcard')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dbId = document.getElementById('edit-idcard-db-id').value;
  const btn = document.getElementById('btn-save-idcard');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const { error } = await supabase
      .from('id_cards')
      .update({
        name: document.getElementById('edit-idcard-name').value,
        role: document.getElementById('edit-idcard-role').value,
        age: document.getElementById('edit-idcard-age').value,
        city: document.getElementById('edit-idcard-city').value,
        state: document.getElementById('edit-idcard-state').value,
        college: document.getElementById('edit-idcard-college').value,
        joining_date: document.getElementById('edit-idcard-joining').value,
        valid_till: document.getElementById('edit-idcard-valid').value,
      })
      .eq('id', dbId);

    if (error) throw error;

    document.getElementById('edit-idcard-modal').classList.remove('active');
    loadManageIdCards();
  } catch (err) {
    console.error(err);
    alert('Error updating ID card: ' + err.message);
  } finally {
    btn.textContent = 'Save Changes';
    btn.disabled = false;
  }
});

// =====================================================
// OFFER LETTER GENERATOR
// =====================================================

const SHEETS_CONFIG = {
  '1': { id: import.meta.env.VITE_SHEET1_ID, gid: import.meta.env.VITE_SHEET1_GID },
  '2': { id: import.meta.env.VITE_SHEET2_ID, gid: import.meta.env.VITE_SHEET2_GID }
};
let googleAccessToken = null;
let olAllApplicants = [];
let olFilteredApplicants = [];
let olSelectedCandidate = null;
let olCurrentSheet = '1';
async function getGoogleAccessToken() {
  if (googleAccessToken) return googleAccessToken;
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    googleAccessToken = credential.accessToken;
    return googleAccessToken;
  } catch (err) {
    console.error('Google Sheets auth failed:', err);
    alert('Failed to connect Google Sheets. Please allow the popup and try again.');
    return null;
  }
}
function findField(obj, ...candidates) {
  for (const c of candidates) {
    const key = Object.keys(obj).find(k => k.toLowerCase().includes(c.toLowerCase()));
    if (key && obj[key]) return obj[key];
  }
  return '';
}
async function fetchSheetData(sheetKey) {
  const config = SHEETS_CONFIG[sheetKey];
  if (!config || !config.id) return [];
  const token = await getGoogleAccessToken();
  if (!token) return [];
  try {
    const metaResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.id}?fields=sheets.properties`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!metaResp.ok) throw new Error(`Sheets API error: ${metaResp.status}`);
    const meta = await metaResp.json();
    let sheetName = 'Sheet1';
    if (meta.sheets) {
      const matched = meta.sheets.find(s => String(s.properties.sheetId) === config.gid);
      if (matched) sheetName = matched.properties.title;
    }
    const dataResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${config.id}/values/${encodeURIComponent(sheetName)}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    if (!dataResp.ok) throw new Error(`Data fetch error: ${dataResp.status}`);
    const data = await dataResp.json();
    const rows = data.values;
    if (!rows || rows.length < 2) return [];
    const headers = rows[0];
    const result = [];
    for (let i = 1; i < rows.length; i++) {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = rows[i][idx] || '';
      });
      obj._headers = headers;
      result.push(obj);
    }
    return result;
  } catch (err) {
    console.error('Error fetching sheet:', err);
    return [];
  }
}

function renderOLTable(data) {
  const thead = document.getElementById('ol-thead');
  const tbody = document.getElementById('ol-tbody');
  if (!data || data.length === 0) {
    thead.innerHTML = '<tr><th>No Data</th></tr>';
    tbody.innerHTML = '<tr><td>No applicants found. Make sure the sheet is shared as "Anyone with the link".</td></tr>';
    return;
  }
  const displayCols = [
    { label: 'Name', key: 'Full Name' },
    { label: 'Email', key: 'Email address' },
    { label: 'College', key: 'College - University' },
    { label: 'Role Applied', key: 'Which role are you applying for ?' },
    { label: 'City', key: 'City' },
  ];
  const headers = data[0]._headers || [];
  const cols = displayCols.filter(c => headers.some(h => h.toLowerCase().includes(c.key.toLowerCase().split(' ')[0])));
  if (cols.length === 0) {
    const fallback = headers.slice(0, 5);
    fallback.forEach(h => cols.push({ label: h, key: h }));
  }
  thead.innerHTML = '<tr>' + cols.map(c => `<th>${c.label}</th>`).join('') + '<th>Action</th></tr>';
  tbody.innerHTML = '';
  data.forEach((row, idx) => {
    const tr = document.createElement('tr');
    let cells = cols.map(c => {
      const val = findField(row, c.key) || '-';
      return `<td>${val.length > 40 ? val.substring(0, 40) + '...' : val}</td>`;
    }).join('');
    cells += `<td><button class="btn-select-candidate" data-idx="${idx}">Select</button></td>`;
    tr.innerHTML = cells;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('.btn-select-candidate').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-select-candidate').forEach(b => {
        b.textContent = 'Select';
        b.style.background = '';
      });
      const idx = parseInt(btn.getAttribute('data-idx'));
      selectOLCandidate(olFilteredApplicants[idx]);
      btn.textContent = '✓ Selected';
      btn.style.background = '#28a745';
    });
  });
}

function selectOLCandidate(candidate) {
  olSelectedCandidate = candidate;
  document.getElementById('ol-name').value = findField(candidate, 'Full Name', 'name');
  document.getElementById('ol-email').value = findField(candidate, 'Email address', 'email');
  document.getElementById('ol-phone').value = findField(candidate, 'Phone', 'WhatsApp', 'mobile');
  document.getElementById('ol-college').value = findField(candidate, 'College - University', 'college', 'university');
  const roleSelect = document.getElementById('ol-role');
  if (olCurrentSheet === '2') {
    roleSelect.value = 'Campus Ambassador';
    roleSelect.disabled = true;
  } else {
    roleSelect.disabled = false;
    const appliedRole = findField(candidate, 'Which role are you applying for', 'role');
    if (appliedRole) {
      const matchOption = Array.from(roleSelect.options).find(
        o => o.value.toLowerCase() === appliedRole.toLowerCase()
      );
      if (matchOption) {
        roleSelect.value = matchOption.value;
      }
    }
  }
  const startDateInput = document.getElementById('ol-start-date');
  if (!startDateInput.value) {
    startDateInput.value = new Date().toISOString().split('T')[0];
  }
  validateOLForm();
}

function validateOLForm() {
  const name = document.getElementById('ol-name').value;
  const role = document.getElementById('ol-role').value;
  document.getElementById('btn-generate-offer').disabled = !(name && role);
}

async function loadOLSheet(sheetKey) {
  olCurrentSheet = sheetKey;
  document.getElementById('ol-table-title').textContent = `Applicants — Sheet ${sheetKey}`;
  document.getElementById('ol-thead').innerHTML = '<tr><th>Loading...</th></tr>';
  document.getElementById('ol-tbody').innerHTML = '<tr><td>Fetching data from Google Sheets...</td></tr>';
  olAllApplicants = await fetchSheetData(sheetKey);
  olFilteredApplicants = [...olAllApplicants];
  renderOLTable(olFilteredApplicants);
}

document.querySelectorAll('.sheet-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadOLSheet(tab.getAttribute('data-sheet'));
  });
});

document.getElementById('ol-search')?.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  if (!term) {
    olFilteredApplicants = [...olAllApplicants];
  } else {
    olFilteredApplicants = olAllApplicants.filter(row => {
      return Object.values(row).some(v => typeof v === 'string' && v.toLowerCase().includes(term));
    });
  }
  renderOLTable(olFilteredApplicants);
});

document.getElementById('ol-role')?.addEventListener('change', validateOLForm);
document.getElementById('ol-idcard-url')?.addEventListener('input', validateOLForm);
document.getElementById('ol-name')?.addEventListener('input', validateOLForm);

document.querySelector('.nav-item[data-target="sec-offerletter"]')?.addEventListener('click', () => {
  if (olAllApplicants.length === 0) loadOLSheet('1');
});

document.getElementById('btn-generate-offer')?.addEventListener('click', async () => {
  const name = document.getElementById('ol-name').value;
  const email = document.getElementById('ol-email').value;
  const phone = document.getElementById('ol-phone').value;
  const college = document.getElementById('ol-college').value;
  const role = document.getElementById('ol-role').value;
  const idCardUrl = document.getElementById('ol-idcard-url').value;
  const startDateVal = document.getElementById('ol-start-date').value;
  if (!name || !role) {
    alert('Please select a candidate and choose a role.');
    return;
  }
  const startDate = startDateVal ? new Date(startDateVal) : new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 3);
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const refNum = `MNM/OL/${startDate.getFullYear()}/${String(Math.floor(Math.random() * 9000) + 1000)}`;
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 25;
  let y = 20;
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  logoImg.src = '/logo.png';
  await new Promise(r => { if (logoImg.complete) r(); else { logoImg.onload = r; logoImg.onerror = r; } });
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, pw, 42, 'F');
  doc.setFillColor(200, 255, 0);
  doc.rect(0, 40, pw, 2, 'F');
  try {
    const canvas = document.createElement('canvas');
    canvas.width = logoImg.naturalWidth;
    canvas.height = logoImg.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(logoImg, 0, 0);
    const logoData = canvas.toDataURL('image/png');
    doc.addImage(logoData, 'PNG', mx, 15.5, 14, 14);
  } catch (e) { }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(200, 255, 0);
  doc.text('MnM', mx + 17, 23);
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text('Makers Need More', mx + 17, 29);
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('INTERNSHIP OFFER LETTER', pw - mx, 23, { align: 'right' });
  doc.setTextColor(160, 160, 160);
  doc.text(refNum, pw - mx, 30, { align: 'right' });
  y = 50;
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${fmt(startDate)}`, mx, y);
  y += 10;
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.text('To,', mx, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(name, mx, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  if (college) { doc.text(college, mx, y); y += 5; }
  if (email) { doc.text(email, mx, y); y += 5; }
  if (phone) { doc.text(phone, mx, y); y += 5; }
  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(mx, y, pw - mx, y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(10, 10, 10);
  doc.text('Subject: Offer of Internship', mx, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(40, 40, 40);
  const bodyLines = [
    `Dear ${name},`,
    '',
    `We are pleased to inform you that you have been selected for the position of ${role} at MnM (Makers Need More). Your application has been reviewed and we are confident that your skills and enthusiasm will be a great addition to our team.`,
    '',
    'Please find the details of your internship below:',
  ];
  bodyLines.forEach(line => {
    if (line === '') { y += 3; return; }
    const split = doc.splitTextToSize(line, pw - mx * 2);
    doc.text(split, mx, y);
    y += split.length * 5;
  });
  y += 5;
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(mx, y, pw - mx * 2, 48, 3, 3, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(mx, y, pw - mx * 2, 48, 3, 3, 'S');
  const bx = mx + 8;
  let by = y + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(10, 10, 10);
  doc.text('INTERNSHIP DETAILS', bx, by);
  by += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(60, 60, 60);
  const details = [
    ['Position', role],
    ['Duration', '3 Months'],
    ['Start Date', fmt(startDate)],
    ['End Date', fmt(endDate)],
  ];
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, bx, by);
    doc.setFont('helvetica', 'normal');
    doc.text(value, bx + 30, by);
    by += 6;
  });
  y += 55;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(10, 10, 10);
  doc.text('Terms & Conditions:', mx, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const terms = [
    'This internship is a learning-oriented engagement.',
    'The intern is expected to maintain professional conduct and adhere to the guidelines set by MnM.',
    'A certificate of completion will be provided upon successful completion of the internship.',
    'The intern must complete assigned tasks and participate actively in team activities.',
    'MnM reserves the right to terminate the internship in case of misconduct or prolonged inactivity.',
    'The intern shall not disclose any confidential information of MnM to third parties.',
  ];
  terms.forEach((term, i) => {
    const text = `${i + 1}. ${term}`;
    const split = doc.splitTextToSize(text, pw - mx * 2 - 5);
    doc.text(split, mx + 3, y);
    y += split.length * 4 + 1.5;
  });
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(mx, y, pw - mx, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  const closing = [
    'We look forward to having you on board and are excited about the contributions you will make to MnM.',
    '',
    'Warm Regards,',
  ];
  closing.forEach(line => {
    if (line === '') { y += 2; return; }
    const split = doc.splitTextToSize(line, pw - mx * 2);
    doc.text(split, mx, y);
    y += split.length * 4.5;
  });
  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(10, 10, 10);
  doc.text('MnM Team', mx, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Authorized Signatory', mx, y + 5);

  const stampX = pw - mx - 55;
  const stampY = y - 8;
  const stampW = 55;
  const stampH = 19;
  
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.2);
  doc.setLineDash([1, 1], 0);
  doc.rect(stampX, stampY, stampW, stampH);
  doc.setLineDash([]); 

  doc.setDrawColor(0, 160, 0);
  doc.setLineWidth(1.2);
  doc.lines([[2, 2], [5, -7]], stampX + 32, stampY + 12);
  doc.setLineWidth(0.2); 

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(20, 60, 140);
  doc.text('Signature valid', stampX + 2, stampY + 4.5);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(40, 40, 40);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
  const timeStr = now.toLocaleTimeString('en-IN', { hour12: false });
  doc.text(`Date: ${dateStr} at ${timeStr} IST`, stampX + 2, stampY + 8);
  doc.text('Digitally signed by:', stampX + 2, stampY + 11.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Manika Kutiyal (COO)', stampX + 2, stampY + 14.5);
  doc.text('Aditya Verma (CTO)', stampX + 2, stampY + 17.5);

  y += 5;
  const footerH = idCardUrl ? 28 : 16;
  doc.setFillColor(10, 10, 10);
  doc.rect(0, ph - footerH, pw, footerH, 'F');
  doc.setFillColor(200, 255, 0);
  doc.rect(0, ph - footerH, pw, 1.5, 'F');
  if (idCardUrl) {
    let qrDataUrl = null;
    try {
      qrDataUrl = await QRCode.toDataURL(idCardUrl, {
        width: 80,
        margin: 1,
        color: { dark: '#ffffff', light: '#0A0A0A' }
      });
    } catch (e) { }
    if (qrDataUrl) {
      try {
        doc.addImage(qrDataUrl, 'PNG', mx - 5, ph - footerH + 4, 20, 20);
      } catch (e) { }
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text('This is a computer-generated document.', mx + 18, ph - footerH + 9);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('This offer can be verified by scanning the QR code or visiting:', mx + 18, ph - footerH + 14);
    doc.setTextColor(200, 255, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(idCardUrl, mx + 18, ph - footerH + 19);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('This is a computer-generated document.', pw / 2, ph - 7, { align: 'center' });
  }
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`MnM_OfferLetter_${safeName}.pdf`);
});

document.getElementById('idcard-joining')?.addEventListener('change', (e) => {
  if (e.target.value) {
    const joiningDate = new Date(e.target.value);
    const validDate = new Date(joiningDate);
    validDate.setMonth(validDate.getMonth() + 3);
    document.getElementById('idcard-valid').value = validDate.toISOString().split('T')[0];
  }
});
