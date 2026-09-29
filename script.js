// --- Environment helpers -------------------------------------------------
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = () => window.matchMedia('(max-width: 600px)').matches;

/** Confetti is expensive on low-end phones — scale the particle count down. */
function particles(n) {
    return REDUCED_MOTION ? 0 : (isSmallScreen() ? Math.round(n * 0.5) : n);
}

function fireConfetti(options) {
    if (REDUCED_MOTION || typeof confetti !== 'function') return;
    confetti(Object.assign({ disableForReducedMotion: true }, options));
}

/** Small, safe haptics helper. Never throws, never blocks anything else. */
function haptic(pattern) {
    try {
        if (typeof navigator.vibrate !== 'function') return false;
        // Blink requires sticky user activation; a no-op is better than an exception.
        if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
        return navigator.vibrate(pattern);
    } catch (err) {
        return false;
    }
}


// --- Custom Cursor ---
const cursor = document.getElementById('custom-cursor');
const isCoarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');

// rAF-throttled so we never write layout styles more than once per frame.
let cursorRafPending = false;
let cursorX = 0;
let cursorY = 0;
let lastSparkX = 0;
let lastSparkY = 0;

function applyCursorPos() {
    cursorRafPending = false;
    cursor.style.transform = `translate3d(${cursorX - 15}px, ${cursorY - 15}px, 0)`;
}

document.addEventListener('mousemove', (e) => {
    cursorX = e.clientX;
    cursorY = e.clientY;
    if (!cursorRafPending) {
        cursorRafPending = true;
        requestAnimationFrame(applyCursorPos);
    }

    // Sparkles are pure desktop decoration — skipped on touch & reduced motion
    if (REDUCED_MOTION || isCoarsePointer.matches) return;
    const far = Math.abs(e.clientX - lastSparkX) + Math.abs(e.clientY - lastSparkY);
    if (far > 40 && Math.random() > 0.8) {
        lastSparkX = e.clientX;
        lastSparkY = e.clientY;
        createSparkle(e.clientX, e.clientY);
    }
}, { passive: true });

document.addEventListener('click', (e) => {
    if (!isCoarsePointer.matches) {
        cursor.style.transform = `translate3d(${cursorX - 15}px, ${cursorY - 15}px, 0) scale(0.8)`;
        setTimeout(() => {
            cursor.style.transform = `translate3d(${cursorX - 15}px, ${cursorY - 15}px, 0) scale(1)`;
        }, 100);
    }
    if (REDUCED_MOTION) return;

    // Playful Ripple Feature: float a tiny heart/kiss on every click!
    const floatEmoji = document.createElement('div');
    const emojis = ['💖', '💋', '✨', '🎀'];
    floatEmoji.innerText = emojis[Math.floor(Math.random() * emojis.length)];
    floatEmoji.style.position = 'fixed';
    floatEmoji.style.left = e.clientX + 'px';
    floatEmoji.style.top = e.clientY + 'px';
    floatEmoji.style.fontSize = '1.5rem';
    floatEmoji.style.pointerEvents = 'none';
    floatEmoji.style.zIndex = '9999';
    document.body.appendChild(floatEmoji);

    gsap.to(floatEmoji, {
        y: -80,
        x: (Math.random() - 0.5) * 40,
        opacity: 0,
        rotation: (Math.random() - 0.5) * 45,
        duration: 1.5,
        ease: "power2.out",
        onComplete: () => floatEmoji.remove()
    });
});

function createSparkle(x, y) {
    const sparkle = document.createElement('div');
    sparkle.innerText = '✨';
    sparkle.style.position = 'fixed';
    sparkle.style.left = x + 'px';
    sparkle.style.top = y + 'px';
    sparkle.style.fontSize = '10px';
    sparkle.style.pointerEvents = 'none';
    sparkle.style.zIndex = '9998';
    sparkle.style.transition = 'all 0.5s ease-out';
    document.body.appendChild(sparkle);
    
    setTimeout(() => {
        sparkle.style.transform = `translate(${(Math.random()-0.5)*50}px, ${(Math.random()-0.5)*50}px) scale(0)`;
        sparkle.style.opacity = '0';
    }, 10);
    
    setTimeout(() => sparkle.remove(), 500);
}


