/* ==========================================================================
   console.js — committee console: registrations, idea briefs, messaging
   ========================================================================== */

import {
  auth,
  db,
  isConfigured,
  toast,
  escapeHtml,
  initial,
  formatTime,
  formatDate,
  formatDateTime,
  authErrorMessage,
  resolveProfile,
  watchRoom,
  sendMessage,
  deskRoomId,
  COLLECTIONS,
  ROOMS,
  onAuthStateChanged,
  signOut,
  collection,
  query,
  orderBy,
  onSnapshot
} from "./core.js";

const el = (id) => document.getElementById(id);

let profile = null;
let rooms = [];
let activeRoom = null;
let unsubRoom = null;
let teams = [];
let ideas = [];

/* ----------------------------------------------------------------- gate -- */

function showGate(which) {
  el("gate").classList.toggle("hidden", which !== "loading");
  el("gate-denied").classList.toggle("hidden", which !== "denied");
  el("console-root").classList.toggle("hidden", which !== "ready");
}

function deny(title, text) {
  el("denied-title").textContent = title;
  el("denied-text").textContent = text;
  showGate("denied");
}

if (!isConfigured) {
  deny("Setup needed", "Add your Firebase project keys to js/firebase-config.js. See README.md.");
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      deny("Sign-in required", "Sign in with an authorised committee account to continue.");
      return;
    }

    profile = await resolveProfile(user);

    if (profile.role !== "organiser") {
      await signOut(auth);
      deny("Access denied", "Your account is not on the authorised-members register.");
      return;
    }

    paintIdentity();
    wireEvents();
    buildRooms();
    showGate("ready");
    watchTeams();
    watchIdeas();
  });
}

function paintIdentity() {
  el("staff-identity").textContent = `${profile.displayName} · ${profile.email}`;
  el("me-avatar").textContent = initial(profile.displayName);
  el("me-name").textContent = profile.displayName;
}

/* ----------------------------------------------------------------- tabs -- */

function showPanel(name) {
  const messaging = name === "messages";
  el("panel-wrap").classList.toggle("hidden", messaging);
  el("panel-messages").classList.toggle("hidden", !messaging);
  el("panel-registrations").classList.toggle("hidden", name !== "registrations");
  el("panel-ideas").classList.toggle("hidden", name !== "ideas");

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panel === name);
  });

  if (messaging && !activeRoom) selectRoom(rooms[0].id);
}

/* ------------------------------------------------------------ live data -- */

function watchTeams() {
  const teamQuery = query(collection(db, COLLECTIONS.teams), orderBy("createdAt", "desc"));

  onSnapshot(
    teamQuery,
    (snapshot) => {
      teams = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      renderTeams();
      renderStats();
      buildRooms();
    },
    (error) => {
      console.error("[BioHack] teams subscription failed:", error);
      toast(authErrorMessage(error), "error");
    }
  );
}

function watchIdeas() {
  onSnapshot(
    collection(db, COLLECTIONS.ideas),
    (snapshot) => {
      ideas = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      ideas.sort((a, b) => String(b.updatedAt?.seconds || 0) - String(a.updatedAt?.seconds || 0));
      renderIdeas();
      renderStats();
    },
    (error) => console.error("[BioHack] ideas subscription failed:", error)
  );
}

function renderStats() {
  el("stat-teams").textContent = teams.length;
  el("stat-ideas").textContent = ideas.length;
  el("stat-people").textContent = teams.reduce((sum, team) => sum + (Number(team.teamSize) || 0), 0);
  el("stat-colleges").textContent = new Set(
    teams.map((team) => (team.college || "").trim().toLowerCase()).filter(Boolean)
  ).size;
}

