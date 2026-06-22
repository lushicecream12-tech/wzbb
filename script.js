const elasticButtons = document.querySelectorAll(".elastic-button");
const appScreen = document.querySelector(".app-screen");
const moreMorph = document.querySelector(".more-morph");
const composeMorph = document.querySelector(".compose-morph");
const profileMorph = document.querySelector(".profile-morph");
const panelBackdrop = document.querySelector(".panel-backdrop");
const usersButton = document.querySelector("[data-users-open]");
const usersList = document.querySelector(".users-list");
const postForm = document.querySelector(".post-form");
const postsFeed = document.querySelector(".posts-feed");
const notificationsFeed = document.querySelector(".notifications-feed");
const mainTitle = document.querySelector(".home-content h1");
const composeMessage = document.querySelector(".compose-message");
const authTabs = document.querySelectorAll("[data-auth-mode]");
const authForms = document.querySelectorAll("[data-auth-form]");
const authTabsWrap = document.querySelector(".auth-tabs");
const authFormWindow = document.querySelector(".auth-form-window");
const authTitle = document.querySelector(".auth-title");
const authMessage = document.querySelector(".auth-message");
const loggedPanel = document.querySelector(".logged-panel");
const loggedName = document.querySelector(".logged-name");
const logoutButton = document.querySelector(".logout-button");
const bottomDock = document.querySelector(".bottom-dock");
const dockTabs = document.querySelectorAll("[data-dock-tab]");

const localUsersKey = "wakacje-z-bogiem-users";
const currentUserKey = "wakacje-z-bogiem-current-user";
const localPostsKey = "wakacje-z-bogiem-posts";
const notificationsReadKey = "wakacje-z-bogiem-notifications-read";
const firebaseConfig = window.WZB_FIREBASE_CONFIG;
const firebaseBaseUrl = firebaseConfig?.databaseURL?.replace(/\/$/, "");
let useLocalDatabase = !firebaseBaseUrl;
let profileCloseTimer = null;
let activeDockIndex = 0;
let suppressDockClick = false;
let openPostPanel = null;
let lastLikedKey = "";
let contrastFrame = 0;
let pendingDeletePostId = null;
let cachedNotifications = [];
let lastAppScrollTop = 0;
let dockExpandTimer = 0;
const clickSound = new Audio("./przycisk.mp3");
clickSound.preload = "auto";
clickSound.volume = 0.42;
const heartSound = new Audio("./serduszko.mp3");
heartSound.preload = "auto";
heartSound.volume = 0.5;

document.documentElement.dataset.appReady = "true";

const playButtonSound = () => {
  try {
    const sound = clickSound.cloneNode();
    sound.volume = clickSound.volume;
    const playPromise = sound.play();

    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  } catch {
    // Brak pliku dzwieku nie powinien blokowac klikniec.
  }
};

const playHeartSound = () => {
  try {
    const sound = heartSound.cloneNode();
    sound.volume = heartSound.volume;
    const playPromise = sound.play();

    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }
  } catch {
    // Brak pliku dzwieku serduszka nie powinien blokowac reakcji.
  }
};

document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest("button");

    if (button) {
      if (button.closest(".heart-button")) {
        return;
      }

      if (!button.disabled) {
        playButtonSound();
      }
      return;
    }

    const roleButton = event.target.closest("[role='button']");
    const insideForm = event.target.closest("input, label, form, .auth-panel, .users-list");

    if (!roleButton || insideForm) {
      return;
    }

    playButtonSound();
  },
  true
);

const isInteractive = (target) =>
  Boolean(target.closest("button, input, label, form, .auth-panel, .compose-panel, .panel-option, .users-list, .post-card"));

const isCloseIcon = (target) => Boolean(target.closest(".close-icon, .profile-close-icon, .compose-close-icon"));

const getDockStep = () => {
  const firstTab = dockTabs[0];
  const secondTab = dockTabs[1];

  if (!firstTab || !secondTab) {
    return 0;
  }

  return secondTab.getBoundingClientRect().left - firstTab.getBoundingClientRect().left;
};

const setDockCollapsed = (isCollapsed) => {
  window.clearTimeout(dockExpandTimer);
  bottomDock.classList.toggle("is-collapsed", isCollapsed);
};

const expandDock = () => {
  setDockCollapsed(false);
  bottomDock.classList.add("is-expanding");
  window.clearTimeout(dockExpandTimer);
  dockExpandTimer = window.setTimeout(() => {
    bottomDock.classList.remove("is-expanding");
  }, 520);
};

const moveDockIndicator = (index) => {
  const clampedIndex = Math.max(0, Math.min(dockTabs.length - 1, index));
  const step = getDockStep();
  const previousIndex = activeDockIndex;
  const direction = Math.sign(clampedIndex - previousIndex);

  activeDockIndex = clampedIndex;
  appScreen.dataset.viewDirection = direction < 0 ? "back" : "forward";
  appScreen.classList.remove("view-switching");
  appScreen.getBoundingClientRect();
  appScreen.classList.add("view-switching");
  appScreen.dataset.view = clampedIndex === 3 ? "notifications" : "home";
  mainTitle.textContent = clampedIndex === 3 ? "Powiadomienia" : "Wakacje z Bogiem";
  expandDock();

  if (clampedIndex === 3) {
    renderNotifications({ markRead: true });
  }

  bottomDock.style.setProperty("--dock-x", `${step * clampedIndex}px`);
  bottomDock.style.setProperty("--dock-drag-x", "0px");
  bottomDock.style.setProperty("--dock-wobble", "0px");
  bottomDock.style.setProperty("--dock-skew", "0deg");
  bottomDock.style.setProperty("--dock-scale-x", "1");
  bottomDock.style.setProperty("--dock-origin-x", "center");
  dockTabs.forEach((tab, tabIndex) => {
    const isActive = tabIndex === clampedIndex;
    tab.classList.toggle("is-active", isActive);
    tab.toggleAttribute("aria-current", isActive);
  });

  window.setTimeout(() => {
    appScreen.classList.remove("view-switching");
  }, 560);
};

const dockIndexFromPoint = (clientX) => {
  const rect = bottomDock.getBoundingClientRect();
  const step = rect.width / dockTabs.length;
  return Math.max(0, Math.min(dockTabs.length - 1, Math.floor((clientX - rect.left) / step)));
};

const setMenuOpen = (isOpen) => {
  appScreen.classList.toggle("menu-open", isOpen);
  moreMorph.setAttribute("aria-expanded", String(isOpen));

  if (!isOpen) {
    usersList.classList.remove("is-visible");
  }
};

