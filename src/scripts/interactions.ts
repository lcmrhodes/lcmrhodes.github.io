const TABS = ['about', 'experience', 'projects'] as const;
const DEFAULT_TAB = 'about';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FINE_POINTER_QUERY = '(pointer: fine)';
const PULSE_HALO_SOUND_DELAY_MS = 320;
const FRAGRANCE_BLOOM_SOUND_DELAY_MS = 320;
const WEDDING_SPARKLE_SOUND_DELAY_MS = 130;
const PROJECT_CARD_HOVER_SOUND_INTERVAL_MS = 220;
const SOUND_ENABLED_KEY = 'sound-enabled';
const THEME_KEY = 'theme';
const THEME_OVERRIDE_KEY = 'portfolio-theme-override';
const LEGACY_WEATHER_KEY = 'weather';
const LEGACY_WEATHER_OVERRIDE_KEY = 'portfolio-weather-override';
const AUTO_ENVIRONMENT_CACHE_KEY = 'portfolio-auto-environment';
const AUTO_GEO_CACHE_KEY = 'portfolio-auto-geo';
const ABOUT_HERO_TYPED_KEY = 'about-hero-typed';
const IDENTITY_TYPED_KEY = 'identity-typed';
const ABOUT_HERO_LINE_PAUSE_MS = 420;
const ABOUT_HERO_CHUNK_PAUSE_MS = 220;
const ABOUT_HERO_HEADING_SPLIT_PAUSE_MS = 140;
const AUTO_ENVIRONMENT_CACHE_MS = 30 * 60 * 1000;
const AUTO_GEO_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

type WeatherMode = 'off' | 'sunny' | 'rain' | 'clouds' | 'snow' | 'overcast';

const WEATHER_HOVER_COPY: Record<WeatherMode, string> = {
	off: "Did you know... I've built a weather feature into this page! Navigate to the control panel to try it.",
	sunny: 'Looks sunny in {location} right now!',
	rain: 'Looks a little rainy in {location} right now...',
	clouds: 'Looks cloudy in {location} right now...',
	snow: 'Looks snowy in {location} right now!',
	overcast: 'Looks a bit overcast in {location} right now...',
};

const WEATHER_HOVER_MANUAL_ADJECTIVE: Record<WeatherMode, string> = {
	off: 'calm',
	sunny: 'sunny',
	rain: 'rainy',
	clouds: 'cloudy',
	snow: 'snowy',
	overcast: 'overcast',
};

type TabKey = (typeof TABS)[number];
type ThemeName = 'light' | 'dark';

type GeoLocationResult = {
	lat: number;
	lon: number;
	src: string;
	city?: string;
	savedAt: number;
};

type AutoEnvironment = {
	theme: ThemeName;
	weather: WeatherMode;
	code?: number | null;
	expires: number;
	location?: {
		src: string;
		city?: string;
	};
	updatedAt?: number;
};

type EnvironmentDebugSnapshot = {
	activeTheme: ThemeName;
	activeWeather: WeatherMode;
	manualThemeOverride: ThemeName | null;
	manualWeatherOverride: WeatherMode | null;
	autoEnvironment: AutoEnvironment | null;
	geo: GeoLocationResult | null;
	localHourTheme: ThemeName;
};

declare global {
	interface Window {
		portfolioEnvironmentDebug?: () => EnvironmentDebugSnapshot;
		portfolioEnvironmentRefresh?: () => Promise<void>;
	}
}

let aboutTypingToken = 0;
let identityTypingToken = 0;
let audioContext: AudioContext | null = null;
const pulseHoverTimeouts = new WeakMap<HTMLElement, number>();
const hoveredButtons = new WeakSet<HTMLElement>();
let lastProjectCardHoverToneAt = 0;
let soundEnabled = true;
let activeInlineHoverLink: HTMLElement | null = null;
let inlineFloatingPopout: HTMLElement | null = null;
let manualWeatherOverride: WeatherMode | null = null;
let weatherMode: WeatherMode = 'off';
let weatherRafId: number | null = null;
const aboutHeroTextCache = new WeakMap<Text, string>();