// --- Floating Hearts Background ---
const heartsContainer = document.getElementById('floating-hearts-container');
const MAX_FLOATING_HEARTS = isSmallScreen() ? 10 : 18;
let heartTimer = null;

function spawnHeart() {
    if (REDUCED_MOTION || heartsContainer.childElementCount >= MAX_FLOATING_HEARTS) return;

    const heart = document.createElement('div');
    heart.classList.add('floating-heart');
    heart.innerText = '💖';
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.animationDuration = (Math.random() * 5 + 7) + 's';
    heart.style.fontSize = (Math.random() * 15 + 10) + 'px';
    heart.style.cursor = 'pointer';

    // Hover/Touch burst logic instead of click for moving elements
    const burst = (e) => {
        const x = (e.clientX || window.innerWidth / 2) / window.innerWidth;
        const y = (e.clientY || window.innerHeight / 2) / window.innerHeight;

        fireConfetti({
            particleCount: particles(20),
            spread: 40,
            origin: { x: x, y: y },
            colors: ['#ff6fa5', '#ff0000', '#fff']
        });
        haptic(12);
        heart.remove();
    };

    heart.addEventListener('pointerenter', burst);

    heartsContainer.appendChild(heart);
    setTimeout(() => { if (heart.parentNode) heart.remove(); }, 12000);
}

function startHearts() {
    if (REDUCED_MOTION || heartTimer) return;
    heartTimer = setInterval(spawnHeart, 800);
}

function stopHearts() {
    if (heartTimer) { clearInterval(heartTimer); heartTimer = null; }
    heartsContainer.innerHTML = '';
}

startHearts();
document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopHearts(); else startHearts();
});


// --- Audio Setup ---
// The music must never start on page load. It is only ever started from inside
// the unlock tap (see unlockApp) or from the player's own button, so autoplay
// policies are always satisfied by a real user gesture.
const bgAudio = document.getElementById('bg-audio');
const audioControl = document.getElementById('audio-control');
let isPlaying = false;

bgAudio.pause(); // belt-and-braces: nothing is audible before the unlock
bgAudio.autoplay = false;

audioControl.addEventListener('click', () => {
    if (isPlaying) {
        bgAudio.pause();
        audioControl.innerText = '🎵 Play Music';
    } else {
        bgAudio.play().catch(() => { audioControl.innerText = '🎵 Play Music'; });
        audioControl.innerText = '⏸️ Pause Music';
    }
    isPlaying = !isPlaying;
    haptic(12);
});


// --- Unlock Screen ---
const unlockBtn = document.getElementById('unlock-btn');
const passwordInput = document.getElementById('password-input');
const unlockScreen = document.getElementById('unlock-screen');
const mainContent = document.getElementById('main-content');
const unlockError = document.getElementById('unlock-error');
const unlockPulse = document.getElementById('unlock-pulse');

unlockBtn.addEventListener('click', unlockApp);
passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') unlockApp();
});

/**
 * The "start of the experience" moment.
 * Runs once, from two independent triggers so it always lands:
 *   - `playing` on the audio  → the haptic is locked to the real first note
 *   - a short safety timer    → covers browsers that block autoplay
 * The visual burst is deliberately deferred until the reveal finishes, so it
 * is never hidden behind the still-opaque unlock screen.
 */
let hapticDone = false;
let visualDone = false;

function startHaptic() {
    if (hapticDone) return;
    hapticDone = true;
    // Physical "lub-dub" heartbeat — a no-op wherever the API is missing
    haptic([40, 70, 150]);
}

function startVisualCelebration() {
    if (visualDone) return;
    visualDone = true;

    // Visual stand-in — always runs, on every browser (iOS included)
    if (unlockPulse) {
        unlockPulse.classList.remove('is-pulsing');
        // force reflow so the animation can be restarted
        void unlockPulse.offsetWidth;
        unlockPulse.classList.add('is-pulsing');
        setTimeout(() => unlockPulse.classList.remove('is-pulsing'), 1400);
    }

    fireConfetti({
        particleCount: particles(90),
        spread: 120,
        origin: { y: 0.5 },
        colors: ['#ff6fa5', '#ffd1dc', '#c77dff', '#fff']
    });

    const heart = document.getElementById('big-heart');
    if (heart && !REDUCED_MOTION) {
        gsap.fromTo(heart, { scale: 1 }, { scale: 1.25, duration: 0.35, yoyo: true, repeat: 1, ease: 'power2.out' });
    }
}

