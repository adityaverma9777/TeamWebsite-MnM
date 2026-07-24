import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { sanityClient } from './sanity.js';
import { supabase } from './supabase.js';
import imageCompression from 'browser-image-compression';

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
window.openUserProfilePanel = async function(userId) {
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
        alert("Editing will be available in future updates! For now, please modify directly in Supabase.");
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
