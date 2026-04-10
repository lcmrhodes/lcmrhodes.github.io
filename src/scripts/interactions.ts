const TABS = ['about', 'experience', 'projects'] as const;
const DEFAULT_TAB = 'about';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FINE_POINTER_QUERY = '(pointer: fine)';
const PULSE_HALO_SOUND_DELAY_MS = 320;
const FRAGRANCE_BLOOM_SOUND_DELAY_MS = 320;
const WEDDING_SPARKLE_SOUND_DELAY_MS = 130;
const SOUND_ENABLED_KEY = 'sound-enabled';
const WEATHER_KEY = 'weather';

type WeatherMode = 'off' | 'rain' | 'clouds' | 'snow' | 'overcast';

type TabKey = (typeof TABS)[number];
type ThemeName = 'light' | 'dark';

let galleryObserver: IntersectionObserver | null = null;
let identityTypingToken = 0;
let audioContext: AudioContext | null = null;
const pulseHoverTimeouts = new WeakMap<HTMLElement, number>();
const hoveredButtons = new WeakSet<HTMLElement>();
let soundEnabled = true;
let activeInlineHoverLink: HTMLElement | null = null;
let weatherMode: WeatherMode = 'off';
let weatherRafId: number | null = null;

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

function playButtonHoverTone() {
	const ctx = getAudioContext();

	if (!ctx || !soundEnabled || ctx.state === 'suspended') {
		return;
	}

	const now = ctx.currentTime;
	const master = ctx.createGain();
	const filter = ctx.createBiquadFilter();
	const oscA = ctx.createOscillator();
	const oscB = ctx.createOscillator();
	const gainA = ctx.createGain();
	const gainB = ctx.createGain();

	filter.type = 'lowpass';
	filter.frequency.setValueAtTime(1800, now);
	filter.Q.setValueAtTime(0.8, now);

	master.gain.setValueAtTime(0.0001, now);
	master.gain.exponentialRampToValueAtTime(0.0042, now + 0.012);
	master.gain.exponentialRampToValueAtTime(0.0016, now + 0.05);
	master.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

	oscA.type = 'sine';
	oscA.frequency.setValueAtTime(940, now);
	oscA.frequency.linearRampToValueAtTime(840, now + 0.09);

	oscB.type = 'triangle';
	oscB.frequency.setValueAtTime(1410, now);
	oscB.frequency.linearRampToValueAtTime(1260, now + 0.09);

	gainA.gain.setValueAtTime(1, now);
	gainB.gain.setValueAtTime(0.1, now);

	oscA.connect(gainA);
	oscB.connect(gainB);
	gainA.connect(filter);
	gainB.connect(filter);
	filter.connect(master);
	master.connect(ctx.destination);

	oscA.start(now);
	oscB.start(now);
	oscA.stop(now + 0.1);
	oscB.stop(now + 0.1);
}

function playButtonClickTone() {
	const ctx = getAudioContext();

	if (!ctx || !soundEnabled || ctx.state === 'suspended') {
		return;
	}

	const now = ctx.currentTime;
	const master = ctx.createGain();
	const lowpass = ctx.createBiquadFilter();
	const oscA = ctx.createOscillator();
	const oscB = ctx.createOscillator();
	const gainA = ctx.createGain();
	const gainB = ctx.createGain();

	lowpass.type = 'lowpass';
	lowpass.frequency.setValueAtTime(1450, now);
	lowpass.Q.setValueAtTime(0.9, now);

	master.gain.setValueAtTime(0.0001, now);
	master.gain.exponentialRampToValueAtTime(0.0085, now + 0.01);
	master.gain.exponentialRampToValueAtTime(0.0036, now + 0.055);
	master.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

	oscA.type = 'triangle';
	oscA.frequency.setValueAtTime(510, now);
	oscA.frequency.exponentialRampToValueAtTime(360, now + 0.14);

	oscB.type = 'sine';
	oscB.frequency.setValueAtTime(760, now);
	oscB.frequency.exponentialRampToValueAtTime(560, now + 0.12);

	gainA.gain.setValueAtTime(1, now);
	gainB.gain.setValueAtTime(0.18, now);

	oscA.connect(gainA);
	oscB.connect(gainB);
	gainA.connect(lowpass);
	gainB.connect(lowpass);
	lowpass.connect(master);
	master.connect(ctx.destination);

	oscA.start(now);
	oscB.start(now);
	oscA.stop(now + 0.15);
	oscB.stop(now + 0.15);
}

