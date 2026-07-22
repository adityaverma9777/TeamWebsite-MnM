import { auth, db } from './firebase.js';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ fedcm_hint: 'none' });

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Check if user exists in Firestore
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // User is new. Trigger onboarding modal to get Location & Phone
      showOnboardingModal(user);
    } else {
      // User already exists. Close any modals and update UI.
      updateUIForLoggedInUser(user);
    }
  } catch (error) {
    console.error("Error signing in with Google: ", error);
  }
}

export async function logout() {
  try {
    await signOut(auth);
    window.location.reload();
  } catch (error) {
    console.error("Error signing out: ", error);
  }
}

// Function to save the extra details from the modal
export async function saveUserProfile(user, phone, location) {
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      name: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      phone: phone,
      location: location,
      points: 0,
      createdAt: new Date()
    });
    
    hideOnboardingModal();
    updateUIForLoggedInUser(user);
  } catch (error) {
    console.error("Error saving user profile: ", error);
  }
}

// Modal Logic
let currentUserToSave = null;

function showOnboardingModal(user) {
  currentUserToSave = user;
  const modal = document.getElementById('onboarding-modal-overlay');
  if (modal) {
    modal.classList.add('active');
  }
}

function hideOnboardingModal() {
  currentUserToSave = null;
  const modal = document.getElementById('onboarding-modal-overlay');
  if (modal) {
    modal.classList.remove('active');
  }
}

export function initAuth() {
  // Setup login buttons
  const loginBtns = document.querySelectorAll('a[href="#login"]');
  loginBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      loginWithGoogle();
    });
  });

  // Setup form submission in modal
  const form = document.getElementById('onboarding-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!currentUserToSave) return;
      const phone = document.getElementById('ob-phone').value;
      const location = document.getElementById('ob-location').value;
      saveUserProfile(currentUserToSave, phone, location);
    });
  }

  // Listen for auth state changes to update the UI on page load
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // They are logged in with Google.
      // Make sure they have a Firestore profile. If they somehow skipped it, don't show UI until they do.
      getDoc(doc(db, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          updateUIForLoggedInUser(user);
        } else {
          showOnboardingModal(user);
        }
      });
    }
  });
}

function updateUIForLoggedInUser(user) {
  // If user came via an invite link, automatically redirect them to the dashboard to join the team
  if (sessionStorage.getItem('pendingInvite')) {
    window.location.href = '/dashboard.html';
    return;
  }

  const loginBtns = document.querySelectorAll('a[href="#login"]');
  loginBtns.forEach(btn => {
    // Change login button to profile/dashboard button
    btn.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="${user.photoURL}" alt="Profile" style="width:24px;height:24px;border-radius:50%;">
        <span>${user.displayName.split(' ')[0]}</span>
      </div>
    `;
    btn.href = "/dashboard.html";
    btn.classList.add('logged-in-btn');
    
    // Swap click listener to redirect to dashboard (remove old listeners)
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    // Since it's an a tag with an href, it will naturally redirect now.
  });
}