function unlockApp() {
    const val = passwordInput.value.trim();
    if (val === '28-09-2007' || val === '2892007') {
        const REVEAL_MS = 400; // must match #unlock-screen's opacity transition

        // Still inside the trusted tap: this is the only point where Blink
        // guarantees both transient activation and permission to vibrate.
        haptic(35);

        // ---- STEP 1: the unlock screen disappears and the site is revealed.
        // This happens on the first frame, not after a delay, so nothing is
        // ever audible while the panel is still opaque.
        unlockScreen.classList.add('is-leaving');
        mainContent.classList.add('is-entering');
        mainContent.classList.remove('hidden');
        audioControl.classList.remove('hidden');
        void mainContent.offsetWidth; // commit opacity:0 so it can animate up
        mainContent.classList.remove('is-entering');

        // ---- STEP 2: only now, with the site already on screen, start the
        // music. The call is still inside the same synchronous user-gesture
        // task, which is what keeps autoplay policies happy — moving it into
        // a setTimeout would make the browser reject the play(). The music
        // therefore always starts *after* the unlock screen is completed.
        bgAudio.play().then(() => {
            isPlaying = true;
            audioControl.innerText = '⏸️ Pause Music';
            startHaptic(); // land the vibration exactly on the first note
        }).catch(() => {
            // Autoplay was prevented by the browser, they need to tap Play
            audioControl.innerText = '🎵 Play Music';
            startHaptic();
        });

        // Safety net if the play() promise never settles
        setTimeout(startHaptic, 1500);

        // ---- STEP 3: tidy up once the reveal animation has finished.
        setTimeout(() => {
            unlockScreen.classList.add('hidden');

            // The reveal beat
            startVisualCelebration();

            // Trigger Entry Animations
            if (!REDUCED_MOTION) {
                gsap.from("#landing-text-1", {y: 50, opacity: 0, duration: 1, ease: "power3.out" });
                gsap.from("#landing-text-2", {y: 50, opacity: 0, duration: 1, delay: 0.5, ease: "power3.out" });
                gsap.from("#surprise-btn", {scale: 0, opacity: 0, duration: 0.5, delay: 1, ease: "back.out(1.7)" });
            }

            initScrollAnimations();
        }, REVEAL_MS);
    } else {
        unlockError.innerText = "That's not it cutie, try again! 💖";
        passwordInput.value = '';
        haptic([25, 40, 25]); // "wrong" buzz where supported
        setTimeout(() => unlockError.innerText = '', 2000);
    }
}


// --- Birthday Popup ---
const surpriseBtn = document.getElementById('surprise-btn');
const popup = document.getElementById('birthday-popup');
const closePopup = document.getElementById('close-popup');
const popupTypewriter = document.getElementById('popup-typewriter');
const msg = "You mean the world to me…";

surpriseBtn.addEventListener('click', () => {
    popup.classList.remove('hidden');
    gsap.from(".modal-content", {y: 100, opacity: 0, scale: 0.8, duration: 0.5, ease: "back.out(1.5)"});
    
    // Confetti
    fireConfetti({
        particleCount: particles(150),
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#ff6fa5', '#ffd1dc', '#c77dff', '#fff']
    });

    // Typewriter
    popupTypewriter.innerText = '';
    let i = 0;
    function typeWriter() {
        if (i < msg.length) {
            popupTypewriter.innerHTML += msg.charAt(i);
            i++;
            setTimeout(typeWriter, 100);
        }
    }
    setTimeout(typeWriter, 500);
});

closePopup.addEventListener('click', () => {
    gsap.to(".modal-content", {y: 100, opacity: 0, scale: 0.8, duration: 0.3, onComplete: () => {
        popup.classList.add('hidden');
        // Restore styles if reopened
        gsap.set(".modal-content", {y: 0, opacity: 1, scale: 1});
    }});
});


