document.addEventListener("DOMContentLoaded", () => {

  const buddy = document.getElementById("buddy");
  if (!buddy) return;

  /* =====================
     CONFIG
  ===================== */
  const SPRITE = 350;
  const SCALE = 200 / SPRITE;
  const FRAME = SPRITE;
  const DIAG = 0.7071;

  const SPEED = 0.6;
  const AUTO_SPEED = 0.35;
  const FRICTION = 0.82;
  const STOP_DIST = 8;
  const IDLE_VEL = 0.05;

  const AUTO_WALK_MIN = 2000;
  const AUTO_WALK_MAX = 5000;
  const SLEEP_TIME = 10000;
  const SLEEP_DURATION = 8000;

  /* =====================
     STATE
  ===================== */
  let x = 20, y = 0;
  let vx = 0, vy = 0;

  let frame = 0;
  let timer = 0;
  let last = performance.now();

  let idleTime = 0;
  let autoTime = 0;
  let autoDir = 1;

  let current = "";
  let lockedAnim = null;
  let playOnce = false;

  let targetX = null;
  let targetY = null;

  let rngTimer = 0;
  let rngDir = 0;

  let emoteCooldown = 0;
  let sleepTimer = 0;

  let mode = "idle"; // idle | player | target | auto | emote | sleep

  /* =====================
     SPRITES (UNCHANGED)
  ===================== */
  const animations = {
    idle: { src: "Image/Buddy/idle.png", cols: 10, rows: 34, frames: 340, speed: 110 },
    emote2: { src: "Image/Buddy/emote2.png", cols: 10, rows: 5, frames: 43, speed: 200 },
    sleep: { src: "Image/Buddy/sleep.png", cols: 10, rows: 5, frames: 50, speed: 110 },

    runUp: { src: "Image/Buddy/backward.png", cols: 10, rows: 2, frames: 18, speed: 100 },
    runDown: { src: "Image/Buddy/forward.png", cols: 10, rows: 2, frames: 18, speed: 100 },
    runLeft: { src: "Image/Buddy/left.png", cols: 10, rows: 2, frames: 18, speed: 100 },
    runRight: { src: "Image/Buddy/right.png", cols: 10, rows: 2, frames: 18, speed: 100 },

    upLeft: { src: "Image/Buddy/upLeft.png", cols: 10, rows: 2, frames: 18, speed: 100 },
    upRight: { src: "Image/Buddy/upRight.png", cols: 10, rows: 2, frames: 18, speed: 100 },
    downLeft: { src: "Image/Buddy/downLeft.png", cols: 10, rows: 2, frames: 18, speed: 100 },
    downRight: { src: "Image/Buddy/downRight.png", cols: 10, rows: 2, frames: 18, speed: 100 },

    walkLeft: { src: "Image/Buddy/walkL.png", cols: 10, rows: 9, frames: 18, speed: 90 },
    walkRight:{ src: "Image/Buddy/walkR.png", cols: 10, rows: 9, frames: 18, speed: 90 },
  };

  /* =====================
     HELPERS
  ===================== */
  function setAnim(name, once = false) {
    if (current === name) return;
    if (lockedAnim && !once) return;

    current = name;
    frame = 0;
    timer = 0;
    playOnce = once;
    lockedAnim = once ? name : null;

    const a = animations[name];
    buddy.style.backgroundImage = `url(${a.src})`;
    buddy.style.backgroundSize =
      `${a.cols * FRAME * SCALE}px ${a.rows * FRAME * SCALE}px`;
  }

  function draw() {
    const a = animations[current];
    const col = frame % a.cols;
    const row = Math.floor(frame / a.cols);
    buddy.style.backgroundPosition =
      `-${col * FRAME * SCALE}px -${row * FRAME * SCALE}px`;
  }

  /* =====================
     INPUT
  ===================== */
  const keys = {};
  window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
  window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

  window.addEventListener("contextmenu", e => {
    e.preventDefault();
    targetX = e.clientX - buddy.offsetWidth / 2;
    targetY = e.clientY - buddy.offsetHeight / 2;
    mode = "target";
  });

  /* =====================
     MAIN LOOP
  ===================== */
  function loop(t) {
    const delta = t - last;
    last = t;

    let dx = 0, dy = 0;
    const usingKeys = keys.w || keys.a || keys.s || keys.d;

    /* ===== HARD LOCK STATES ===== */
    if (mode === "sleep") {
      sleepTimer -= delta;
      if (sleepTimer <= 0) {
        mode = "idle";
        idleTime = 0;
      }
      setAnim("sleep");
      advanceFrames(delta);
      requestAnimationFrame(loop);
      return;
    }

    if (mode === "emote") {
      vx = vy = 0;
      advanceFrames(delta);
      requestAnimationFrame(loop);
      return;
    }

    /* ===== PLAYER ===== */
    if (usingKeys) {
      mode = "player";
      targetX = targetY = null;
      idleTime = 0;

      if (keys.a) dx--;
      if (keys.d) dx++;
      if (keys.w) dy--;
      if (keys.s) dy++;
    }

    /* ===== TARGET MOVE ===== */
    else if (mode === "target" && targetX !== null) {
      const rx = targetX - x;
      const ry = targetY - y;
      const dist = Math.hypot(rx, ry);
      if (dist < STOP_DIST) {
        mode = "idle";
        vx = vy = 0;
      } else {
        dx = rx / dist;
        dy = ry / dist;
      }
    }

    /* ===== RNG WALK ===== */
    else if (rngTimer > 0) {
      rngTimer -= delta;
      dx = rngDir;
      if (rngTimer <= 0) {
        mode = "idle";
        idleTime = 0;
      }
    }

    /* ===== IDLE ===== */
    else {
      idleTime += delta;

      if (idleTime > SLEEP_TIME) {
        mode = "sleep";
        sleepTimer = SLEEP_DURATION;
        setAnim("sleep");
      }
      else if (idleTime > 3000 && Math.random() < 0.002) {
        rngDir = Math.random() < 0.5 ? -1 : 1;
        rngTimer = 1200 + Math.random() * 1200;
        mode = "auto";
        idleTime = 0;
      }
      else if (idleTime > 2000 && emoteCooldown <= 0 && Math.random() < 0.001) {
        mode = "emote";
        emoteCooldown = 6000;
        setAnim("emote2", true);
      }
    }

    emoteCooldown -= delta;

    /* ===== MOVEMENT ===== */
    if (dx || dy) {
      if (dx && dy) { dx *= DIAG; dy *= DIAG; }
      vx += dx * SPEED;
      vy += dy * SPEED;
    }

    x += vx;
    y += vy;
    vx *= FRICTION;
    vy *= FRICTION;

    if (Math.abs(vx) < IDLE_VEL) vx = 0;
    if (Math.abs(vy) < IDLE_VEL) vy = 0;

    /* ===== BOUNDS ===== */
    const maxX = window.innerWidth - buddy.offsetWidth;
    const maxY = window.innerHeight - buddy.offsetHeight;
    x = Math.max(0, Math.min(maxX, x));
    y = Math.max(0, Math.min(maxY, y));

    /* ===== ANIMATION ===== */
  /* ===== ANIMATION ===== */
const moving = vx !== 0 || vy !== 0;

/* AUTO WALK has priority */
if (mode === "auto" && moving) {
  setAnim(rngDir > 0 ? "walkRight" : "walkLeft");
}

/* PLAYER / TARGET movement */
else if (moving) {
  if (Math.abs(vx) > 0.5 && Math.abs(vy) > 0.5) {
    setAnim(
      vx > 0 && vy > 0 ? "downRight" :
      vx < 0 && vy > 0 ? "downLeft" :
      vx > 0 && vy < 0 ? "upRight" : "upLeft"
    );
  }
  else if (Math.abs(vx) > Math.abs(vy)) {
    setAnim(vx > 0 ? "runRight" : "runLeft");
  }
  else {
    setAnim(vy > 0 ? "runDown" : "runUp");
  }
}

/* IDLE */
else {
  setAnim("idle");
}


    advanceFrames(delta);

    buddy.style.left = `${Math.round(x)}px`;
    buddy.style.top  = `${Math.round(y)}px`;

    requestAnimationFrame(loop);
  }

  function advanceFrames(delta) {timer += delta;
while (timer >= animations[current].speed) {
  timer -= animations[current].speed;
  frame++;

  if (frame >= animations[current].frames) {
    if (playOnce) {
      playOnce = false;
      lockedAnim = null;
      mode = "idle";
      frame = 0;
    } else {
      frame = 0;
    }
  }
}
draw();

  }

  /* ===== SPAWN ===== */
  const preload = new Image();
  preload.src = animations.idle.src;
  preload.onload = () => {
    y = window.innerHeight - buddy.offsetHeight - 20;
    setAnim("idle");
    draw();
    requestAnimationFrame(loop);
  };
});