function prefersReducedMotion() {
	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function isValidTab(tab: string): tab is TabKey {
	return TABS.includes(tab as TabKey);
}

function getActiveTheme(): ThemeName {
	return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function isValidTheme(value: string | null): value is ThemeName {
	return value === 'light' || value === 'dark';
}

function isValidWeather(value: string | null): value is WeatherMode {
	return value === 'off' || value === 'sunny' || value === 'rain' || value === 'clouds' || value === 'snow' || value === 'overcast';
}

function getStoredValue(key: string) {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function setStoredValue(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Storage can be unavailable in private browsing or embedded previews.
	}
}

function removeStoredValue(key: string) {
	try {
		localStorage.removeItem(key);
	} catch {
		// Storage can be unavailable in private browsing or embedded previews.
	}
}

function getManualThemeOverride() {
	const saved = getStoredValue(THEME_OVERRIDE_KEY);
	return isValidTheme(saved) ? saved : null;
}

function getManualWeatherOverride() {
	return manualWeatherOverride;
}

function clearStoredWeatherOverride() {
	removeStoredValue(LEGACY_WEATHER_OVERRIDE_KEY);
	removeStoredValue(LEGACY_WEATHER_KEY);
}

function getBrowserTimeTheme(): ThemeName {
	const hour = new Date().getHours();
	return hour >= 7 && hour < 19 ? 'light' : 'dark';
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
	setStoredValue(SOUND_ENABLED_KEY, String(nextValue));
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
	filter.frequency.setValueAtTime(1320, now);
	filter.Q.setValueAtTime(0.42, now);

	master.gain.setValueAtTime(0.0001, now);
	master.gain.linearRampToValueAtTime(0.0024, now + 0.026);
	master.gain.exponentialRampToValueAtTime(0.0012, now + 0.076);
	master.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

	oscA.type = 'sine';
	oscA.frequency.setValueAtTime(760, now);
	oscA.frequency.linearRampToValueAtTime(710, now + 0.14);

	oscB.type = 'sine';
	oscB.frequency.setValueAtTime(1140, now);
	oscB.frequency.linearRampToValueAtTime(1030, now + 0.14);

	gainA.gain.setValueAtTime(1, now);
	gainB.gain.setValueAtTime(0.06, now);

	oscA.connect(gainA);
	oscB.connect(gainB);
	gainA.connect(filter);
	gainB.connect(filter);
	filter.connect(master);
	master.connect(ctx.destination);

	oscA.start(now);
	oscB.start(now);
	oscA.stop(now + 0.15);
	oscB.stop(now + 0.15);
}

function playProjectCardHoverTone() {
	const ctx = getAudioContext();

	if (!ctx || !soundEnabled || ctx.state === 'suspended') {
		return;
	}

	const elapsed = window.performance.now() - lastProjectCardHoverToneAt;
	if (elapsed < PROJECT_CARD_HOVER_SOUND_INTERVAL_MS) {
		return;
	}
	lastProjectCardHoverToneAt = window.performance.now();

	const now = ctx.currentTime;
	const master = ctx.createGain();
	const lowpass = ctx.createBiquadFilter();
	const oscA = ctx.createOscillator();
	const oscB = ctx.createOscillator();
	const gainA = ctx.createGain();
	const gainB = ctx.createGain();

	lowpass.type = 'lowpass';
	lowpass.frequency.setValueAtTime(980, now);
	lowpass.Q.setValueAtTime(0.36, now);

	master.gain.setValueAtTime(0.0001, now);
	master.gain.linearRampToValueAtTime(0.0026, now + 0.028);
	master.gain.exponentialRampToValueAtTime(0.0013, now + 0.09);
	master.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);

	oscA.type = 'sine';
	oscA.frequency.setValueAtTime(360, now);
	oscA.frequency.exponentialRampToValueAtTime(318, now + 0.17);

	oscB.type = 'sine';
	oscB.frequency.setValueAtTime(540, now);
	oscB.frequency.exponentialRampToValueAtTime(486, now + 0.14);

	gainA.gain.setValueAtTime(1, now);
	gainB.gain.setValueAtTime(0.1, now);

	oscA.connect(gainA);
	oscB.connect(gainB);
	gainA.connect(lowpass);
	gainB.connect(lowpass);
	lowpass.connect(master);
	master.connect(ctx.destination);

	oscA.start(now);
	oscB.start(now);
	oscA.stop(now + 0.18);
	oscB.stop(now + 0.18);
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
	const isDark = getActiveTheme() === 'dark';
	const nextLabel = isDark ? 'Light mode' : 'Dark mode';
	const visibleLabel = isDark ? 'Dark' : 'Light';

	document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((button) => {
		button.setAttribute('aria-label', nextLabel);
		button.setAttribute('aria-pressed', String(isDark));
		button.querySelector<HTMLElement>('[data-theme-toggle-label]')?.replaceChildren(visibleLabel);
	});
}

function setTheme(nextTheme: ThemeName, options: { persist?: boolean } = {}) {
	const { persist = true } = options;
	const root = document.documentElement;

	if (root.dataset.theme === nextTheme) {
		if (persist) {
			setStoredValue(THEME_OVERRIDE_KEY, nextTheme);
			setStoredValue(THEME_KEY, nextTheme);
		}
		syncEnvironmentDiagnostics();
		return;
	}

	root.classList.add('theme-switching');
	root.dataset.theme = nextTheme;
	if (persist) {
		setStoredValue(THEME_OVERRIDE_KEY, nextTheme);
		setStoredValue(THEME_KEY, nextTheme);
	}
	syncThemeToggleLabels();
	// Refresh cloud colors when theme changes
	if (weatherMode === 'clouds') createClouds('clouds');
	else if (weatherMode === 'overcast') createClouds('overcast');
	syncEnvironmentDiagnostics();

	window.setTimeout(() => {
		root.classList.remove('theme-switching');
	}, 380);
}

function getIdentityTextElements() {
	return Array.from(document.querySelectorAll<HTMLElement>('.identity-top .identity-name, .identity-top .identity-tagline'));
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

function hasTypedIdentity() {
	if (document.body.dataset.identityTyped === 'true') {
		return true;
	}

	try {
		const hasTyped = sessionStorage.getItem(IDENTITY_TYPED_KEY) === 'true';

		if (hasTyped) {
			document.body.dataset.identityTyped = 'true';
		}

		return hasTyped;
	} catch {
		return false;
	}
}

function markIdentityTyped() {
	document.body.dataset.identityTyped = 'true';

	try {
		sessionStorage.setItem(IDENTITY_TYPED_KEY, 'true');
	} catch {
		// Ignore storage failures and fall back to the in-memory body dataset.
	}
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
		charDelay: element.classList.contains('identity-name') ? 62 : 38,
	}));

	if (!elements.length || prefersReducedMotion()) {
		restoreIdentityText();
		return;
	}

	let elementIndex = 0;

	const typeNextElement = () => {
		if (token !== identityTypingToken) {
			return;
		}

		const current = elements[elementIndex];

		if (!current) {
			return;
		}

		elementIndex += 1;
		let charIndex = 0;

		const typeChar = () => {
			if (token !== identityTypingToken) {
				return;
			}

			charIndex += 1;
			current.element.textContent = current.text.slice(0, charIndex);

			if (charIndex < current.text.length) {
				window.setTimeout(typeChar, getNaturalTypingDelay(current.text[charIndex - 1], current.charDelay));
				return;
			}

			window.setTimeout(typeNextElement, 220);
		};

		window.setTimeout(typeChar, 88);
	};

	window.setTimeout(typeNextElement, 100);
}

