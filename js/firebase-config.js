/* ==========================================================================
   Firebase connection settings — Organising Committee Console
   --------------------------------------------------------------------------
   Paste the SAME config object used by the participant portal, so both
   deployments read and write one shared live database.

   Firebase web keys are public identifiers, not secrets. Protection comes
   from Firebase Authentication plus the rules in `firestore.rules`.
   ========================================================================== */

window.APP_CONFIG = {
  firebase: {
    apiKey: "AIzaSyDfnHUSr_o7ToX0CMnOrJobWcxX03XFRSk",
    authDomain: "bio-hack-1afd4.firebaseapp.com",
    projectId: "bio-hack-1afd4",
    storageBucket: "bio-hack-1afd4.firebasestorage.app",
    messagingSenderId: "961557486892",
    appId: "1:961557486892:web:30428d3c5e69e3d8a06089"
  },

  /* Public URL of the participant portal deployment. Shown as a footer link. */
  portalUrl: "https://akahssak.github.io/biohack-portal/"
};