function renderTeams() {
  const body = el("teams-body");
  el("teams-empty").classList.toggle("hidden", teams.length > 0);
  body.innerHTML = teams
    .map(
      (team) => `
      <tr>
        <td><b>${escapeHtml(team.teamName || "—")}</b><br>
            <span class="mono" style="font-size:11px">${escapeHtml(team.email || "")}</span></td>
        <td>${escapeHtml(team.college || "—")}</td>
        <td>${escapeHtml(team.leaderName || "—")}</td>
        <td class="mono">${escapeHtml(team.phone || "—")}</td>
        <td><span class="tag cyan">${escapeHtml(team.track || "—")}</span></td>
        <td class="mono">${escapeHtml(String(team.teamSize || "—"))}</td>
        <td>${escapeHtml(formatDate(team.createdAt))}</td>
      </tr>`
    )
    .join("");
}

function renderIdeas() {
  const list = el("ideas-list");
  el("ideas-empty").classList.toggle("hidden", ideas.length > 0);

  list.innerHTML = ideas
    .map(
      (idea) => `
      <article class="idea-card">
        <h4>${escapeHtml(idea.title || "Untitled brief")}</h4>
        <div class="idea-meta">
          <span class="tag green">${escapeHtml(idea.teamName || "—")}</span>
          <span class="tag cyan">${escapeHtml(idea.track || "—")}</span>
          <span class="tag amber">${escapeHtml(idea.status || "under review")}</span>
          <span class="tag">${escapeHtml(formatDateTime(idea.updatedAt || idea.createdAt))}</span>
        </div>
        <p><b style="color:#fff">Problem.</b> ${escapeHtml(idea.problem || "—")}</p>
        <p style="margin-top:10px"><b style="color:#fff">Approach.</b> ${escapeHtml(idea.approach || "—")}</p>
        <p style="margin-top:10px"><b style="color:#fff">Data &amp; tooling.</b> ${escapeHtml(idea.dataTooling || "—")}</p>
        <p style="margin-top:10px"><b style="color:#fff">Outcome &amp; impact.</b> ${escapeHtml(idea.impact || "—")}</p>
        ${
          idea.repoUrl
            ? `<p style="margin-top:12px"><a href="${escapeHtml(idea.repoUrl)}" target="_blank" rel="noopener noreferrer">
                 <i class="fa-solid fa-code-branch"></i> ${escapeHtml(idea.repoUrl)}</a></p>`
            : ""
        }
        <div style="margin-top:16px">
          <button class="btn btn-ghost btn-sm" data-desk="${escapeHtml(idea.uid || "")}">
            <i class="fa-solid fa-comments"></i>Open team desk
          </button>
        </div>
      </article>`
    )
    .join("");

  list.querySelectorAll("[data-desk]").forEach((button) => {
    button.addEventListener("click", () => {
      showPanel("messages");
      selectRoom(deskRoomId(button.dataset.desk));
    });
  });
}

/* ---------------------------------------------------------------- rooms -- */

function buildRooms() {
  rooms = [
    {
      id: ROOMS.announcements,
      name: "Announcements",
      desc: "Broadcast to every registered team",
      icon: "fa-bullhorn",
      tone: "amber",
      note: "Broadcast channel. Every registered team sees these messages."
    },
    {
      id: ROOMS.lounge,
      name: "Participant Lounge",
      desc: "Open floor for all teams",
      icon: "fa-users",
      tone: "cyan",
      note: "Shared with all registered teams."
    },
    ...teams.map((team) => ({
      id: deskRoomId(team.uid || team.id),
      name: team.teamName || team.email || "Team",
      desc: team.college || team.email || "",
      icon: "fa-dna",
      tone: "",
      note: `Private thread with ${team.teamName || "this team"}.`
    }))
  ];

  const list = el("room-list");
  if (!list) return;

  list.innerHTML = "";
  rooms.forEach((room) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `room${activeRoom && activeRoom.id === room.id ? " active" : ""}`;
    button.dataset.room = room.id;
    button.innerHTML = `
      <span class="room-icon ${room.tone}"><i class="fa-solid ${room.icon}"></i></span>
      <span class="room-body">
        <span class="room-name">${escapeHtml(room.name)}</span>
        <span class="room-desc">${escapeHtml(room.desc)}</span>
      </span>`;
    button.addEventListener("click", () => selectRoom(room.id));
    list.appendChild(button);
  });
}