const setProfileOpen = (isOpen) => {
  window.clearTimeout(profileCloseTimer);

  if (isOpen) {
    appScreen.classList.remove("profile-closing");
    appScreen.classList.add("profile-open");
    profileMorph.setAttribute("aria-expanded", "true");
    return;
  }

  if (!appScreen.classList.contains("profile-open")) {
    appScreen.classList.remove("profile-closing");
    profileMorph.setAttribute("aria-expanded", "false");
    return;
  }

  appScreen.classList.add("profile-closing");
  profileMorph.setAttribute("aria-expanded", "false");
  profileMorph.getBoundingClientRect();

  window.requestAnimationFrame(() => {
    appScreen.classList.remove("profile-open");
  });

  profileCloseTimer = window.setTimeout(() => {
    appScreen.classList.remove("profile-closing");
  }, 1240);
};

const setComposeOpen = (isOpen) => {
  appScreen.classList.toggle("compose-open", isOpen);
  composeMorph.setAttribute("aria-expanded", String(isOpen));

  if (!isOpen) {
    composeMessage.textContent = "";
  }
};

const updateAuthorUi = () => {
  const user = readCurrentUser();
  const isAuthor = isAuthorUser(user);
  appScreen.classList.toggle("is-author", isAuthor);
  composeMorph.hidden = !isAuthor;

  if (!isAuthor) {
    setComposeOpen(false);
  }
};

const closePanels = () => {
  setMenuOpen(false);
  setProfileOpen(false);
  setComposeOpen(false);
};

const readLocalUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(localUsersKey) || "[]");
  } catch {
    return [];
  }
};

const writeLocalUsers = (users) => {
  localStorage.setItem(localUsersKey, JSON.stringify(users));
};

const readCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem(currentUserKey) || "null");
  } catch {
    return null;
  }
};

const writeCurrentUser = (user) => {
  localStorage.setItem(currentUserKey, JSON.stringify(user));
};

const clearCurrentUser = () => {
  localStorage.removeItem(currentUserKey);
};

const readLocalPosts = () => {
  try {
    return JSON.parse(localStorage.getItem(localPostsKey) || "[]");
  } catch {
    return [];
  }
};

const readNotificationsReadMap = () => {
  try {
    return JSON.parse(localStorage.getItem(notificationsReadKey) || "{}");
  } catch {
    return {};
  }
};

const readNotificationsAt = (userId) => readNotificationsReadMap()[userId] || "";

const writeNotificationsAt = (userId, value = new Date().toISOString()) => {
  if (!userId) {
    return;
  }

  const readMap = readNotificationsReadMap();
  readMap[userId] = value;
  localStorage.setItem(notificationsReadKey, JSON.stringify(readMap));
};

const writeLocalPosts = (posts) => {
  localStorage.setItem(localPostsKey, JSON.stringify(posts));
};

const fetchFirebaseUsers = async () => {
  if (useLocalDatabase || !firebaseBaseUrl) {
    return null;
  }

  const response = await fetch(`${firebaseBaseUrl}/wakacjeZBogiem/users.json`);
  if (!response.ok) {
    throw new Error("Nie udalo sie pobrac uzytkownikow.");
  }

  const data = await response.json();
  return data ? Object.values(data) : [];
};

const saveFirebaseUser = async (user) => {
  if (useLocalDatabase || !firebaseBaseUrl) {
    return false;
  }

  const response = await fetch(`${firebaseBaseUrl}/wakacjeZBogiem/users/${user.id}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(user),
  });

  if (!response.ok) {
    throw new Error("Nie udalo sie zapisac uzytkownika.");
  }

  return true;
};

const fetchFirebasePosts = async () => {
  if (useLocalDatabase || !firebaseBaseUrl) {
    return null;
  }

  const response = await fetch(`${firebaseBaseUrl}/wakacjeZBogiem/posts.json`);
  if (!response.ok) {
    throw new Error("Nie udalo sie pobrac postow.");
  }

  const data = await response.json();
  return data ? Object.values(data) : [];
};

const saveFirebasePost = async (post) => {
  if (useLocalDatabase || !firebaseBaseUrl) {
    return false;
  }

  const response = await fetch(`${firebaseBaseUrl}/wakacjeZBogiem/posts/${post.id}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(post),
  });

  if (!response.ok) {
    throw new Error("Nie udalo sie zapisac postu.");
  }

  return true;
};

const deleteFirebasePost = async (postId) => {
  if (useLocalDatabase || !firebaseBaseUrl) {
    return false;
  }

  const response = await fetch(`${firebaseBaseUrl}/wakacjeZBogiem/posts/${postId}.json`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Nie udalo sie usunac postu.");
  }

  return true;
};

const getUsers = async () => {
  try {
    const firebaseUsers = await fetchFirebaseUsers();
    if (firebaseUsers) {
      return firebaseUsers;
    }
  } catch {
    authMessage.textContent = "Baza online jest chwilowo niedostepna. Uzywam danych lokalnych.";
  }

  return readLocalUsers();
};

const getCurrentUserProfile = async () => {
  const currentUser = readCurrentUser();

  if (!currentUser) {
    return null;
  }

  if (currentUser.createdAt) {
    return currentUser;
  }

  const users = await getUsers().catch(() => []);
  const fullUser = users.find((user) => user.id === currentUser.id);

  if (fullUser) {
    const mergedUser = {
      ...currentUser,
      firstName: fullUser.firstName || currentUser.firstName,
      lastName: fullUser.lastName || currentUser.lastName,
      isAuthor: Boolean(fullUser.isAuthor || currentUser.isAuthor),
      createdAt: fullUser.createdAt || currentUser.createdAt || new Date().toISOString(),
    };
    writeCurrentUser(mergedUser);
    return mergedUser;
  }

  const fallbackUser = { ...currentUser, createdAt: currentUser.createdAt || new Date().toISOString() };
  writeCurrentUser(fallbackUser);
  return fallbackUser;
};

const saveUser = async (user) => {
  if (await saveFirebaseUser(user).catch(() => false)) {
    return;
  }

  const users = readLocalUsers().filter((item) => item.id !== user.id);
  users.push(user);
  writeLocalUsers(users);
};

const getPosts = async () => {
  try {
    const firebasePosts = await fetchFirebasePosts();
    if (firebasePosts) {
      return firebasePosts;
    }
  } catch {
    // Jesli chmura chwilowo nie odpowiada, pokaz lokalne wpisy, ale probuj ponownie przy nastepnej operacji.
  }

  return readLocalPosts();
};