function playTabClickTone() {
	const ctx = getAudioContext();

	if (!ctx || !soundEnabled || ctx.state === 'suspended') {
		return;
	}

	const now = ctx.currentTime;
	const master = ctx.createGain();
	const bandpass = ctx.createBiquadFilter();
	const lowpass = ctx.createBiquadFilter();
	const oscA = ctx.createOscillator();
	const oscB = ctx.createOscillator();
	const gainA = ctx.createGain();
	const gainB = ctx.createGain();

	bandpass.type = 'bandpass';
	bandpass.frequency.setValueAtTime(540, now);
	bandpass.Q.setValueAtTime(0.75, now);

	lowpass.type = 'lowpass';
	lowpass.frequency.setValueAtTime(1180, now);
	lowpass.Q.setValueAtTime(0.25, now);

	master.gain.setValueAtTime(0.0001, now);
	master.gain.exponentialRampToValueAtTime(0.015, now + 0.006);
	master.gain.exponentialRampToValueAtTime(0.0054, now + 0.036);
	master.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

	oscA.type = 'triangle';
	oscA.frequency.setValueAtTime(360, now);
	oscA.frequency.exponentialRampToValueAtTime(292, now + 0.09);

	oscB.type = 'sine';
	oscB.frequency.setValueAtTime(510, now);
	oscB.frequency.exponentialRampToValueAtTime(410, now + 0.082);

	gainA.gain.setValueAtTime(1, now);
	gainB.gain.setValueAtTime(0.16, now);

	oscA.connect(gainA);
	oscB.connect(gainB);
	gainA.connect(bandpass);
	gainB.connect(bandpass);
	bandpass.connect(lowpass);
	lowpass.connect(master);
	master.connect(ctx.destination);

	oscA.start(now);
	oscB.start(now);
	oscA.stop(now + 0.095);
	oscB.stop(now + 0.095);
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
	});
}

function setTheme(nextTheme: ThemeName) {
	const root = document.documentElement;

	if (root.dataset.theme === nextTheme) {
		return;
	}

	root.classList.add('theme-switching');
	root.dataset.theme = nextTheme;
	localStorage.setItem('theme', nextTheme);
	syncThemeToggleLabels();
	// Refresh cloud colors when theme changes
	if (weatherMode === 'clouds') createClouds('clouds');
	else if (weatherMode === 'overcast') createClouds('overcast');

	window.setTimeout(() => {
		root.classList.remove('theme-switching');
	}, 380);
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
	indicator.style.top = `${y}px`;
	indicator.classList.remove('is-bouncing');
	void indicator.offsetWidth;
	indicator.classList.add('is-bouncing');
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

function bindButtonUiSounds() {
	document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
		const isTabButton = button.matches('[data-tab]');

		if (window.matchMedia(FINE_POINTER_QUERY).matches) {
			button.addEventListener('pointerenter', () => {
				if (prefersReducedMotion() || button.disabled || hoveredButtons.has(button) || isTabButton) {
					return;
				}

				hoveredButtons.add(button);
				playButtonHoverTone();
			});

			button.addEventListener('pointerleave', () => {
				hoveredButtons.delete(button);
			});
		}

		button.addEventListener('click', () => {
			if (prefersReducedMotion() || button.disabled) {
				return;
			}

			if (isTabButton) {
				playTabClickTone();
				return;
			}

			playButtonClickTone();
		});
	});
}