// --- "Why I Love You" Generator ---
const loveBtn = document.getElementById('love-generator-btn');
const loveBox = document.getElementById('love-message-box');
const loveText = document.getElementById('love-message-text');
const reasons = [
    "Because your smile fixes my worst days",
    "Because you're my safe place",
    "Because you are my happiness",
    "Because life feels better with you",
    "Because of your cute little voice",
    "Because you understand me like no one else",
    "Because looking at your eyes feels like looking at the stars",
    "Because your hugs make me forget all my worries",
    "Because your laugh is my favorite sound in the world",
    "Because every moment with you is perfectly magical",
    "Because I can be my true silly self around you",
    "Because you are incredibly beautiful inside and out"
];

loveBtn.addEventListener('click', () => {
    loveBox.classList.remove('hidden');
    const randomMsg = reasons[Math.floor(Math.random() * reasons.length)];
    loveText.innerText = randomMsg;
    gsap.fromTo(loveBox, {scale: 0.8, opacity: 0}, {scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)"});
});


// --- Gift Reveal ---
const giftBox = document.getElementById('gift-box');
const giftMsg = document.getElementById('gift-message');
let giftOpened = false;

giftBox.addEventListener('click', () => {
    if (!giftOpened) {
        giftOpened = true;
        giftBox.innerText = '🎀'; // Open box
        giftMsg.classList.remove('hidden');
        gsap.from(giftMsg, {scale: 0, opacity: 0, duration: 0.5, ease: "back.out(1.5)"});
        confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.8 }
        });
    }
});


// --- Interactive Fun (No button escaping) ---
const noBtn = document.getElementById('no-btn');
const yesBtn = document.getElementById('yes-btn');

// pointerenter covers mouse, pen AND touch (mouseover alone never fires reliably on phones)
function escapeNoBtn() {
    noBtn.style.position = 'absolute';
    const container = document.querySelector('.btn-group');
    const bounds = container.getBoundingClientRect();

    const x = Math.random() * Math.max(0, bounds.width - noBtn.offsetWidth);
    const y = (Math.random() - 0.5) * 100;

    noBtn.style.left = `${Math.max(0, x)}px`;
    noBtn.style.transform = `translateY(${y}px)`;
}

noBtn.addEventListener('pointerenter', escapeNoBtn);
noBtn.addEventListener('pointerdown', escapeNoBtn);

yesBtn.addEventListener('click', () => {
    fireConfetti({
        particleCount: particles(200),
        spread: 360,
        colors: ['#ff6fa5', '#ff0000', '#fff']
    });
    haptic([20, 40, 20]);
    yesBtn.innerText = "I knew it! 💖";
    
    const teddy = document.getElementById('teddy-popup');
    if(teddy) {
        teddy.classList.remove('hidden');
        if (!REDUCED_MOTION) {
            gsap.fromTo(teddy, 
                { scale: 0, rotation: 180 }, 
                { scale: 1, rotation: 0, duration: 1.5, ease: "elastic.out(1, 0.4)" }
            );
        }
    }
});

// --- Playful Hidden Heart Game (Mystery Boxes) ---
const gameContainer = document.getElementById('hidden-heart-game');
const gameReward = document.getElementById('game-reward');
const gameItems = ['🍫', '🧸', '🎀', '💌', '💍', '💖'];

// Shuffle the array of items randomly
gameItems.sort(() => Math.random() - 0.5);

gameContainer.innerHTML = '';
gameItems.forEach(item => {
    const box = document.createElement('div');
    box.className = 'mystery-box';
    box.innerText = '🎁';
    
    box.addEventListener('click', () => {
        // Flip animation
        if (!REDUCED_MOTION) gsap.to(box, { rotationY: 180, duration: 0.4 });
        
        setTimeout(() => {
            box.innerText = item;
            box.classList.add('opened');
            
            if (item === '💖') {
                // User found the heart!
                gameReward.classList.remove('hidden');
                haptic([30, 50, 30]);
                if (!REDUCED_MOTION) {
                    gsap.fromTo(gameReward, 
                        { scale: 0, opacity: 0 }, 
                        { scale: 1, opacity: 1, duration: 1, ease: "elastic.out(1, 0.4)" }
                    );
                }
                fireConfetti({ particleCount: particles(150), spread: 360, colors: ['#ff3366', '#ff6fa5', '#fff'] });
                
                // Hide other boxes and make heart heartbeat
                document.querySelectorAll('.mystery-box').forEach(b => {
                    if (b.innerText !== '💖') {
                        gsap.to(b, { scale: 0, opacity: 0, duration: 0.3 });
                    } else if (!REDUCED_MOTION) {
                        gsap.to(b, { scale: 1.5, y: -15, duration: 0.5, yoyo: true, repeat: -1, ease: "power1.inOut" });
                    }
                });
            } else {
                // Wrong box vibration
                haptic(18);
                if (!REDUCED_MOTION) {
                    gsap.fromTo(box, { x: -3 }, { x: 3, duration: 0.05, yoyo: true, repeat: 5 });
                }
            }
        }, 200); // Change icon halfway through the flip
    });
    
    gameContainer.appendChild(box);
});