const savePost = async (post) => {
  if (await saveFirebasePost(post).catch(() => false)) {
    return;
  }

  const posts = readLocalPosts().filter((item) => item.id !== post.id);
  posts.push(post);
  writeLocalPosts(posts);
};

const deletePost = async (postId) => {
  const deletedOnline = await deleteFirebasePost(postId).catch(() => false);
  const posts = readLocalPosts().filter((item) => item.id !== postId);
  writeLocalPosts(posts);

  if (!deletedOnline && !posts.some((item) => item.id === postId)) {
    return false;
  }

  return deletedOnline;
};

const syncLocalPostsToFirebase = async () => {
  if (useLocalDatabase || !firebaseBaseUrl) {
    return;
  }

  const localPosts = readLocalPosts();
  if (!localPosts.length) {
    return;
  }

  const results = await Promise.all(localPosts.map((post) => saveFirebasePost(post).catch(() => false)));
  if (results.every(Boolean)) {
    writeLocalPosts([]);
  }
};

const normalize = (value) => value.trim().toLocaleLowerCase("pl-PL");

const userIdFor = (firstName, lastName = "") =>
  `${normalize(firstName)}-${normalize(lastName)}`.replace(/\s+/g, "-").replace(/^-|-$/g, "");

const isAuthorCredentials = (firstName, lastName, password) =>
  normalize(firstName) === "kacper" && normalize(lastName) === "czarnojan" && password === "qqwe1928ASq";

const isAuthorUser = (user) => Boolean(user?.isAuthor);

const hashPassword = async (password) => {
  const encoded = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const sortUsers = (users) =>
  [...users].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "pl"));

const renderUsers = async () => {
  const users = sortUsers(await getUsers());
  usersList.innerHTML = "";

  if (!users.length) {
    const empty = document.createElement("li");
    empty.textContent = "Brak użytkowników";
    usersList.append(empty);
    return;
  }

  users.forEach((user) => {
    const item = document.createElement("li");
    item.textContent = `${user.firstName} ${user.lastName}`.trim();
    usersList.append(item);
  });
};