function bindIconLinkUiSounds() {
	document.querySelectorAll<HTMLAnchorElement>('.identity-link-icon').forEach((link) => {
		if (window.matchMedia(FINE_POINTER_QUERY).matches) {
			link.addEventListener('pointerenter', () => {
				if (prefersReducedMotion() || hoveredButtons.has(link)) {
					return;
				}

				hoveredButtons.add(link);
				playButtonHoverTone();
			});

			link.addEventListener('pointerleave', () => {
				hoveredButtons.delete(link);
			});
		}

		link.addEventListener('pointerdown', () => {
			if (prefersReducedMotion()) {
				return;
			}

			playButtonClickTone();
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

// ── Weather ──────────────────────────────────────────────────

interface RainParticle {
	x: number;
	y: number;
	speed: number;
	length: number;
	opacity: number;
}

interface SnowParticle {
	x: number;
	y: number;
	speed: number;
	radius: number;
	drift: number;
	driftOffset: number;
	opacity: number;
}

function getRainColor(): string {
	return getActiveTheme() === 'dark'
		? 'rgba(180, 200, 220, 0.07)'
		: 'rgba(55, 75, 105, 0.16)';
}

function getSnowColor(): string {
	return getActiveTheme() === 'dark'
		? 'rgba(220, 230, 240, 0.12)'
		: 'rgba(120, 145, 175, 0.32)';
}

function createRainParticles(count: number, w: number, h: number): RainParticle[] {
	return Array.from({ length: count }, () => ({
		x: Math.random() * w,
		y: Math.random() * h,
		speed: 3 + Math.random() * 3,
		length: 10 + Math.random() * 12,
		opacity: 0.4 + Math.random() * 0.6,
	}));
}

function createSnowParticles(count: number, w: number, h: number): SnowParticle[] {
	return Array.from({ length: count }, () => ({
		x: Math.random() * w,
		y: Math.random() * h,
		speed: 0.4 + Math.random() * 1.1,
		radius: 1 + Math.random() * 2,
		drift: 0.3 + Math.random() * 0.5,
		driftOffset: Math.random() * Math.PI * 2,
		opacity: 0.4 + Math.random() * 0.6,
	}));
}

function stopWeatherCanvas() {
	if (weatherRafId !== null) {
		cancelAnimationFrame(weatherRafId);
		weatherRafId = null;
	}
	const canvas = document.getElementById('weather-canvas') as HTMLCanvasElement | null;
	if (canvas) {
		const ctx = canvas.getContext('2d');
		ctx?.clearRect(0, 0, canvas.width, canvas.height);
	}
}

function startRain() {
	if (prefersReducedMotion()) return;

	const canvas = document.getElementById('weather-canvas') as HTMLCanvasElement | null;
	if (!canvas) return;

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	let particles = createRainParticles(100, canvas.width, canvas.height);
	const angle = 0.2; // slight lean

	function frame() {
		if (weatherMode !== 'rain') return;
		canvas!.width = window.innerWidth;
		canvas!.height = window.innerHeight;
		ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

		const color = getRainColor();
		ctx!.strokeStyle = color;
		ctx!.lineWidth = 1;

		// ensure particle count matches canvas size
		while (particles.length < 100) {
			particles.push({
				x: Math.random() * canvas!.width,
				y: -20,
				speed: 3 + Math.random() * 3,
				length: 10 + Math.random() * 12,
				opacity: 0.4 + Math.random() * 0.6,
			});
		}

		particles.forEach((p) => {
			ctx!.beginPath();
			ctx!.moveTo(p.x, p.y);
			ctx!.lineTo(p.x + Math.sin(angle) * p.length, p.y + Math.cos(angle) * p.length);
			ctx!.stroke();

			p.y += p.speed;
			p.x += Math.sin(angle) * p.speed * 0.3;

			if (p.y > canvas!.height + 20) {
				p.y = -20;
				p.x = Math.random() * canvas!.width;
			}
		});

		weatherRafId = requestAnimationFrame(frame);
	}

	weatherRafId = requestAnimationFrame(frame);
}

function startSnow() {
	if (prefersReducedMotion()) return;

	const canvas = document.getElementById('weather-canvas') as HTMLCanvasElement | null;
	if (!canvas) return;

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	const ctx = canvas.getContext('2d');
	if (!ctx) return;

	const particles = createSnowParticles(50, canvas.width, canvas.height);
	let tick = 0;

	function frame() {
		if (weatherMode !== 'snow') return;
		canvas!.width = window.innerWidth;
		canvas!.height = window.innerHeight;
		ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

		const color = getSnowColor();
		ctx!.fillStyle = color;

		tick += 0.008;

		particles.forEach((p) => {
			ctx!.beginPath();
			ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
			ctx!.fill();

			p.y += p.speed;
			p.x += Math.sin(tick + p.driftOffset) * p.drift;

			if (p.y > canvas!.height + 10) {
				p.y = -10;
				p.x = Math.random() * canvas!.width;
			}
			if (p.x > canvas!.width + 10) p.x = -10;
			if (p.x < -10) p.x = canvas!.width + 10;
		});

		weatherRafId = requestAnimationFrame(frame);
	}

	weatherRafId = requestAnimationFrame(frame);
}

function clearClouds() {
	const container = document.getElementById('weather-clouds');
	if (container) container.innerHTML = '';
}

function createClouds(mode: 'clouds' | 'overcast') {
	const container = document.getElementById('weather-clouds');
	if (!container) return;
	container.innerHTML = '';

	const isDark = getActiveTheme() === 'dark';
	const isClouds = mode === 'clouds';

	const configs = isClouds
		? [
			{ w: 320, h: 80, top: '6%', startX: '-380px', endX: '110vw', dur: 80, delay: 0, opacity: isDark ? 0.08 : 0.30 },
			{ w: 240, h: 60, top: '15%', startX: '-290px', endX: '110vw', dur: 70, delay: -25000, opacity: isDark ? 0.06 : 0.24 },
			{ w: 400, h: 90, top: '2%', startX: '-460px', endX: '110vw', dur: 90, delay: -50000, opacity: isDark ? 0.05 : 0.20 },
			{ w: 200, h: 50, top: '22%', startX: '-250px', endX: '110vw', dur: 75, delay: -38000, opacity: isDark ? 0.07 : 0.26 },
		]
		: [
			{ w: 480, h: 110, top: '3%', startX: '-540px', endX: '110vw', dur: 60, delay: 0, opacity: isDark ? 0.1 : 0.28 },
			{ w: 360, h: 90, top: '10%', startX: '-420px', endX: '110vw', dur: 55, delay: -20000, opacity: isDark ? 0.09 : 0.26 },
			{ w: 520, h: 120, top: '0%', startX: '-580px', endX: '110vw', dur: 65, delay: -40000, opacity: isDark ? 0.08 : 0.24 },
			{ w: 300, h: 80, top: '18%', startX: '-360px', endX: '110vw', dur: 50, delay: -10000, opacity: isDark ? 0.07 : 0.22 },
			{ w: 440, h: 100, top: '7%', startX: '-500px', endX: '110vw', dur: 58, delay: -30000, opacity: isDark ? 0.09 : 0.26 },
		];

	configs.forEach((c) => {
		const cloud = document.createElement('div');
		cloud.className = 'weather-cloud';

		const baseColor = isClouds
			? (isDark ? '200, 215, 230' : '215, 228, 245')
			: (isDark ? '110, 118, 128' : '148, 156, 168');

		cloud.style.cssText = `
			width: ${c.w}px;
			height: ${c.h}px;
			top: ${c.top};
			background: radial-gradient(ellipse 60% 50% at 40% 50%, rgba(${baseColor}, ${c.opacity}) 0%, transparent 100%);
			--cloud-start-x: ${c.startX};
			--cloud-end-x: ${c.endX};
			animation-duration: ${c.dur}s;
			animation-delay: ${c.delay}ms;
		`;

		container.appendChild(cloud);
	});
}

function syncWeatherToggleLabels() {
	const labels: Record<WeatherMode, string> = {
		off: 'Weather: off',
		rain: 'Weather: rain',
		clouds: 'Weather: clouds',
		snow: 'Weather: snow',
		overcast: 'Weather: overcast',
	};

	document.querySelectorAll<HTMLElement>('[data-weather-toggle]').forEach((btn) => {
		btn.setAttribute('aria-label', labels[weatherMode]);
	});
}

function setWeather(mode: WeatherMode) {
	weatherMode = mode;
	document.documentElement.dataset.weather = mode;
	localStorage.setItem(WEATHER_KEY, mode);

	stopWeatherCanvas();
	clearClouds();

	if (mode === 'rain') startRain();
	else if (mode === 'snow') startSnow();
	else if (mode === 'clouds') createClouds('clouds');
	else if (mode === 'overcast') createClouds('overcast');

	syncWeatherToggleLabels();
}

function bindWeatherButtons() {
	const cycle: WeatherMode[] = ['off', 'rain', 'clouds', 'snow', 'overcast'];

	document.querySelectorAll<HTMLElement>('[data-weather-toggle]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const current = cycle.indexOf(weatherMode);
			const next = cycle[(current + 1) % cycle.length];
			setWeather(next);
		});
	});
}

function closePillboxOverflow() {
	document.querySelectorAll<HTMLElement>('.pillbox-overflow').forEach((container) => {
		container.classList.remove('is-open');

		const toggle = container.querySelector<HTMLElement>('[data-pillbox-overflow-toggle]');
		const menu = container.querySelector<HTMLElement>('[data-pillbox-overflow-menu]');

		toggle?.setAttribute('aria-expanded', 'false');
		menu?.setAttribute('aria-hidden', 'true');
	});
}

function bindPillboxOverflow() {
	const containers = Array.from(document.querySelectorAll<HTMLElement>('.pillbox-overflow'));

	if (!containers.length) {
		return;
	}

	containers.forEach((container) => {
		const toggle = container.querySelector<HTMLElement>('[data-pillbox-overflow-toggle]');
		const menu = container.querySelector<HTMLElement>('[data-pillbox-overflow-menu]');

		if (!toggle || !menu) {
			return;
		}

		toggle.addEventListener('click', (event) => {
			event.stopPropagation();
			const shouldOpen = !container.classList.contains('is-open');
			closePillboxOverflow();
			container.classList.toggle('is-open', shouldOpen);
			toggle.setAttribute('aria-expanded', String(shouldOpen));
			menu.setAttribute('aria-hidden', String(!shouldOpen));
		});

		menu.addEventListener('click', (event) => {
			const target = event.target;

			if (target instanceof HTMLElement && target.closest('button, a')) {
				window.setTimeout(closePillboxOverflow, 0);
			}
		});
	});

	document.addEventListener('pointerdown', (event) => {
		const target = event.target;

		if (!(target instanceof Node)) {
			return;
		}

		if (containers.some((container) => container.contains(target))) {
			return;
		}

		closePillboxOverflow();
	});

	window.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closePillboxOverflow();
		}
	});

	window.addEventListener('resize', closePillboxOverflow);
}

