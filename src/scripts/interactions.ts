const TABS = ['about', 'work', 'gallery', 'proof', 'contact'] as const;
const DEFAULT_TAB = 'about';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const FINE_POINTER_QUERY = '(pointer: fine)';

type TabKey = (typeof TABS)[number];
type ThemeName = 'light' | 'dark';

let galleryObserver: IntersectionObserver | null = null;

function prefersReducedMotion() {
	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function isValidTab(tab: string): tab is TabKey {
	return TABS.includes(tab as TabKey);
}

function getActiveTheme(): ThemeName {
	return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
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

export default function initPortfolioInteractions() {
	if (document.body.dataset.portfolioInteractionsReady === 'true') {
		return;
	}

	document.body.dataset.portfolioInteractionsReady = 'true';

	bindTabButtons();
	bindMobileNav();
	bindThemeButtons();
	syncThemeToggleLabels();
	initMouseGlow();

	const initialHash = window.location.hash.slice(1);
	const initialTab = isValidTab(initialHash) ? initialHash : DEFAULT_TAB;
	activateTab(initialTab, initialTab !== DEFAULT_TAB);

	window.addEventListener('resize', updateNavIndicator);
	window.addEventListener('load', updateNavIndicator);
}