// --- Interactive Teddy ---
const interactiveTeddy = document.getElementById('interactive-teddy');
const teddyMessage = document.getElementById('teddy-message');
const cuteMessages = [
    "You're the cutest person ever! 🎀",
    "Sending you 1000 hugs! 🫂",
    "I really, really love you! 💖",
    "Your smile is my favorite thing 😍",
    "You have my whole heart! 💞",
    "I'm so lucky to have you. ❤️"
];

if(interactiveTeddy) {
    interactiveTeddy.addEventListener('click', (e) => {
        // Bounce animation
        if (!REDUCED_MOTION) {
            gsap.fromTo(interactiveTeddy, 
                { scale: 0.8, rotation: -20 },
                { scale: 1.2, rotation: 10, duration: 0.5, yoyo: true, repeat: 1, ease: 'bounce.out' }
            );
        }
        
        fireConfetti({
            particleCount: particles(30),
            spread: 50,
            origin: { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight },
            colors: ['#ff6fa5', '#ffd1dc', '#ff3366']
        });
        haptic(15);

        // Change message
        const randomMsg = cuteMessages[Math.floor(Math.random() * cuteMessages.length)];
        if (REDUCED_MOTION) {
            teddyMessage.innerText = randomMsg;
        } else {
            gsap.to(teddyMessage, { opacity: 0, duration: 0.2, onComplete: () => {
                teddyMessage.innerText = randomMsg;
                gsap.to(teddyMessage, { opacity: 1, duration: 0.2 });
            }});
        }
    });
}

// --- Day/Night Toggle ---
const toggleBtn = document.getElementById('day-night-toggle');
toggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('night-mode');
    haptic(14);
    if (document.body.classList.contains('night-mode')) {
        toggleBtn.innerText = 'Switch to day ☀️';
        createStars();
    } else {
        toggleBtn.innerText = 'Switch to night 🌙';
        document.getElementById('stars-container').innerHTML = '';
    }
});

function createStars() {
    const starContainer = document.getElementById('stars-container');
    starContainer.innerHTML = '';
    for(let i=0; i<50; i++) {
        let star = document.createElement('div');
        star.style.position = 'absolute';
        star.style.left = Math.random() * 100 + 'vw';
        star.style.top = Math.random() * 100 + 'vh';
        star.style.width = Math.random() * 3 + 'px';
        star.style.height = star.style.width;
        star.style.backgroundColor = '#fff';
        star.style.borderRadius = '50%';
        star.style.opacity = Math.random();
        star.style.zIndex = '0';
        starContainer.appendChild(star);
    }
}


// --- Big Heart Click Event ---
const bigHeart = document.getElementById('big-heart');
const heartImage = document.getElementById('heartbeat-image');
bigHeart.addEventListener('click', () => {
    heartImage.classList.remove('hidden');
    if (!REDUCED_MOTION) {
        gsap.fromTo(heartImage, 
            { scale: 0, rotation: -20 }, 
            { scale: 1, rotation: 5, duration: 1, ease: "elastic.out(1, 0.4)" }
        );
    }
    haptic([30, 60, 30]);
    fireConfetti({
        particleCount: particles(80),
        spread: 80,
        origin: { y: 0.6 }
    });
});