function initWeather() {
	const saved = localStorage.getItem(WEATHER_KEY) as WeatherMode | null;
	const valid: WeatherMode[] = ['off', 'rain', 'clouds', 'snow', 'overcast'];
	const initial = saved && valid.includes(saved) ? saved : 'off';
	weatherMode = initial;

	if (initial !== 'off') {
		if (initial === 'rain') startRain();
		else if (initial === 'snow') startSnow();
		else if (initial === 'clouds') createClouds('clouds');
		else if (initial === 'overcast') createClouds('overcast');
	}

	syncWeatherToggleLabels();
}

// ── Experience section floating card ─────────────────────────

function initExperienceHover() {
	if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

	const columns = document.querySelector<HTMLElement>('.experience-columns');
	if (!columns) return;

	// Single floating card anchored to the columns container
	const floatCard = document.createElement('div');
	floatCard.className = 'experience-float-card';
	floatCard.setAttribute('aria-hidden', 'true');
	columns.appendChild(floatCard);

	// ── Hide with a short delay so the mouse can travel to the card ──
	let hideTimer: number | null = null;

	function scheduleHide() {
		if (hideTimer !== null) return;
		hideTimer = window.setTimeout(() => {
			hideTimer = null;
			setDimmed(null);
			floatCard.classList.remove('is-active');
		}, 120);
	}

	function cancelHide() {
		if (hideTimer !== null) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
	}

	// Keep card open while mouse is over it
	floatCard.addEventListener('mouseenter', cancelHide);
	floatCard.addEventListener('mouseleave', scheduleHide);

	function positionCard(item: HTMLElement, isProf: boolean) {
		const imgs = item.querySelectorAll<HTMLImageElement>('.experience-logo-img');
		const logo = Array.from(imgs).find((img) => img.offsetWidth > 0);
		if (!logo) return;

		const colRect = columns!.getBoundingClientRect();
		const logoRect = logo.getBoundingClientRect();
		const GAP = 12;
		// Minimum card width — matches CSS clamp lower bound
		const MIN_CARD_W = 200;

		const source = item.querySelector<HTMLElement>('.experience-logo-hover');
		if (source) floatCard.innerHTML = source.innerHTML;

		// Preferred direction: professional → right, education → left.
		// Fall back to the other side if the preferred side lacks space
		// (e.g. single-column layout where education logos are left-aligned).
		const spaceRight = window.innerWidth - logoRect.right - GAP;
		const spaceLeft = logoRect.left - GAP;
		const preferRight = isProf;
		const useRight = preferRight ? spaceRight >= MIN_CARD_W : spaceLeft < MIN_CARD_W;

		floatCard.dataset.col = useRight ? 'professional' : 'education';

		if (useRight) {
			floatCard.style.left = `${logoRect.right - colRect.left + GAP}px`;
			floatCard.style.right = 'auto';
		} else {
			floatCard.style.right = `${colRect.right - logoRect.left + GAP}px`;
			floatCard.style.left = 'auto';
		}

		// Place card at logo's top initially; rAF centres it vertically
		floatCard.style.top = `${logoRect.top - colRect.top}px`;
		floatCard.classList.add('is-active');

		requestAnimationFrame(() => {
			const cardH = floatCard.offsetHeight;
			const centeredTop = logoRect.top - colRect.top + logoRect.height / 2 - cardH / 2;
			const maxTop = columns!.offsetHeight - cardH - 8;
			floatCard.style.top = `${Math.max(0, Math.min(maxTop, centeredTop))}px`;
		});
	}

	const items = Array.from(columns.querySelectorAll<HTMLElement>('.experience-logo-item'));

	function setDimmed(activeItem: HTMLElement | null) {
		items.forEach((it) => {
			it.classList.toggle('is-dimmed', activeItem !== null && it !== activeItem);
		});
	}

	items.forEach((item) => {
		const isProf = item.closest('.experience-col--professional') !== null;

		item.addEventListener('mouseenter', () => {
			cancelHide();
			setDimmed(item);
			positionCard(item, isProf);
		});

		item.addEventListener('mouseleave', scheduleHide);

		item.addEventListener('focusin', () => {
			cancelHide();
			setDimmed(item);
			positionCard(item, isProf);
		});

		item.addEventListener('focusout', () => {
			setDimmed(null);
			floatCard.classList.remove('is-active');
		});
	});
}

