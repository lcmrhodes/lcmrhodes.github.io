const TABS = ['about', 'experience', 'projects'] as const;
const DEFAULT_TAB = 'about';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FINE_POINTER_QUERY = '(pointer: fine)';
const PULSE_HALO_SOUND_DELAY_MS = 320;
const FRAGRANCE_BLOOM_SOUND_DELAY_MS = 320;
const WEDDING_SPARKLE_SOUND_DELAY_MS = 130;
const SOUND_ENABLED_KEY = 'sound-enabled';

type TabKey = (typeof TABS)[number];
type ThemeName = 'light' | 'dark';

let galleryObserver: IntersectionObserver | null = null;
let identityTypingToken = 0;
let audioContext: AudioContext | null = null;
const pulseHoverTimeouts = new WeakMap<HTMLElement, number>();
let soundEnabled = true;
let activeInlineHoverLink: HTMLElement | null = null;

function prefersReducedMotion() {
	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function isValidTab(tab: string): tab is TabKey {
	return TABS.includes(tab as TabKey);
}

function getActiveTheme(): ThemeName {
	return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function syncSoundToggleLabels() {
	document.body.dataset.soundEnabled = String(soundEnabled);

	document.querySelectorAll<HTMLElement>('[data-sound-toggle]').forEach((button) => {
		const nextLabel = soundEnabled ? 'Mute sounds' : 'Enable sounds';
		button.setAttribute('aria-label', nextLabel);
		button.setAttribute('aria-pressed', String(soundEnabled));

		const label = button.querySelector<HTMLElement>('.sound-toggle-label');
		if (label) {
			label.textContent = soundEnabled ? 'Sound on' : 'Sound off';
		}
	});
}

function setSoundEnabled(nextValue: boolean) {
	soundEnabled = nextValue;
	localStorage.setItem(SOUND_ENABLED_KEY, String(nextValue));
	syncSoundToggleLabels();
}

function getAudioContext() {
	return audioContext;
}

function unlockAudioContext() {
	if (prefersReducedMotion() || !soundEnabled) {
		return;
	}

	if (!audioContext) {
		try {
			const AudioContextCtor =
				window.AudioContext ||
				(window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

			if (!AudioContextCtor) {
				return;
			}

			audioContext = new AudioContextCtor();
		} catch {
			return;
		}
	}

	const ctx = audioContext;

	if (!ctx || ctx.state !== 'suspended') {
		return;
	}

	void ctx.resume().catch(() => undefined);
}

function playPulseHaloTone() {
	const ctx = getAudioContext();

	if (!ctx || !soundEnabled) {
		return;
	}

	if (ctx.state === 'suspended') {
		return;
	}

	const now = ctx.currentTime;
	const masterGain = ctx.createGain();
	const filter = ctx.createBiquadFilter();
	const primaryOscillator = ctx.createOscillator();
	const harmonicOscillator = ctx.createOscillator();
	const primaryGain = ctx.createGain();
	const harmonicGain = ctx.createGain();

	filter.type = 'bandpass';
	filter.frequency.setValueAtTime(1120, now);
	filter.Q.setValueAtTime(2.2, now);

	masterGain.gain.setValueAtTime(0.0001, now);
	masterGain.gain.exponentialRampToValueAtTime(0.016, now + 0.012);
	masterGain.gain.exponentialRampToValueAtTime(0.012, now + 0.07);
	masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

	primaryOscillator.type = 'sine';
	primaryOscillator.frequency.setValueAtTime(720, now);
	primaryOscillator.frequency.linearRampToValueAtTime(680, now + 0.16);

	harmonicOscillator.type = 'sine';
	harmonicOscillator.frequency.setValueAtTime(1440, now);
	harmonicOscillator.frequency.linearRampToValueAtTime(1360, now + 0.16);

	primaryGain.gain.setValueAtTime(1, now);
	harmonicGain.gain.setValueAtTime(0.2, now);

	primaryOscillator.connect(primaryGain);
	harmonicOscillator.connect(harmonicGain);
	primaryGain.connect(filter);
	harmonicGain.connect(filter);
	filter.connect(masterGain);
	masterGain.connect(ctx.destination);

	primaryOscillator.start(now);
	harmonicOscillator.start(now);
	primaryOscillator.stop(now + 0.17);
	harmonicOscillator.stop(now + 0.17);
}

function createNoiseBuffer(ctx: AudioContext, duration = 0.24) {
	const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
	const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
	const channel = buffer.getChannelData(0);

	for (let index = 0; index < frameCount; index += 1) {
		channel[index] = (Math.random() * 2 - 1) * 0.55;
	}

	return buffer;
}

function playFragranceBloomSpritz() {
	const ctx = getAudioContext();

	if (!ctx || !soundEnabled) {
		return;
	}

	if (ctx.state === 'suspended') {
		return;
	}

	const now = ctx.currentTime;
	const noiseSource = ctx.createBufferSource();
	const noiseGain = ctx.createGain();
	const lowpass = ctx.createBiquadFilter();
	const highpass = ctx.createBiquadFilter();
	const clickOscillator = ctx.createOscillator();
	const clickGain = ctx.createGain();

	noiseSource.buffer = createNoiseBuffer(ctx, 0.24);

	highpass.type = 'highpass';
	highpass.frequency.setValueAtTime(900, now);
	lowpass.type = 'lowpass';
	lowpass.frequency.setValueAtTime(4600, now);
	lowpass.Q.setValueAtTime(0.6, now);

	noiseGain.gain.setValueAtTime(0.0001, now);
	noiseGain.gain.exponentialRampToValueAtTime(0.009, now + 0.018);
	noiseGain.gain.exponentialRampToValueAtTime(0.0048, now + 0.09);
	noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

	clickOscillator.type = 'triangle';
	clickOscillator.frequency.setValueAtTime(2100, now);
	clickOscillator.frequency.exponentialRampToValueAtTime(1260, now + 0.028);

	clickGain.gain.setValueAtTime(0.0001, now);
	clickGain.gain.exponentialRampToValueAtTime(0.0034, now + 0.008);
	clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

	noiseSource.connect(highpass);
	highpass.connect(lowpass);
	lowpass.connect(noiseGain);
	noiseGain.connect(ctx.destination);

	clickOscillator.connect(clickGain);
	clickGain.connect(ctx.destination);

	noiseSource.start(now);
	noiseSource.stop(now + 0.24);
	clickOscillator.start(now);
	clickOscillator.stop(now + 0.045);
}

function playWeddingBubbleCluster() {
	const ctx = getAudioContext();

	if (!ctx || !soundEnabled) {
		return;
	}

	if (ctx.state === 'suspended') {
		return;
	}

	const now = ctx.currentTime;
	const pops = [
		{ delay: 0, base: 720, harmonic: 1160, peak: 0.0025, duration: 0.1, noisePeak: 0.00055 },
		{ delay: 0.055, base: 860, harmonic: 1320, peak: 0.0022, duration: 0.094, noisePeak: 0.00048 },
		{ delay: 0.12, base: 650, harmonic: 1020, peak: 0.002, duration: 0.11, noisePeak: 0.00052 },
	];

	pops.forEach(({ delay, base, harmonic, peak, duration, noisePeak }) => {
		const start = now + delay;
		const end = start + duration;
		const master = ctx.createGain();
		const filter = ctx.createBiquadFilter();
		const oscA = ctx.createOscillator();
		const oscB = ctx.createOscillator();
		const gainA = ctx.createGain();
		const gainB = ctx.createGain();
		const noiseBuffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
		const noiseData = noiseBuffer.getChannelData(0);
		const noiseSource = ctx.createBufferSource();
		const noiseFilter = ctx.createBiquadFilter();
		const noiseGain = ctx.createGain();

		for (let index = 0; index < noiseData.length; index += 1) {
			noiseData[index] = (Math.random() * 2 - 1) * (1 - index / noiseData.length) * 0.16;
		}

		filter.type = 'bandpass';
		filter.frequency.setValueAtTime(base * 1.38, start);
		filter.Q.setValueAtTime(0.75, start);

		master.gain.setValueAtTime(0.0001, start);
		master.gain.linearRampToValueAtTime(peak, start + 0.02);
		master.gain.linearRampToValueAtTime(peak * 0.62, start + duration * 0.5);
		master.gain.linearRampToValueAtTime(0.0001, end);

		oscA.type = 'sine';
		oscA.frequency.setValueAtTime(base, start);
		oscA.frequency.exponentialRampToValueAtTime(base * 0.91, end);

		oscB.type = 'sine';
		oscB.frequency.setValueAtTime(harmonic, start);
		oscB.frequency.exponentialRampToValueAtTime(harmonic * 0.93, end);

		gainA.gain.setValueAtTime(1, start);
		gainB.gain.setValueAtTime(0.1, start);

		noiseSource.buffer = noiseBuffer;
		noiseFilter.type = 'lowpass';
		noiseFilter.frequency.setValueAtTime(2400, start);
		noiseFilter.Q.setValueAtTime(0.5, start);

		noiseGain.gain.setValueAtTime(0.0001, start);
		noiseGain.gain.linearRampToValueAtTime(noisePeak, start + 0.022);
		noiseGain.gain.linearRampToValueAtTime(noisePeak * 0.55, start + duration * 0.45);
		noiseGain.gain.linearRampToValueAtTime(0.0001, end);

		oscA.connect(gainA);
		oscB.connect(gainB);
		gainA.connect(filter);
		gainB.connect(filter);
		filter.connect(master);
		master.connect(ctx.destination);

		noiseSource.connect(noiseFilter);
		noiseFilter.connect(noiseGain);
		noiseGain.connect(master);

		oscA.start(start);
		oscB.start(start);
		noiseSource.start(start);
		oscA.stop(end + 0.01);
		oscB.stop(end + 0.01);
		noiseSource.stop(end);
	});
}

function shuffle<T>(values: T[]) {
	const copy = [...values];

	for (let index = copy.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1));
		[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
	}

	return copy;
}

function randomizeWeddingSparkles(link: HTMLElement) {
	const sparkles = Array.from(link.querySelectorAll<HTMLElement>('.about-inline-link__sparkles span'));

	if (!sparkles.length) {
		return;
	}

	const colors = shuffle([
		{
			fill: 'var(--wed-ivory-node)',
			glow: 'color-mix(in srgb, var(--wed-ivory-node) 55%, white 45%)',
			border: '0.04em solid rgba(200, 161, 104, 0.42)',
			minSize: 0.34,
			maxSize: 0.48,
		},
		{
			fill: 'var(--wed-blush-node)',
			glow: 'color-mix(in srgb, var(--wed-blush-node) 70%, white 30%)',
			border: 'none',
			minSize: 0.28,
			maxSize: 0.42,
		},
		{
			fill: 'var(--wed-sage-node)',
			glow: 'color-mix(in srgb, var(--wed-sage-node) 70%, white 30%)',
			border: 'none',
			minSize: 0.3,
			maxSize: 0.44,
		},
		{
			fill: 'var(--wed-burgundy-node)',
			glow: 'color-mix(in srgb, var(--wed-burgundy-node) 72%, white 28%)',
			border: 'none',
			minSize: 0.3,
			maxSize: 0.46,
		},
		{
			fill: 'var(--wed-plum-node)',
			glow: 'color-mix(in srgb, var(--wed-plum-node) 72%, white 28%)',
			border: 'none',
			minSize: 0.28,
			maxSize: 0.43,
		},
	]);

	const baseAngles = shuffle([-150, -78, 16, 74, 146]);

	sparkles.forEach((sparkle, index) => {
		const angle = (baseAngles[index] + (Math.random() * 28 - 14)) * (Math.PI / 180);
		const radius = 0.92 + Math.random() * 0.58;
		const overshoot = radius * 0.82;
		const color = colors[index];
		const size = color.minSize + Math.random() * (color.maxSize - color.minSize);
		const glowSize = `${0.26 + size * 0.46}em`;

		sparkle.style.setProperty('--sparkle-mid-x', `${Math.cos(angle) * overshoot}em`);
		sparkle.style.setProperty('--sparkle-mid-y', `${Math.sin(angle) * overshoot}em`);
		sparkle.style.setProperty('--sparkle-end-x', `${Math.cos(angle) * radius}em`);
		sparkle.style.setProperty('--sparkle-end-y', `${Math.sin(angle) * radius}em`);
		sparkle.style.setProperty('--sparkle-fill', color.fill);
		sparkle.style.setProperty('--sparkle-glow', color.glow);
		sparkle.style.setProperty('--sparkle-glow-size', glowSize);
		sparkle.style.setProperty('--sparkle-border', color.border);
		sparkle.style.setProperty('--sparkle-size', `${size}em`);
	});
}

function syncThemeToggleLabels() {
	const nextLabel = getActiveTheme() === 'dark' ? 'Light mode' : 'Dark mode';

	document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((button) => {
		button.setAttribute('aria-label', nextLabel);
		button.setAttribute('aria-pressed', String(getActiveTheme() === 'dark'));

		const label = button.querySelector<HTMLElement>('.theme-toggle-label');
		if (label) {
			label.textContent = nextLabel;
		}
	});
}

function setTheme(nextTheme: ThemeName) {
	document.documentElement.dataset.theme = nextTheme;
	localStorage.setItem('theme', nextTheme);
	syncThemeToggleLabels();
}

function getIdentityTextElements() {
	return Array.from(
		document.querySelectorAll<HTMLElement>(
			'.identity-top .eyebrow, .identity-top .identity-name, .identity-top .identity-tagline',
		),
	);
}

function cacheIdentityText() {
	getIdentityTextElements().forEach((element) => {
		if (!element.dataset.fullText) {
			element.dataset.fullText = element.textContent ?? '';
		}
	});
}

function restoreIdentityText() {
	identityTypingToken += 1;
	cacheIdentityText();

	getIdentityTextElements().forEach((element) => {
		element.textContent = element.dataset.fullText ?? '';
	});
}

function prepareIdentityTyping() {
	identityTypingToken += 1;
	cacheIdentityText();

	getIdentityTextElements().forEach((element) => {
		element.textContent = '';
	});

	return identityTypingToken;
}

function startIdentityTyping(token: number) {
	const elements = getIdentityTextElements().map((element) => ({
		element,
		text: element.dataset.fullText ?? '',
		charDelay: element.classList.contains('identity-name') ? 42 : 22,
	}));

	if (!elements.length || prefersReducedMotion()) {
		restoreIdentityText();
		return;
	}

	let index = 0;

	const typeNext = () => {
		if (token !== identityTypingToken || index >= elements.length) {
			return;
		}

		const { element, text, charDelay } = elements[index];
		index += 1;

		let charIndex = 0;

		const typeChar = () => {
			if (token !== identityTypingToken) {
				return;
			}

			charIndex += 1;
			element.textContent = text.slice(0, charIndex);

			if (charIndex < text.length) {
				window.setTimeout(typeChar, charDelay);
				return;
			}

			window.setTimeout(typeNext, 90);
		};

		window.setTimeout(typeChar, 70);
	};

	typeNext();
}

function updateNavIndicator() {
	const nav = document.querySelector<HTMLElement>('.side-nav');
	const activeButton = document.querySelector<HTMLElement>('.side-nav-item.active');
	const indicator = document.querySelector<HTMLElement>('.side-nav-indicator');

	if (!nav || !activeButton || !indicator || nav.offsetParent === null) {
		return;
	}

	const y = activeButton.offsetTop + activeButton.offsetHeight / 2 - indicator.offsetHeight / 2;
	indicator.style.opacity = '1';
	indicator.style.transform = `translateY(${y}px)`;
}

function closeMobileNav() {
	const mobileNav = document.getElementById('mobile-nav');
	const mobileToggle = document.querySelector<HTMLElement>('.mobile-nav-toggle');

	if (!mobileNav || !mobileToggle) {
		return;
	}

	mobileNav.classList.remove('open');
	mobileNav.setAttribute('aria-hidden', 'true');
	mobileToggle.setAttribute('aria-expanded', 'false');
}

function setMobileNavOpen(isOpen: boolean) {
	const mobileNav = document.getElementById('mobile-nav');
	const mobileToggle = document.querySelector<HTMLElement>('.mobile-nav-toggle');

	if (!mobileNav || !mobileToggle) {
		return;
	}

	mobileNav.classList.toggle('open', isOpen);
	mobileNav.setAttribute('aria-hidden', String(!isOpen));
	mobileToggle.setAttribute('aria-expanded', String(isOpen));
}

function initGalleryReveal() {
	const gallerySection = document.querySelector<HTMLElement>('.content-section[data-section="gallery"]');
	const scrollContainer = document.querySelector<HTMLElement>('.gallery-scroll');

	if (!gallerySection || !scrollContainer) {
		return;
	}

	const items = Array.from(scrollContainer.querySelectorAll<HTMLElement>('.gallery-item'));

	if (prefersReducedMotion()) {
		galleryObserver?.disconnect();
		galleryObserver = null;
		items.forEach((item) => {
			item.classList.remove('reveal-hidden');
			item.classList.add('reveal-visible');
		});
		scrollContainer.dataset.revealReady = 'true';
		return;
	}

	if (!gallerySection.classList.contains('active') || scrollContainer.dataset.revealReady === 'true') {
		return;
	}

	galleryObserver?.disconnect();

	items.forEach((item, index) => {
		item.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 70}ms`);

		if (!item.classList.contains('reveal-visible')) {
			item.classList.add('reveal-hidden');
		}
	});

	galleryObserver = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (!entry.isIntersecting) {
					return;
				}

				entry.target.classList.remove('reveal-hidden');
				entry.target.classList.add('reveal-visible');
				galleryObserver?.unobserve(entry.target);
			});
		},
		{
			root: scrollContainer,
			threshold: 0.15,
			rootMargin: '0px 0px 0px -50px',
		},
	);

	items
		.filter((item) => !item.classList.contains('reveal-visible'))
		.forEach((item) => galleryObserver?.observe(item));

	scrollContainer.dataset.revealReady = 'true';
}

function initMouseGlow() {
	const layout = document.querySelector<HTMLElement>('.layout');

	if (!layout || layout.dataset.mouseGlowReady === 'true' || prefersReducedMotion()) {
		return;
	}

	if (!window.matchMedia(FINE_POINTER_QUERY).matches) {
		return;
	}

	layout.dataset.mouseGlowReady = 'true';

	let frameId = 0;

	window.addEventListener('mousemove', (event) => {
		cancelAnimationFrame(frameId);

		frameId = window.requestAnimationFrame(() => {
			layout.style.setProperty('--mouse-x', `${event.clientX}px`);
			layout.style.setProperty('--mouse-y', `${event.clientY}px`);
			layout.style.setProperty('--glow-opacity', '1');
		});
	});

	document.addEventListener('mouseleave', () => {
		layout.style.setProperty('--glow-opacity', '0');
	});

	window.addEventListener('blur', () => {
		layout.style.setProperty('--glow-opacity', '0');
	});
}

function activateTab(tab: string, animate = true) {
	const nextTab = isValidTab(tab) ? tab : DEFAULT_TAB;
	const shouldAnimate = animate && !prefersReducedMotion();
	const layout = document.querySelector<HTMLElement>('.layout');
	const currentTab = (layout?.dataset.activeTab as TabKey | undefined) ?? DEFAULT_TAB;
	const shouldTypeIdentity = currentTab === 'about' && nextTab !== 'about';

	if (shouldTypeIdentity) {
		prepareIdentityTyping();
	} else {
		restoreIdentityText();
	}

	if (layout) {
		layout.dataset.activeTab = nextTab;
	}

	document.querySelectorAll<HTMLElement>('.side-nav-item, .mobile-nav-item').forEach((button) => {
		const isActive = button.dataset.tab === nextTab;
		button.classList.toggle('active', isActive);
		button.setAttribute('aria-current', isActive ? 'page' : 'false');
	});

	document.querySelectorAll<HTMLElement>('.content-section').forEach((section) => {
		const isActive = section.dataset.section === nextTab;
		section.classList.toggle('active', isActive);
		section.setAttribute('aria-hidden', isActive ? 'false' : 'true');
		section.classList.remove('tab-entering');
	});

	const activeSection = document.querySelector<HTMLElement>(`.content-section[data-section="${nextTab}"]`);

	if (activeSection && shouldAnimate) {
		void activeSection.offsetWidth;
		activeSection.classList.add('tab-entering');
	}

	const panel = document.getElementById('content-panel');
	if (panel) {
		panel.scrollTop = 0;
	}

	history.replaceState(null, '', `#${nextTab}`);
	updateNavIndicator();

	if (nextTab === 'gallery') {
		initGalleryReveal();
	}

	if (shouldTypeIdentity) {
		window.setTimeout(() => startIdentityTyping(identityTypingToken), 120);
	}
}

function bindTabButtons() {
	document.querySelectorAll<HTMLElement>('[data-tab]').forEach((button) => {
		button.addEventListener('click', () => {
			activateTab(button.dataset.tab ?? DEFAULT_TAB);
			closeMobileNav();
		});
	});
}

function bindMobileNav() {
	const mobileToggle = document.querySelector<HTMLElement>('.mobile-nav-toggle');

	if (!mobileToggle) {
		return;
	}

	mobileToggle.addEventListener('click', () => {
		const mobileNav = document.getElementById('mobile-nav');
		const isOpen = mobileNav?.classList.contains('open') ?? false;
		setMobileNavOpen(!isOpen);
	});

	window.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeMobileNav();
		}
	});
}

