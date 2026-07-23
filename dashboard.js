import { auth, db, storage } from './firebase.js';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, onSnapshot, orderBy, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { sanityClient } from './sanity.js';
import imageUrlBuilder from '@sanity/image-url';

const builder = imageUrlBuilder(sanityClient);
function urlFor(source) {
  return builder.image(source);
}

let currentUser = null;

// --- Authentication Check ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadUserProfile();
    loadProjectSubmissions();
    loadRecentChats();
    loadNotices();
    checkUrlParams();
    document.getElementById('preloader').style.display = 'none';
  } else {
    // Save invite parameter to sessionStorage if present in URL
    const urlParams = new URLSearchParams(window.location.search);
    const invite = urlParams.get('invite');
    if (invite) {
      sessionStorage.setItem('pendingInvite', invite);
    }
    // Not logged in, redirect to home
    window.location.href = '/index.html';
  }
});

document.getElementById('btn-logout').addEventListener('click', () => {
  signOut(auth).then(() => {
    window.location.href = '/index.html';
  });
});

// --- Tab Switching Logic ---
const navBtns = document.querySelectorAll('.nav-btn');
const tabs = document.querySelectorAll('.dash-tab');

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active from all
    navBtns.forEach(b => b.classList.remove('active'));
    tabs.forEach(t => t.classList.remove('active-tab'));
    
    // Set active
    btn.classList.add('active');
    const targetId = btn.getAttribute('data-target');
    document.getElementById(targetId).classList.add('active-tab');
  });
});

// --- Dynamic Links Logic ---
function renderExtraLinks(links) {
  const container = document.getElementById('extra-links-container');
  container.innerHTML = '';
  links.forEach(link => {
    addLinkInput(link);
  });
}

function addLinkInput(value = '') {
  const container = document.getElementById('extra-links-container');
  const div = document.createElement('div');
  div.style.display = 'flex';
  div.style.gap = '8px';
  div.innerHTML = `
    <input type="url" class="dash-input extra-link-input" placeholder="https://..." value="${value}" style="flex:1;">
    <button type="button" class="btn-remove-link" style="background:var(--slate); color:var(--white); border:none; border-radius:8px; padding:0 12px; cursor:pointer;">X</button>
  `;
  div.querySelector('.btn-remove-link').onclick = () => div.remove();
  container.appendChild(div);
}

document.getElementById('btn-add-link').addEventListener('click', () => {
  addLinkInput();
});

// --- Profile Logic ---
let initialGithub = null;

async function loadUserProfile() {
  const userRef = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(userRef);
  
  if (snap.exists()) {
    const data = snap.data();
    
    document.getElementById('dash-user-name').textContent = data.name || 'User';
    document.getElementById('dash-user-email').textContent = data.email || '';
    document.getElementById('dash-user-avatar').src = data.photoURL || '/logo.png';
    
    // Pre-fill form
    if (data.name) document.getElementById('dash-name').value = data.name;
    if (data.username) document.getElementById('dash-username').value = data.username;
    if (data.bio) document.getElementById('dash-bio').value = data.bio;
    if (data.phone) document.getElementById('dash-phone').value = data.phone;
    if (data.college) document.getElementById('dash-college').value = data.college;
    if (data.linkedin) document.getElementById('dash-linkedin').value = data.linkedin;
    
    const ghInput = document.getElementById('dash-github');
    if (data.github) {
      initialGithub = data.github;
      ghInput.value = data.github;
      ghInput.disabled = true;
      ghInput.style.opacity = '0.7';
      document.getElementById('github-lock-note').style.display = 'inline';
      
      // Show Contributions Chart
      document.getElementById('github-contributions-card').style.display = 'block';
      document.getElementById('github-chart-container').innerHTML = `
        <img src="https://ghchart.rshah.org/C0FF00/${data.github}" alt="${data.github}'s Github Chart" style="width: 100%; min-width: 600px; display: block; margin: 0 auto; filter: brightness(1.2);">
      `;
    } else {
      ghInput.value = '';
      ghInput.disabled = false;
      ghInput.style.opacity = '1';
      document.getElementById('github-lock-note').style.display = 'none';
      document.getElementById('github-contributions-card').style.display = 'none';
    }
    
    document.getElementById('dash-public').checked = data.isPublic === true;

    renderExtraLinks(data.extraLinks || []);
    
    // Team Logic
    await handleTeamFlow(data.teamId);
  }
}

