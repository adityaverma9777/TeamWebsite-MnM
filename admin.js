import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { sanityClient } from './sanity.js';

const ADMIN_EMAIL = 'admin@mnmworks.xyz';
let allUsers = [];
let allTeams = [];
let allRegistrations = [];
let allRepos = [];

// --- AUTHENTICATION ---
let currentAdminUid = null;

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (user.email === ADMIN_EMAIL) {
      currentAdminUid = user.uid;
      // Ensure admin name is set correctly
      try {
        await updateDoc(doc(db, 'users', user.uid), { name: "MnM Admin" });
      } catch(e) { }

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
          <strong>${user.name || 'Unnamed'}</strong>
        </div>
      </td>
      <td>${user.email || 'N/A'}</td>
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
    const leaderName = leader ? leader.name : 'Unknown';
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
      <td>${leaderName}</td>
      <td>${memberCount} User(s)</td>
      <td>${dateStr}</td>
    `;
    tbody.appendChild(tr);
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
        <strong>${user ? user.name : 'Unknown'}</strong><br>
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
  });
}

async function updateRepoStatus(repoId, status) {
  try {
    await updateDoc(doc(db, 'repo_submissions', repoId), { status });
    // Update local and re-render
    const r = allRepos.find(x => x.id === repoId);
    if (r) r.status = status;
    renderSubmissions();
  } catch(e) {
    console.error("Failed to update status", e);
    alert("Error updating status");
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