const sortPosts = (posts) =>
  [...posts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

const currentUserDisplay = () => {
  const user = readCurrentUser();
  return user ? `${user.firstName} ${user.lastName || ""}`.trim() : "";
};

const postDateLabel = (value) =>
  new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const relativeTimeLabel = (value) => {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) {
    return `${minutes} min temu`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} godz. temu`;
  }

  const days = Math.floor(hours / 24);
  return `${days} dni temu`;
};

const likeDisplayName = (value) => {
  if (typeof value === "string") {
    return value;
  }

  return value?.name || "Użytkownik";
};

const createHeartButton = ({ isLiked, count, label, postId, commentId = "" }) => {
  const button = document.createElement("button");
  const likeKey = commentId ? `${postId}:${commentId}` : postId;
  button.className = `heart-button${isLiked ? " is-liked" : ""}${lastLikedKey === likeKey ? " is-popping" : ""}`;
  button.type = "button";
  button.dataset.postId = postId;
  button.dataset.commentId = commentId;
  button.dataset.likeTarget = commentId ? "comment" : "post";
  button.setAttribute("aria-label", label);

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M20.4 5.7c-1.8-1.9-4.6-1.8-6.4.1L12 7.9l-2-2.1c-1.8-1.9-4.6-2-6.4-.1-1.9 2-1.9 5.1.1 7.1L12 21l8.3-8.2c2-2 2-5.1.1-7.1Z");
  icon.append(path);

  const text = document.createElement("span");
  text.textContent = String(count);
  button.append(icon, text);
  return button;
};

const createCommentButton = ({ count, postId, isOpen }) => {
  const button = document.createElement("button");
  button.className = `comment-toggle${isOpen ? " is-open" : ""}`;
  button.type = "button";
  button.dataset.postId = postId;
  button.dataset.commentToggle = "true";
  button.setAttribute("aria-label", "Komentarze");

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  const bubble = document.createElementNS("http://www.w3.org/2000/svg", "path");
  bubble.setAttribute("d", "M5.2 5.6h13.6v9.1H9.3L5.2 18.4Z");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", "M8.3 9.2h7.4M8.3 12h5.2");
  icon.append(bubble, line);

  const text = document.createElement("span");
  text.textContent = String(count);
  button.append(icon, text);
  return button;
};

const likeNamesFor = (likes = {}) =>
  Object.values(likes)
    .map(likeDisplayName)
    .sort((a, b) => a.localeCompare(b, "pl"));

const userCanDeletePost = (user, post) =>
  isAuthorUser(user) && normalize(`${post.authorName || ""}`) === "kacper czarnojan";

const renderPosts = async () => {
  const posts = sortPosts(await getPosts());
  const user = readCurrentUser();
  postsFeed.innerHTML = "";

  if (!posts.length) {
    const empty = document.createElement("p");
    empty.className = "posts-empty";
    empty.textContent = "Tu pojawią się pierwsze wpisy z wakacji.";
    postsFeed.append(empty);
    return;
  }

  posts.forEach((post) => {
    const card = document.createElement("article");
    card.className = "post-card";
    card.dataset.postId = post.id;

    const header = document.createElement("header");
    header.className = "post-header";

    const avatar = document.createElement("span");
    avatar.className = "post-avatar";
    avatar.textContent = "KC";

    const meta = document.createElement("span");
    meta.className = "post-meta";
    const author = document.createElement("strong");
    author.textContent = post.authorName || "Kacper Czarnojan";
    if (normalize(author.textContent) === "kacper czarnojan") {
      const badge = document.createElement("em");
      badge.className = "author-badge";
      badge.textContent = "AUTOR BLOGA";
      author.append(badge);
    }
    const time = document.createElement("span");
    time.textContent = postDateLabel(post.createdAt);
    meta.append(author, time);
    header.append(avatar, meta);

    if (userCanDeletePost(user, post)) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "post-delete-button";
      deleteButton.type = "button";
      deleteButton.dataset.deletePostOpen = post.id;
      deleteButton.setAttribute("aria-label", "Usuń post");
      deleteButton.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14" />
          <path d="M9 7V5.4h6V7" />
          <path d="M8 10v8" />
          <path d="M12 10v8" />
          <path d="M16 10v8" />
          <path d="M7 7l.8 13h8.4L17 7" />
        </svg>
      `;
      header.append(deleteButton);
    }

    const title = document.createElement("h2");
    title.textContent = post.title;

    const hashtags = document.createElement("p");
    hashtags.className = "post-hashtags";
    hashtags.textContent = (post.hashtags || []).join(" ");

    const gallery = document.createElement("div");
    gallery.className = `post-gallery image-count-${Math.min(post.images?.length || 0, 4)}`;
    (post.images || []).slice(0, 4).forEach((src) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      gallery.append(img);
    });

    const actions = document.createElement("div");
    actions.className = "post-actions";
    const openType = openPostPanel?.postId === post.id ? openPostPanel.type : "";
    const isCommentsOpen = openType === "comments";
    const isLikesOpen = openType === "likes";
    actions.append(
      createHeartButton({
        isLiked: Boolean(user && post.likes?.[user.id]),
        count: Object.keys(post.likes || {}).length,
        label: "Polub post",
        postId: post.id,
      }),
      createCommentButton({
        count: (post.comments || []).length,
        postId: post.id,
        isOpen: isCommentsOpen,
      })
    );

    const socialModal = document.createElement("div");
    socialModal.className = `post-social-modal ${openType ? `is-${openType}` : ""}`;
    if (openType) {
      socialModal.dataset.pendingOpen = "true";
    }
    const modalTitle = document.createElement("span");
    modalTitle.className = "post-social-title";
    modalTitle.textContent = isLikesOpen ? "Polubili post" : "Komentarze";
    const modalClose = document.createElement("button");
    modalClose.className = "post-social-close";
    modalClose.type = "button";
    modalClose.dataset.closePostPanel = "true";
    modalClose.setAttribute("aria-label", "Zamknij");
    socialModal.append(modalTitle, modalClose);

    const likesList = document.createElement("div");
    likesList.className = "likes-list";
    const likeNames = likeNamesFor(post.likes);
    if (!likeNames.length) {
      const empty = document.createElement("span");
      empty.className = "social-empty";
      empty.textContent = "Jeszcze nikt nie polubił tego posta.";
      likesList.append(empty);
    } else {
      likeNames.forEach((nameText) => {
        const item = document.createElement("span");
        item.className = "like-person";
        item.textContent = nameText;
        likesList.append(item);
      });
    }

    const comments = document.createElement("div");
    comments.className = "comments-list";
    (post.comments || []).forEach((comment) => {
      const row = document.createElement("div");
      row.className = "comment-row";
      const body = document.createElement("span");
      body.className = "comment-body";
      const name = document.createElement("strong");
      name.textContent = comment.userName;
      const text = document.createElement("span");
      text.textContent = comment.text;
      body.append(name, text);
      row.append(
        body,
        createHeartButton({
          isLiked: Boolean(user && comment.likes?.[user.id]),
          count: Object.keys(comment.likes || {}).length,
          label: "Polub komentarz",
          postId: post.id,
          commentId: comment.id,
        })
      );
      comments.append(row);
    });

    const commentForm = document.createElement("form");
    commentForm.className = "comment-form";
    commentForm.dataset.postId = post.id;
    const input = document.createElement("input");
    input.name = "comment";
    input.placeholder = user ? "Napisz komentarz..." : "Zaloguj się, aby komentować";
    input.disabled = !user;
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Wyślij";
    button.disabled = !user;
    commentForm.append(input, button);
    socialModal.append(isLikesOpen ? likesList : comments, ...(isCommentsOpen ? [commentForm] : []));

    const deleteConfirm = document.createElement("div");
    deleteConfirm.className = `delete-confirm${pendingDeletePostId === post.id ? " is-open" : ""}`;
    deleteConfirm.innerHTML = `
      <button class="delete-close" type="button" data-delete-cancel aria-label="Zamknij"></button>
      <span class="delete-title">Czy chcesz trwale usunąć ten post, Kacpi?</span>
      <span class="delete-slider" data-delete-slider data-post-id="${post.id}">
        <span class="delete-slider-fill"></span>
        <span class="delete-slider-label">Przesuń, aby usunąć</span>
        <span class="delete-slider-thumb">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 7h14" />
            <path d="M9 7V5.4h6V7" />
            <path d="M8 10v8" />
            <path d="M12 10v8" />
            <path d="M16 10v8" />
            <path d="M7 7l.8 13h8.4L17 7" />
          </svg>
        </span>
      </span>
    `;

    card.append(header, title);
    if (hashtags.textContent) {
      card.append(hashtags);
    }
    if (gallery.children.length) {
      card.append(gallery);
    }
    card.append(actions, socialModal, deleteConfirm);
    postsFeed.append(card);
  });

  window.requestAnimationFrame(() => {
    document.querySelectorAll(".post-social-modal[data-pending-open]").forEach((modal) => {
      modal.classList.add("is-open");
      modal.removeAttribute("data-pending-open");
    });
  });
  window.setTimeout(scheduleDockContrast, 0);
};