function bindThemeButtons() {
	document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((button) => {
		button.addEventListener('click', () => {
			setTheme(getActiveTheme() === 'dark' ? 'light' : 'dark');
		});
	});
}

function bindSoundButtons() {
	document.querySelectorAll<HTMLElement>('[data-sound-toggle]').forEach((button) => {
		button.addEventListener('click', () => {
			setSoundEnabled(!soundEnabled);
		});
	});
}

function bindPulseHaloSound() {
	if (!window.matchMedia(FINE_POINTER_QUERY).matches) {
		return;
	}

	document.querySelectorAll<HTMLElement>('.about-inline-link--pulse').forEach((link) => {
		link.addEventListener('mouseenter', () => {
			if (prefersReducedMotion()) {
				return;
			}

			const existingTimeout = pulseHoverTimeouts.get(link);
			if (existingTimeout) {
				window.clearTimeout(existingTimeout);
			}

			const timeoutId = window.setTimeout(() => {
				playPulseHaloTone();
				pulseHoverTimeouts.delete(link);
			}, PULSE_HALO_SOUND_DELAY_MS);

			pulseHoverTimeouts.set(link, timeoutId);
		});

		link.addEventListener('mouseleave', () => {
			const existingTimeout = pulseHoverTimeouts.get(link);
			if (existingTimeout) {
				window.clearTimeout(existingTimeout);
				pulseHoverTimeouts.delete(link);
			}
		});
	});
}