function selectRoom(roomId) {
  const room = rooms.find((entry) => entry.id === roomId);
  if (!room) return;

  activeRoom = room;

  document.querySelectorAll(".room").forEach((node) => {
    node.classList.toggle("active", node.dataset.room === roomId);
  });

  el("room-title").textContent = room.name;
  el("room-desc").textContent = room.desc;
  el("room-avatar").className = `room-icon ${room.tone}`;
  el("room-avatar").innerHTML = `<i class="fa-solid ${room.icon}"></i>`;
  el("panel-messages").classList.add("room-open");

  renderThread([], "loading");

  if (unsubRoom) unsubRoom();
  unsubRoom = watchRoom(
    room.id,
    (messages) => renderThread(messages, "ready"),
    () => renderThread([], "error")
  );
}

/* --------------------------------------------------------------- thread -- */

function renderThread(messages, state) {
  const thread = el("thread");
  thread.innerHTML = `<div class="thread-note"><i class="fa-solid fa-lock"></i>${escapeHtml(
    activeRoom.note
  )}</div>`;

  if (state === "loading") {
    thread.insertAdjacentHTML(
      "beforeend",
      '<div class="thread-empty"><div class="spinner"></div><span>Loading…</span></div>'
    );
    return;
  }

  if (state === "error") {
    thread.insertAdjacentHTML(
      "beforeend",
      '<div class="thread-empty"><i class="fa-solid fa-triangle-exclamation"></i><span>Could not load this conversation.</span></div>'
    );
    return;
  }

  if (!messages.length) {
    thread.insertAdjacentHTML(
      "beforeend",
      '<div class="thread-empty"><i class="fa-regular fa-comments"></i><span>No messages yet.</span></div>'
    );
    return;
  }

  let lastDay = "";
  messages.forEach((message) => {
    const day = formatDate(message.createdAt);
    if (day !== lastDay && day !== "—") {
      lastDay = day;
      thread.insertAdjacentHTML("beforeend", `<div class="thread-note">${escapeHtml(day)}</div>`);
    }

    const mine = message.senderUid === profile.uid;
    const staff = message.senderRole === "organiser";
    const author = staff
      ? `${message.senderName || "Committee"} · Organising committee`
      : message.senderName || message.senderEmail || "Participant";

    thread.insertAdjacentHTML(
      "beforeend",
      `<div class="bubble-row ${mine ? "out" : "in"}">
         <div class="bubble">
           ${mine ? "" : `<div class="bubble-author ${staff ? "staff" : ""}">${escapeHtml(author)}</div>`}
           <p class="bubble-text">${escapeHtml(message.text)}</p>
           <div class="bubble-meta">
             <span>${escapeHtml(formatTime(message.createdAt) || "sending…")}</span>
             ${mine ? '<i class="fa-solid fa-check-double"></i>' : ""}
           </div>
         </div>
       </div>`
    );
  });

  thread.scrollTop = thread.scrollHeight;
}

/* --------------------------------------------------------------- wiring -- */

function wireEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.panel));
  });

  el("back-to-panels").addEventListener("click", () => showPanel("registrations"));
  el("back-to-rooms").addEventListener("click", () =>
    el("panel-messages").classList.remove("room-open")
  );

  const input = el("composer-input");

  el("composer").addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    input.style.height = "auto";

    try {
      await sendMessage({ room: activeRoom.id, text, profile });
    } catch (error) {
      console.error("[BioHack] send failed:", error);
      toast(authErrorMessage(error), "error");
      input.value = text;
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      el("composer").requestSubmit();
    }
  });

  el("sign-out").addEventListener("click", async () => {
    if (unsubRoom) unsubRoom();
    await signOut(auth);
    window.location.href = "index.html";
  });
}