// ============================================================
//  MEMORIES / MEDIA GALLERY
//  One manifest drives the whole section — add a photo by adding a line here.
//  `w` / `h` are the real pixel dimensions: they are used for the aspect-ratio
//  box so the grid never shifts while images stream in (no layout thrash).
// ============================================================
//  2.jpg is deliberately NOT listed here — it is reserved for the very last
//  section of the page (#final-ending) and must not appear anywhere else.
const MEDIA = [
    { src: 'img/14.jpg', type: 'img', w: 720, h: 1280, label: 'عيونك بتسحرني 💖' },
    { src: 'img/3.jpg', type: 'img', w: 960, h: 1280, label: 'الضحكه يناس 🫶' },
    { src: 'img/4.jpg', type: 'img', w: 720, h: 1280, label: 'ابتسامتك بتغسلني 💖' },
    { src: 'img/5.jpg', type: 'img', w: 720, h: 1280, label: '💋💋💋' },
    { src: 'img/7.jpg', type: 'img', w: 730, h: 1280, label: 'نفسي اكتب وصف مش مش قادر من جمالك' },
    { src: 'img/9.jpg', type: 'img', w: 720, h: 1280, label: '❤️❤️❤️' },
    { src: 'img/10.jpg', type: 'img', w: 720, h: 1280},
    { src: 'img/13.jpg', type: 'img', w: 592, h: 1280, label: 'قلب بيبو🫂' },
    { src: 'img/12.mp4', type: 'video', w: 480, h: 854, duration: '0:40', label: 'السواند بيوصفني' },
    { src: 'img/15.jpg', type: 'img', w: 720, h: 1280, label: 'وانا عارف سببها😍' },
    { src: 'img/16.mp4', type: 'video', w: 368, h: 656, duration: '0:02', label: 'مضمنش نفسي هعمل ايه لو شوفتك كدا🫦' },
    { src: 'img/17.mp4', type: 'video', w: 480, h: 854, duration: '0:01', label: 'بستناها كل يوم' },
    { src: 'img/18.jpg', type: 'img', w: 720, h: 1280, label: 'ملكه جمالهم' },
    { src: 'img/19.jpeg', type: 'img', w: 900, h: 1600, label: 'happy birthday y 2lby🎂' }
];

const memoriesGrid = document.getElementById('memories-grid');
const memoriesHint = document.getElementById('memories-hint');

/** Build the grid. Videos are rendered as a play placeholder — no bytes downloaded. */
function renderMemories() {
    if (!memoriesGrid) return;

    const frag = document.createDocumentFragment();

    MEDIA.forEach((item, index) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'memory-card' + (item.type === 'video' ? ' is-video' : '');
        card.dataset.index = String(index);
        card.setAttribute('aria-label', `Open ${item.label}, item ${index + 1} of ${MEDIA.length}`);

        const num = document.createElement('span');
        num.className = 'memory-card-num';
        num.textContent = String(index + 1).padStart(2, '0');
        card.appendChild(num);

        if (item.type === 'video') {
            const play = document.createElement('span');
            play.className = 'memory-card-play';
            play.setAttribute('aria-hidden', 'true');
            play.textContent = '▶';
            card.appendChild(play);

            if (item.duration) {
                const dur = document.createElement('span');
                dur.className = 'memory-card-duration';
                dur.textContent = item.duration;
                card.appendChild(dur);
            }
        } else {
            const img = document.createElement('img');
            img.className = 'memory-card-img';
            img.src = item.src;
            img.alt = item.label;
            img.width = item.w;
            img.height = item.h;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
            img.addEventListener('error', () => {
                // never leave a broken card behind
                img.classList.add('is-loaded');
                card.style.background = 'linear-gradient(160deg, var(--primary), var(--accent))';
            }, { once: true });
            card.appendChild(img);
        }

        const tag = document.createElement('span');
        tag.className = 'memory-card-tag';
        tag.textContent = item.label;
        card.appendChild(tag);

        card.addEventListener('click', () => openLightbox(index));
        frag.appendChild(card);
    });

    memoriesGrid.appendChild(frag);
    // reveal animation is set up by initScrollAnimations() after unlock
}

// ============================================================
//  LIGHTBOX
//  Only the visible item (and its two neighbours) ever gets a src,
//  so opening the viewer never downloads the whole album.
// ============================================================
const lightbox = document.getElementById('lightbox');
const lightboxStage = document.getElementById('lightbox-stage');
const lightboxCaption = document.getElementById('lightbox-caption');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');

let lbIndex = 0;
let lbOpen = false;
let lastFocused = null;
let savedScrollY = 0;