const buildNotifications = async (user) => {
  if (!user) {
    return [];
  }

  const accountCreatedAt = new Date(user.createdAt || 0).getTime();
  const posts = sortPosts(await getPosts());
  const items = [];

  posts.forEach((post) => {
    const postCreatedAt = new Date(post.createdAt).getTime();
    if (postCreatedAt >= accountCreatedAt) {
      items.push({
        createdAt: post.createdAt,
        type: "post",
        actor: post.authorName || "Kacper Czarnojan",
        title: "Nowy wpis na blogu",
        detail: `${post.authorName || "Kacper Czarnojan"} wstawił(a) post pod tytułem „${post.title}”.`,
      });
    }

    (post.comments || []).forEach((comment) => {
      if (comment.userId !== user.id) {
        return;
      }

      Object.entries(comment.likes || {}).forEach(([likerId, likerValue]) => {
        if (likerId === user.id) {
          return;
        }

        const likedAt = typeof likerValue === "object" && likerValue?.createdAt ? likerValue.createdAt : comment.createdAt || post.createdAt;
        if (new Date(likedAt).getTime() < accountCreatedAt) {
          return;
        }

        items.push({
          createdAt: likedAt,
          type: "like",
          actor: likeDisplayName(likerValue),
          title: "Ktoś polubił Twój komentarz",
          detail: `${likeDisplayName(likerValue)} polubił(a) twój komentarz.`,
        });
      });
    });
  });

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

const updateNotificationsBadge = async () => {
  const user = await getCurrentUserProfile();
  const notificationsTab = document.querySelector(".notifications-tab");

  if (!notificationsTab || !user) {
    notificationsTab?.classList.remove("has-unread");
    return;
  }

  const lastReadAt = new Date(readNotificationsAt(user.id) || 0).getTime();
  const items = cachedNotifications.length ? cachedNotifications : await buildNotifications(user);
  const hasUnread = items.some((item) => new Date(item.createdAt).getTime() > lastReadAt);
  notificationsTab.classList.toggle("has-unread", hasUnread && activeDockIndex !== 3);
};

const renderNotifications = async ({ markRead = false } = {}) => {
  const user = await getCurrentUserProfile();
  notificationsFeed.innerHTML = "";

  if (!user) {
    cachedNotifications = [];
    const loginNotice = document.createElement("p");
    loginNotice.className = "notifications-empty";
    loginNotice.textContent = "Zaloguj się, aby móc otrzymywać powiadomienia.";
    notificationsFeed.append(loginNotice);
    await updateNotificationsBadge();
    return;
  }

  const items = await buildNotifications(user);
  cachedNotifications = items;

  if (markRead) {
    writeNotificationsAt(user.id);
  }

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "notifications-empty";
    empty.textContent = "Nie masz jeszcze nowych powiadomień.";
    notificationsFeed.append(empty);
    await updateNotificationsBadge();
    return;
  }

  const lastReadAt = new Date(readNotificationsAt(user.id) || 0).getTime();

  items.forEach((item) => {
    const row = document.createElement("article");
    row.className = `notification-card notification-${item.type}`;
    row.classList.toggle("is-unread", new Date(item.createdAt).getTime() > lastReadAt && !markRead);

    const icon = document.createElement("span");
    icon.className = "notification-icon";
    icon.innerHTML =
      item.type === "like"
        ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 5.7c-1.8-1.9-4.6-1.8-6.4.1L12 7.9l-2-2.1c-1.8-1.9-4.6-2-6.4-.1-1.9 2-1.9 5.1.1 7.1L12 21l8.3-8.2c2-2 2-5.1.1-7.1Z"/></svg>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.8h8.2l2.8 2.8v11.6h-11z"/><path d="M14.7 4.8v3h2.8"/><path d="M8.8 12h6.4"/><path d="M8.8 15.4h5"/></svg>`;

    const body = document.createElement("span");
    body.className = "notification-body";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const detail = document.createElement("span");
    detail.textContent = item.detail;
    const time = document.createElement("time");
    time.dateTime = item.createdAt;
    time.textContent = relativeTimeLabel(item.createdAt);
    body.append(title, detail, time);
    row.append(icon, body);
    notificationsFeed.append(row);
  });

  await updateNotificationsBadge();
};

const setView = async (view) => {
  appScreen.dataset.view = view;
  mainTitle.textContent = view === "notifications" ? "Powiadomienia" : "Wakacje z Bogiem";

  if (view === "notifications") {
    await renderNotifications({ markRead: true });
  }
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });

const fileToPostImage = async (file) => {
  const dataUrl = await fileToDataUrl(file);
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = dataUrl;
  });

  const maxSide = 760;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.68);
};

const setAuthMode = (mode) => {
  document.querySelector(".auth-panel").dataset.authMode = mode;
  authFormWindow.hidden = false;
  authTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.authMode === mode));
  authMessage.textContent = "";
};

const setLoggedView = (user) => {
  const isLogged = Boolean(user);

  loggedPanel.hidden = !isLogged;
  authTitle.hidden = isLogged;
  authTabsWrap.hidden = isLogged;
  authFormWindow.hidden = isLogged;
  authForms.forEach((form) => {
    form.hidden = isLogged;
  });

  if (isLogged) {
    loggedName.textContent = `Witaj na blogu, ${user.firstName}.`;
    authMessage.textContent = "";
    updateAuthorUi();
    renderPosts();
    renderNotifications();
    return;
  }

  setAuthMode("login");
  updateAuthorUi();
  renderPosts();
  renderNotifications();
};

elasticButtons.forEach((button) => {
  let startX = 0;
  let startY = 0;
  let pointerId = null;
  let maxMove = 0;
  let releaseTimer = null;

  const reset = () => {
    window.clearTimeout(releaseTimer);
    button.classList.remove("is-pressing");
    button.classList.add("is-releasing");

    window.requestAnimationFrame(() => {
      button.style.setProperty("--stretch-x", "1");
      button.style.setProperty("--stretch-y", "1");
      button.style.setProperty("--shift-x", "0px");
      button.style.setProperty("--shift-y", "0px");
      button.style.setProperty("--origin-x", "center");
      button.style.setProperty("--origin-y", "center");
    });

    releaseTimer = window.setTimeout(() => {
      button.classList.remove("is-releasing");
      maxMove = 0;
    }, 760);

    pointerId = null;
  };

  button.addEventListener("pointerdown", (event) => {
    if (
      (button === moreMorph && appScreen.classList.contains("menu-open")) ||
      (button === profileMorph && appScreen.classList.contains("profile-open")) ||
      (button === composeMorph && appScreen.classList.contains("compose-open"))
    ) {
      return;
    }

    pointerId = event.pointerId;
    maxMove = 0;
    startX = event.clientX;
    startY = event.clientY;
    window.clearTimeout(releaseTimer);
    button.classList.remove("is-releasing");
    button.classList.add("is-pressing");
    button.style.setProperty("--stretch-x", "1.025");
    button.style.setProperty("--stretch-y", "0.976");
    button.style.setProperty("--shift-x", "0px");
    button.style.setProperty("--shift-y", "0px");
    button.style.setProperty("--origin-x", "center");
    button.style.setProperty("--origin-y", "center");
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId || !button.classList.contains("is-pressing")) {
      return;
    }

    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const distance = Math.min(Math.hypot(deltaX, deltaY), 42);
    const pull = Math.min(distance / 220, 0.19);
    const total = absX + absY || 1;
    const xWeight = absX / total;
    const yWeight = absY / total;
    const stretchX = 1 + pull * xWeight - pull * 0.46 * yWeight;
    const stretchY = 1 + pull * yWeight - pull * 0.46 * xWeight;

    maxMove = Math.max(maxMove, Math.hypot(deltaX, deltaY));

    button.style.setProperty("--shift-x", `${Math.max(-7, Math.min(7, deltaX * 0.1))}px`);
    button.style.setProperty("--shift-y", `${Math.max(-7, Math.min(7, deltaY * 0.1))}px`);
    button.style.setProperty("--origin-x", deltaX >= 0 ? "left" : "right");
    button.style.setProperty("--origin-y", deltaY >= 0 ? "top" : "bottom");
    button.style.setProperty("--stretch-x", stretchX.toFixed(3));
    button.style.setProperty("--stretch-y", stretchY.toFixed(3));
  });

  button.addEventListener("pointerup", (event) => {
    if (event.pointerId === pointerId) {
      reset();
    }
  });

  button.addEventListener("pointercancel", (event) => {
    if (event.pointerId === pointerId) {
      reset();
    }
  });

  button.addEventListener("lostpointercapture", (event) => {
    if (event.pointerId === pointerId) {
      reset();
    }
  });

  button.addEventListener("click", (event) => {
    if (maxMove > 8) {
      event.preventDefault();
      event.stopPropagation();
      maxMove = 0;
      return;
    }

    if (button === moreMorph && isCloseIcon(event.target)) {
      setMenuOpen(false);
      return;
    }

    if (button === profileMorph && isCloseIcon(event.target)) {
      setProfileOpen(false);
      return;
    }

    if (button === composeMorph && isCloseIcon(event.target)) {
      setComposeOpen(false);
      return;
    }

    if (button === moreMorph && !isInteractive(event.target)) {
      setProfileOpen(false);
      setComposeOpen(false);
      setMenuOpen(!appScreen.classList.contains("menu-open"));
    }

    if (button === profileMorph && !isInteractive(event.target)) {
      setMenuOpen(false);
      setComposeOpen(false);
      setProfileOpen(!appScreen.classList.contains("profile-open"));
    }

    if (button === composeMorph && !isInteractive(event.target)) {
      setMenuOpen(false);
      setProfileOpen(false);
      setComposeOpen(!appScreen.classList.contains("compose-open"));
    }
  });

  button.addEventListener("keydown", (event) => {
    if (isInteractive(event.target)) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      button.click();
    }
  });
});

panelBackdrop.addEventListener("click", closePanels);

usersButton.addEventListener("click", async (event) => {
  event.stopPropagation();
  await renderUsers();
  usersList.classList.toggle("is-visible");
});

authTabs.forEach((tab) => {
  tab.addEventListener("click", (event) => {
    event.stopPropagation();
    setAuthMode(tab.dataset.authMode);
  });
});

authForms.forEach((form) => {
  form.addEventListener("click", (event) => event.stopPropagation());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const formData = new FormData(form);
    const mode = form.dataset.authForm;
    const firstName = formData.get("firstName").trim();
    const lastName = formData.get("lastName")?.trim() || "";
    const password = formData.get("password");
    const users = await getUsers();

    if (mode === "register") {
      const passwordRepeat = formData.get("passwordRepeat");

      if (password !== passwordRepeat) {
        authMessage.textContent = "Hasła nie są takie same.";
        return;
      }

      const id = userIdFor(firstName, lastName);
      if (users.some((user) => user.id === id)) {
        authMessage.textContent = "Taki użytkownik już istnieje.";
        return;
      }

      await saveUser({
        id,
        firstName,
        lastName,
        passwordHash: await hashPassword(password),
        isAuthor: isAuthorCredentials(firstName, lastName, password),
        createdAt: new Date().toISOString(),
      });

      const currentUser = {
        id,
        firstName,
        lastName,
        isAuthor: isAuthorCredentials(firstName, lastName, password),
        createdAt: new Date().toISOString(),
      };
      writeCurrentUser(currentUser);
      setLoggedView(currentUser);
      form.reset();
      await renderUsers();
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = users.find(
      (item) =>
        normalize(item.firstName) === normalize(firstName) &&
        normalize(item.lastName || "") === normalize(lastName) &&
        item.passwordHash === passwordHash
    );

    if (!user && isAuthorCredentials(firstName, lastName, password)) {
      const id = userIdFor(firstName, lastName);
      const authorUser = {
        id,
        firstName,
        lastName,
        passwordHash,
        isAuthor: true,
        createdAt: new Date().toISOString(),
      };
      await saveUser(authorUser);
      writeCurrentUser({ id, firstName, lastName, isAuthor: true, createdAt: authorUser.createdAt });
      setLoggedView(authorUser);
      form.reset();
      await renderUsers();
      return;
    }

    if (!user) {
      authMessage.textContent = "Nieprawidłowe imię, nazwisko lub hasło.";
      return;
    }

    const currentUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      isAuthor: isAuthorCredentials(firstName, lastName, password) || Boolean(user.isAuthor),
      createdAt: user.createdAt || new Date().toISOString(),
    };
    writeCurrentUser(currentUser);
    setLoggedView(currentUser);
  });
});

logoutButton.addEventListener("click", (event) => {
  event.stopPropagation();
  clearCurrentUser();
  setLoggedView(null);
  authMessage.textContent = "Wylogowano.";
});

postForm.addEventListener("click", (event) => event.stopPropagation());

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  event.stopPropagation();
  const user = readCurrentUser();

  if (!isAuthorUser(user)) {
    composeMessage.textContent = "Tylko autor może dodawać posty.";
    return;
  }

  const formData = new FormData(postForm);
  const files = formData
    .getAll("images")
    .filter((file) => file instanceof File && file.size > 0)
    .slice(0, 4);

  if (!files.length) {
    composeMessage.textContent = "Dodaj przynajmniej jedno zdjęcie.";
    return;
  }

  composeMessage.textContent = "Dodaję post...";
  let images = [];
  try {
    images = await Promise.all(files.map(fileToPostImage));
  } catch {
    composeMessage.textContent = "Nie udało się przygotować zdjęć.";
    return;
  }
  const hashtags = String(formData.get("hashtags") || "")
    .split(/\s+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));

  try {
    await savePost({
      id: `post-${Date.now()}`,
      title: String(formData.get("title") || "").trim(),
      hashtags,
      images,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`.trim(),
      likes: {},
      comments: [],
      createdAt: new Date().toISOString(),
    });
  } catch {
    composeMessage.textContent = "Nie udało się zapisać posta.";
    return;
  }

  postForm.reset();
  composeMessage.textContent = "Post dodany.";
  setComposeOpen(false);
  await renderPosts();
  await renderNotifications({ markRead: activeDockIndex === 3 });
});