function bindFragranceBloomSound() {
	if (!window.matchMedia(FINE_POINTER_QUERY).matches) {
		return;
	}

	document.querySelectorAll<HTMLElement>('.about-inline-link--fragrance').forEach((link) => {
		link.addEventListener('mouseenter', () => {
			if (prefersReducedMotion()) {
				return;
			}

			const existingTimeout = pulseHoverTimeouts.get(link);
			if (existingTimeout) {
				window.clearTimeout(existingTimeout);
			}

			const timeoutId = window.setTimeout(() => {
				playFragranceBloomSpritz();
				pulseHoverTimeouts.delete(link);
			}, FRAGRANCE_BLOOM_SOUND_DELAY_MS);

			pulseHoverTimeouts.set(link, timeoutId);
		});

		link.addEventListener('mouseleave', () => {
			const existingTimeout = pulseHoverTimeouts.get(link);
			if (existingTimeout) {
				window.clearTimeout(existingTimeout);
				pulseHoverTimeouts.delete(link);
			}
		});
	});
}

function bindWeddingSparkleEffect() {
	if (!window.matchMedia(FINE_POINTER_QUERY).matches) {
		return;
	}

	document.querySelectorAll<HTMLElement>('.about-inline-link--wedding').forEach((link) => {
		link.addEventListener('mouseenter', () => {
			if (prefersReducedMotion()) {
				return;
			}

			randomizeWeddingSparkles(link);

			const existingTimeout = pulseHoverTimeouts.get(link);
			if (existingTimeout) {
				window.clearTimeout(existingTimeout);
			}

			const timeoutId = window.setTimeout(() => {
				playWeddingBubbleCluster();
				pulseHoverTimeouts.delete(link);
			}, WEDDING_SPARKLE_SOUND_DELAY_MS);

			pulseHoverTimeouts.set(link, timeoutId);
		});

		link.addEventListener('mouseleave', () => {
			const existingTimeout = pulseHoverTimeouts.get(link);
			if (existingTimeout) {
				window.clearTimeout(existingTimeout);
				pulseHoverTimeouts.delete(link);
			}
		});
	});
}