type AboutHeroTypingNode = {
	node: Text;
	text: string;
	charDelay: number;
};

type AboutHeroTypingBlock = {
	nodes: AboutHeroTypingNode[];
	initialDelay: number;
	pauseAfter: number;
	glowTarget?: HTMLElement | null;
	keepGlowActive?: boolean;
};

function hasTypedAboutHero() {
	if (document.body.dataset.aboutHeroTyped === 'true') {
		return true;
	}

	try {
		const hasTyped = sessionStorage.getItem(ABOUT_HERO_TYPED_KEY) === 'true';

		if (hasTyped) {
			document.body.dataset.aboutHeroTyped = 'true';
		}

		return hasTyped;
	} catch {
		return false;
	}
}

function markAboutHeroTyped() {
	document.body.dataset.aboutHeroTyped = 'true';

	try {
		sessionStorage.setItem(ABOUT_HERO_TYPED_KEY, 'true');
	} catch {
		// Ignore storage failures and fall back to the in-memory body dataset.
	}
}

function collectAboutHeroTypingNodes(root: HTMLElement, charDelay: number) {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
		acceptNode(node) {
			if ((node.parentElement as HTMLElement | null)?.closest('.about-inline-popout')) {
				return NodeFilter.FILTER_REJECT;
			}
			const cachedValue = aboutHeroTextCache.get(node as Text) ?? '';
			const value = node.textContent ?? '';
			return cachedValue.trim().length > 0 || value.trim().length > 0
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_REJECT;
		},
	});
	const nodes: AboutHeroTypingNode[] = [];
	let currentNode = walker.nextNode();

	while (currentNode) {
		const textNode = currentNode as Text;
		const cachedText = aboutHeroTextCache.get(textNode) ?? textNode.textContent ?? '';
		aboutHeroTextCache.set(textNode, cachedText);
		nodes.push({
			node: textNode,
			text: cachedText,
			charDelay,
		});
		currentNode = walker.nextNode();
	}

	return nodes;
}

function createAboutHeroTypingBlock(
	root: HTMLElement,
	charDelay: number,
	initialDelay: number,
	pauseAfter: number,
	glowTarget?: HTMLElement | null,
	keepGlowActive = false,
) {
	return {
		nodes: collectAboutHeroTypingNodes(root, charDelay),
		initialDelay,
		pauseAfter,
		glowTarget,
		keepGlowActive,
	};
}

function getNaturalTypingDelay(char: string | undefined, baseDelay: number) {
	if (!char) {
		return baseDelay;
	}

	if (char === '.' || char === ',' || char === ':' || char === ';') {
		return baseDelay + 70;
	}

	if (char === '!' || char === '?') {
		return baseDelay + 95;
	}

	if (char === ' ') {
		return Math.round(baseDelay * 0.64);
	}

	return baseDelay + Math.round(Math.random() * 8);
}

function clearAboutTypingGlow() {
	document.querySelectorAll<HTMLElement>('.about-inline-link.is-type-glowing').forEach((link) => {
		link.classList.remove('is-type-glowing');
	});
}

function setAboutTypingGlow(target: HTMLElement | null | undefined, mode: 'replace' | 'add' = 'replace') {
	if (mode === 'replace') {
		clearAboutTypingGlow();
	}

	target?.classList.add('is-type-glowing');
}