async function handleTeamFlow(teamId) {
  const urlParams = new URLSearchParams(window.location.search);
  let inviteCode = urlParams.get('invite');
  
  if (!inviteCode) {
    inviteCode = sessionStorage.getItem('pendingInvite');
    if (inviteCode) {
      sessionStorage.removeItem('pendingInvite'); // Clear so we don't prompt on subsequent loads
    }
  } else {
    sessionStorage.removeItem('pendingInvite');
  }
  
  if (inviteCode && !teamId) {
    // User is joining via invite link
    if (confirm("You were invited to join a team! Join now?")) {
      await joinTeam(inviteCode);
      return;
    } else {
      // User declined, clean up URL and show no-team state
      window.history.replaceState({}, document.title, "/dashboard.html");
    }
  }

  if (teamId) {
    document.getElementById('team-none-state').style.display = 'none';
    document.getElementById('team-active-state').style.display = 'block';
    
    // Load Team Data
    const teamSnap = await getDoc(doc(db, 'teams', teamId));
    if (teamSnap.exists()) {
      const teamData = teamSnap.data();
      const isLeader = teamData.leaderId === currentUser.uid;

      document.getElementById('active-team-name').textContent = teamData.name;

      // --- Role Badge ---
      document.getElementById('team-role-badge').textContent = isLeader ? '👑 You are the Team Leader' : '👤 You are a Member';
      document.getElementById('team-role-badge').style.color = isLeader ? 'var(--lime)' : 'var(--slate)';

      // --- Members List ---
      const list = document.getElementById('team-members-list');
      list.innerHTML = '';
      
      for (let uid of teamData.members) {
        const memberSnap = await getDoc(doc(db, 'users', uid));
        if (memberSnap.exists()) {
          const mData = memberSnap.data();
          const row = document.createElement('div');
          row.style.cssText = 'display:flex; align-items:center; gap:12px; margin-bottom:10px; padding:8px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--border);';
          
          let removeBtn = '';
          // Leader can remove any member except themselves
          if (isLeader && uid !== currentUser.uid) {
            removeBtn = `<button class="btn-remove-member" data-uid="${uid}" style="margin-left:auto; background:transparent; border:1px solid #ef4444; color:#ef4444; border-radius:6px; padding:2px 10px; cursor:pointer; font-size:12px;">Remove</button>`;
          }

          row.innerHTML = `
            <img src="${mData.photoURL || '/logo.png'}" style="width:28px; height:28px; border-radius:50%; flex-shrink:0;">
            <span style="font-size:14px; color:var(--white);">${mData.name || mData.email || 'Unknown'}</span>
            ${uid === teamData.leaderId ? '<span style="font-size:11px; color:var(--lime); margin-left:4px;">👑 Leader</span>' : ''}
            ${removeBtn}
          `;
          list.appendChild(row);

          // Bind remove button
          if (isLeader && uid !== currentUser.uid) {
            row.querySelector('.btn-remove-member').addEventListener('click', async () => {
              if (confirm(`Remove ${mData.name} from the team?`)) {
                await removeMember(teamId, uid);
              }
            });
          }
        }
      }

      // --- Leader Controls: Rename Team ---
      const leaderControls = document.getElementById('team-leader-controls');
      const memberControls = document.getElementById('team-member-controls');

      if (isLeader) {
        leaderControls.style.display = 'block';
        memberControls.style.display = 'none';
        document.getElementById('rename-team-input').value = teamData.name;
      } else {
        leaderControls.style.display = 'none';
        memberControls.style.display = 'block';
      }

      // --- Copy Invite Link ---
      document.getElementById('btn-copy-invite').onclick = () => {
        const inviteUrl = `${window.location.origin}/dashboard.html?invite=${teamId}`;
        navigator.clipboard.writeText(inviteUrl);
        document.getElementById('btn-copy-invite').textContent = '✅ Copied!';
        setTimeout(() => { document.getElementById('btn-copy-invite').textContent = '📋 Copy Invite Link'; }, 2000);
      };

    }
  } else {
    document.getElementById('team-none-state').style.display = 'block';
    document.getElementById('team-active-state').style.display = 'none';
  }
}

