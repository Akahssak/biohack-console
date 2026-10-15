/* ==========================================================================
   signin.js — committee sign-in with role verification
   ========================================================================== */

import {
  auth,
  db,
  config,
  isConfigured,
  warnIfUnconfigured,
  disableForm,
  busy,
  toast,
  authErrorMessage,
  COLLECTIONS,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  doc,
  getDoc
} from "./core.js";

const el = (id) => document.getElementById(id);
const CONSOLE_URL = "console.html";

if (config.portalUrl) {
  const link = el("portal-link");
  link.href = config.portalUrl;
  link.classList.remove("hidden");
}

async function handleSignIn(event) {
  event.preventDefault();

  const form = el("staff-form");
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const email = el("staff-email").value.trim().toLowerCase();
  const password = el("staff-password").value;
  const remember = el("staff-remember").checked;
  const done = busy(el("staff-submit"), "Verifying…");

  try {
    await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
    const credential = await signInWithEmailAndPassword(auth, email, password);

    // Authentication alone is not enough — the account must hold a committee record.
    const staffSnap = await getDoc(doc(db, COLLECTIONS.staff, credential.user.uid));

    if (!staffSnap.exists()) {
      await signOut(auth);
      toast("This account is not authorised for committee access.", "error");
      done();
      return;
    }

    toast("Verified. Opening console…", "success");
    window.location.href = CONSOLE_URL;
  } catch (error) {
    console.error("[BioHack] committee sign-in failed:", error);
    toast(authErrorMessage(error), "error");
    done();
  }
}

async function handleReset() {
  const email = el("staff-email").value.trim().toLowerCase();
  if (!email) {
    toast("Enter your committee email first.", "info");
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error("[BioHack] reset failed:", error);
  }
  toast(`Reset link sent to ${email} if that account exists.`, "success");
}

if (!isConfigured) {
  warnIfUnconfigured();
  disableForm(el("staff-form"), "Firebase is not configured yet — see README.md.");
} else {
  el("staff-form").addEventListener("submit", handleSignIn);
  el("staff-reset").addEventListener("click", handleReset);
}