function getAboutHeroTypingBlocks() {
	const heading = document.querySelector<HTMLElement>('.about-hero h2');
	const lead = document.querySelector<HTMLElement>('.about-summary-lead');
	const detail = document.querySelector<HTMLElement>('.about-summary-detail');
	const blocks: AboutHeroTypingBlock[] = [];

	if (heading) {
		const headingChunks = Array.from(heading.querySelectorAll<HTMLElement>('.about-heading-chunk'));

		if (headingChunks.length > 0) {
			headingChunks.forEach((chunk, index) => {
				blocks.push(
					createAboutHeroTypingBlock(
						chunk,
						58,
						36,
						index < headingChunks.length - 1 ? ABOUT_HERO_HEADING_SPLIT_PAUSE_MS : ABOUT_HERO_LINE_PAUSE_MS,
					),
				);
			});
		} else {
			blocks.push(createAboutHeroTypingBlock(heading, 58, 36, ABOUT_HERO_LINE_PAUSE_MS));
		}
	}

	if (lead) {
		blocks.push(createAboutHeroTypingBlock(lead, 24, 28, ABOUT_HERO_LINE_PAUSE_MS));
	}

	if (detail) {
		const detailChunks = Array.from(detail.querySelectorAll<HTMLElement>('.about-summary-chunk'));

		if (detailChunks.length > 0) {
			detailChunks.forEach((chunk, index) => {
				const links = Array.from(chunk.querySelectorAll<HTMLElement>('.about-inline-link'));
				const glowTarget = links.at(-1) ?? null;

				blocks.push(
					createAboutHeroTypingBlock(
						chunk,
						25,
						30,
						0,
						glowTarget,
						true,
					),
				);
			});
		} else {
			const links = Array.from(detail.querySelectorAll<HTMLElement>('.about-inline-link'));
			blocks.push(createAboutHeroTypingBlock(detail, 25, 30, 0, links.at(-1) ?? null, true));
		}
	}

	return blocks.filter((block) => block.nodes.length > 0);
}

function restoreAboutHeroText() {
	aboutTypingToken += 1;
	clearAboutTypingGlow();

	getAboutHeroTypingBlocks().forEach(({ nodes }) => {
		nodes.forEach(({ node, text }) => {
			node.textContent = text;
		});
	});
}

function prepareAboutHeroTyping() {
	aboutTypingToken += 1;
	clearAboutTypingGlow();

	getAboutHeroTypingBlocks().forEach(({ nodes }) => {
		nodes.forEach(({ node }) => {
			node.textContent = '';
		});
	});

	return aboutTypingToken;
}

function startAboutHeroTyping(token: number) {
	const blocks = getAboutHeroTypingBlocks();

	if (!blocks.length || prefersReducedMotion()) {
		restoreAboutHeroText();
		return;
	}

	let blockIndex = 0;

	const typeBlock = () => {
		if (token !== aboutTypingToken) {
			return;
		}

		const currentBlock = blocks[blockIndex];

		if (!currentBlock) {
			clearAboutTypingGlow();
			return;
		}

		blockIndex += 1;
		setAboutTypingGlow(currentBlock.glowTarget, currentBlock.keepGlowActive ? 'add' : 'replace');
		let nodeIndex = 0;

		const typeNextNode = () => {
			if (token !== aboutTypingToken) {
				return;
			}

			const currentNode = currentBlock.nodes[nodeIndex];

			if (!currentNode) {
				window.setTimeout(typeBlock, currentBlock.pauseAfter);
				return;
			}

			nodeIndex += 1;
			let charIndex = 0;

			const typeChar = () => {
				if (token !== aboutTypingToken) {
					return;
				}

				charIndex += 1;
				currentNode.node.textContent = currentNode.text.slice(0, charIndex);

				if (charIndex < currentNode.text.length) {
					window.setTimeout(typeChar, getNaturalTypingDelay(currentNode.text[charIndex - 1], currentNode.charDelay));
					return;
				}

				window.setTimeout(typeNextNode, currentNode.node.parentElement?.tagName === 'A' ? 64 : 40);
			};

			window.setTimeout(typeChar, currentNode.node.parentElement?.tagName === 'A' ? 44 : currentBlock.initialDelay);
		};

		typeNextNode();
	};

	window.setTimeout(typeBlock, 60);
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
	const mobileHeader = document.querySelector<HTMLElement>('.mobile-header');

	if (!mobileNav || !mobileToggle) {
		return;
	}

	mobileNav.classList.remove('open');
	mobileHeader?.classList.remove('mobile-header--nav-open');
	mobileNav.setAttribute('aria-hidden', 'true');
	mobileToggle.setAttribute('aria-expanded', 'false');
}