document.getElementById('create-team-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.textContent = 'Creating...';
  btn.disabled = true;
  
  const teamName = document.getElementById('new-team-name').value.trim();
  if (!teamName) { btn.textContent = 'Create Team'; btn.disabled = false; return; }
  
  try {
    // 1. Create team doc
    const teamDoc = await addDoc(collection(db, 'teams'), {
      name: teamName,
      leaderId: currentUser.uid,
      members: [currentUser.uid],
      createdAt: new Date()
    });
    
    // 2. Update user with teamId
    await updateDoc(doc(db, 'users', currentUser.uid), {
      teamId: teamDoc.id
    });
    
    document.getElementById('new-team-name').value = '';
    await handleTeamFlow(teamDoc.id);
  } catch (error) {
    console.error("Error creating team:", error);
    alert('Failed to create team. Check console for details.');
  } finally {
    btn.textContent = 'Create Team';
    btn.disabled = false;
  }
});

async function joinTeam(teamId) {
  try {
    const teamRef = doc(db, 'teams', teamId);
    const teamSnap = await getDoc(teamRef);
    
    if (teamSnap.exists()) {
      const data = teamSnap.data();
      
      if (!data.members.includes(currentUser.uid)) {
        // Use arrayUnion for safe atomic update
        await updateDoc(teamRef, { members: arrayUnion(currentUser.uid) });
      }
      
      // Update user doc with their new teamId
      await updateDoc(doc(db, 'users', currentUser.uid), { teamId: teamId });
      
      // Clean up URL
      window.history.replaceState({}, document.title, "/dashboard.html");
      await handleTeamFlow(teamId);
    } else {
      alert("Invalid invite link. This team no longer exists.");
      window.history.replaceState({}, document.title, "/dashboard.html");
    }
  } catch (e) {
    console.error('Error joining team:', e);
    alert(`Failed to join team: ${e.message}. You may not have permission — please contact an admin.`);
    window.history.replaceState({}, document.title, "/dashboard.html");
  }
}

async function leaveTeam(teamId) {
  if (!confirm('Are you sure you want to leave this team?')) return;
  try {
    // Remove self from team members array
    await updateDoc(doc(db, 'teams', teamId), {
      members: arrayRemove(currentUser.uid)
    });
    // Clear teamId from user profile
    await updateDoc(doc(db, 'users', currentUser.uid), { teamId: null });
    await handleTeamFlow(null);
  } catch (e) {
    console.error('Error leaving team:', e);
    alert(`Failed to leave team: ${e.message}`);
  }
}

async function removeMember(teamId, memberUid) {
  try {
    // Remove member from team
    await updateDoc(doc(db, 'teams', teamId), {
      members: arrayRemove(memberUid)
    });
    // Clear teamId from removed user's profile
    await updateDoc(doc(db, 'users', memberUid), { teamId: null });
    // Re-render team
    await handleTeamFlow(teamId);
  } catch (e) {
    console.error('Error removing member:', e);
    alert(`Failed to remove member: ${e.message}`);
  }
}

async function renameTeam(teamId, newName) {
  if (!newName.trim()) { alert('Team name cannot be empty.'); return; }
  try {
    await updateDoc(doc(db, 'teams', teamId), { name: newName.trim() });
    document.getElementById('active-team-name').textContent = newName.trim();
    return true;
  } catch (e) {
    console.error('Error renaming team:', e);
    alert(`Failed to rename team: ${e.message}`);
    return false;
  }
}

// --- Rename Team Form Handler ---
document.getElementById('rename-team-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const newName = document.getElementById('rename-team-input').value.trim();
  const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
  const teamId = userSnap.data()?.teamId;
  if (!teamId) return;
  btn.textContent = 'Saving...';
  btn.disabled = true;
  const success = await renameTeam(teamId, newName);
  btn.textContent = success ? 'Saved!' : 'Save Name';
  setTimeout(() => { btn.textContent = 'Save Name'; btn.disabled = false; }, 2000);
});

