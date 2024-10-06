const clerkPublishableKey = 'pk_test_ZGVjZW50LWNvd2JpcmQtNDMuY2xlcmsuYWNjb3VudHMuZGV2JA';

let clerk;

async function initializeClerk() {
  clerk = Clerk(clerkPublishableKey);
  await clerk.load();
  
  if (clerk.user) {
    console.log('User is signed in:', clerk.user);
  } else {
    console.log('User is signed out');
  }
}

function signIn() {
  if (clerk) {
    clerk.openSignIn();
  } else {
    console.error('Clerk is not initialized');
  }
}

function signOut() {
  if (clerk) {
    clerk.signOut();
  } else {
    console.error('Clerk is not initialized');
  }
}

// Initialize Clerk when the popup opens
document.addEventListener('DOMContentLoaded', initializeClerk);