function setMobileNavOpen(isOpen: boolean) {
	const mobileNav = document.getElementById('mobile-nav');
	const mobileToggle = document.querySelector<HTMLElement>('.mobile-nav-toggle');
	const mobileHeader = document.querySelector<HTMLElement>('.mobile-header');

	if (!mobileNav || !mobileToggle) {
		return;
	}

	mobileNav.classList.toggle('open', isOpen);
	mobileHeader?.classList.toggle('mobile-header--nav-open', isOpen);
	mobileNav.setAttribute('aria-hidden', String(!isOpen));
	mobileToggle.setAttribute('aria-expanded', String(isOpen));
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

function syncMobileHeaderForTab(activeTab: TabKey) {
	document
		.querySelector<HTMLElement>('.mobile-header')
		?.classList.toggle('mobile-header--name-hidden', activeTab === DEFAULT_TAB);
}

function activateTab(tab: string, animate = true) {
	const nextTab = isValidTab(tab) ? tab : DEFAULT_TAB;
	const shouldAnimate = animate && !prefersReducedMotion();
	const layout = document.querySelector<HTMLElement>('.layout');
	const shouldTypeAboutHero = nextTab === 'about' && !hasTypedAboutHero();
	const shouldTypeIdentity = nextTab !== 'about' && !hasTypedIdentity();

	if (shouldTypeAboutHero) {
		markAboutHeroTyped();
		prepareAboutHeroTyping();
	} else {
		restoreAboutHeroText();
	}

	if (shouldTypeIdentity) {
		markIdentityTyped();
		prepareIdentityTyping();
	} else {
		restoreIdentityText();
	}

	document.body.dataset.typingReady = 'true';

	if (layout) {
		layout.dataset.activeTab = nextTab;
	}

	syncMobileHeaderForTab(nextTab);

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

	if (shouldTypeAboutHero) {
		window.setTimeout(() => startAboutHeroTyping(aboutTypingToken), shouldAnimate ? 120 : 0);
	}

	if (shouldTypeIdentity) {
		window.setTimeout(() => startIdentityTyping(identityTypingToken), shouldAnimate ? 120 : 0);
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

	document.addEventListener('click', (event) => {
		const target = event.target;
		const mobileNav = document.getElementById('mobile-nav');
		const mobileHeader = document.querySelector<HTMLElement>('.mobile-header');

		if (!(target instanceof Node) || !mobileNav?.classList.contains('open')) {
			return;
		}

		if (mobileNav.contains(target) || mobileHeader?.contains(target)) {
			return;
		}

		closeMobileNav();
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
		const isProjectGalleryButton = button.matches('.gallery-tile__action');

		if (window.matchMedia(FINE_POINTER_QUERY).matches) {
			button.addEventListener('pointerenter', () => {
				if (
					prefersReducedMotion() ||
					button.disabled ||
					hoveredButtons.has(button) ||
					isTabButton ||
					isProjectGalleryButton
				) {
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

function bindProjectGalleryUiSounds() {
	if (!window.matchMedia(FINE_POINTER_QUERY).matches) {
		return;
	}

	document.querySelectorAll<HTMLElement>('.gallery-tile__action').forEach((card) => {
		card.addEventListener('pointerenter', () => {
			if (prefersReducedMotion() || hoveredButtons.has(card) || card.matches(':disabled')) {
				return;
			}

			hoveredButtons.add(card);
			playProjectCardHoverTone();
		});

		card.addEventListener('pointerleave', () => {
			hoveredButtons.delete(card);
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
		activeInlineHoverLink.style.removeProperty('--popout-shift');
		activeInlineHoverLink.style.removeProperty('--popout-anchor-x');
		activeInlineHoverLink.style.removeProperty('--popout-anchor-y');
		activeInlineHoverLink.querySelector<HTMLElement>('.about-inline-popout')?.setAttribute('aria-hidden', 'true');
	}

	activeInlineHoverLink = link;

	if (link) {
		document.body.dataset.inlineHover = 'true';
		link.classList.add('is-inline-hover-active');
		link.querySelector<HTMLElement>('.about-inline-popout')?.setAttribute('aria-hidden', 'true');
		positionInlinePopout(link);
		return;
	}

	delete document.body.dataset.inlineHover;
	hideInlineFloatingPopout();
}

function getInlineFloatingPopout() {
	if (inlineFloatingPopout) {
		return inlineFloatingPopout;
	}

	inlineFloatingPopout = document.createElement('span');
	inlineFloatingPopout.className = 'about-inline-floating-popout';
	inlineFloatingPopout.setAttribute('aria-hidden', 'true');
	document.body.append(inlineFloatingPopout);
	return inlineFloatingPopout;
}

function hideInlineFloatingPopout() {
	if (!inlineFloatingPopout) {
		return;
	}

	inlineFloatingPopout.classList.remove('is-active');
	inlineFloatingPopout.setAttribute('aria-hidden', 'true');
}

function positionInlinePopout(link: HTMLElement) {
	const sourcePopout = link.querySelector<HTMLElement>('.about-inline-popout');

	if (!sourcePopout) {
		return;
	}

	const popout = getInlineFloatingPopout();
	popout.textContent = sourcePopout.textContent ?? '';
	popout.setAttribute('aria-hidden', 'false');

	const linkRect = link.getBoundingClientRect();
	const anchorX = linkRect.left + linkRect.width / 2 + window.scrollX;
	const anchorY = linkRect.bottom + 8 + window.scrollY;

	popout.style.setProperty('--popout-anchor-x', `${Math.round(anchorX)}px`);
	popout.style.setProperty('--popout-anchor-y', `${Math.round(anchorY)}px`);
	popout.style.setProperty('--popout-shift', '0px');
	popout.classList.add('is-active');

	window.requestAnimationFrame(() => {
		const nextLinkRect = link.getBoundingClientRect();
		const popoutRect = popout.getBoundingClientRect();
		const viewportPadding = 14;
		const nextAnchorX = nextLinkRect.left + nextLinkRect.width / 2 + window.scrollX;
		const nextAnchorY = nextLinkRect.bottom + 8 + window.scrollY;
		const idealLeft = nextLinkRect.left + nextLinkRect.width / 2 - popoutRect.width / 2;
		const idealRight = idealLeft + popoutRect.width;
		const leftOverflow = Math.max(0, viewportPadding - idealLeft);
		const rightOverflow = Math.max(0, idealRight - (window.innerWidth - viewportPadding));
		const shift = leftOverflow - rightOverflow;

		popout.style.setProperty('--popout-anchor-x', `${Math.round(nextAnchorX)}px`);
		popout.style.setProperty('--popout-anchor-y', `${Math.round(nextAnchorY)}px`);
		popout.style.setProperty('--popout-shift', `${Math.round(shift)}px`);
	});
}

function bindInlineHoverFocus() {
	const supportsFinePointer = window.matchMedia(FINE_POINTER_QUERY).matches;

	document.querySelectorAll<HTMLElement>('.about-inline-link').forEach((link) => {
		link.addEventListener('mouseenter', () => {
			if (!supportsFinePointer) {
				return;
			}

			setInlineHoverFocus(link);
		});

		link.addEventListener('mouseleave', (event) => {
			if (!supportsFinePointer) {
				return;
			}

			const relatedTarget = event.relatedTarget;
			const nextLink =
				relatedTarget instanceof HTMLElement ? relatedTarget.closest<HTMLElement>('.about-inline-link') : null;

			setInlineHoverFocus(nextLink);
		});

		link.addEventListener('focusin', () => {
			setInlineHoverFocus(link);
		});

		link.addEventListener('focusout', () => {
			setInlineHoverFocus(null);
		});

		link.addEventListener('click', (event) => {
			if (supportsFinePointer || activeInlineHoverLink === link) {
				return;
			}

			event.preventDefault();
			setInlineHoverFocus(link);
		});
	});

	document.addEventListener('pointerdown', (event) => {
		if (!activeInlineHoverLink) {
			return;
		}

		const target = event.target;
		if (target instanceof HTMLElement && target.closest('.about-inline-link')) {
			return;
		}

		setInlineHoverFocus(null);
	});

	window.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			setInlineHoverFocus(null);
		}
	});

	window.addEventListener('resize', () => {
		if (activeInlineHoverLink) {
			positionInlinePopout(activeInlineHoverLink);
		}
	});

	document.getElementById('content-panel')?.addEventListener('scroll', () => {
		if (activeInlineHoverLink) {
			positionInlinePopout(activeInlineHoverLink);
		}
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
		sunny: 'Weather: sunny',
		rain: 'Weather: rain',
		clouds: 'Weather: clouds',
		snow: 'Weather: snow',
		overcast: 'Weather: overcast',
	};
	const label = getManualWeatherOverride()
		? labels[weatherMode]
		: `Weather: auto (${labels[weatherMode].replace('Weather: ', '')})`;

	document.querySelectorAll<HTMLElement>('[data-weather-toggle]').forEach((btn) => {
		btn.setAttribute('aria-label', label);
	});
}

function getWeatherHoverLocation(environment: AutoEnvironment | null) {
	return environment?.location?.city || getCachedGeoLocation()?.city || 'your area';
}

function getWeatherHoverText(mode: WeatherMode, environment: AutoEnvironment | null = getCachedAutoEnvironment()) {
	const location = getWeatherHoverLocation(environment);

	if (getManualWeatherOverride()) {
		const autoWeather = environment?.weather ?? 'off';
		const adjective = WEATHER_HOVER_MANUAL_ADJECTIVE[autoWeather];
		return `Glad to see you've changed the weather here. Was a bit too ${adjective} in ${location} today anyway...`;
	}

	if (mode === 'off') {
		return WEATHER_HOVER_COPY.off;
	}

	return WEATHER_HOVER_COPY[mode].replace('{location}', location);
}

function syncWeatherPortraitCopy(environment: AutoEnvironment | null = getCachedAutoEnvironment()) {
	const copy = document.querySelector<HTMLElement>('[data-weather-portrait-copy]');
	const portrait = document.querySelector<HTMLElement>('[data-weather-portrait]');

	if (!copy || !portrait) {
		return;
	}

	const text = getWeatherHoverText(weatherMode, environment);
	copy.textContent = text;
	portrait.setAttribute('aria-label', text);
}

function renderWeather(mode: WeatherMode) {
	weatherMode = mode;
	document.documentElement.dataset.weather = mode;

	stopWeatherCanvas();
	clearClouds();

	if (mode === 'rain') startRain();
	else if (mode === 'snow') startSnow();
	else if (mode === 'clouds') createClouds('clouds');
	else if (mode === 'overcast') createClouds('overcast');

	syncWeatherToggleLabels();
	syncWeatherPortraitCopy();
}

function syncEnvironmentDiagnostics(environment: AutoEnvironment | null = getCachedAutoEnvironment()) {
	const root = document.documentElement;
	root.dataset.environmentThemeSource = getManualThemeOverride() ? 'manual' : 'auto';
	root.dataset.environmentWeatherSource = getManualWeatherOverride() ? 'manual' : 'auto';

	if (environment?.code != null) {
		root.dataset.weatherCode = String(environment.code);
	} else {
		delete root.dataset.weatherCode;
	}

	if (environment?.location?.src) {
		root.dataset.geoSource = environment.location.src;
	} else {
		delete root.dataset.geoSource;
	}

	syncWeatherPortraitCopy(environment);
}

function setWeather(mode: WeatherMode, options: { persist?: boolean } = {}) {
	const { persist = true } = options;
	renderWeather(mode);

	if (persist) {
		manualWeatherOverride = mode;
		clearStoredWeatherOverride();
		syncWeatherToggleLabels();
	}

	syncEnvironmentDiagnostics();
}

function setAutoWeather() {
	manualWeatherOverride = null;
	const cachedAuto = getCachedAutoEnvironment();
	renderWeather(cachedAuto?.weather ?? 'off');
	syncEnvironmentDiagnostics(cachedAuto);
	void fetchAutoEnvironment(true);
}

function bindWeatherButtons() {
	const manualCycle: WeatherMode[] = ['sunny', 'rain', 'clouds', 'snow', 'overcast'];

	document.querySelectorAll<HTMLElement>('[data-weather-toggle]').forEach((btn) => {
		btn.addEventListener('click', () => {
			const manualWeather = getManualWeatherOverride();

			if (!manualWeather) {
				setWeather(manualCycle[0]);
				return;
			}

			const current = manualCycle.indexOf(manualWeather);

			if (current === manualCycle.length - 1) {
				setAutoWeather();
				return;
			}

			const next = manualCycle[current + 1] ?? manualCycle[0];
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
	clearStoredWeatherOverride();
	const manualWeather = getManualWeatherOverride();
	const cachedAuto = getCachedAutoEnvironment();
	renderWeather(manualWeather ?? cachedAuto?.weather ?? 'off');
	syncEnvironmentDiagnostics(cachedAuto);
}

function getCachedAutoEnvironment() {
	try {
		const cached = JSON.parse(localStorage.getItem(AUTO_ENVIRONMENT_CACHE_KEY) || 'null') as Partial<AutoEnvironment> | null;

		if (
			cached &&
			typeof cached.expires === 'number' &&
			cached.expires > Date.now() &&
			isValidTheme(cached.theme ?? null) &&
			isValidWeather(cached.weather ?? null)
		) {
			if (
				cached.weather === 'off' &&
				(cached.code === 0 || cached.code === 1) &&
				cached.theme === 'light'
			) {
				cached.weather = 'sunny';
			}

			return cached as AutoEnvironment;
		}
	} catch {
		return null;
	}

	return null;
}

function setCachedAutoEnvironment(environment: AutoEnvironment) {
	try {
		localStorage.setItem(AUTO_ENVIRONMENT_CACHE_KEY, JSON.stringify(environment));
	} catch {
		// Auto mode still applies for this session when storage is unavailable.
	}
}

function getEnvironmentDebugSnapshot(): EnvironmentDebugSnapshot {
	return {
		activeTheme: getActiveTheme(),
		activeWeather: weatherMode,
		manualThemeOverride: getManualThemeOverride(),
		manualWeatherOverride: getManualWeatherOverride(),
		autoEnvironment: getCachedAutoEnvironment(),
		geo: getCachedGeoLocation(),
		localHourTheme: getBrowserTimeTheme(),
	};
}

function mapWeatherCodeToMode(code: number | null | undefined, isDay: number | null | undefined): WeatherMode {
	if (code == null) return 'off';
	if (code === 0 || code === 1) return isDay === 1 ? 'sunny' : 'off';
	if (code === 2) return 'clouds';
	if (code === 3 || code === 45 || code === 48) return 'overcast';
	if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain';
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
	return 'off';
}

function applyAutoEnvironment(environment: AutoEnvironment) {
	if (!getManualThemeOverride()) {
		setTheme(environment.theme, { persist: false });
	}

	if (!getManualWeatherOverride()) {
		setWeather(environment.weather, { persist: false });
	}

	syncEnvironmentDiagnostics(environment);
}

function normaliseGeoLocation(candidate: Partial<GeoLocationResult> | null): GeoLocationResult | null {
	const lat = Number(candidate?.lat);
	const lon = Number(candidate?.lon);

	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		return null;
	}

	return {
		lat,
		lon,
		src: String(candidate?.src || 'unknown'),
		city: candidate?.city,
		savedAt: Number(candidate?.savedAt) || Date.now(),
	};
}

function getCachedGeoLocation() {
	try {
		const cached = normaliseGeoLocation(JSON.parse(localStorage.getItem(AUTO_GEO_CACHE_KEY) || 'null'));

		if (cached && Date.now() - cached.savedAt < AUTO_GEO_CACHE_MS) {
			return cached;
		}
	} catch {
		return null;
	}

	return null;
}

function saveGeoLocation(location: Omit<GeoLocationResult, 'savedAt'>) {
	const value: GeoLocationResult = { ...location, savedAt: Date.now() };

	try {
		localStorage.setItem(AUTO_GEO_CACHE_KEY, JSON.stringify(value));
	} catch {
		// Keep using the in-memory result for this request.
	}

	return value;
}

function getBrowserGeoLocation() {
	return new Promise<GeoLocationResult | null>((resolve) => {
		if (!navigator.geolocation) {
			resolve(null);
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(pos) => {
				resolve(saveGeoLocation({
					lat: pos.coords.latitude,
					lon: pos.coords.longitude,
					src: 'browser',
				}));
			},
			() => resolve(null),
			{ timeout: 6000, maximumAge: 60 * 60 * 1000 },
		);
	});
}

async function getGrantedBrowserGeoLocation() {
	if (!navigator.permissions) {
		return null;
	}

	try {
		const permission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });

		if (permission.state !== 'granted') {
			return null;
		}

		return getBrowserGeoLocation();
	} catch {
		return null;
	}
}

async function getFreeIpGeoLocation() {
	try {
		const response = await fetch('https://freeipapi.com/api/json/');
		if (!response.ok) return null;

		const data = await response.json() as {
			latitude?: number;
			longitude?: number;
			cityName?: string;
		};

		if (data.latitude == null || data.longitude == null) return null;

		return saveGeoLocation({
			lat: data.latitude,
			lon: data.longitude,
			src: 'freeipapi.com',
			city: data.cityName,
		});
	} catch {
		return null;
	}
}

async function getGeoDbLocation() {
	try {
		const response = await fetch('https://geolocation-db.com/json/');
		if (!response.ok) return null;

		const data = await response.json() as {
			latitude?: number | string;
			longitude?: number | string;
			city?: string;
		};

		if (data.latitude == null || data.longitude == null || data.latitude === 'Not found') return null;

		return saveGeoLocation({
			lat: Number(data.latitude),
			lon: Number(data.longitude),
			src: 'geolocation-db.com',
			city: data.city,
		});
	} catch {
		return null;
	}
}

async function fetchAutoGeoLocation() {
	return getCachedGeoLocation()
		?? await getGrantedBrowserGeoLocation()
		?? await getFreeIpGeoLocation()
		?? await getGeoDbLocation();
}

async function fetchAutoEnvironment(force = false) {
	const cached = force ? null : getCachedAutoEnvironment();

	if (cached) {
		applyAutoEnvironment(cached);
		return;
	}

	const location = await fetchAutoGeoLocation();

	if (!location) {
		applyAutoEnvironment({
			theme: getBrowserTimeTheme(),
			weather: 'off',
			expires: Date.now() + 10 * 60 * 1000,
		});
		return;
	}

	try {
		const url = new URL('https://api.open-meteo.com/v1/forecast');
		url.searchParams.set('latitude', String(location.lat));
		url.searchParams.set('longitude', String(location.lon));
		url.searchParams.set('current', 'weather_code,is_day');
		url.searchParams.set('timezone', 'auto');

		const response = await fetch(url.toString());
		if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);

		const data = await response.json() as {
			current?: {
				is_day?: number;
				weather_code?: number;
			};
		};
		const code = data.current?.weather_code ?? null;
		const environment: AutoEnvironment = {
			theme: data.current?.is_day === 0 ? 'dark' : data.current?.is_day === 1 ? 'light' : getBrowserTimeTheme(),
			weather: mapWeatherCodeToMode(code, data.current?.is_day),
			code,
			expires: Date.now() + AUTO_ENVIRONMENT_CACHE_MS,
			location: {
				src: location.src,
				city: location.city,
			},
			updatedAt: Date.now(),
		};

		setCachedAutoEnvironment(environment);
		applyAutoEnvironment(environment);
	} catch {
		applyAutoEnvironment({
			theme: getBrowserTimeTheme(),
			weather: 'off',
			expires: Date.now() + 10 * 60 * 1000,
		});
	}
}

function initAutoEnvironment() {
	window.portfolioEnvironmentDebug = getEnvironmentDebugSnapshot;
	window.portfolioEnvironmentRefresh = () => fetchAutoEnvironment(true);

	const cached = getCachedAutoEnvironment();

	if (cached) {
		applyAutoEnvironment(cached);
	}

	void fetchAutoEnvironment();
	window.setInterval(() => {
		void fetchAutoEnvironment(true);
	}, 30 * 60 * 1000);
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

	soundEnabled = getStoredValue(SOUND_ENABLED_KEY) !== 'false';
	cacheIdentityText();

	bindTabButtons();
	bindMobileNav();
	bindThemeButtons();
	bindSoundButtons();
	bindButtonUiSounds();
	bindProjectGalleryUiSounds();
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
	initAutoEnvironment();

	const initialHash = window.location.hash.slice(1);
	const initialTab = isValidTab(initialHash) ? initialHash : DEFAULT_TAB;
	activateTab(initialTab, initialTab !== DEFAULT_TAB);

	window.addEventListener('pointerdown', unlockAudioContext, { passive: true });
	window.addEventListener('keydown', unlockAudioContext);
	window.addEventListener('resize', updateNavIndicator);
	window.addEventListener('load', updateNavIndicator);
}