/*speak, my horse.*/
document.addEventListener("DOMContentLoaded", () => {
  const buddy  = document.getElementById("buddy");
  const speech = document.getElementById("buddy-speech");
  if (!buddy || !speech) return;

  /* === PAGE IDENTIFIER === */
 let page = location.pathname;

// handle "/" → "/index.html"
if (page === "/" || page.endsWith("/")) {
  page += "index.html";
}

// strip folders: "/site/music.html" → "/music.html"
page = "/" + page.split("/").pop();



  /* === PAGE-SPECIFIC DIALOGUE === */
  const dialogueMap = {
    "/index.html": [
      "Welcome to my page!",
      "How are you today?",
      "Hope you have a great time checking out my hobbies!"
    ],
    "/music.html": [
      "Did you know? Soothing music can ease anxiety.",
      "Bo En composed a song for a game called 'OMORI'.",
      "You can find some of my favorite songs here!"
    ],
    "default": [
      "Hello, you can right-click me to move me around!",
      "I'll be with you as you explore the site."
    ],
    "/games.html": [
      "I love playing games!",
      "Did you know? This charcter is based on a real horse.",
      "You can also use WASD to move me!"
    ],
    "/animals.html": [
      "Fun fact: Horses can sleep both lying down and standing up!",
      "Cats have delightfully unpredictable personalities.",
      "Petting animals can reduce stress and anxiety!"
    ],
  };

  const dialogue = dialogueMap[page] || dialogueMap["default"];
  let index = 0;

  /* === POSITION OFFSETS === */
  const OFFSET_X = 210; // right of buddy
  const OFFSET_Y = -20; // slightly up

  /* === BOUNDS === */
  function updatePosition() {
    const rect = buddy.getBoundingClientRect();
    speech.style.left = rect.right + OFFSET_X - buddy.offsetWidth + "px";
    speech.style.top  = rect.top + OFFSET_Y + "px";
  }

 function speak() {
  // 🚫 no talking while sleeping
  if (buddy.dataset.mode === "sleep") return;

  speech.textContent = dialogue[index];
  speech.style.opacity = "1";
  speech.style.transform = "translateY(0)";

  index = (index + 1) % dialogue.length;

  setTimeout(() => {
    speech.style.opacity = "0";
    speech.style.transform = "translateY(6px)";
  }, 4000);
}


  /* === AUTO FACTS (EVERY 5s) === */
  setInterval(speak, 10000);

  /* === STICK TO BUDDY === */
  function follow() {
    updatePosition();
    requestAnimationFrame(follow);
  }
  follow();
});