export default function initPortfolioInteractions() {
	if (document.body.dataset.portfolioInteractionsReady === 'true') {
		return;
	}

	document.body.dataset.portfolioInteractionsReady = 'true';

	// Enable smooth palette transitions now that the initial theme is already set.
	// Must come after the inline script in Layout.astro has run to prevent FOUC.
	document.documentElement.classList.add('theme-ready');

	soundEnabled = localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';

	cacheIdentityText();
	bindTabButtons();
	bindMobileNav();
	bindThemeButtons();
	bindSoundButtons();
	bindButtonUiSounds();
	bindIconLinkUiSounds();
	bindWeatherButtons();
	bindPillboxOverflow();
	bindInlineHoverFocus();
	initExperienceHover();
	bindPulseHaloSound();
	bindFragranceBloomSound();
	bindWeddingSparkleEffect();
	syncThemeToggleLabels();
	syncSoundToggleLabels();
	initMouseGlow();
	initWeather();

	const initialHash = window.location.hash.slice(1);
	const initialTab = isValidTab(initialHash) ? initialHash : DEFAULT_TAB;
	activateTab(initialTab, initialTab !== DEFAULT_TAB);

	window.addEventListener('pointerdown', unlockAudioContext, { passive: true });
	window.addEventListener('keydown', unlockAudioContext);
	window.addEventListener('resize', updateNavIndicator);
	window.addEventListener('load', updateNavIndicator);
}