// --- Leave Team Button Handler ---
document.getElementById('btn-leave-team').addEventListener('click', async () => {
  const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
  const teamId = userSnap.data()?.teamId;
  if (teamId) await leaveTeam(teamId);
});

document.getElementById('dash-profile-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Saving...';
  
  const name = document.getElementById('dash-name').value.trim();
  const username = document.getElementById('dash-username').value.trim();
  const bio = document.getElementById('dash-bio').value.trim();
  const phone = document.getElementById('dash-phone').value.trim();
  const college = document.getElementById('dash-college').value.trim();
  const github = document.getElementById('dash-github').value.trim();
  const linkedin = document.getElementById('dash-linkedin').value.trim();
  const isPublic = document.getElementById('dash-public').checked;
  
  if (github && github !== initialGithub) {
    const confirmGh = confirm("Are you sure? Once your GitHub username is saved, you cannot change it without contacting support. Proceed?");
    if (!confirmGh) {
      btn.textContent = 'Save Changes';
      return; // Cancel submission
    }
  }
  
  const extraLinks = [];
  document.querySelectorAll('.extra-link-input').forEach(input => {
    if (input.value.trim()) extraLinks.push(input.value.trim());
  });

  const updateData = {
    name, username, bio, phone, college, github, linkedin, isPublic, extraLinks
  };

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, updateData);
    
    document.getElementById('dash-user-name').textContent = name;
    
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = 'Save Changes'; }, 2000);
  } catch (error) {
    console.error("Error saving profile:", error);
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Save Changes'; }, 2000);
  }
});

// --- Repo Submission Logic ---
document.getElementById('dash-repo-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.textContent = 'Validating...';
  
  const url = document.getElementById('repo-url').value.trim();
  const desc = document.getElementById('repo-desc').value.trim();
  
  try {
    // 1. Ensure user has a GitHub username set
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const userData = userDoc.data();
    if (!userData.github) {
      alert("You must set your GitHub username in your Profile before submitting a repo.");
      btn.textContent = 'Submit Repo';
      return;
    }

    // 2. Extract username and repo name from URL
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      alert("Invalid GitHub URL. Must be in format https://github.com/Username/RepoName");
      btn.textContent = 'Submit Repo';
      return;
    }

    const submittedUsername = match[1];
    const submittedRepoName = match[2].replace('.git', '');

    if (submittedUsername.toLowerCase() !== userData.github.toLowerCase()) {
      alert(`URL username (${submittedUsername}) does not match your locked GitHub username (${userData.github}).`);
      btn.textContent = 'Submit Repo';
      return;
    }

    // 3. Fetch Sanity parent repos to validate repo name
    const sanityRepos = await sanityClient.fetch(`*[_type == "repository"]`);
    let isValidParent = false;

    for (let r of sanityRepos) {
      if (r.githubUrl) {
        const pMatch = r.githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (pMatch) {
          const pRepoName = pMatch[2].replace('.git', '');
          if (pRepoName.toLowerCase() === submittedRepoName.toLowerCase()) {
            isValidParent = true;
            break;
          }
        }
      }
    }

    if (!isValidParent) {
      alert(`The repository name "${submittedRepoName}" does not match any official parent repository on our platform.`);
      btn.textContent = 'Submit Repo';
      return;
    }

    // Passed all validation
    btn.textContent = 'Submitting...';
    await addDoc(collection(db, 'repo_submissions'), {
      userId: currentUser.uid,
      repoUrl: url,
      description: desc,
      status: 'pending',
      timestamp: new Date()
    });
    
    document.getElementById('dash-repo-form').reset();
    btn.textContent = 'Submitted!';
    setTimeout(() => btn.textContent = 'Submit Repo', 2000);
    
    loadSubmissions();
    
  } catch (error) {
    console.error('Error submitting repo:', error);
    btn.textContent = 'Error';
    setTimeout(() => btn.textContent = 'Submit Repo', 2000);
  }
});