postsFeed.addEventListener("click", async (event) => {
  const deleteOpen = event.target.closest("[data-delete-post-open]");
  const deleteCancel = event.target.closest("[data-delete-cancel]");
  const closePostPanel = event.target.closest("[data-close-post-panel]");
  const commentToggle = event.target.closest("[data-comment-toggle]");
  const heartButton = event.target.closest(".heart-button");

  if (deleteOpen) {
    event.preventDefault();
    event.stopPropagation();
    pendingDeletePostId = deleteOpen.dataset.deletePostOpen;
    openPostPanel = null;
    await renderPosts();
    return;
  }

  if (deleteCancel) {
    event.preventDefault();
    event.stopPropagation();
    pendingDeletePostId = null;
    await renderPosts();
    return;
  }

  if (closePostPanel) {
    event.preventDefault();
    event.stopPropagation();
    openPostPanel = null;
    await renderPosts();
    return;
  }

  if (commentToggle) {
    event.preventDefault();
    event.stopPropagation();
    const isSamePanel = openPostPanel?.postId === commentToggle.dataset.postId && openPostPanel.type === "comments";
    openPostPanel = isSamePanel ? null : { postId: commentToggle.dataset.postId, type: "comments" };
    pendingDeletePostId = null;
    await renderPosts();
    return;
  }

  if (!heartButton) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const user = readCurrentUser();

  if (!user) {
    setMenuOpen(false);
    setComposeOpen(false);
    setProfileOpen(true);
    return;
  }

  const posts = await getPosts();
  const post = posts.find((item) => item.id === heartButton.dataset.postId);

  if (!post) {
    return;
  }

  if (heartButton.dataset.likeTarget === "comment") {
    const comment = (post.comments || []).find((item) => item.id === heartButton.dataset.commentId);

    if (!comment) {
      return;
    }

    comment.likes = comment.likes || {};
    if (comment.likes[user.id]) {
      delete comment.likes[user.id];
    } else {
      comment.likes[user.id] = {
        name: currentUserDisplay(),
        createdAt: new Date().toISOString(),
      };
      playHeartSound();
      lastLikedKey = `${post.id}:${comment.id}`;
    }
  } else {
    post.likes = post.likes || {};
    if (post.likes[user.id]) {
      delete post.likes[user.id];
    } else {
      post.likes[user.id] = currentUserDisplay();
      playHeartSound();
      lastLikedKey = post.id;
    }
    openPostPanel = { postId: post.id, type: "likes" };
    pendingDeletePostId = null;
  }

  await savePost(post);
  await renderPosts();
  await renderNotifications({ markRead: activeDockIndex === 3 });
  window.setTimeout(() => {
    lastLikedKey = "";
  }, 520);
});

