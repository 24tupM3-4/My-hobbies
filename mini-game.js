/* Mini-game: Buddy Collect — placeholder assets, simple canvas game
   - Loads when the user clicks the injected button
   - Draws placeholders until image assets are supplied later
   - Toggleable overlay, keyboard/mouse controls, simple scoring
*/
/* Mini-game button injection (non-destructive) */

console.log("JS is running");

document.addEventListener("DOMContentLoaded", () => {
  const topRight = document.querySelector('.top-right');
  if (!topRight) return;

  const btn = document.createElement('button');
  btn.id = 'mini-game-btn';
  btn.className = 'icon-btn';
  btn.title = 'Play: Carrot Collect';
  btn.textContent = 'Carrot Collect';

  topRight.insertBefore(btn, topRight.firstChild);

  btn.addEventListener('click', () => {
    if (window.MiniGame && typeof window.MiniGame.toggle === 'function') {
      window.MiniGame.toggle();
      return;
    }

    // load the mini-game script once and open when ready
    if (!document.querySelector('script[data-mini-game]')) {
      const s = document.createElement('script');
      s.src = 'mini-game.js';
      s.setAttribute('data-mini-game', '1');
      s.onload = () => {
        window.MiniGame && window.MiniGame.open();
      };
      document.body.appendChild(s);
    }
  });
});


document.addEventListener('DOMContentLoaded', () => {

  const btn = document.createElement("button");
  btn.textContent = "🎮 Play Ice Skate Buddy";
  btn.style.padding = "12px 20px";
  btn.style.fontSize = "16px";
  btn.style.cursor = "pointer";
  btn.style.margin = "20px";

  document.body.prepend(btn); // 👈 always works

});