const MEDIA_LB = {};   // index -> element living in the stage
let lbTouchX = 0;
let lbTouchY = 0;

function buildLightboxItem(index) {
    if (MEDIA_LB[index]) return MEDIA_LB[index];
    const item = MEDIA[index];
    if (!item) return null;

    let el;
    if (item.type === 'video') {
        el = document.createElement('video');
        el.controls = true;
        el.playsInline = true;
        el.setAttribute('playsinline', '');
        el.preload = 'metadata';
        // no poster file ships with the project — a gradient placeholder instead,
        // so nothing 404s and nothing is downloaded until it is actually played
        el.style.background = 'linear-gradient(160deg, #ff6fa5, #c77dff)';
        el.setAttribute('aria-label', item.label);
    } else {
        el = document.createElement('img');
        el.alt = item.label;
        el.decoding = 'async';
    }
    el.dataset.index = String(index);
    el.hidden = true;
    lightboxStage.appendChild(el);
    MEDIA_LB[index] = el;
    return el;
}

function setLightboxSource(index) {
    const el = buildLightboxItem(index);
    if (!el) return;
    const item = MEDIA[index];

    if (el.tagName === 'IMG' && el.getAttribute('src') !== item.src) {
        el.setAttribute('src', item.src);
    } else if (el.tagName === 'VIDEO' && !el.getAttribute('src')) {
        el.setAttribute('src', item.src);
    }
}

function showLightboxIndex(index) {
    lbIndex = (index + MEDIA.length) % MEDIA.length;

    // preload just the neighbours so swiping feels instant
    [lbIndex - 1, lbIndex, lbIndex + 1].forEach(i => {
        if (i >= 0 && i < MEDIA.length) setLightboxSource(i);
    });

    Object.keys(MEDIA_LB).forEach(key => {
        const i = Number(key);
        const el = MEDIA_LB[i];
        if (!el) return;
        el.hidden = i !== lbIndex;
        if (el.tagName === 'VIDEO' && i !== lbIndex && !el.paused) el.pause();
    });

    const item = MEDIA[lbIndex];
    lightboxCaption.textContent = `${item.label}  ·  ${lbIndex + 1} / ${MEDIA.length}`;

    const multi = MEDIA.length > 1;
    lightboxPrev.hidden = !multi;
    lightboxNext.hidden = !multi;

    if (!REDUCED_MOTION) {
        gsap.fromTo(lightboxStage, { opacity: 0.3, scale: 0.98 }, { opacity: 1, scale: 1, duration: 0.28, ease: 'power2.out' });
    }
}

function pauseLightboxVideo() {
    Object.values(MEDIA_LB).forEach(el => {
        if (el && el.tagName === 'VIDEO' && !el.paused) el.pause();
    });
}

function openLightbox(index) {
    if (!lightbox || !MEDIA.length) return;

    lastFocused = document.activeElement;
    savedScrollY = window.scrollY;

    lightbox.classList.remove('hidden');
    lbOpen = true;

    // lock the page behind the viewer
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.width = '100%';

    showLightboxIndex(index);
    haptic(14);
    lightboxClose.focus({ preventScroll: true });

    // the "tap to view" hint has served its purpose
    if (memoriesHint) memoriesHint.classList.add('is-hidden');
}

function closeLightbox() {
    if (!lbOpen) return;
    lbOpen = false;

    pauseLightboxVideo();
    lightbox.classList.add('hidden');

    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, savedScrollY);

    if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus({ preventScroll: true });
    }
}

if (lightbox) {
    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', () => { showLightboxIndex(lbIndex - 1); haptic(10); });
    lightboxNext.addEventListener('click', () => { showLightboxIndex(lbIndex + 1); haptic(10); });

    // tap the backdrop (but not the media itself) to dismiss
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target === lightboxStage) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
        if (!lbOpen) return;
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') showLightboxIndex(lbIndex - 1);
        else if (e.key === 'ArrowRight') showLightboxIndex(lbIndex + 1);
    });

    // Mobile swipe (kept tiny and dependency-free)
    lightbox.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        lbTouchX = e.touches[0].clientX;
        lbTouchY = e.touches[0].clientY;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
        if (!e.changedTouches.length) return;
        const dx = e.changedTouches[0].clientX - lbTouchX;
        const dy = e.changedTouches[0].clientY - lbTouchY;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            showLightboxIndex(dx < 0 ? lbIndex + 1 : lbIndex - 1);
        }
    }, { passive: true });
}