async function loadSubmissions() {
  const q = query(collection(db, 'repo_submissions'), where('userId', '==', currentUser.uid));
  const querySnapshot = await getDocs(q);
  
  const list = document.getElementById('repo-submissions-list');
  list.innerHTML = '';
  
  if (querySnapshot.empty) {
    list.innerHTML = '<div class="dash-empty-state">No repositories submitted yet.</div>';
    return;
  }
  
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    let statusColor = data.status === 'approved' ? 'var(--lime)' : (data.status === 'rejected' ? 'red' : 'var(--slate)');
    
    list.innerHTML += `
      <div class="dash-card" style="margin-bottom: 12px; padding: 16px;">
        <h4 style="margin: 0 0 8px;">${data.repoUrl}</h4>
        <p style="margin: 0 0 12px; color: var(--slate); font-size: 14px;">${data.description}</p>
        <span class="commit-mono" style="color: ${statusColor}; font-size: 12px; border: 1px solid ${statusColor}; padding: 2px 8px; border-radius: 12px;">${data.status.toUpperCase()}</span>
      </div>
    `;
  });
}

// --- Messaging / Search Logic ---
document.getElementById('user-search-input').addEventListener('input', async (e) => {
  const term = e.target.value.toLowerCase();
  const resultsContainer = document.getElementById('user-search-results');
  
  if (term.length < 2) {
    resultsContainer.innerHTML = '';
    return;
  }
  
  // Note: Firestore doesn't support native "starts-with" case-insensitive search easily without external services like Algolia. 
  // For this prototype, we'll fetch a limited set of users and filter client-side for simplicity, 
  // OR we can just fetch all users if the DB is small enough.
  const usersSnap = await getDocs(collection(db, 'users'));
  resultsContainer.innerHTML = '';
  
  let found = false;
  usersSnap.forEach(docSnap => {
    const data = docSnap.data();
    if (docSnap.id === currentUser.uid) return; // Don't show self
    
    if (data.name && data.name.toLowerCase().includes(term)) {
      found = true;
      const card = document.createElement('div');
      card.className = 'search-result-card';
      card.innerHTML = `
        <img src="${data.photoURL || '/logo.png'}" class="chat-avatar">
        <div class="chat-details">
          <h4>${data.name}</h4>
          <p>${data.email}</p>
        </div>
      `;
      card.addEventListener('click', () => openChat(docSnap.id, data.name));
      resultsContainer.appendChild(card);
    }
  });
  
  if (!found) {
    resultsContainer.innerHTML = '<div class="dash-empty-state">No users found.</div>';
  }
});

async function loadRecentChats() {
  const list = document.getElementById('recent-chats-list');
  if (!list) return;

  const q = query(
    collection(db, 'messages'),
    where('participants', 'array-contains', currentUser.uid)
  );

  onSnapshot(q, async (snapshot) => {
    if (snapshot.empty) {
      list.innerHTML = '<div class="dash-empty-state">No recent messages.</div>';
      return;
    }

    const chatsMap = new Map();
    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const existing = chatsMap.get(msg.chatId);
      if (!existing || msg.timestamp > existing.timestamp) {
        chatsMap.set(msg.chatId, msg);
      }
    });

    const recentChats = Array.from(chatsMap.values()).sort((a, b) => {
      return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0);
    });

    list.innerHTML = '';
    
    for (const chat of recentChats) {
      const otherUid = chat.senderId === currentUser.uid ? chat.receiverId : chat.senderId;
      
      const userRef = doc(db, 'users', otherUid);
      const userSnap = await getDoc(userRef);
      const otherUser = userSnap.exists() ? userSnap.data() : { name: 'Unknown User', photoURL: '/logo.png' };

      const card = document.createElement('div');
      card.className = 'dash-card';
      card.style.cssText = 'padding: 12px; margin-bottom: 8px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: 0.2s;';
      card.innerHTML = `
        <img src="${otherUser.photoURL || '/logo.png'}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
        <div style="flex: 1; overflow: hidden;">
          <h4 style="margin: 0 0 4px; color: var(--white);">${otherUser.name}</h4>
          <p style="margin: 0; color: var(--slate); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${chat.text}</p>
        </div>
      `;
      card.onmouseover = () => card.style.borderColor = 'var(--lime)';
      card.onmouseout = () => card.style.borderColor = 'var(--border)';
      
      card.addEventListener('click', () => {
        openChat(otherUid, otherUser.name);
      });
      list.appendChild(card);
    }
  });
}

// --- Chat Overlay Logic ---
let currentChatUserId = null;
let chatUnsubscribe = null;