function setInlineHoverFocus(link: HTMLElement | null) {
	if (activeInlineHoverLink && activeInlineHoverLink !== link) {
		activeInlineHoverLink.classList.remove('is-inline-hover-active');
	}

	activeInlineHoverLink = link;

	if (link) {
		document.body.dataset.inlineHover = 'true';
		link.classList.add('is-inline-hover-active');
		return;
	}

	delete document.body.dataset.inlineHover;
}

function bindInlineHoverFocus() {
	document.querySelectorAll<HTMLElement>('.about-inline-link').forEach((link) => {
		link.addEventListener('mouseenter', () => {
			setInlineHoverFocus(link);
		});

		link.addEventListener('mouseleave', (event) => {
			const relatedTarget = event.relatedTarget;
			const nextLink =
				relatedTarget instanceof HTMLElement ? relatedTarget.closest<HTMLElement>('.about-inline-link') : null;

			setInlineHoverFocus(nextLink);
		});
	});
}

export default function initPortfolioInteractions() {
	if (document.body.dataset.portfolioInteractionsReady === 'true') {
		return;
	}

	document.body.dataset.portfolioInteractionsReady = 'true';
	soundEnabled = localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';

	cacheIdentityText();
	bindTabButtons();
	bindMobileNav();
	bindThemeButtons();
	bindSoundButtons();
	bindInlineHoverFocus();
	bindPulseHaloSound();
	bindFragranceBloomSound();
	bindWeddingSparkleEffect();
	syncThemeToggleLabels();
	syncSoundToggleLabels();
	initMouseGlow();

	const initialHash = window.location.hash.slice(1);
	const initialTab = isValidTab(initialHash) ? initialHash : DEFAULT_TAB;
	activateTab(initialTab, initialTab !== DEFAULT_TAB);

	window.addEventListener('pointerdown', unlockAudioContext, { passive: true });
	window.addEventListener('keydown', unlockAudioContext);
	window.addEventListener('resize', updateNavIndicator);
	window.addEventListener('load', updateNavIndicator);
}