// Render immediately so the grid is ready the moment the page unlocks.
renderMemories();


// --- Scroll Animations (GSAP) ---
function initScrollAnimations() {
    gsap.registerPlugin(ScrollTrigger);

    // Reduced motion: show the final state of every scroll-driven element immediately
    if (REDUCED_MOTION) {
        gsap.set(".name-container .letter", { y: 0, opacity: 1 });
        gsap.set(".timeline-line", { scaleY: 1 });
        gsap.set(".timeline-item", { y: 0, opacity: 1, scale: 1 });
        gsap.set(".stagger-line", { opacity: 1 });
        gsap.set(".story-line", { opacity: 1, y: 0 });
        gsap.set(".slow-fade", { opacity: 1 });
        gsap.set(".memory-card", { opacity: 1, y: 0, scale: 1 });
        return;
    }

    const isPhone = isSmallScreen();
    const mm = gsap.matchMedia();

    // Name Animation
    mm.add("(min-width: 0px)", () => {
        gsap.fromTo(".name-container .letter", 
            { y: -100, opacity: 0 },
            {
                scrollTrigger: {
                    trigger: "#name-animation",
                    start: "top 70%",
                    once: true,
                },
                y: 0,
                opacity: 1,
                stagger: isPhone ? 0.1 : 0.2, // word by word drop feel
                duration: 1.1,
                ease: "bounce.out"
            }
        );
    });

    // Future Cards Tree Animation
    let futureTl = gsap.timeline({
        scrollTrigger: {
            trigger: "#future-with-you",
            start: "top 80%", // trigger when section is well into view
            once: true
        }
    });

    // 1. Draw the vertical line down
    futureTl.fromTo(".timeline-line", 
        { scaleY: 0 }, 
        { scaleY: 1, duration: 1.5, ease: "power2.inOut" }
    )
    // 2. Pop in the cards and dots one by one
    .fromTo(".timeline-item", 
        { y: 50, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, stagger: isPhone ? 0.25 : 0.4, duration: 0.6, ease: "back.out(1.5)" },
        "-=1.0" // start popping cards before the line is completely finished drawing
    );

    // Stagger text (If I could)
    gsap.to(".stagger-line", {
        scrollTrigger: {
            trigger: "#if-i-could",
            start: "top 60%",
            once: true
        },
        opacity: 1,
        y: -10,
        stagger: 0.3,
        duration: 1
    });

    // Memories: one batched tween instead of 18 individual ScrollTriggers
    gsap.set(".memory-card", { opacity: 0, y: 36, scale: 0.97 });
    ScrollTrigger.batch(".memory-card", {
        start: "top 92%",
        once: true,
        onEnter: (batch) => {
            batch.forEach(el => el.classList.add('is-revealed'));
            gsap.to(batch, {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.6,
                stagger: 0.07,
                ease: "power2.out",
                overwrite: true
            });
        }
    });

    // Scroll Story Parallax
    // Pinning + scrub is the jankiest thing on low-end phones, so phones
    // get the same parallax without the pin.
    mm.add({
        desktop: "(min-width: 601px)",
        phone: "(max-width: 600px)"
    }, (ctx) => {
        const isPinned = ctx.conditions.desktop;
        gsap.to(".story-line", {
            scrollTrigger: {
                trigger: "#scroll-story",
                start: "top top",
                end: "bottom top",
                scrub: true,
                pin: isPinned,
                anticipatePin: 1,
                invalidateOnRefresh: true
            },
            opacity: 1,
            y: -50,
            stagger: 1
        });
    });

    // Final emotional text
    gsap.to(".slow-fade", {
        scrollTrigger: {
            trigger: "#emotional-section",
            start: "top 60%",
            once: true
        },
        opacity: 1,
        duration: 2,
        stagger: 1
    });

    // Refresh ScrollTrigger in case element sizes changed
    setTimeout(() => {
        ScrollTrigger.refresh();
    }, 500);

    // Images stream in lazily and change the page height — re-measure once settled.
    window.addEventListener('load', () => ScrollTrigger.refresh());
}