function openChat(targetUid, targetName) {
  currentChatUserId = targetUid;
  document.getElementById('chat-target-name').textContent = targetName;
  document.getElementById('chat-overlay').classList.add('active');
  
  const messagesArea = document.getElementById('chat-messages');
  messagesArea.innerHTML = 'Loading messages...';
  
  // Create a predictable Chat ID (alphabetical combination of both UIDs)
  const chatId = [currentUser.uid, targetUid].sort().join('_');
  
  // Query all messages for the current user to avoid composite index requirements
  const q = query(
    collection(db, 'messages'), 
    where('participants', 'array-contains', currentUser.uid)
  );
  
  if (chatUnsubscribe) chatUnsubscribe();
  
  chatUnsubscribe = onSnapshot(q, (snapshot) => {
    messagesArea.innerHTML = '';
    
    // Filter and sort in memory
    const chatMessages = [];
    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      if (msg.chatId === chatId) {
        chatMessages.push(msg);
      }
    });
    
    chatMessages.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));
    
    if (chatMessages.length === 0) {
      messagesArea.innerHTML = '<div style="margin: auto; color: var(--slate);">No messages yet. Say hi!</div>';
    }

    chatMessages.forEach(msg => {
      const isSent = msg.senderId === currentUser.uid;
      
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${isSent ? 'sent' : 'received'}`;
      bubble.textContent = msg.text;
      messagesArea.appendChild(bubble);
    });
    // Scroll to bottom
    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
}

document.getElementById('close-chat-btn').addEventListener('click', () => {
  document.getElementById('chat-overlay').classList.remove('active');
  if (chatUnsubscribe) chatUnsubscribe();
  currentChatUserId = null;
});

document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  
  if (!text || !currentChatUserId) return;
  input.value = '';
  
  const chatId = [currentUser.uid, currentChatUserId].sort().join('_');
  
  await addDoc(collection(db, 'messages'), {
    chatId: chatId,
    participants: [currentUser.uid, currentChatUserId],
    senderId: currentUser.uid,
    receiverId: currentChatUserId,
    text: text,
    timestamp: new Date()
  });
});

// --- URL Params handling ---
function checkUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab');
  
  if (tab) {
    const targetBtn = document.querySelector(`.nav-btn[data-target="tab-${tab}"]`);
    if (targetBtn) {
      targetBtn.click(); // Switch to the tab automatically
    }
  }
}

// --- Notices Logic ---
let activeCompetitionData = null;
let allDynamicActivities = [];

async function loadNotices() {
  const noticeContent = document.getElementById('dash-notice-content');
  if (!noticeContent) return;

  try {
    const notice = await sanityClient.fetch(`*[_type == "notice"] | order(_createdAt desc)[0]`);
    
    if (!notice || !notice.text) {
      noticeContent.innerHTML = '<div class="dash-empty-state">No notices available</div>';
    } else {
      noticeContent.textContent = notice.text;
    }
  } catch (error) {
    console.error("Failed to load Notices", error);
    noticeContent.innerHTML = `<div class="dash-empty-state">Error loading notices</div>`;
  }
}

// --- Dynamic Modal Logic ---
function openDynamicModal(activity) {
  const overlay = document.getElementById('dynamic-modal-overlay');
  
  document.getElementById('dyn-modal-title').textContent = activity.title;
  
  const imgEl = document.getElementById('dyn-modal-image');
  if (activity.coverImage) {
    imgEl.src = urlFor(activity.coverImage).width(800).url();
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
  }

  document.getElementById('dyn-modal-details').textContent = activity.details || '';
  
  const btnContainer = document.getElementById('dyn-modal-buttons');
  btnContainer.innerHTML = '';
  
  if (activity.actionButtons && activity.actionButtons.length > 0) {
    activity.actionButtons.forEach(btn => {
      const a = document.createElement('a');
      a.href = btn.url || '#';
      a.target = '_blank';
      a.className = 'btn-pill';
      a.textContent = btn.label;
      a.style.textAlign = 'center';
      a.style.display = 'block';
      a.style.textDecoration = 'none';
      
      if (btn.style === 'secondary') {
        a.style.background = 'transparent';
        a.style.border = '1px solid #ec4899';
        a.style.color = '#ec4899';
      } else {
        a.style.background = '#ec4899';
        a.style.color = '#000';
      }
      btnContainer.appendChild(a);
    });
  }

  overlay.classList.add('active');
}

document.getElementById('dynamic-modal-close').addEventListener('click', () => {
  document.getElementById('dynamic-modal-overlay').classList.remove('active');
});

async function openRegistrationModal(comp) {
  activeCompetitionData = comp;
  const overlay = document.getElementById('registration-modal-overlay');
  if (!overlay) return;

  document.getElementById('reg-modal-title').textContent = `Register for ${comp.title}`;
  
  // Check team status
  const userRef = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(userRef);
  const teamId = snap.exists() ? snap.data().teamId : null;
  
  const teamStatusText = document.getElementById('reg-team-status');
  if (teamId) {
    const teamSnap = await getDoc(doc(db, 'teams', teamId));
    if (teamSnap.exists()) {
      teamStatusText.innerHTML = `You are registering as team <strong>${teamSnap.data().name}</strong>.`;
      teamStatusText.style.color = 'var(--lime)';
    } else {
      teamStatusText.innerHTML = `Team data error.`;
    }
  } else {
    teamStatusText.innerHTML = `You must <a href="#" onclick="document.querySelector('.nav-btn[data-target=\\'tab-profile\\']').click(); document.getElementById('registration-modal-overlay').classList.remove('active'); return false;" style="color:var(--lime); text-decoration:underline;">create or join a team</a> first before registering.`;
    teamStatusText.style.color = 'var(--slate)';
  }

  // Check if already registered
  const q = query(
    collection(db, 'hackathon_registrations'),
    where('userId', '==', currentUser.uid),
    where('competitionId', '==', comp._id)
  );
  const existingReg = await getDocs(q);
  
  const submitBtn = document.getElementById('btn-submit-reg');
  if (!existingReg.empty) {
    submitBtn.textContent = "Already Registered";
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';
  } else {
    submitBtn.textContent = "Confirm Registration";
    submitBtn.disabled = !teamId; // Disable if no team
    submitBtn.style.opacity = teamId ? '1' : '0.5';
  }

  overlay.classList.add('active');
}

// Close registration modal
document.getElementById('registration-modal-close').addEventListener('click', () => {
  document.getElementById('registration-modal-overlay').classList.remove('active');
  activeCompetitionData = null;
});

// Submit Registration
document.getElementById('registration-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeCompetitionData) return;

  const btn = document.getElementById('btn-submit-reg');
  if (btn.disabled) return;
  
  btn.textContent = "Registering...";
  btn.disabled = true;

  const userRef = doc(db, 'users', currentUser.uid);
  const snap = await getDoc(userRef);
  const teamId = snap.exists() ? snap.data().teamId : null;

  if (!teamId) {
    alert("You must be in a team to register.");
    btn.textContent = "Confirm Registration";
    return;
  }

  const idea = document.getElementById('reg-idea').value.trim();
  const why = document.getElementById('reg-why').value.trim();

  try {
    await addDoc(collection(db, 'hackathon_registrations'), {
      competitionId: activeCompetitionData._id,
      competitionTitle: activeCompetitionData.title,
      userId: currentUser.uid,
      teamId: teamId,
      projectIdea: idea,
      motivation: why,
      timestamp: new Date()
    });

    alert("Successfully registered for the hackathon!");
    document.getElementById('registration-modal-overlay').classList.remove('active');
    btn.textContent = "Already Registered";
  } catch (error) {
    console.error("Registration failed", error);
    alert("Failed to register. Please try again.");
    btn.textContent = "Confirm Registration";
    btn.disabled = false;
  }
});

// --- Repo Contribution Logic ---
let activeRepoData = null;

window.openRepoContributionModal = function(repo) {
  activeRepoData = repo;
  document.getElementById('repo-modal-title').textContent = `Contribute to ${repo.title}`;
  document.getElementById('repo-fork-url').value = '';
  document.getElementById('repo-fork-desc').value = '';
  document.getElementById('btn-submit-fork').textContent = 'Validate & Submit';
  document.getElementById('btn-submit-fork').disabled = false;
  document.getElementById('repo-contribution-modal-overlay').classList.add('active');
}

document.getElementById('repo-contribution-modal-close')?.addEventListener('click', () => {
  document.getElementById('repo-contribution-modal-overlay').classList.remove('active');
  activeRepoData = null;
});

document.getElementById('repo-contribution-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!activeRepoData || !currentUser) return;

  const btn = document.getElementById('btn-submit-fork');
  btn.disabled = true;
  btn.textContent = 'Validating with GitHub...';

  const forkUrl = document.getElementById('repo-fork-url').value.trim();
  const desc = document.getElementById('repo-fork-desc').value.trim();
  
  const userRef = doc(db, 'users', currentUser.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists() || !userSnap.data().github) {
    alert("You must link your GitHub username in your Profile first!");
    btn.disabled = false;
    btn.textContent = 'Validate & Submit';
    return;
  }
  
  const githubUsername = userSnap.data().github;
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

  try {
    const res = await fetch(`${backendUrl}/api/validate-fork`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        forkUrl,
        expectedUsername: githubUsername,
        expectedRepoName: activeRepoData.title
      })
    });

    const data = await res.json();
    
    if (!res.ok || !data.valid) {
      alert(`Validation Failed: ${data.error}`);
      btn.disabled = false;
      btn.textContent = 'Validate & Submit';
      return;
    }

    // Validation passed! Save to Firebase
    btn.textContent = 'Validation Passed! Saving...';
    await addDoc(collection(db, 'repo_submissions'), {
      userId: currentUser.uid,
      userName: userSnap.data().name,
      githubUsername: githubUsername,
      repoId: activeRepoData._id,
      repoTitle: activeRepoData.title,
      forkUrl: forkUrl,
      note: desc,
      status: 'pending',
      timestamp: new Date()
    });

    alert("Awesome! Your fork has been validated and submitted.");
    document.getElementById('repo-contribution-modal-overlay').classList.remove('active');
    
  } catch (error) {
    console.error("Submission error", error);
    alert("Network error occurred during validation.");
    btn.disabled = false;
    btn.textContent = 'Validate & Submit';
  }
});

// --- Submit New Project Logic ---
document.getElementById('dash-project-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const url = document.getElementById('project-url').value.trim();
  const desc = document.getElementById('project-desc').value.trim();
  
  if (!url || !desc) return;
  
  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Submitting...';
  
  try {
    const { addDoc, collection } = await import('firebase/firestore');
    await addDoc(collection(db, 'project_proposals'), {
      userId: currentUser.uid,
      url: url,
      description: desc,
      status: 'pending',
      timestamp: new Date()
    });
    
    alert('Project submitted for review successfully!');
    document.getElementById('project-url').value = '';
    document.getElementById('project-desc').value = '';
    
    loadProjectSubmissions();
  } catch (error) {
    console.error('Error submitting project', error);
    alert('Error submitting project');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit for Review';
  }
});

async function loadProjectSubmissions() {
  const list = document.getElementById('project-submissions-list');
  if (!list) return;

  const { query, collection, where, getDocs } = await import('firebase/firestore');
  const q = query(collection(db, 'project_proposals'), where('userId', '==', currentUser.uid));
  const snap = await getDocs(q);
  
  if (snap.empty) {
    list.innerHTML = '<div class="dash-empty-state">No projects proposed yet.</div>';
    return;
  }
  
  list.innerHTML = '';
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const div = document.createElement('div');
    div.className = 'dash-card';
    div.style.marginBottom = '12px';
    div.style.padding = '12px 16px';
    
    let statusColor = 'var(--slate)';
    if (data.status === 'approved') statusColor = 'var(--lime)';
    if (data.status === 'rejected') statusColor = '#ef4444';
    
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <a href="${data.url}" target="_blank" style="color: var(--white); text-decoration: none; font-weight: 500;">${data.url}</a>
          <p style="color: var(--slate); font-size: 14px; margin: 4px 0 0;">${data.description}</p>
        </div>
        <span style="font-size: 12px; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.1); color: ${statusColor}; text-transform: uppercase; font-family: 'Commit Mono', monospace;">${data.status}</span>
      </div>
    `;
    list.appendChild(div);
  });
}