postsFeed.addEventListener("pointerdown", (event) => {
  const slider = event.target.closest("[data-delete-slider]");
  if (!slider) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const postId = slider.dataset.postId;
  const thumb = slider.querySelector(".delete-slider-thumb");
  const fill = slider.querySelector(".delete-slider-fill");
  const rect = slider.getBoundingClientRect();
  const max = Math.max(1, rect.width - thumb.getBoundingClientRect().width - 8);
  let completed = false;

  slider.setPointerCapture(event.pointerId);
  slider.classList.add("is-sliding");

  const setProgress = (clientX) => {
    const raw = Math.max(0, Math.min(max, clientX - rect.left - 4));
    const progress = raw / max;
    thumb.style.setProperty("--delete-slide-x", `${raw.toFixed(2)}px`);
    fill.style.setProperty("--delete-slide-progress", `${(progress * 100).toFixed(1)}%`);

    if (progress > 0.92 && !completed) {
      completed = true;
      slider.classList.add("is-complete");
    }
  };

  const finish = async (finishEvent) => {
    if (finishEvent.pointerId !== event.pointerId) {
      return;
    }

    slider.releasePointerCapture(event.pointerId);
    slider.removeEventListener("pointermove", move);
    slider.removeEventListener("pointerup", finish);
    slider.removeEventListener("pointercancel", finish);
    slider.classList.remove("is-sliding");

    if (completed) {
      await deletePost(postId);
      pendingDeletePostId = null;
      openPostPanel = null;
      await renderPosts();
      await renderNotifications({ markRead: activeDockIndex === 3 });
      return;
    }

    thumb.style.setProperty("--delete-slide-x", "0px");
    fill.style.setProperty("--delete-slide-progress", "0%");
  };

  const move = (moveEvent) => {
    if (moveEvent.pointerId === event.pointerId) {
      setProgress(moveEvent.clientX);
    }
  };

  setProgress(event.clientX);
  slider.addEventListener("pointermove", move);
  slider.addEventListener("pointerup", finish);
  slider.addEventListener("pointercancel", finish);
});

postsFeed.addEventListener("submit", async (event) => {
  const form = event.target.closest(".comment-form");

  if (!form) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  const user = readCurrentUser();

  if (!user) {
    setMenuOpen(false);
    setComposeOpen(false);
    setProfileOpen(true);
    return;
  }

  const input = form.elements.comment;
  const text = input.value.trim();

  if (!text) {
    return;
  }

  const posts = await getPosts();
  const post = posts.find((item) => item.id === form.dataset.postId);

  if (!post) {
    return;
  }

  post.comments = post.comments || [];
  post.comments.push({
    id: `comment-${Date.now()}`,
    userId: user.id,
    userName: currentUserDisplay(),
    text,
    likes: {},
    createdAt: new Date().toISOString(),
  });

  input.value = "";
  await savePost(post);
  await renderPosts();
  await renderNotifications({ markRead: activeDockIndex === 3 });
});

dockTabs.forEach((tab, index) => {
  tab.addEventListener("click", (event) => {
    event.stopPropagation();

    if (suppressDockClick) {
      event.preventDefault();
      return;
    }

    if (bottomDock.classList.contains("is-collapsed")) {
      event.preventDefault();
      expandDock();
      return;
    }

    setMenuOpen(false);
    setProfileOpen(false);
    setComposeOpen(false);
    const direction = Math.sign(index - activeDockIndex);
    moveDockIndicator(index);
    bottomDock.classList.add("is-switching");
    bottomDock.style.setProperty("--dock-scale-x", "1.18");
    bottomDock.style.setProperty("--dock-skew", `${direction * 5.2}deg`);
    bottomDock.style.setProperty("--dock-origin-x", direction >= 0 ? "left" : "right");
    window.setTimeout(() => {
      bottomDock.classList.remove("is-switching");
      bottomDock.style.setProperty("--dock-scale-x", "1");
      bottomDock.style.setProperty("--dock-skew", "0deg");
      bottomDock.style.setProperty("--dock-origin-x", "center");
    }, 360);
  });
});

