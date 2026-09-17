document.addEventListener('DOMContentLoaded', () => {
    const addMemberBtn = document.getElementById('addMemberBtn');
    const membersContainer = document.getElementById('membersContainer');
    const form = document.getElementById('registrationForm');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const loader = submitBtn.querySelector('.loader');
    const messageBox = document.getElementById('messageBox');

    // Autocomplete elements
    const teamNameInput = document.getElementById('teamName');
    const teamDropdown = document.getElementById('teamDropdown');
    const successTick = document.querySelector('.success-tick');
    let availableTeams = [];

    // Fetch teams for autocomplete
    async function fetchTeams() {
        try {
            // Try fetching from public/teams.json first for local dev
            let res = await fetch('/teams.json');
            if (res.ok) {
                const data = await res.json();
                availableTeams = data.teams || [];
                return;
            }
        } catch (e) {
            console.log('Local teams.json not found, trying /api/teams');
        }

        // Production Vercel fallback
        try {
            const res = await fetch('/api/teams');
            if (res.ok) {
                const data = await res.json();
                availableTeams = data.teams || [];
            }
        } catch (e) {
            console.error('Failed to fetch teams', e);
        }
    }
    fetchTeams();

    // Autocomplete Logic
    teamNameInput.addEventListener('input', () => {
        const val = teamNameInput.value.toLowerCase();
        teamDropdown.innerHTML = '';
        successTick.classList.add('hidden'); // hide tick on edit
        
        if (!val) {
            teamDropdown.classList.add('hidden');
            return;
        }

        const filtered = availableTeams.filter(t => t.name.toLowerCase().startsWith(val));
        
        if (filtered.length > 0) {
            teamDropdown.classList.remove('hidden');
            filtered.slice(0, 10).forEach(team => {
                const li = document.createElement('li');
                li.textContent = team.name;
                li.addEventListener('click', () => {
                    teamNameInput.value = team.name;
                    teamDropdown.classList.add('hidden');
                    successTick.classList.remove('hidden'); // show green tick
                    
                    // Auto-render exactly the right number of member blocks
                    renderMemberBlocks(team.size);
                });
                teamDropdown.appendChild(li);
            });
        } else {
            teamDropdown.classList.add('hidden');
        }
    });

    // Hide dropdown if clicked outside
    document.addEventListener('click', (e) => {
        if (!teamNameInput.contains(e.target) && !teamDropdown.contains(e.target)) {
            teamDropdown.classList.add('hidden');
        }
    });

    let memberCount = 1;

    function renderMemberBlocks(size) {
        membersContainer.innerHTML = '';
        memberCount = size;
        for (let i = 1; i <= size; i++) {
            membersContainer.appendChild(createMemberCard(i));
        }
    }

    function createMemberCard(index) {
        const row = document.createElement('div');
        row.className = 'member-row';
        const roleLabel = index === 1 ? 'Team Leader' : `Team Member ${index}`;
        
        row.innerHTML = `
            <div class="member-info">
                <span class="member-label">${roleLabel}</span>
            </div>
            <div class="input-grid">
                <div class="input-group">
                    <label>Registered Email</label>
                    <input type="email" name="memberEmail[]" placeholder="name@example.com" required>
                </div>
                <div class="input-group">
                    <label>GitHub Username</label>
                    <input type="text" name="memberGithub[]" placeholder="e.g. torvalds" required>
                </div>
            </div>
        `;
        return row;
    }

    function showMessage(msg, isError) {
        messageBox.textContent = msg;
        messageBox.className = `message-box ${isError ? 'error' : 'success'}`;
        messageBox.classList.remove('hidden');
    }

    function hideMessage() {
        messageBox.classList.add('hidden');
    }

    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        if (isLoading) {
            btnText.classList.add('hidden');
            loader.classList.remove('hidden');
        } else {
            btnText.classList.remove('hidden');
            loader.classList.add('hidden');
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage();
        setLoading(true);

        const teamName = document.getElementById('teamName').value.trim();
        const emails = document.getElementsByName('memberEmail[]');
        const githubs = document.getElementsByName('memberGithub[]');

        const members = [];
        for (let i = 0; i < emails.length; i++) {
            members.push({
                email: emails[i].value.trim(),
                githubUsername: githubs[i].value.trim()
            });
        }

        try {
            // Send request to the Vercel serverless function
            const response = await fetch('/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ teamName, members })
            });

            const data = await response.json();

            if (!response.ok) {
                showMessage(data.error || 'An error occurred.', true);
            } else {
                showMessage(data.message, false);
                form.reset();
                
                // Reset members to just 1
                while(membersContainer.children.length > 1) {
                    membersContainer.lastElementChild.remove();
                }
                memberCount = 1;
            }
        } catch (error) {
            showMessage('Network error. Please try again later.', true);
        } finally {
            setLoading(false);
        }
    });
});