(function(){
  const MiniGame = {};
  let overlay, canvas, ctx, raf;
  let running = false;
  let items = [];
  let spawnTimer = 0;
  let score = 0;
  let lives = 3;
  let last = 0;
  let player = { x: 0, y: 0, w: 64, h: 64 };
  let width = 0, height = 0;

  
  

  // Sprite-sheet animation config (match java.js locations)
  const SPRITE_FRAME = 350; // assumed frame size used by java.js
  const spritePaths = {
    idle: { src: "/My-hobbies/Image/Buddy/idle.png"},
    runLeft: { src: "/My-hobbies/Image/Buddy/left.png"},
    runRight: { src: "/My-hobbies/Image/Buddy/right.png"}
  };
  const buddySprites = {};
  const spriteMeta = {};
  Object.keys(spritePaths).forEach(name => {
    // default meta similar to java.js for directional runs
    spriteMeta[name] = { cols: 10, rows: 2, frames: 18, speed: 90 };
    if (name === 'idle') spriteMeta[name] = { cols: 10, rows: 34, frames: 340, speed: 110 };
    buddySprites[name] = { img: new Image(), loaded: false };
    // try candidates in order
    (function tryLoad(idx, candidates){
      if (idx >= candidates.length) return;
      const img = new Image();
      img.onload = () => { buddySprites[name].img = img; buddySprites[name].loaded = true; };
      img.onerror = () => tryLoad(idx+1, candidates);
      img.src = candidates[idx];
    })(0, spritePaths[name]);
  });


  const assetPaths = {
    collect: ['Image/collect.png'],
    obstacle: ['Image/obstacle.png']
  };
  const assetImgs = { collect: {img:new Image(), loaded:false}, obstacle: {img:new Image(), loaded:false} };
  Object.keys(assetPaths).forEach(kind => {
    const p = assetPaths[kind][0];
    const img = new Image();
    img.onload = () => { assetImgs[kind].img = img; assetImgs[kind].loaded = true; };
    img.onerror = () => {console.warn(`Failed to load asset for ${kind} from ${p}`); };
    img.src = p;
  });


  let currentSprite = 'idle';
  let spriteFrame = 0;
  let spriteTimer = 0;

  let prevX = 0, prevY = 0;

  function createOverlay(){
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'game-overlay';

    overlay.innerHTML = `
      <div class="game-panel">
        <div class="game-hud">
          <div id="game-score">Score: 0</div>
          <div>
            <button id="game-close">✖</button>
          </div>
        </div>
        <canvas id="game-canvas"></canvas>
        <div class="game-controls">
          <button id="game-start">Start</button>
          <button id="game-restart" style="display:none">Restart</button>
        </div>
        <div class="game-msg">Let's horse around on an ice rink! (A/D to move)</div>
      </div>`;

    document.body.appendChild(overlay);
    canvas = overlay.querySelector('#game-canvas');
    ctx = canvas.getContext('2d');

    overlay.querySelector('#game-close').addEventListener('click', close);
    overlay.querySelector('#game-start').addEventListener('click', start);
    overlay.querySelector('#game-restart').addEventListener('click', restart);

    overlay.addEventListener('mousedown', e => e.stopPropagation());

    window.addEventListener('resize', resize);

    document.addEventListener('keydown', keyHandler, true);
    document.addEventListener('keyup', keyUpHandler, true);

    resize();
  }

  let keys = {};
  function keyHandler(e){
    if (!overlay || overlay.style.display === 'none') return;
    // prevent site-wide handlers from interfering while game active
    e.stopPropagation();
    const code = e.code;
    const key = e.key && e.key.toLowerCase();
    // prevent default for arrow keys, space, and WASD keys
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space","KeyA","KeyD","KeyW","KeyS"].includes(code) || ["a","d","w","s"," "].includes(key)){
      e.preventDefault();
    }
    keys[code] = true;
    if (key) keys[key] = true;
  }
  function keyUpHandler(e){
    if (!overlay) return;
    const code = e.code;
    const key = e.key && e.key.toLowerCase();
    keys[code] = false;
    if (key) keys[key] = false;
  }

  function resize(){
    if (!canvas) return;
    width = Math.min(window.innerWidth * 0.9, 1040);
    height = 520;
    canvas.width = Math.floor(width);
    canvas.height = Math.floor(height);
    player.y = height - player.h - 12;
    if (!running) render();
  }

  function start(){
    score = 0; lives = 3; items = []; spawnTimer = 0; last = performance.now(); running = true;
    overlay.querySelector('#game-start').style.display = 'none';
    overlay.querySelector('#game-restart').style.display = 'none';
    overlay.querySelector('#game-score').textContent = 'Score: 0';
    document.body.style.overflow = 'hidden';
    raf = requestAnimationFrame(loop);
  }

  function restart(){ start(); }

  function stop(){ running = false; cancelAnimationFrame(raf); raf = null; document.body.style.overflow = ''; }

  function close(){ stop(); if (overlay) overlay.style.display = 'none'; }

  function open(){ createOverlay(); overlay.style.display = 'flex'; overlay.querySelector('#game-start').style.display = 'inline-block'; overlay.querySelector('#game-restart').style.display = 'none'; }

  function toggle(){ if (!overlay) createOverlay(); overlay.style.display = (!overlay || overlay.style.display === 'none') ? 'flex' : 'none'; if (overlay.style.display === 'none') stop(); }

  function spawn(){
    const kind = Math.random() < 0.75 ? 'collect' : 'obstacle';
    const x = Math.random() * (canvas.width - 36) + 18;
    const size = kind === 'collect' ? 36 + Math.random()*18 : 36 + Math.random()*24;
    const speed = 1.2 + Math.random()*2.6 + score*0.02;
    // shadow properties: spawn a faint shadow immediately, darken as item approaches
    const shadowMax = kind === 'collect' ? 0.36 : 0.6;
    items.push({ x, y: -size, size, speed, kind, shadowAlpha: 0.04, shadowMax, shadowScale: 0.3 });
  }

  function loop(now){
    const dt = Math.min(60, now - last); last = now;

    // spawn logic
    spawnTimer -= dt;
    if (spawnTimer <= 0){ spawn(); spawnTimer = 600 + Math.random()*900; }

let accel = 0;

if (keys.ArrowLeft || keys.a) accel = -0.6;
if (keys.ArrowRight || keys.d) accel = 0.6;

player.vx = player.vx || 0;

// weak acceleration (hard to control)
player.vx += accel;

// VERY LOW friction = real ice
player.vx *= 0.995;

// clamp max speed
player.vx = Math.max(-25, Math.min(25, player.vx));

player.x += player.vx;
    // lock vertical position to ground so Buddy cannot move vertically
    player.y = height - player.h - 12;

    // compute simple velocity from position delta
    const vx = player.x - prevX;
    const vy = player.y - prevY;

    // determine sprite from velocity (horizontal only)
    function pickSpriteFromVel(vx, vy){
      const ax = Math.abs(vx);
      if (ax < 0.5) return 'idle';
      return vx > 0 ? 'runRight' : 'runLeft';
    }
    const desiredSprite = pickSpriteFromVel(vx, vy);
    if (desiredSprite !== currentSprite) { currentSprite = desiredSprite; spriteFrame = 0; spriteTimer = 0; }
    // clamp
    player.x = Math.max(0, Math.min(canvas.width - player.w, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.h, player.y));

    // update items (movement + shadow progression)
    for (let i = items.length -1; i >=0; i--){
      const it = items[i];
      it.y += it.speed * (dt / 16);
      // shadow progression: make the shadow grow and darken as the item falls
      // t = normalized fall progress (0 at top, 1 near bottom)
      const t = Math.min(1, Math.max(0, (it.y + it.size) / (canvas.height)));
      it.shadowAlpha = Math.min(it.shadowMax, t * it.shadowMax);
      it.shadowScale = 0.3 + 0.9 * t; // scale shadow from small to larger as it approaches
      // collision
      if (rectIntersect(player.x, player.y, player.w, player.h, it.x, it.y, it.size, it.size)){
if (it.kind === 'collect') {
    score += 10;
} else {
    // BIG ice boost
    player.vx += (Math.random() - 0.5) * 40;
}
        items.splice(i,1);
        overlay.querySelector('#game-score').textContent = 'Score: ' + score;
        if (lives <= 0){
          stop();
          overlay.querySelector('#game-restart').style.display = 'inline-block';
          overlay.querySelector('#game-start').style.display = 'none';
        }
      } else if (it.y > canvas.height + 100) {
        items.splice(i,1);
      }
    }

    render(dt);
    if (running) raf = requestAnimationFrame(loop);
  }

  function rectIntersect(ax,ay,aw,ah,bx,by,bw,bh){
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  

  function render(dt){
    if (!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    const snowflakes = Array.from({length: 50}, () => ({
  x: Math.random()*width,
  y: Math.random()*height,
  size: Math.random()*3+1,
  speed: Math.random()*1+0.5
}));

ctx.fillStyle = "white";
snowflakes.forEach(f => {
  f.y += f.speed;
  if (f.y > canvas.height) f.y = 0;
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.size, 0, Math.PI*2);
  ctx.fill();
}); 

    // Winter sky gradient
const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
sky.addColorStop(0, "#9fd8ff");
sky.addColorStop(1, "#eaf6ff");
ctx.fillStyle = sky;
ctx.fillRect(0, 0, canvas.width, canvas.height);


// Snow ground
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

    // draw player (animated sprite if available)
    const spriteInfo = buddySprites[currentSprite];
    const meta = spriteMeta[currentSprite];
    if (spriteInfo && spriteInfo.loaded) {
      // advance frames by sprite speed
      spriteTimer += dt || 0;
      while (spriteTimer >= meta.speed) { spriteTimer -= meta.speed; spriteFrame++; }
      if (spriteFrame >= meta.frames) spriteFrame = 0;
      const col = spriteFrame % meta.cols;
      const row = Math.floor(spriteFrame / meta.cols);
      try {
        ctx.drawImage(
          spriteInfo.img,
          col * SPRITE_FRAME, row * SPRITE_FRAME, SPRITE_FRAME, SPRITE_FRAME,
          player.x, player.y, player.w, player.h
        );
      } catch(e){
        // fallback to placeholder if draw fails
        ctx.fillStyle = '#6fb3ff'; roundRect(ctx, player.x, player.y, player.w, player.h, 10);
        ctx.fillStyle = '#073b66'; ctx.font = '12px sans-serif'; ctx.fillText('Buddy', player.x + 8, player.y + player.h/2 + 5);
      }
    } else {
      ctx.fillStyle = '#6fb3ff'; roundRect(ctx, player.x, player.y, player.w, player.h, 10);
      ctx.fillStyle = '#073b66'; ctx.font = '12px sans-serif'; ctx.fillText('Buddy', player.x + 8, player.y + player.h/2 + 5);
    }

    // remember prev positions for next frame
    prevX = player.x; prevY = player.y;

    // draw items with shadows (shadows spawn early and darken as they fall)
    const groundY = canvas.height - 24; // where shadows sit (near bottom)
    items.forEach(it => {
      // shadow draw
      const shadowX = it.x + it.size / 2;
      const shadowW = it.size * (it.kind === 'collect' ? 0.6 : 0.9) * it.shadowScale;
      const shadowH = it.size * (it.kind === 'collect' ? 0.16 : 0.26) * (it.shadowScale * 0.9);
      ctx.beginPath();
      ctx.ellipse(shadowX, groundY, shadowW, shadowH, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${it.shadowAlpha.toFixed(3)})`;
      ctx.fill();

      // draw item: if an asset image is loaded for this kind, draw it; otherwise draw placeholder
      const asset = assetImgs[it.kind];
      if (asset && asset.loaded) {
        try {
          ctx.drawImage(asset.img, it.x, it.y, it.size, it.size);
        } catch(e) {
          // fallback to shape if draw fails
        }
      }
      if (!asset || !asset.loaded) {
        if (it.kind === 'collect'){
          // cloud placeholder
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.beginPath(); ctx.arc(it.x + it.size*0.3, it.y + it.size*0.5, it.size*0.28,0,Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(it.x + it.size*0.6, it.y + it.size*0.46, it.size*0.24,0,Math.PI*2); ctx.fill();
          ctx.fillStyle = '#b6d8ff'; ctx.fillRect(it.x + it.size*0.08, it.y + it.size*0.6, it.size*0.7, Math.max(4, it.size*0.12));
        } else {
       // snowflake emoji obstacle
ctx.font = `${it.size}px serif`;
ctx.fillText("❄️", it.x, it.y + it.size);
        }
      }
    });

    // HUD lives
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(8,8,120,28);
    ctx.fillStyle = 'var(--gold)'; ctx.font = '14px sans-serif'; ctx.fillText('Lives: ' + lives, 14, 26);
  }

  function roundRect(ctx, x, y, w, h, r){
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath(); ctx.fill();
  }

  MiniGame.open = open;
  MiniGame.close = close;
  MiniGame.toggle = toggle;
  MiniGame.start = start;

  // auto-init: expose globally
  window.MiniGame = MiniGame;
})();