bottomDock.addEventListener("pointerdown", (event) => {
  if (bottomDock.classList.contains("is-collapsed")) {
    expandDock();
    return;
  }

  const tab = event.target.closest("[data-dock-tab]");

  if (!tab && !event.target.closest(".dock-indicator")) {
    return;
  }

  const startX = event.clientX;
  const startIndex = activeDockIndex;
  const step = getDockStep() || 1;
  let lastX = startX;
  let lastTime = performance.now();
  let smoothVelocity = 0;
  let animationFrame = 0;
  let moved = false;
  const current = { shift: 0, wobble: 0, skew: 0, stretch: 1 };
  const target = { shift: 0, wobble: 0, skew: 0, stretch: 1 };

  const animateDrag = () => {
    current.shift += (target.shift - current.shift) * 0.36;
    current.wobble += (target.wobble - current.wobble) * 0.32;
    current.skew += (target.skew - current.skew) * 0.3;
    current.stretch += (target.stretch - current.stretch) * 0.28;

    bottomDock.style.setProperty("--dock-drag-x", `${current.shift.toFixed(2)}px`);
    bottomDock.style.setProperty("--dock-wobble", `${current.wobble.toFixed(2)}px`);
    bottomDock.style.setProperty("--dock-skew", `${current.skew.toFixed(2)}deg`);
    bottomDock.style.setProperty("--dock-scale-x", current.stretch.toFixed(3));

    animationFrame = window.requestAnimationFrame(animateDrag);
  };

  bottomDock.classList.add("is-dragging");
  bottomDock.setPointerCapture(event.pointerId);
  animationFrame = window.requestAnimationFrame(animateDrag);

  const onPointerMove = (moveEvent) => {
    if (moveEvent.pointerId !== event.pointerId) {
      return;
    }

    moved = true;
    const now = performance.now();
    const delta = moveEvent.clientX - lastX;
    const elapsed = Math.max(16, now - lastTime);
    const instantVelocity = Math.max(-1, Math.min(1, delta / elapsed));
    smoothVelocity += (instantVelocity - smoothVelocity) * 0.34;
    const maxShift = step * (dockTabs.length - 1 - startIndex);
    const minShift = -step * startIndex;
    const shift = Math.max(minShift, Math.min(maxShift, moveEvent.clientX - startX));
    const energy = Math.min(1, Math.abs(smoothVelocity) * 1.55);
    const wobble = Math.sin(moveEvent.clientX / 14 + now / 72) * energy * 5.8;
    const skew = Math.max(-8.6, Math.min(8.6, smoothVelocity * 72));
    const stretch = 1 + Math.min(0.22, energy * 0.19);

    target.shift = shift;
    target.wobble = wobble;
    target.skew = skew;
    target.stretch = stretch;
    bottomDock.style.setProperty("--dock-origin-x", smoothVelocity >= 0 ? "left" : "right");

    lastX = moveEvent.clientX;
    lastTime = now;
  };

  const finish = (finishEvent) => {
    if (finishEvent.pointerId !== event.pointerId) {
      return;
    }

    bottomDock.classList.remove("is-dragging");
    window.cancelAnimationFrame(animationFrame);
    bottomDock.removeEventListener("pointermove", onPointerMove);
    bottomDock.removeEventListener("pointerup", finish);
    bottomDock.removeEventListener("pointercancel", finish);
    moveDockIndicator(moved ? dockIndexFromPoint(finishEvent.clientX) : Array.from(dockTabs).indexOf(tab));

    if (moved) {
      suppressDockClick = true;
      window.setTimeout(() => {
        suppressDockClick = false;
      }, 0);
    }
  };

  bottomDock.addEventListener("pointermove", onPointerMove);
  bottomDock.addEventListener("pointerup", finish);
  bottomDock.addEventListener("pointercancel", finish);
});

bottomDock.addEventListener("click", (event) => {
  if (bottomDock.classList.contains("is-collapsed")) {
    event.preventDefault();
    event.stopPropagation();
    expandDock();
  }
});

window.addEventListener("resize", () => {
  moveDockIndicator(activeDockIndex);
});

const getPageScrollTop = () =>
  Math.max(
    appScreen.scrollTop || 0,
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0
  );

const handleDockAutoCollapse = () => {
  const currentScrollTop = getPageScrollTop();
  const delta = currentScrollTop - lastAppScrollTop;
  const isHome = appScreen.dataset.view !== "notifications";
  const hasOpenPanel =
    appScreen.classList.contains("menu-open") ||
    appScreen.classList.contains("profile-open") ||
    appScreen.classList.contains("compose-open");

  if (!isHome || hasOpenPanel || currentScrollTop < 70) {
    expandDock();
    lastAppScrollTop = currentScrollTop;
    return;
  }

  if (delta > 8) {
    setDockCollapsed(true);
  }

  if (delta < -6) {
    expandDock();
  }

  lastAppScrollTop = currentScrollTop;
};

const imageLooksDark = (image) => {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, image.naturalWidth * 0.38, image.naturalHeight * 0.58, image.naturalWidth * 0.24, image.naturalHeight * 0.24, 0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return red * 0.299 + green * 0.587 + blue * 0.114 < 96;
  } catch {
    return false;
  }
};

const updateDockContrast = () => {
  dockTabs.forEach((tab) => {
    const rect = tab.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height * 0.55;
    const elements = document.elementsFromPoint(x, y).filter((element) => !bottomDock.contains(element));
    const image = elements.find((element) => element.tagName === "IMG");
    const isDark = image ? imageLooksDark(image) : false;

    tab.classList.toggle("is-on-dark", isDark);
  });
};

const scheduleDockContrast = () => {
  window.cancelAnimationFrame(contrastFrame);
  contrastFrame = window.requestAnimationFrame(updateDockContrast);
};

window.addEventListener(
  "scroll",
  () => {
    scheduleDockContrast();
    handleDockAutoCollapse();
  },
  { passive: true }
);
appScreen.addEventListener(
  "scroll",
  () => {
    scheduleDockContrast();
    handleDockAutoCollapse();
  },
  { passive: true }
);
window.addEventListener("resize", scheduleDockContrast);

moveDockIndicator(0);
setLoggedView(readCurrentUser());
renderUsers();
syncLocalPostsToFirebase()
  .then(renderPosts)
  .catch(() => {});
scheduleDockContrast();
