document.addEventListener('DOMContentLoaded', () => {
    // Hero marquee: clone each group once so translateX(-50%) loops seamlessly
    document.querySelectorAll('.marquee__track').forEach(track => {
        const group = track.querySelector('.marquee__group');
        if (!group) return;
        const clone = group.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        clone.querySelectorAll('img').forEach(img => { img.alt = ''; });
        track.appendChild(clone);
    });

    // Sticker cursor: when the pointer enters a [data-cursor] section, that section's
    // title sticker flies to the pointer and becomes the cursor. On leave it flies
    // back to its place in the title.
    const EASE = 0.18;            // follow smoothness (0–1, higher = snappier)
    const SETTLE_DISTANCE = 0.5;  // px from home at which the sticker lands

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const zones = [...document.querySelectorAll('[data-cursor]')]
        .map(el => ({ el, sticker: el.querySelector('.sticker') }))
        .filter(zone => zone.sticker);

    if (finePointer && zones.length) {
        document.documentElement.classList.add('custom-cursor');

        let mouseX = 0;
        let mouseY = 0;
        let activeZone = null;
        let frame = null;

        zones.forEach(zone => {
            const [tx, ty] = (zone.el.dataset.cursorTip || '0,0').split(',').map(Number);
            zone.tipNatural = { x: tx, y: ty };
            zone.state = 'home'; // home | follow | return

            const flyer = document.createElement('img');
            flyer.className = 'sticker-flyer';
            flyer.src = zone.sticker.currentSrc || zone.sticker.src;
            flyer.alt = '';
            flyer.setAttribute('aria-hidden', 'true');
            document.body.appendChild(flyer);
            zone.flyer = flyer;
        });

        // Arrow-tip offset inside the sticker, in on-screen px
        const tipOffset = zone => {
            const scale = zone.sticker.offsetWidth / (zone.sticker.naturalWidth || 1);
            return { x: zone.tipNatural.x * scale, y: zone.tipNatural.y * scale };
        };

        // Where the tip sits when the sticker is in its place in the title
        const homeTip = zone => {
            const rect = zone.sticker.getBoundingClientRect();
            const tip = tipOffset(zone);
            return { x: rect.left + tip.x, y: rect.top + tip.y };
        };

        const place = zone => {
            const tip = tipOffset(zone);
            zone.flyer.style.transform =
                `translate3d(${zone.pos.x - tip.x}px, ${zone.pos.y - tip.y}px, 0)`;
        };

        const enter = zone => {
            if (zone.state === 'home') {
                zone.pos = homeTip(zone);
                zone.flyer.style.width = `${zone.sticker.offsetWidth}px`;
                place(zone);
                zone.flyer.classList.add('is-visible');
                zone.sticker.classList.add('is-away');
            }
            zone.state = 'follow';
            zone.el.classList.add('is-cursor-active');
        };

        const leave = zone => {
            zone.state = 'return';
            zone.el.classList.remove('is-cursor-active');
        };

        const tick = () => {
            frame = null;
            let moving = false;

            zones.forEach(zone => {
                if (zone.state === 'home') return;

                const target = zone.state === 'follow'
                    ? { x: mouseX, y: mouseY }
                    : homeTip(zone);

                zone.pos.x += (target.x - zone.pos.x) * EASE;
                zone.pos.y += (target.y - zone.pos.y) * EASE;

                if (zone.state === 'return' &&
                    Math.hypot(target.x - zone.pos.x, target.y - zone.pos.y) < SETTLE_DISTANCE) {
                    zone.state = 'home';
                    zone.flyer.classList.remove('is-visible');
                    zone.sticker.classList.remove('is-away');
                    return;
                }

                place(zone);
                moving = true;
            });

            if (moving) frame = requestAnimationFrame(tick);
        };

        const update = target => {
            const el = target && target.closest ? target.closest('[data-cursor]') : null;
            const zone = zones.find(z => z.el === el) || null;

            if (zone !== activeZone) {
                if (activeZone) leave(activeZone);
                if (zone) enter(zone);
                activeZone = zone;
            }
            if (!frame) frame = requestAnimationFrame(tick);
        };

        document.addEventListener('mousemove', e => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            update(e.target);
        });

        // Scrolling moves content under a still pointer
        window.addEventListener('scroll', () => {
            if (!mouseX && !mouseY) return;
            update(document.elementFromPoint(mouseX, mouseY));
        }, { passive: true });

        document.documentElement.addEventListener('mouseleave', () => update(null));
    }

    // Light snowfall inside the hero section only
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hero = document.querySelector('.hero');

    if (!reduceMotion && hero) {
        const canvas = document.createElement('canvas');
        canvas.className = 'snow';
        canvas.setAttribute('aria-hidden', 'true');
        hero.prepend(canvas);

        const ctx = canvas.getContext('2d');
        let width = 0;
        let height = 0;
        let flakes = [];
        let frame = 0;

        const makeFlake = (startAtTop = false) => ({
            x: Math.random() * width,
            y: startAtTop ? -10 : Math.random() * height,
            r: 0.8 + Math.random() * 1.8,              // radius px
            speed: 0.3 + Math.random() * 0.7,          // fall px/frame
            drift: Math.random() * Math.PI * 2,        // sway phase
            sway: 0.2 + Math.random() * 0.5,           // sway amount
            alpha: 0.7 + Math.random() * 0.3
        });

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = hero.clientWidth;
            height = hero.clientHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const count = width < 768 ? 35 : 70;
            flakes = Array.from({ length: count }, () => makeFlake());
        };

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            flakes.forEach((f, i) => {
                f.drift += 0.01;
                f.y += f.speed;
                f.x += Math.sin(f.drift) * f.sway;

                if (f.y > height + 10 || f.x < -10 || f.x > width + 10) {
                    flakes[i] = makeFlake(true);
                    return;
                }

                ctx.beginPath();
                ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
                ctx.fill();
            });

            frame = requestAnimationFrame(draw);
        };

        // Only ever one loop running: cancel any pending frame before (re)starting
        const start = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(draw);
        };

        const stop = () => cancelAnimationFrame(frame);
        let heroVisible = true;

        resize();
        new ResizeObserver(resize).observe(hero);

        // Pause while the hero is scrolled out of view or the tab is hidden
        new IntersectionObserver(([entry]) => {
            heroVisible = entry.isIntersecting;
            heroVisible && !document.hidden ? start() : stop();
        }).observe(hero);

        document.addEventListener('visibilitychange', () => {
            heroVisible && !document.hidden ? start() : stop();
        });
    }

    // Footer year
    const year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();
});
