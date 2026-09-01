<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import Accordion from "primevue/accordion";
import AccordionContent from "primevue/accordioncontent";
import AccordionHeader from "primevue/accordionheader";
import AccordionPanel from "primevue/accordionpanel";
import {
  catalogFilters,
  catalogProducts,
  catalogStatus,
  catalogError,
  getProductByHandle,
  getProductPath,
  loadCatalog,
  loadProductByHandle,
  configureCatalogApiBaseUrl,
  productKey,
} from "./data/catalog.js";
import ProductListingPage from "./components/ProductListingPage.vue";
import ProductDetailPage from "./components/ProductDetailPage.vue";
import CartPage from "./components/CartPage.vue";
import CheckoutPage from "./components/CheckoutPage.vue";
import CheckoutReviewPage from "./components/CheckoutReviewPage.vue";
import ProductSearch from "./components/ProductSearch.vue";
import TestimonialsPage from "./components/TestimonialsPage.vue";
import OrderHistoryPage from "./components/OrderHistoryPage.vue";
import WishlistPage from "./components/WishlistPage.vue";
import DesignerListPage from "./components/DesignerListPage.vue";
import DesignerProfilePage from "./components/DesignerProfilePage.vue";
import ProductImageCarousel from "./components/ProductImageCarousel.vue";
import {
  CART_EVENT,
  cartSubtotal,
  formatCartPrice,
  getCart,
  removeCartItem,
  configureCartApiBaseUrl,
  setCartQuantity,
  syncCart,
} from "./data/cart.js";
import {
  getWishlist,
  toggleWishlist,
  WISHLIST_EVENT,
} from "./data/wishlist.js";
import { designers as fallbackDesigners } from "./data/designers.js";

const categorySlugs = {
  Living: "living",
  Dining: "dining",
  Bedroom: "bedroom",
  "Mirrors & Accessories": "mirrors-accessories",
  Entertainment: "entertainment",
};
const categoriesBySlug = Object.fromEntries(
  Object.entries(categorySlugs).map(([name, slug]) => [slug, name]),
);
const requestUrl = useRequestURL();
const currentPathname = requestUrl.pathname;
const currentSearch = requestUrl.search;
const routeMatch = currentPathname.match(/^\/products\/([^/]+)\/?$/);
const isNewArrivalsPage = routeMatch?.[1] === "new-arrivals";
const listingCategory = routeMatch ? categoriesBySlug[routeMatch[1]] : null;
const productRouteMatch = currentPathname.match(/^\/product\/([^/]+)\/?$/);
const selectedProduct = computed(() => productRouteMatch
  ? getProductByHandle(decodeURIComponent(productRouteMatch[1]))
  : null);
const isCartPage = /^\/cart\/?$/.test(currentPathname);
const isCheckoutPage = /^\/checkout\/?$/.test(currentPathname);
const isCheckoutReviewPage = /^\/checkout\/review\/?$/.test(currentPathname);
const isTestimonialsPage = /^\/testimonials\/?$/.test(currentPathname);
const isOrdersPage = /^\/orders\/?$/.test(currentPathname);
const isWishlistPage = /^\/wishlist\/?$/.test(currentPathname);
const isDesignerListPage = /^\/designers\/?$/.test(currentPathname);
const designerRouteMatch = currentPathname.match(/^\/designers\/([^/]+)\/?$/);
const designerProfiles = ref([...fallbackDesigners]);
const hasLoadedDesignerProfiles = ref(false);
const selectedDesigner = computed(() => designerRouteMatch
  ? designerProfiles.value.find((designer) => designer.slug === decodeURIComponent(designerRouteMatch[1])) || null
  : null);
const isDesignerProfilePage = Boolean(designerRouteMatch);
const routeQuery = new URLSearchParams(currentSearch);
const listingSubcategory = listingCategory
  ? routeQuery.get("subcategory") || routeQuery.get("sub_category") || ""
  : "";
const isListingPage = Boolean(listingCategory || isNewArrivalsPage);
const isProductPage = Boolean(productRouteMatch);
const isShopTheLookPage = /^\/shop-the-look\/?$/.test(currentPathname);
const homeLink = (anchor = "") =>
  isListingPage ||
  isProductPage ||
  isShopTheLookPage ||
  isCartPage ||
  isCheckoutPage ||
  isCheckoutReviewPage ||
  isTestimonialsPage ||
  isOrdersPage ||
  isWishlistPage ||
  isDesignerListPage ||
  isDesignerProfilePage
    ? `/${anchor}`
    : anchor || "#top";

// These original slides are display-only fallbacks. They are never created in
// the database; saved hero banners replace them from left to right by position.
const placeholderHeroBanners = [
  {
    id: "placeholder-living",
    src: "/media/showcase/living.mp4",
    mediaType: "video",
    eyebrow: "The Art of Living",
    title: "A room should move you.",
    copy: "Sculptural silhouettes and tactile comfort, composed for the way life unfolds.",
    href: "/products/living",
    cta: "Explore Living",
  },
  {
    id: "placeholder-dining",
    src: "/media/showcase/dining.mp4",
    mediaType: "video",
    eyebrow: "Gather Beautifully",
    title: "Every occasion, elevated.",
    copy: "Statement tables and graceful seating set the stage for conversations worth remembering.",
    href: "/products/dining",
    cta: "Explore Dining",
  },
  {
    id: "placeholder-bedroom",
    src: "/media/showcase/bedroom.mp4",
    mediaType: "video",
    eyebrow: "The Private Retreat",
    title: "Rest, reimagined.",
    copy: "Quiet luxury, refined proportions, and layers of softness for your most personal space.",
    href: "/products/bedroom",
    cta: "Explore Bedroom",
  },
];
const videos = ref([...placeholderHeroBanners]);
const runtimeConfig = useRuntimeConfig();
const apiBaseUrl = ((import.meta.server
  ? runtimeConfig.apiInternalBaseUrl
  : runtimeConfig.public.apiBaseUrl) || "http://localhost:3000").replace(
  /\/$/,
  "",
);
configureCatalogApiBaseUrl(apiBaseUrl);
configureCartApiBaseUrl(apiBaseUrl);

const seoTitle = computed(() => {
  if (selectedProduct.value?.name) return selectedProduct.value.name;
  if (isNewArrivalsPage) return 'New Arrivals';
  if (listingCategory) return `${listingCategory} Collection`;
  if (isShopTheLookPage) return 'Shop the Look';
  if (isDesignerListPage) return 'Designers';
  if (isTestimonialsPage) return 'Testimonials';
  if (isCartPage) return 'Shopping Cart';
  if (isCheckoutPage || isCheckoutReviewPage) return 'Checkout';
  return 'Modern Luxury, Made Personal';
});
const seoDescription = computed(() => {
  if (selectedProduct.value?.description) return selectedProduct.value.description;
  if (listingCategory) return `Explore ${listingCategory} furniture from Caracole Philippines.`;
  if (isNewArrivalsPage) return 'Discover the newest artful furnishings from Caracole Philippines.';
  return 'Discover Caracole Philippines — artful furnishings, expressive rooms, and modern luxury made personal.';
});

useSeoMeta({
  title: () => seoTitle.value,
  description: () => seoDescription.value,
  ogTitle: () => seoTitle.value,
  ogDescription: () => seoDescription.value,
  twitterTitle: () => seoTitle.value,
  twitterDescription: () => seoDescription.value,
});

// Public catalog pages render their data on the server when the API is
// available. Browser-only interactions still initialize in onMounted.
if (import.meta.server) {
  const serverLoad = isProductPage
    ? loadProductByHandle(decodeURIComponent(productRouteMatch[1]))
    : isListingPage
      ? loadCatalog({
          page: 1,
          limit: 24,
          ...(isNewArrivalsPage ? {} : { category: listingCategory }),
          ...(listingSubcategory ? { subcategory: listingSubcategory } : {}),
        })
      : Promise.resolve();

  await serverLoad.catch(() => {});
}

function heroBannerToSlide(banner) {
  const category = banner.category === "Entertainments" ? "Entertainment" : banner.category;
  const categorySlug = categorySlugs[category] || "living";

  return {
    id: banner.id,
    src: banner.mediaUrl,
    mediaType: banner.mediaType,
    eyebrow: banner.subtitle || "Caracole Philippines",
    title: banner.title,
    copy: banner.description,
    href: `/products/${categorySlug}`,
    cta: `Explore ${category}`,
  };
}

async function loadHeroBanners() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/hero-banners`);
    if (!response.ok) throw new Error("Hero banners are unavailable");

    const payload = await response.json();
    const savedBannersByPosition = new Map(
      (payload.heroBanners || []).map((banner) => [banner.position, heroBannerToSlide(banner)]),
    );
    videos.value = placeholderHeroBanners.map(
      (placeholder, index) => savedBannersByPosition.get(index) || placeholder,
    );
    currentVideo.value = 0;
    videoProgress.value = 0;
  } catch (error) {
    console.warn("Unable to load hero banners", error);
    videos.value = [...placeholderHeroBanners];
  }
}

const requestedSubcategories = {
  Living: [
    "Chairs",
    "Sofas & Loveseats",
    "Settees & Chaises",
    "Sectionals",
    "Benches & Ottomans",
    "Center & Cocktail Tables",
    "Side & End Tables",
    "Consoles & Desks",
  ],
  Dining: [
    "Bar & Counter Stools",
    "Dining Chairs",
    "Dining Tables",
    "Sideboards & Buffets",
  ],
  Bedroom: [
    "Beds",
    "Nightstands",
    "Chest Of Drawers",
    "Dressers",
    "Armoires & Wardrobes",
  ],
};

function catalogSubcategories(category) {
  const group = catalogFilters.find((item) => item.name === category);
  const counts = new Map(
    (group?.subcategories ?? []).map((item) => [item.name, item.count]),
  );
  const names = [
    ...new Set([...(requestedSubcategories[category] ?? []), ...counts.keys()]),
  ];
  const categorySlug = categorySlugs[category];

  return names.map((name) => ({
    name,
    count: counts.get(name) ?? 0,
    href: `/products/${categorySlug}?subcategory=${encodeURIComponent(name)}`,
    filter: { category, subcategory: name },
    }));
};

const categories = ref([
  {
    name: "Living",
    number: "01",
    images: ["/media/shop-the-look/living-room.jpeg"],
    href: "/products/living",
    size: "wide",
    subcategories: catalogSubcategories("Living"),
  },
  {
    name: "Dining",
    number: "02",
    images: ["/media/shop-the-look/dining-room.jpeg"],
    href: "/products/dining",
    size: "tall",
    subcategories: catalogSubcategories("Dining"),
  },
  {
    name: "Bedroom",
    number: "03",
    images: ["/media/shop-the-look/bedroom.jpeg"],
    href: "/products/bedroom",
    size: "standard",
    subcategories: catalogSubcategories("Bedroom"),
  },
  {
    name: "Mirrors & Accessories",
    number: "04",
    images: ["/media/shop-the-look/mirrors_living_room.jpeg"],
    href: "/products/mirrors-accessories",
    size: "standard",
  },
  {
    name: "Entertainment",
    number: "05",
    images: ["/media/shop-the-look/entertainment_living_room_two.jpeg"],
    href: "/products/entertainment",
    size: "wide",
  },
]);
const categoryImageIndexes = ref(categories.value.map(() => 0));

const featuredDesigners = computed(() => {
  const configured = designerProfiles.value.filter((designer) => designer.isFeatured);
  return (hasLoadedDesignerProfiles.value ? configured : fallbackDesigners).slice(0, 2);
});

function designerProfileToClientProfile(designer) {
  return {
    slug: designer.slug,
    name: designer.name,
    link: designer.link,
    image: designer.thumbnailImageUrl,
    banner: designer.headerImageUrl,
    introDescription: designer.tagline,
    profileDescription: designer.briefStory,
    isFeatured: designer.isFeatured,
    featuredProducts: (designer.featuredProducts || []).map((product) => ({
      name: product.name,
      description: product.shortDescription,
      image: product.lifestyleImageUrl,
    })),
  };
}

function applyContentDisplays(content) {
  if (content?.categories) {
    const displays = new Map((content.categories.displays || []).map((display) => [display.name, display.imageUrl]));
    categories.value = categories.value.map((category) => ({
      ...category,
      images: displays.has(category.name) ? [displays.get(category.name)] : category.images,
    }));
    categoryImageIndexes.value = categories.value.map(() => 0);
  }
  if (content?.designers) {
    designerProfiles.value = (content.designers.designers || []).map(designerProfileToClientProfile);
    hasLoadedDesignerProfiles.value = true;
  }
}

async function fetchContentDisplays() {
  try {
    const [categoryResponse, designerResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/api/v1/content/main-categories`),
      fetch(`${apiBaseUrl}/api/v1/content/designers/public`),
    ]);
    return {
      categories: categoryResponse.ok ? await categoryResponse.json() : null,
      designers: designerResponse.ok ? await designerResponse.json() : null,
    };
  } catch (error) {
    console.warn("Unable to load content displays", error);
    return null;
  }
}

async function loadContentDisplays() {
  applyContentDisplays(await fetchContentDisplays());
}

const { data: initialContentDisplays } = await useAsyncData('homepage-content-displays', fetchContentDisplays);
applyContentDisplays(initialContentDisplays.value);

const products = computed(() => [...catalogProducts.value]
  .sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0))
  .slice(0, 5)
  .map((product) => ({
    id: product.id,
    edpNumber: product.edpNumber,
    name: product.name,
    category: product.primaryCategory,
    subcategory: product.subcategory,
    image: product.image,
    images: product.images,
    href: getProductPath(product),
  })));

const shopTheLookEnvironments = ref([]);
const shopTheLookProducts = ref([]);
const shopTheLookEnvironmentCount = ref(0);
const isLoadingShopTheLook = ref(false);

const allShopTheLooks = computed(() => {
  const productsById = new Map(shopTheLookProducts.value.map((product) => [product.id, product]));

  return shopTheLookEnvironments.value.slice(0, 10).map((environment) => ({
    id: environment.id,
    name: environment.name,
    image: environment.imageUrl,
    description: environment.description,
    products: (environment.hotspots || []).map((hotspot) => {
      const product = productsById.get(hotspot.productId);
      if (!product) return null;
      return {
        id: `${environment.id}-${hotspot.id}`,
        name: product.name,
        edpNumber: product.edpNumber,
        image: product.image,
        price: product.price ? formatCartPrice(Number(product.price)) : "Price on request",
        category: product.category,
        subcategory: product.subcategory,
        href: `/product/${encodeURIComponent(product.handle)}`,
        x: hotspot.x,
        y: hotspot.y,
        side: hotspot.x > 58 ? "left" : "right",
      };
    }).filter(Boolean),
  }));
});

const looks = computed(() => allShopTheLooks.value.slice(0, 3));

async function loadShopTheLookEnvironments() {
  isLoadingShopTheLook.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/shop-the-look/public`);
    if (!response.ok) throw new Error("Shop the Look is unavailable");
    const payload = await response.json();
    shopTheLookEnvironments.value = payload.environments || [];
    shopTheLookProducts.value = payload.products || [];
    shopTheLookEnvironmentCount.value = payload.totalEnvironments || shopTheLookEnvironments.value.length;
    lookIndex.value = 0;
  } catch (error) {
    console.warn("Unable to load Shop the Look", error);
    shopTheLookEnvironments.value = [];
    shopTheLookProducts.value = [];
    shopTheLookEnvironmentCount.value = 0;
  } finally {
    isLoadingShopTheLook.value = false;
  }
}

const locations = [
  {
    label: "Flagship Showroom",
    branch: "Greenhills",
    name: "GH Mall, San Juan",
    address: "4F GH Mall, Ortigas Avenue, San Juan City, Philippines",
    hours: ["Mon–Thu · 10:00 AM–9:00 PM", "Fri–Sun · 10:00 AM–10:00 PM"],
    phones: "(02) 8682-0074 · 0917-183-1793",
    images: [
      "/media/locations/greenhills/image_1.jpg",
      "/media/locations/greenhills/image_2.jpg",
      "/media/locations/greenhills/image_3.jpg",
    ],
  },
  {
    label: "Design Center",
    branch: "Quezon City",
    name: "Manresa, Quezon City",
    address:
      "157 Sgt. E. Rivera Street, Brgy. Manresa, Quezon City, Philippines",
    hours: ["Mon–Fri · 8:30 AM–5:30 PM"],
    phones: "(02) 8362-1111 · 0917-858-3858",
    images: [
      "/media/locations/quezon-city/image_1.jpeg",
      "/media/locations/quezon-city/image_2.jpeg",
      "/media/locations/quezon-city/image_3.jpeg",
    ],
  },
];

const currentVideo = ref(0);
const videoEl = ref(null);
const videoProgress = ref(0);
const menuOpen = ref(false);
const activeMenuCategory = ref(null);
const lookIndex = ref(0);
const newsletterSent = ref(false);
const email = ref("");
const locationImageIndexes = ref(locations.map(() => 0));
const locationTimers = new Map();
const lookMediaViewport = ref(null);
const lookImageDimensions = ref({ width: 1920, height: 1080 });
const lookCanvasDimensions = ref({ width: 1920, height: 1080 });
const lookPan = ref({ active: false, moved: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
const isLookProductsDialogOpen = ref(false);
const lookProductsDialog = ref(null);
const selectedShopTheLook = ref(null);
const shopTheLookViewer = ref(null);
const shopTheLookHover = ref({ productId: null, source: null });
const shopTheLookProductPreview = ref(null);
const categoryTimers = new Map();
const accountView = ref(null);
const currentUser = ref(null);
const authError = ref("");
const loginForm = reactive({ email: "", password: "" });
const registerForm = reactive({
  firstName: "",
  lastName: "",
  email: "",
  password: "",
});
const sampleAccount = {
  firstName: "John",
  lastName: "Doe",
  email: "johndoe@gmail.com",
  password: "12345",
};
const designerOpen = ref(false);
const designerSubmitted = ref(false);
const designerError = ref("");
const designerFieldErrors = reactive({});
const isSubmittingDesigner = ref(false);
const showDesignerPassword = ref(false);
const showDesignerConfirmPassword = ref(false);
const designerForm = reactive({
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
  birthDate: "",
  company: "",
  officeAddress: "",
  website: "",
  password: "",
  confirmPassword: "",
  touchpoint: "",
  discovery: "",
  termsAccepted: false,
  captchaConfirmed: false,
});
const serviceModal = ref(null);
const serviceSubmitted = ref(false);
const contactForm = reactive({
  firstName: "",
  lastName: "",
  email: "",
  contactNumber: "",
  inquiry: "",
  captchaConfirmed: false,
});
const appointmentForm = reactive({
  firstName: "",
  lastName: "",
  email: "",
  contactNumber: "",
  company: "",
  branch: "",
  date: "",
  time: "",
  captchaConfirmed: false,
});
const appointmentMinDate = new Date().toISOString().slice(0, 10);
const searchOpen = ref(false);
const cartOpen = ref(false);
const cartItems = ref([]);
const cartCount = computed(() =>
  cartItems.value.reduce((total, item) => total + item.quantity, 0),
);
const cartTotal = computed(() => cartSubtotal(cartItems.value));
const wishlistSet = ref(new Set());

const activeVideo = computed(() => videos.value[currentVideo.value] || null);
const activeLook = computed(() => looks.value[lookIndex.value] || looks.value[0]);
const activeLookImageStyle = computed(() => ({
  width: `${lookCanvasDimensions.value.width}px`,
  height: `${lookCanvasDimensions.value.height}px`,
}));

function selectVideo(index) {
  if (!videos.value.length) return;
  currentVideo.value = (index + videos.value.length) % videos.value.length;
  videoProgress.value = 0;
}

function nextVideo() {
  selectVideo(currentVideo.value + 1);
}

function selectLook(index) {
  lookIndex.value = index;
  lookImageDimensions.value = { width: 1920, height: 1080 };
  lookCanvasDimensions.value = { width: 1920, height: 1080 };
  lookPan.value.moved = false;
  void nextTick(() => {
    if (lookMediaViewport.value) {
      lookMediaViewport.value.scrollLeft = 0;
      lookMediaViewport.value.scrollTop = 0;
    }
  });
}

function updateLookImageDimensions(event) {
  const image = event.target;
  if (image.naturalWidth && image.naturalHeight) {
    lookImageDimensions.value = { width: image.naturalWidth, height: image.naturalHeight };
    void nextTick(fitLookCanvasToViewport);
  }
}

function fitLookCanvasToViewport() {
  const viewport = lookMediaViewport.value;
  if (!viewport) return;
  const { width, height } = lookImageDimensions.value;
  const scale = Math.max(viewport.clientWidth / width, viewport.clientHeight / height);
  lookCanvasDimensions.value = {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function startLookPan(event) {
  if (event.button !== 0 || event.target.closest(".look-pin")) return;
  const viewport = lookMediaViewport.value;
  if (!viewport) return;
  lookPan.value = {
    active: true,
    moved: false,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: viewport.scrollLeft,
    scrollTop: viewport.scrollTop,
  };
  viewport.setPointerCapture?.(event.pointerId);
}

function moveLookPan(event) {
  if (!lookPan.value.active || !lookMediaViewport.value) return;
  const deltaX = event.clientX - lookPan.value.startX;
  const deltaY = event.clientY - lookPan.value.startY;
  if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) lookPan.value.moved = true;
  lookMediaViewport.value.scrollLeft = lookPan.value.scrollLeft - deltaX;
  lookMediaViewport.value.scrollTop = lookPan.value.scrollTop - deltaY;
}

function stopLookPan(event) {
  const moved = lookPan.value.moved;
  if (lookPan.value.active) event.currentTarget.releasePointerCapture?.(event.pointerId);
  lookPan.value.active = false;
  if (moved) window.setTimeout(() => { lookPan.value.moved = false; }, 0);
}

function preventPinClickAfterPan(event) {
  if (!lookPan.value.moved) return;
  event.preventDefault();
  lookPan.value.moved = false;
}

function closeLookProductsDialog() {
  isLookProductsDialogOpen.value = false;
}

function openLookProductsDialog() {
  isLookProductsDialogOpen.value = true;
}

function trapLookProductsDialogFocus(event) {
  if (event.key !== "Tab" || !lookProductsDialog.value) return;
  const focusable = [...lookProductsDialog.value.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openShopTheLookEnvironment(environment) {
  selectedShopTheLook.value = environment;
}

function closeShopTheLookEnvironment() {
  selectedShopTheLook.value = null;
  shopTheLookHover.value = { productId: null, source: null };
}

function browseShopTheLookEnvironment(direction) {
  const environments = allShopTheLooks.value;
  if (environments.length < 2 || !selectedShopTheLook.value) return;
  const currentIndex = environments.findIndex((environment) => environment.id === selectedShopTheLook.value.id);
  const nextIndex = (Math.max(currentIndex, 0) + direction + environments.length) % environments.length;
  selectedShopTheLook.value = environments[nextIndex];
  clearShopTheLookHover();
}

function setShopTheLookHover(productId, source) {
  shopTheLookHover.value = { productId, source };
  if (source === "pin") void nextTick(updateShopTheLookProductPreview);
  else shopTheLookProductPreview.value = null;
}

function clearShopTheLookHover() {
  shopTheLookHover.value = { productId: null, source: null };
  shopTheLookProductPreview.value = null;
}

function updateShopTheLookProductPreview() {
  const { productId, source } = shopTheLookHover.value;
  if (source !== "pin" || !productId || !selectedShopTheLook.value) {
    shopTheLookProductPreview.value = null;
    return;
  }
  const productRow = [...document.querySelectorAll("[data-shop-look-product]")]
    .find((element) => element.dataset.shopLookProduct === productId);
  const product = selectedShopTheLook.value.products.find((item) => item.id === productId);
  if (!productRow || !product) {
    shopTheLookProductPreview.value = null;
    return;
  }
  const bounds = productRow.getBoundingClientRect();
  const isVisible = bounds.bottom > 20 && bounds.top < window.innerHeight - 20;
  const previewWidth = Math.min(390, window.innerWidth - 40);
  const horizontalPosition = Math.max(
    20,
    Math.min(window.innerWidth - previewWidth - 20, bounds.left),
  );
  shopTheLookProductPreview.value = isVisible ? null : { product, horizontalPosition };
}

function handleShopTheLookViewerScroll() {
  updateShopTheLookProductPreview();
}

function trapShopTheLookViewerFocus(event) {
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    browseShopTheLookEnvironment(-1);
    return;
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    browseShopTheLookEnvironment(1);
    return;
  }
  if (event.key !== "Tab" || !shopTheLookViewer.value) return;
  const focusable = [...shopTheLookViewer.value.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function updateProgress(event) {
  const { currentTime, duration } = event.target;
  videoProgress.value = duration
    ? Math.min(100, (currentTime / duration) * 100)
    : 0;
}

function closeMenu() {
  menuOpen.value = false;
  activeMenuCategory.value = null;
}

function toggleMenu() {
  closeAccount();
  closeCart();
  closeDesigner();
  closeSearch();
  menuOpen.value = !menuOpen.value;
  if (!menuOpen.value) activeMenuCategory.value = null;
}

function submitNewsletter() {
  if (!email.value) return;
  newsletterSent.value = true;
}

function startLocationCarousel(index) {
  if (locationTimers.has(index) || locations[index].images.length < 2) return;

  locationTimers.set(
    index,
    window.setInterval(() => {
      locationImageIndexes.value[index] =
        (locationImageIndexes.value[index] + 1) %
        locations[index].images.length;
    }, 1500),
  );
}

function stopLocationCarousel(index) {
  const timer = locationTimers.get(index);
  if (timer) window.clearInterval(timer);
  locationTimers.delete(index);
  locationImageIndexes.value[index] = 0;
}

function handleLocationFocusOut(index, event) {
  if (!event.currentTarget.contains(event.relatedTarget))
    stopLocationCarousel(index);
}

function startCategoryCarousel(index) {
  if (categoryTimers.has(index) || categories.value[index].images.length < 2) return;

  categoryTimers.set(
    index,
    window.setInterval(() => {
      categoryImageIndexes.value[index] =
        (categoryImageIndexes.value[index] + 1) %
        categories.value[index].images.length;
    }, 1500),
  );
}

function stopCategoryCarousel(index) {
  const timer = categoryTimers.get(index);
  if (timer) window.clearInterval(timer);
  categoryTimers.delete(index);
}

function handleCategoryFocusOut(index, event) {
  if (!event.currentTarget.contains(event.relatedTarget))
    stopCategoryCarousel(index);
}

watch(currentVideo, async () => {
  await nextTick();
  videoEl.value?.load();
  videoEl.value?.play().catch(() => {});
});

watch([isLookProductsDialogOpen, selectedShopTheLook], async ([isProductsDialogOpen, selectedLook]) => {
  const isOpen = isProductsDialogOpen || Boolean(selectedLook);
  const appRoot = document.getElementById("app");
  document.body.classList.toggle("modal-scroll-lock", isOpen);
  if (appRoot) appRoot.inert = isOpen;
  if (isOpen) {
    await nextTick();
    if (selectedLook) shopTheLookViewer.value?.querySelector("button")?.focus();
    else lookProductsDialog.value?.querySelector("button")?.focus();
  }
});

function handleKey(event) {
  if (event.key === "Escape") {
    closeMenu();
    closeAccount();
    closeCart();
    closeDesigner();
    closeServiceModal();
    closeSearch();
    closeLookProductsDialog();
    closeShopTheLookEnvironment();
  }
}

function storedAccounts() {
  try {
    const accounts = JSON.parse(
      localStorage.getItem("caracole-accounts") || "[]",
    );
    const sampleIndex = accounts.findIndex(
      (account) => account.email.toLowerCase() === sampleAccount.email,
    );
    if (sampleIndex === -1) accounts.push(sampleAccount);
    else accounts[sampleIndex] = sampleAccount;
    localStorage.setItem("caracole-accounts", JSON.stringify(accounts));
    return accounts;
  } catch {
    localStorage.setItem("caracole-accounts", JSON.stringify([sampleAccount]));
    return [sampleAccount];
  }
}

function openAccount() {
  closeMenu();
  closeCart();
  closeDesigner();
  closeSearch();
  authError.value = "";
  accountView.value = currentUser.value ? "account" : "login";
}

function closeAccount() {
  accountView.value = null;
  authError.value = "";
}

function showRegistration() {
  authError.value = "";
  accountView.value = "register";
}

function showLogin() {
  authError.value = "";
  accountView.value = "login";
}

function persistSession(account) {
  const session = {
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
  };
  currentUser.value = session;
  localStorage.setItem("caracole-session", JSON.stringify(session));
  syncCart(getCart());
}

function login() {
  const account = storedAccounts().find(
    (item) =>
      item.email.toLowerCase() === loginForm.email.trim().toLowerCase() &&
      item.password === loginForm.password,
  );
  if (!account) {
    authError.value = "The email address or password is incorrect.";
    return;
  }
  persistSession(account);
  loginForm.email = "";
  loginForm.password = "";
  accountView.value = "account";
}

function createAccount() {
  const accounts = storedAccounts();
  const email = registerForm.email.trim().toLowerCase();
  if (accounts.some((account) => account.email.toLowerCase() === email)) {
    authError.value = "An account with this email address already exists.";
    return;
  }
  const account = {
    firstName: registerForm.firstName.trim(),
    lastName: registerForm.lastName.trim(),
    email,
    password: registerForm.password,
  };
  accounts.push(account);
  localStorage.setItem("caracole-accounts", JSON.stringify(accounts));
  persistSession(account);
  Object.assign(registerForm, {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  accountView.value = "account";
}

function signOut() {
  localStorage.removeItem("caracole-session");
  currentUser.value = null;
  syncCart(getCart());
  closeAccount();
}

function refreshCart() {
  cartItems.value = getCart();
}

function openCart() {
  closeMenu();
  closeAccount();
  closeDesigner();
  closeSearch();
  refreshCart();
  syncCart(getCart());
  cartOpen.value = true;
}

function closeCart() {
  cartOpen.value = false;
}

function closePanels() {
  closeAccount();
  closeCart();
  closeDesigner();
  closeServiceModal();
}

function openDesigner() {
  closeMenu();
  closeAccount();
  closeCart();
  closeSearch();
  designerError.value = "";
  clearDesignerFieldErrors();
  designerSubmitted.value = false;
  showDesignerPassword.value = false;
  showDesignerConfirmPassword.value = false;
  designerOpen.value = true;
}

function closeDesigner() {
  designerOpen.value = false;
  designerError.value = "";
  clearDesignerFieldErrors();
  showDesignerPassword.value = false;
  showDesignerConfirmPassword.value = false;
}

function prefillGuestForm(form) {
  if (!currentUser.value) return;
  form.firstName = form.firstName || currentUser.value.firstName || "";
  form.lastName = form.lastName || currentUser.value.lastName || "";
  form.email = form.email || currentUser.value.email || "";
}

function openServiceModal(type, branch = "") {
  closeMenu();
  closeAccount();
  closeCart();
  closeDesigner();
  closeSearch();
  serviceSubmitted.value = false;
  serviceModal.value = type;
  prefillGuestForm(type === "contact" ? contactForm : appointmentForm);
  if (type === "appointment" && branch) appointmentForm.branch = branch;
}

function closeServiceModal() {
  serviceModal.value = null;
  serviceSubmitted.value = false;
}

function saveLocalSubmission(key, submission) {
  try {
    const submissions = JSON.parse(localStorage.getItem(key) || "[]");
    submissions.push(submission);
    localStorage.setItem(key, JSON.stringify(submissions));
  } catch {
    localStorage.setItem(key, JSON.stringify([submission]));
  }
}

function submitContact() {
  saveLocalSubmission("caracole-contact-inquiries", {
    ...contactForm,
    submittedAt: new Date().toISOString(),
  });
  serviceSubmitted.value = true;
}

function submitAppointment() {
  saveLocalSubmission("caracole-showroom-appointments", {
    ...appointmentForm,
    submittedAt: new Date().toISOString(),
  });
  serviceSubmitted.value = true;
}

function openSearch() {
  closeMenu();
  closeAccount();
  closeCart();
  closeDesigner();
  searchOpen.value = true;
}

function closeSearch() {
  searchOpen.value = false;
}

function clearDesignerFieldErrors() {
  Object.keys(designerFieldErrors).forEach((field) => delete designerFieldErrors[field]);
}

function setDesignerFieldError(field, message) {
  if (!designerFieldErrors[field]) designerFieldErrors[field] = message;
}

function validateDesignerApplication() {
  clearDesignerFieldErrors();

  if (!designerForm.firstName.trim()) setDesignerFieldError("firstName", "First name is required.");
  if (!designerForm.lastName.trim()) setDesignerFieldError("lastName", "Last name is required.");
  if (!designerForm.email.trim()) {
    setDesignerFieldError("email", "Email address is required.");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(designerForm.email.trim())) {
    setDesignerFieldError("email", "Enter a valid email address.");
  }
  if (!/^\+63\d{10}$/.test(designerForm.mobile.trim())) {
    setDesignerFieldError("mobile", "Enter a mobile number in the format +63 followed by 10 digits.");
  }
  if (!designerForm.birthDate) setDesignerFieldError("birthDate", "Birth date is required.");
  if (!designerForm.company.trim()) setDesignerFieldError("company", "Company is required.");
  if (!designerForm.officeAddress.trim()) setDesignerFieldError("officeAddress", "Office address is required.");
  if (designerForm.website.trim()) {
    try {
      new URL(designerForm.website.trim());
    } catch {
      setDesignerFieldError("website", "Enter a valid website URL, including https://.");
    }
  }
  if (designerForm.password.length < 8) setDesignerFieldError("password", "Password must be at least 8 characters.");
  if (designerForm.password !== designerForm.confirmPassword) setDesignerFieldError("confirmPassword", "Passwords must match exactly.");
  if (!designerForm.touchpoint) setDesignerFieldError("touchpoint", "Select a touchpoint.");
  if (!designerForm.discovery) setDesignerFieldError("discovery", "Select how you heard about us.");
  if (!designerForm.termsAccepted) setDesignerFieldError("termsAccepted", "You must accept the Terms & Conditions and Privacy Policy.");
  if (!designerForm.captchaConfirmed) setDesignerFieldError("captchaConfirmed", "Confirm that you are not a robot.");

  return Object.keys(designerFieldErrors).length === 0;
}

function applyDesignerApiErrors(errors) {
  const fieldByPath = {
    email: "email",
    password: "password",
    "designer.firstName": "firstName",
    "designer.lastName": "lastName",
    "designer.mobileNumber": "mobile",
    "designer.birthdate": "birthDate",
    "designer.company": "company",
    "designer.officeAddress": "officeAddress",
    "designer.companyWebsite": "website",
    "designer.touchpoint": "touchpoint",
    "designer.howDidYouHearAboutUs": "discovery",
  };
  errors?.forEach((issue) => {
    const field = fieldByPath[issue.path?.join(".")];
    if (field) setDesignerFieldError(field, issue.message);
  });
}

async function submitDesignerApplication() {
  designerError.value = "";
  if (!validateDesignerApplication()) return;

  isSubmittingDesigner.value = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/register/designer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: designerForm.email.trim().toLowerCase(),
        password: designerForm.password,
        designer: {
          firstName: designerForm.firstName.trim(),
          lastName: designerForm.lastName.trim(),
          mobileNumber: designerForm.mobile.trim(),
          birthdate: designerForm.birthDate,
          company: designerForm.company.trim() || null,
          officeAddress: designerForm.officeAddress.trim() || null,
          companyWebsite: designerForm.website.trim() || null,
          touchpoint: designerForm.touchpoint,
          howDidYouHearAboutUs: designerForm.discovery,
        },
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      applyDesignerApiErrors(payload.errors);
      throw new Error(payload.message || "We could not submit your registration. Please try again.");
    }

    designerSubmitted.value = true;
    clearDesignerFieldErrors();
    Object.assign(designerForm, {
      firstName: "",
      lastName: "",
      email: "",
      mobile: "",
      birthDate: "",
      company: "",
      officeAddress: "",
      website: "",
      password: "",
      confirmPassword: "",
      touchpoint: "",
      discovery: "",
      termsAccepted: false,
      captchaConfirmed: false,
    });
  } catch (error) {
    if (!Object.keys(designerFieldErrors).length) designerError.value = error.message || "We could not submit your registration. Please try again.";
  } finally {
    isSubmittingDesigner.value = false;
  }
}

function changeDrawerQuantity(item, amount) {
  setCartQuantity(
    item.id,
    Math.max(1, Math.min(99, item.quantity + amount)),
  );
}

function removeDrawerItem(id) {
  removeCartItem(id);
}

function refreshWishlist() {
  wishlistSet.value = new Set(getWishlist());
}

function updateWishlist(id) {
  wishlistSet.value = new Set(toggleWishlist(id));
}

onMounted(() => {
  window.addEventListener("keydown", handleKey);
  window.addEventListener(CART_EVENT, refreshCart);
  window.addEventListener("storage", refreshCart);
  window.addEventListener(WISHLIST_EVENT, refreshWishlist);
  window.addEventListener("resize", fitLookCanvasToViewport);
  refreshCart();
  refreshWishlist();
  if (!isListingPage && !isProductPage) void loadCatalog().catch(() => {});
  if (productRouteMatch) void loadProductByHandle(decodeURIComponent(productRouteMatch[1])).catch(() => {});
  void loadHeroBanners();
  void loadShopTheLookEnvironments();
  void loadContentDisplays();
  storedAccounts();
  try {
    currentUser.value = JSON.parse(
      localStorage.getItem("caracole-session") || "null",
    );
  } catch {
    localStorage.removeItem("caracole-session");
  }
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKey);
  window.removeEventListener(CART_EVENT, refreshCart);
  window.removeEventListener("storage", refreshCart);
  window.removeEventListener(WISHLIST_EVENT, refreshWishlist);
  window.removeEventListener("resize", fitLookCanvasToViewport);
  locationTimers.forEach((timer) => window.clearInterval(timer));
  locationTimers.clear();
  categoryTimers.forEach((timer) => window.clearInterval(timer));
  categoryTimers.clear();
  document.body.classList.remove("modal-scroll-lock");
  const appRoot = document.getElementById("app");
  if (appRoot) appRoot.inert = false;
});
</script>

<template>
  <div class="site-shell">
    <a class="skip-link" href="#main">Skip to content</a>

    <header
      class="header"
      :class="{
        'menu-active': menuOpen,
        'header--light':
          isNewArrivalsPage ||
          isShopTheLookPage ||
          isProductPage ||
          isCartPage ||
          isCheckoutPage ||
          isCheckoutReviewPage ||
          isTestimonialsPage ||
          isOrdersPage ||
          isWishlistPage ||
          isDesignerListPage ||
          isDesignerProfilePage,
      }"
    >
      <button
        class="menu-toggle"
        type="button"
        :aria-expanded="menuOpen"
        aria-label="Toggle menu"
        @click="toggleMenu"
      >
        <span></span><span></span>
      </button>
      <a :href="homeLink('#story')" class="header-link header-link--left"
        ><span>Our Story</span></a
      >
      <a
        class="brand"
        :href="homeLink()"
        aria-label="Caracole Philippines home"
      >
        <img src="/brand/caracole-logo.png" alt="Caracole" />
        <small>PHILIPPINES</small>
      </a>
      <a :href="homeLink('#locations')" class="header-link"
        ><span>Showrooms</span></a
      >
      <a href="/products/new-arrivals" class="header-link"
        ><span>New Arrivals</span></a
      >
      <a href="/testimonials" class="header-link"><span>Testimonials</span></a>
      <button
        class="header-link header-designer-link"
        type="button"
        @click="openDesigner"
      >
        <span>Become a Designer</span>
      </button>
      <div class="header-actions">
        <button
          class="user-button"
          type="button"
          :aria-label="
            currentUser
              ? `Open ${currentUser.firstName}'s account`
              : 'Sign in or create an account'
          "
          :aria-expanded="Boolean(accountView)"
          @click="openAccount"
        >
          <span class="user-button__head"></span
          ><span class="user-button__body"></span>
        </button>
        <button
          class="cart-button"
          type="button"
          aria-label="Open shopping cart"
          :aria-expanded="cartOpen"
          @click="openCart"
        >
          <span class="cart-button__handle"></span
          ><span class="cart-button__bag"></span
          ><b v-if="cartCount">{{ cartCount > 99 ? "99+" : cartCount }}</b>
        </button>
        <button
          class="search-button"
          type="button"
          aria-label="Search Caracole"
          :aria-expanded="searchOpen"
          @click="openSearch"
        >
          <span aria-hidden="true">⌕</span>
        </button>
      </div>
    </header>

    <ProductSearch :open="searchOpen" @close="closeSearch" />

    <div
      class="menu-panel"
      :class="{ open: menuOpen }"
      aria-label="Main navigation"
    >
      <div class="menu-panel__inner">
        <nav aria-label="Product categories">
          <Accordion v-model:value="activeMenuCategory" class="menu-accordion" unstyled>
            <template v-for="category in categories" :key="category.name">
              <AccordionPanel
                v-if="category.subcategories"
                :value="category.name"
                class="menu-category"
                unstyled
              >
                <AccordionHeader class="menu-category__trigger" unstyled>
                  <span class="menu-category__number">{{
                    category.number
                  }}</span>
                  <span class="menu-category__name">{{ category.name }}</span>
                  <b class="menu-category__icon" aria-hidden="true">{{
                    activeMenuCategory === category.name ? "−" : "+"
                  }}</b>
                </AccordionHeader>
                <AccordionContent class="menu-category__content" unstyled>
                  <div class="menu-subcategories">
                    <a
                      :href="category.href"
                      class="menu-subcategory-link menu-subcategory-link--all"
                      @click="closeMenu"
                    >
                      <span>View all {{ category.name }}</span
                      ><b aria-hidden="true">↗</b>
                    </a>
                    <a
                      v-for="subcategory in category.subcategories"
                      :key="subcategory.name"
                      :href="subcategory.href"
                      class="menu-subcategory-link"
                      :data-category="subcategory.filter.category"
                      :data-subcategory="subcategory.filter.subcategory"
                      @click="closeMenu"
                    >
                      <span>{{ subcategory.name }}</span
                      ><b aria-hidden="true">↗</b>
                    </a>
                  </div>
                </AccordionContent>
              </AccordionPanel>
              <a
                v-else
                :href="category.href"
                class="menu-category__trigger menu-category__direct"
                @click="closeMenu"
              >
                <span class="menu-category__number">{{ category.number }}</span>
                <span class="menu-category__name">{{ category.name }}</span>
                <b class="menu-category__icon" aria-hidden="true">↗</b>
              </a>
            </template>
          </Accordion>
        </nav>
        <div class="menu-secondary">
          <a :href="homeLink('#story')" @click="closeMenu">About Caracole</a>
          <a :href="homeLink('#look')" @click="closeMenu">Shop the Look</a>
          <a :href="homeLink('#locations')" @click="closeMenu">Locations</a>
          <a href="https://caracole.ph/catalogs">Catalogues</a>
          <a href="/testimonials" @click="closeMenu">Testimonials</a>
          <button type="button" @click="openDesigner">Become a Designer</button>
          <p>Modern luxury, thoughtfully composed for the Philippine home.</p>
        </div>
      </div>
    </div>

    <div
      class="account-backdrop"
      :class="{ open: accountView || cartOpen || designerOpen || serviceModal }"
      @click="closePanels"
    ></div>

    <section
      v-if="serviceModal"
      class="service-modal"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="`${serviceModal}-modal-title`"
    >
      <button
        class="service-modal__close"
        type="button"
        :aria-label="`Close ${serviceModal} form`"
        @click="closeServiceModal"
      >
        ×
      </button>
      <div v-if="serviceSubmitted" class="service-modal__success">
        <span aria-hidden="true">✓</span>
        <p class="eyebrow">Request received</p>
        <h2 :id="`${serviceModal}-modal-title`">Thank you.</h2>
        <p>
          {{
            serviceModal === "contact"
              ? "A Caracole PH specialist will respond to your inquiry shortly."
              : "Our showroom team will contact you to confirm your appointment."
          }}
        </p>
        <button type="button" @click="closeServiceModal">
          Continue exploring
        </button>
      </div>
      <template v-else-if="serviceModal === 'contact'">
        <header>
          <p class="eyebrow">We would love to hear from you</p>
          <h2 id="contact-modal-title">Contact Us</h2>
          <p>Reach out with any questions, requests, or feedback.</p>
        </header>
        <form class="service-form" @submit.prevent="submitContact">
          <div class="service-fields service-fields--two">
            <label
              ><span>First name</span
              ><input
                v-model.trim="contactForm.firstName"
                autocomplete="given-name"
                required /></label
            ><label
              ><span>Last name</span
              ><input
                v-model.trim="contactForm.lastName"
                autocomplete="family-name"
                required /></label
            ><label
              ><span>Email</span
              ><input
                v-model.trim="contactForm.email"
                type="email"
                autocomplete="email"
                required /></label
            ><label
              ><span>Contact number</span
              ><input
                v-model.trim="contactForm.contactNumber"
                type="tel"
                autocomplete="tel"
                required
            /></label>
          </div>
          <label
            ><span>Enter your inquiry</span
            ><textarea v-model.trim="contactForm.inquiry" required></textarea>
          </label>
          <div class="service-form__foot">
            <label class="service-captcha"
              ><input
                v-model="contactForm.captchaConfirmed"
                type="checkbox"
                required
              /><span
                ><b>I'm not a robot</b
                ><small>Prototype verification</small></span
              ><i aria-hidden="true">✓</i></label
            ><button type="submit">Submit</button>
          </div>
        </form>
      </template>
      <template v-else>
        <header>
          <p class="eyebrow">A personal showroom experience</p>
          <h2 id="appointment-modal-title">Book an Appointment</h2>
          <p>Choose your preferred showroom and visit schedule.</p>
        </header>
        <form class="service-form" @submit.prevent="submitAppointment">
          <div class="service-fields service-fields--two">
            <label
              ><span>First name</span
              ><input
                v-model.trim="appointmentForm.firstName"
                autocomplete="given-name"
                required /></label
            ><label
              ><span>Last name</span
              ><input
                v-model.trim="appointmentForm.lastName"
                autocomplete="family-name"
                required /></label
            ><label
              ><span>Email</span
              ><input
                v-model.trim="appointmentForm.email"
                type="email"
                autocomplete="email"
                required /></label
            ><label
              ><span>Contact number</span
              ><input
                v-model.trim="appointmentForm.contactNumber"
                type="tel"
                autocomplete="tel"
                required /></label
            ><label
              ><span>Company name <small>Optional</small></span
              ><input
                v-model.trim="appointmentForm.company"
                autocomplete="organization" /></label
            ><label
              ><span>Branch</span
              ><select v-model="appointmentForm.branch" required>
                <option value="" disabled>Select showroom</option>
                <option>Greenhills</option>
                <option>Quezon City</option>
              </select></label
            ><label
              ><span>Appointment date</span
              ><input
                v-model="appointmentForm.date"
                type="date"
                :min="appointmentMinDate"
                required /></label
            ><label
              ><span>Appointment time</span
              ><input v-model="appointmentForm.time" type="time" required
            /></label>
          </div>
          <div class="service-form__foot">
            <label class="service-captcha"
              ><input
                v-model="appointmentForm.captchaConfirmed"
                type="checkbox"
                required
              /><span
                ><b>I'm not a robot</b
                ><small>Prototype verification</small></span
              ><i aria-hidden="true">✓</i></label
            ><button type="submit">Set appointment</button>
          </div>
        </form>
      </template>
    </section>

    <section
      v-if="designerOpen"
      class="designer-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="designer-title"
    >
      <button
        class="designer-modal__close"
        type="button"
        aria-label="Close designer registration"
        @click="closeDesigner"
      >
        ×
      </button>
      <template v-if="!designerSubmitted">
        <header>
          <p class="eyebrow">Caracole PH Design Partner</p>
          <h2 id="designer-title">Become a Designer.</h2>
          <p>
            Gain exclusive access to product prices, high-precision CAD files,
            3D models, and specialized design resources. Join our network of
            design professionals.
          </p>
        </header>
        <form novalidate @submit.prevent="submitDesignerApplication">
          <div class="designer-fields designer-fields--two">
            <label
              ><span>First name</span
              ><input
                v-model.trim="designerForm.firstName"
                type="text"
                autocomplete="given-name"
                :aria-invalid="designerFieldErrors.firstName ? 'true' : undefined"
            /><small v-if="designerFieldErrors.firstName" class="designer-field-error" role="alert">{{ designerFieldErrors.firstName }}</small></label>
            <label
              ><span>Last name</span
              ><input
                v-model.trim="designerForm.lastName"
                type="text"
                autocomplete="family-name"
                :aria-invalid="designerFieldErrors.lastName ? 'true' : undefined"
            /><small v-if="designerFieldErrors.lastName" class="designer-field-error" role="alert">{{ designerFieldErrors.lastName }}</small></label>
            <label
              ><span>Email address</span
              ><input
                v-model.trim="designerForm.email"
                type="email"
                autocomplete="email"
                :aria-invalid="designerFieldErrors.email ? 'true' : undefined"
            /><small v-if="designerFieldErrors.email" class="designer-field-error" role="alert">{{ designerFieldErrors.email }}</small></label>
            <label
              ><span>Mobile number</span
              ><input
                v-model.trim="designerForm.mobile"
                type="tel"
                autocomplete="tel"
                placeholder="+63"
                :aria-invalid="designerFieldErrors.mobile ? 'true' : undefined"
            /><small v-if="designerFieldErrors.mobile" class="designer-field-error" role="alert">{{ designerFieldErrors.mobile }}</small></label>
            <label
              ><span>Birth date</span
              ><input
                v-model="designerForm.birthDate"
                type="date"
                autocomplete="bday"
                :aria-invalid="designerFieldErrors.birthDate ? 'true' : undefined"
            /><small v-if="designerFieldErrors.birthDate" class="designer-field-error" role="alert">{{ designerFieldErrors.birthDate }}</small></label>
            <label
              ><span>Company</span
              ><input
                v-model.trim="designerForm.company"
                type="text"
                autocomplete="organization"
                :aria-invalid="designerFieldErrors.company ? 'true' : undefined"
            /><small v-if="designerFieldErrors.company" class="designer-field-error" role="alert">{{ designerFieldErrors.company }}</small></label>
          </div>
          <div class="designer-fields">
            <label
              ><span>Office address</span
              ><input
                v-model.trim="designerForm.officeAddress"
                type="text"
                autocomplete="street-address"
                :aria-invalid="designerFieldErrors.officeAddress ? 'true' : undefined"
            /><small v-if="designerFieldErrors.officeAddress" class="designer-field-error" role="alert">{{ designerFieldErrors.officeAddress }}</small></label>
            <label
              ><span>Company website</span
              ><input
                v-model.trim="designerForm.website"
                type="url"
                placeholder="https://"
                :aria-invalid="designerFieldErrors.website ? 'true' : undefined"
            /><small v-if="designerFieldErrors.website" class="designer-field-error" role="alert">{{ designerFieldErrors.website }}</small></label>
          </div>
          <div class="designer-fields designer-fields--two">
            <label>
              <span class="designer-password-label"><span>Password</span><span class="designer-password-help" tabindex="0" aria-label="Password requirements">?<span role="tooltip"><span>Use at least 8 characters.</span><span>Passwords must match exactly.</span></span></span></span>
              <span class="designer-password-input">
                <input
                  v-model="designerForm.password"
                  :type="showDesignerPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  :aria-invalid="designerFieldErrors.password ? 'true' : undefined"
                />
                <button type="button" :aria-label="showDesignerPassword ? 'Hide password' : 'Show password'" @click="showDesignerPassword = !showDesignerPassword"><i :class="showDesignerPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i></button>
              </span>
              <small v-if="designerFieldErrors.password" class="designer-field-error" role="alert">{{ designerFieldErrors.password }}</small>
            </label>
            <label>
              <span>Confirm password</span>
              <span class="designer-password-input">
                <input
                  v-model="designerForm.confirmPassword"
                  :type="showDesignerConfirmPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  :aria-invalid="designerFieldErrors.confirmPassword ? 'true' : undefined"
                />
                <button type="button" :aria-label="showDesignerConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'" @click="showDesignerConfirmPassword = !showDesignerConfirmPassword"><i :class="showDesignerConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i></button>
              </span>
              <small v-if="designerFieldErrors.confirmPassword" class="designer-field-error" role="alert">{{ designerFieldErrors.confirmPassword }}</small>
            </label>
            <label
              ><span>Touchpoint</span
              ><select v-model="designerForm.touchpoint" :aria-invalid="designerFieldErrors.touchpoint ? 'true' : undefined">
                <option value="" disabled>Select touchpoint</option>
                <option>Caracole showroom</option>
                <option>Dexterton showroom</option>
                <option>Design consultation</option>
                <option>Industry event</option>
                <option>Online</option>
              </select><small v-if="designerFieldErrors.touchpoint" class="designer-field-error" role="alert">{{ designerFieldErrors.touchpoint }}</small></label
            >
            <label
              ><span>How did you hear about us?</span
              ><select v-model="designerForm.discovery" :aria-invalid="designerFieldErrors.discovery ? 'true' : undefined">
                <option value="" disabled>Select an option</option>
                <option>Social media</option>
                <option>Search engine</option>
                <option>Professional referral</option>
                <option>Showroom visit</option>
                <option>Design event</option>
                <option>Other</option>
              </select><small v-if="designerFieldErrors.discovery" class="designer-field-error" role="alert">{{ designerFieldErrors.discovery }}</small></label
            >
          </div>
          <label class="designer-consent"
            ><input
              v-model="designerForm.termsAccepted"
              type="checkbox"
              :aria-invalid="designerFieldErrors.termsAccepted ? 'true' : undefined"
            /><span
              >I agree to the <u>Terms &amp; Conditions</u> and
              <u>Privacy Policy</u>.</span
            ></label
          >
          <small v-if="designerFieldErrors.termsAccepted" class="designer-field-error" role="alert">{{ designerFieldErrors.termsAccepted }}</small>
          <div class="designer-form__foot">
            <label class="designer-captcha"
              ><input
              v-model="designerForm.captchaConfirmed"
              type="checkbox"
                :aria-invalid="designerFieldErrors.captchaConfirmed ? 'true' : undefined"
              /><span
                ><b>I'm not a robot</b
                ><small>Prototype verification</small></span
              ><i aria-hidden="true">✓</i></label
            >
            <button class="designer-submit" type="submit" :disabled="isSubmittingDesigner">
              {{ isSubmittingDesigner ? "Registering…" : "Register" }} <span>→</span>
            </button>
          </div>
          <small v-if="designerFieldErrors.captchaConfirmed" class="designer-field-error" role="alert">{{ designerFieldErrors.captchaConfirmed }}</small>
          <p v-if="designerError" class="auth-error" role="alert">
            {{ designerError }}
          </p>
        </form>
      </template>
      <div v-else class="designer-success">
        <span aria-hidden="true">✓</span>
        <p class="eyebrow">Application received</p>
        <h2 id="designer-title">Welcome to the<br />design community.</h2>
        <p>
          Thank you for applying to become a Caracole PH Design Partner. Our
          team will review your details and contact you soon.
        </p>
        <button type="button" @click="closeDesigner">Continue exploring</button>
      </div>
    </section>

    <section
      v-if="accountView === 'login'"
      class="auth-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <button
        class="auth-close"
        type="button"
        aria-label="Close login"
        @click="closeAccount"
      >
        ×
      </button>
      <p class="eyebrow">My Caracole</p>
      <h2 id="login-title">Welcome back.</h2>
      <p>Sign in to view your orders, wishlist, and profile.</p>
      <form @submit.prevent="login">
        <label
          ><span>Email address</span
          ><input
            v-model="loginForm.email"
            type="email"
            autocomplete="email"
            required
        /></label>
        <label
          ><span>Password</span
          ><input
            v-model="loginForm.password"
            type="password"
            autocomplete="current-password"
            required
        /></label>
        <p v-if="authError" class="auth-error" role="alert">{{ authError }}</p>
        <button class="auth-primary" type="submit">Sign in</button>
      </form>
      <div class="auth-alternate">
        <span>New to Caracole?</span
        ><button type="button" @click="showRegistration">
          Create an account
        </button>
      </div>
    </section>

    <section
      v-if="accountView === 'register'"
      class="auth-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-title"
    >
      <button
        class="auth-close"
        type="button"
        aria-label="Close registration"
        @click="closeAccount"
      >
        ×
      </button>
      <p class="eyebrow">My Caracole</p>
      <h2 id="register-title">Create an account.</h2>
      <p>
        Save your details and begin composing a more personal Caracole
        experience.
      </p>
      <form @submit.prevent="createAccount">
        <div class="auth-name-fields">
          <label
            ><span>First name</span
            ><input
              v-model="registerForm.firstName"
              type="text"
              autocomplete="given-name"
              required
          /></label>
          <label
            ><span>Last name</span
            ><input
              v-model="registerForm.lastName"
              type="text"
              autocomplete="family-name"
              required
          /></label>
        </div>
        <label
          ><span>Email address</span
          ><input
            v-model="registerForm.email"
            type="email"
            autocomplete="email"
            required
        /></label>
        <label
          ><span>Password</span
          ><input
            v-model="registerForm.password"
            type="password"
            autocomplete="new-password"
            minlength="5"
            required
        /></label>
        <p v-if="authError" class="auth-error" role="alert">{{ authError }}</p>
        <button class="auth-primary" type="submit">Create account</button>
      </form>
      <div class="auth-alternate">
        <span>Already have an account?</span
        ><button type="button" @click="showLogin">Sign in</button>
      </div>
    </section>

    <aside
      class="account-drawer"
      :class="{ open: accountView === 'account' }"
      :aria-hidden="accountView !== 'account'"
      aria-label="My account"
    >
      <button
        class="account-drawer__close"
        type="button"
        aria-label="Close account menu"
        @click="closeAccount"
      >
        ×
      </button>
      <div v-if="currentUser" class="account-drawer__content">
        <p>My account</p>
        <h2>Welcome back {{ currentUser.firstName }}</h2>
        <nav aria-label="Account options">
          <a href="/orders">Order History <span>→</span></a>
          <a href="/wishlist">Wishlist <span>→</span></a>
          <button type="button">Profile <span>→</span></button>
          <button type="button" @click="signOut">
            Sign out <span>→</span>
          </button>
        </nav>
      </div>
    </aside>

    <aside
      class="cart-drawer"
      :class="{ open: cartOpen }"
      :aria-hidden="!cartOpen"
      aria-label="Shopping cart"
    >
      <div class="cart-drawer__head">
        <div>
          <p>My Cart</p>
          <h2>{{ cartCount }} {{ cartCount === 1 ? "piece" : "pieces" }}</h2>
        </div>
        <button type="button" aria-label="Close cart" @click="closeCart">
          ×
        </button>
      </div>
      <div v-if="cartItems.length" class="cart-drawer__items">
        <article
          v-for="item in cartItems"
          :key="item.id"
          class="cart-drawer__item"
        >
          <a :href="`/product/${encodeURIComponent(item.handle)}`"
            ><img :src="item.image" :alt="item.name"
          /></a>
          <div>
            <a :href="`/product/${encodeURIComponent(item.handle)}`">{{
              item.name
            }}</a>
            <p>{{ formatCartPrice(item.priceValue) }}</p>
            <div class="mini-quantity">
              <button type="button" @click="changeDrawerQuantity(item, -1)">
                −</button
              ><span>{{ item.quantity }}</span
              ><button type="button" @click="changeDrawerQuantity(item, 1)">
                +
              </button>
            </div>
          </div>
          <button
            class="cart-drawer__remove"
            type="button"
            :aria-label="`Remove ${item.name}`"
            @click="removeDrawerItem(item.id)"
          >
            ×
          </button>
        </article>
      </div>
      <div v-else class="cart-drawer__empty">
        <p>Your cart is waiting.</p>
        <a href="/products/living">Explore the collection →</a>
      </div>
      <div class="cart-drawer__foot">
        <div>
          <span>Subtotal</span><strong>{{ formatCartPrice(cartTotal) }}</strong>
        </div>
        <a class="cart-drawer__history" href="/orders" @click="closeCart"
          >Browser order history</a
        ><a class="cart-drawer__view" href="/cart" @click="closeCart"
          >View cart</a
        ><a class="cart-drawer__checkout" href="/checkout" @click="closeCart"
          >Checkout as {{ currentUser ? currentUser.firstName : "guest" }}</a
        >
      </div>
    </aside>

    <main
      v-if="
        !isListingPage &&
        !isProductPage &&
        !isShopTheLookPage &&
        !isCartPage &&
        !isCheckoutPage &&
        !isCheckoutReviewPage &&
        !isTestimonialsPage &&
        !isOrdersPage &&
        !isWishlistPage &&
        !isDesignerListPage &&
        !isDesignerProfilePage
      "
      id="main"
    >
      <section
        v-if="activeVideo"
        id="top"
        class="hero"
        aria-label="Caracole cinematic collection showcase"
      >
        <video
          v-if="activeVideo.mediaType === 'video'"
          ref="videoEl"
          class="hero-video"
          :key="activeVideo.src"
          autoplay
          muted
          playsinline
          preload="auto"
          @ended="nextVideo"
          @timeupdate="updateProgress"
        >
          <source :src="activeVideo.src" type="video/mp4" />
        </video>
        <img
          v-else
          class="hero-video"
          :src="activeVideo.src"
          :alt="activeVideo.title"
        />
        <div class="hero-scrim"></div>
        <div class="hero-content">
          <p class="eyebrow light">{{ activeVideo.eyebrow }}</p>
          <h1>{{ activeVideo.title }}</h1>
          <p class="hero-copy">{{ activeVideo.copy }}</p>
          <div class="hero-actions">
            <a class="text-link text-link--light" :href="activeVideo.href"
              >{{ activeVideo.cta }} <span>↗</span></a
            ><button type="button" @click="openServiceModal('appointment')">
              Book an Appointment
            </button>
          </div>
        </div>
        <div class="hero-rail">
          <button
            v-for="(video, index) in videos"
            :key="video.id"
            type="button"
            :class="{ active: currentVideo === index }"
            :aria-label="`Play ${video.eyebrow}`"
            @click="selectVideo(index)"
          >
            <span class="rail-number">0{{ index + 1 }}</span>
            <span class="rail-title">{{ video.eyebrow }}</span>
            <span class="rail-line"
              ><i
                :style="
                  currentVideo === index ? { width: `${videoProgress}%` } : {}
                "
              ></i
            ></span>
          </button>
        </div>
        <div class="scroll-cue"><span></span> Discover</div>
      </section>

      <section id="new-arrivals" class="arrivals section-pad">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Just Landed</p>
            <h2>New Arrivals</h2>
          </div>
          <p>
            Fresh forms. Expressive finishes.<br />The newest chapter in modern
            luxury.
          </p>
          <a
            class="round-link"
            href="/products/new-arrivals"
            aria-label="View all new arrivals"
            >↗</a
          >
        </div>
        <div
          class="product-scroll"
          role="list"
          aria-label="New arrival products"
        >
          <article
            v-for="(product, index) in products"
            :key="product.href"
            class="product-card"
            role="listitem"
          >
            <div class="product-card__image">
              <span>New · 0{{ index + 1 }}</span>
              <a :href="product.href"
                ><ProductImageCarousel :product="product" /><i
                  >View piece ↗</i
                ></a
              >
              <button
                class="wishlist-heart"
                type="button"
                :class="{ active: wishlistSet.has(product.id) }"
                :aria-label="
                  wishlistSet.has(product.id)
                    ? `Remove ${product.name} from wishlist`
                    : `Add ${product.name} to wishlist`
                "
                @click="updateWishlist(product.id)"
              >
                <span aria-hidden="true">{{
                  wishlistSet.has(product.id) ? "♥" : "♡"
                }}</span>
              </button>
            </div>
            <div class="product-card__info">
              <a :href="product.href"
                ><h3>{{ product.name }}</h3></a
              >
              <p>{{ product.category }}</p>
            </div>
          </article>
        </div>
      </section>

      <section v-if="activeLook" id="look" class="look-section">
        <div class="look-media-frame">
          <div ref="lookMediaViewport" class="look-media" :class="{ 'is-panning': lookPan.active }" @pointerdown="startLookPan" @pointermove="moveLookPan" @pointerup="stopLookPan" @pointercancel="stopLookPan">
            <div class="look-media__canvas">
            <img
              :key="activeLook.image"
              :src="activeLook.image"
              :style="activeLookImageStyle"
              :alt="`${activeLook.name} room styled with Caracole furniture`"
              draggable="false"
              @load="updateLookImageDimensions"
            />
            <a
              v-for="(product, index) in activeLook.products"
              :key="product.id"
              class="look-pin"
              :class="`look-pin--${product.side}`"
              :href="product.href"
              :style="{ left: `${product.x}%`, top: `${product.y}%` }"
              :aria-label="`View ${product.name}`"
              @click="preventPinClickAfterPan"
            >
              <span class="look-pin__dot" aria-hidden="true">{{
                String(index + 1).padStart(2, "0")
              }}</span>
              <span class="look-pin__card">
                <small
                  >{{ product.category
                  }}<template v-if="product.subcategory">
                    · {{ product.subcategory }}</template
                  ></small
                >
                <strong>{{ product.name }}</strong>
                <span>EDP {{ product.edpNumber }}</span>
                <b>{{ product.price }}</b>
                <em>View product <span>↗</span></em>
              </span>
            </a>
            </div>
          </div>
          <span class="look-drag-hint"><i class="pi pi-arrows-alt" aria-hidden="true"></i> Hold and drag to explore the image</span>
        </div>
        <div class="look-copy">
          <p class="eyebrow">Shop the Look</p>
          <h2>{{ activeLook.name }}</h2>
          <div class="look-copy__description" v-html="activeLook.description"></div>
          <ol>
            <li
              v-for="(item, index) in activeLook.products.slice(0, 4)"
              :key="item.id"
            >
              <a :href="item.href">
                <span>0{{ index + 1 }}</span
                ><b>{{ item.name }}</b
                ><i>Explore ↗</i>
              </a>
            </li>
            <li v-if="activeLook.products.length > 4" class="look-copy__more-products">
              <button type="button" @click="openLookProductsDialog">See More Products <span>↗</span></button>
            </li>
          </ol>
          <div class="look-tabs" role="tablist" aria-label="Shop by room">
            <button
              v-for="(look, index) in looks"
              :key="look.name"
              type="button"
              role="tab"
              :aria-selected="lookIndex === index"
              :class="{ active: lookIndex === index }"
              @click="selectLook(index)"
            >
              {{ look.name }}
            </button>
            <a v-if="shopTheLookEnvironmentCount > 3" href="/shop-the-look" class="look-tabs__explore-more">Explore More <span>↗</span></a>
          </div>
        </div>
      </section>

      <Teleport to="body">
        <Transition name="admin-dialog-fade">
          <div v-if="isLookProductsDialogOpen && activeLook" class="look-products-dialog-backdrop" role="presentation" @click.self="closeLookProductsDialog">
            <section ref="lookProductsDialog" class="look-products-dialog" role="dialog" aria-modal="true" aria-labelledby="look-products-dialog-title" tabindex="-1" @keydown="trapLookProductsDialogFocus">
              <header>
                <div><p class="eyebrow">Shop the Look</p><h2 id="look-products-dialog-title">{{ activeLook.name }}</h2></div>
                <button type="button" aria-label="Close products" @click="closeLookProductsDialog"><i class="pi pi-times" aria-hidden="true"></i></button>
              </header>
              <div class="look-products-dialog__list">
                <a v-for="product in activeLook.products" :key="product.id" :href="product.href" @click="closeLookProductsDialog">
                  <img v-if="product.image" :src="product.image" :alt="product.name" />
                  <span v-else class="look-products-dialog__image-placeholder"><i class="pi pi-image" aria-hidden="true"></i></span>
                  <span><small>EDP {{ product.edpNumber }}</small><strong>{{ product.name }}</strong></span>
                  <i class="pi pi-arrow-up-right" aria-hidden="true"></i>
                </a>
              </div>
            </section>
          </div>
        </Transition>
      </Teleport>

      <section class="collections section-pad">
        <div class="section-heading section-heading--collections">
          <div>
            <p class="eyebrow">The Collection</p>
            <h2>Rooms, reimagined.</h2>
          </div>
          <p>
            Explore a world of refined silhouettes, luminous materials, and
            details made to be discovered.
          </p>
        </div>
        <div class="category-grid">
          <a
            v-for="(category, categoryIndex) in categories"
            :key="category.name"
            :href="category.href"
            class="category-card"
            :class="`category-card--${category.size}`"
            @mouseenter="startCategoryCarousel(categoryIndex)"
            @mouseleave="stopCategoryCarousel(categoryIndex)"
            @focusin="startCategoryCarousel(categoryIndex)"
            @focusout="handleCategoryFocusOut(categoryIndex, $event)"
          >
            <img
              v-for="(image, imageIndex) in category.images"
              :key="image"
              :src="image"
              :alt="
                imageIndex === categoryImageIndexes[categoryIndex]
                  ? `${category.name} collection view ${imageIndex + 1}`
                  : ''
              "
              :aria-hidden="imageIndex !== categoryImageIndexes[categoryIndex]"
              :class="{
                active: imageIndex === categoryImageIndexes[categoryIndex],
              }"
              loading="lazy"
            />
            <div class="category-card__shade"></div>
            <span class="category-number">{{ category.number }}</span>
            <div class="category-card__title">
              <h3>{{ category.name }}</h3>
              <b>↗</b>
            </div>
          </a>
        </div>
      </section>

      <section id="designers" class="home-designers">
        <header class="home-designers__heading">
          <div>
            <p class="eyebrow">Creative voices</p>
            <h2>Meet the minds<br />behind the form.</h2>
          </div>
          <div>
            <p>
              Go inside the process with the designers who shape Caracole’s
              expressive silhouettes, unexpected materials, and enduring sense
              of modern luxury.
            </p>
          </div>
        </header>
        <div class="home-designers__grid">
          <a
            v-for="(designer, index) in featuredDesigners"
            :key="designer.slug"
            :href="`/designers/${designer.slug}`"
            class="home-designer-card"
          >
            <div>
              <img :src="designer.image" :alt="designer.name" loading="lazy" />
              <span>{{ String(index + 1).padStart(2, "0") }}</span>
            </div>
            <p class="eyebrow">Designer profile</p>
            <h3>{{ designer.name }}</h3>
            <span>View profile ↗</span>
          </a>
        </div>
        <a class="home-designers__more" href="/designers"
          >Know other designers <span>↗</span></a
        >
      </section>

      <section id="story" class="about-story">
        <div class="about-story__hero">
          <img
            src="/media/about/about-caracole.webp"
            alt="A refined Caracole interior showcasing sculptural furniture"
            loading="lazy"
          />
          <div class="about-story__hero-shade"></div>
          <div>
            <p class="eyebrow light">Our Story</p>
            <h2>About Caracole</h2>
          </div>
        </div>

        <div class="about-story__intro">
          <div>
            <p class="eyebrow">The foundation of our design</p>
            <h2>Our Ethos</h2>
          </div>
          <p>
            These brand pillars are the very foundation of Caracole’s DNA and
            longstanding passion for design excellence and innovation—uniting
            our product and people, our culture and communities, while providing
            intention and purpose for everything we do. It is from this place of
            passion that our new collection evolves, with fresh styles that
            bring elegance and hope to the world through sensory living
            experiences.
          </p>
        </div>

        <div class="ethos-panels">
          <article class="ethos-panel">
            <img
              src="/media/about/sensory.webp"
              alt="A tactile Caracole interior representing sensory design"
              loading="lazy"
            />
            <div class="ethos-panel__shade"></div>
            <span class="ethos-panel__number">1 / 3</span>
            <div class="ethos-panel__copy">
              <p class="eyebrow light">Our first pillar</p>
              <h3>Sensory</h3>
              <p>
                Defined as relating, transmitted, or perceived by the physical
                senses, we are destined to create a soul-healing connection in a
                world of sensory deprivation. From sight to touch, we imagine,
                innovate, and create to evoke all of the senses. This
                unmistakable, unspoken spirit connects our design language with
                human emotion. From color to material and finish, our unique
                approach to sensory design pushes the limits of innovation and
                leadership within the world of design.
              </p>
            </div>
          </article>

          <article class="ethos-panel ethos-panel--right">
            <img
              src="/media/about/elegant.webp"
              alt="An elegant Caracole room inspired by nature and proportion"
              loading="lazy"
            />
            <div class="ethos-panel__shade"></div>
            <span class="ethos-panel__number">2 / 3</span>
            <div class="ethos-panel__copy">
              <p class="eyebrow light">Our second pillar</p>
              <h3>Elegant</h3>
              <p>
                Elegance is defined as beauty that shows unusual effectiveness
                and simplicity. From science and math to literature and design,
                elegance is the standard of taste. We take our cues from mother
                nature and her elegant designs, often hidden in plain sight;
                where rhythmic patterns, colors, and shapes are captured through
                the discerning lens of the golden ratio to decode mother
                nature’s beauty. It’s this self-imposed exploration where beauty
                is unearthed, and elegance is realized.
              </p>
            </div>
          </article>

          <article class="ethos-panel">
            <img
              src="/media/about/hopeful.webp"
              alt="An uplifting Caracole interior representing hopeful living"
              loading="lazy"
            />
            <div class="ethos-panel__shade"></div>
            <span class="ethos-panel__number">3 / 3</span>
            <div class="ethos-panel__copy">
              <p class="eyebrow light">Our third pillar</p>
              <h3>Hopeful</h3>
              <p>
                Being hopeful means feeling or inspiring optimism about a future
                event. It’s this positive, forward-thinking that drives our
                design philosophy and language. Although our inspiration is
                rooted in the beauty of nature, our world isn’t always kind or
                compassionate. We infuse our soulful designs with optimism to
                bring happiness and hope to homes and all those living within.
              </p>
            </div>
          </article>
        </div>

        <div class="about-story__film">
          <div class="about-story__video">
            <iframe
              src="https://brandfolder.com/caracole/attachments/embed/754gwmm93wwstwtjh47frr?resource_type=Brandfolder&amp;frame=auto&amp;animated=false&amp;loop=false&amp;muted=true&amp;autoplay=true"
              title="The world of Caracole"
              loading="lazy"
              allowfullscreen
            ></iframe>
          </div>
          <div class="about-story__closing">
            <p class="eyebrow light">Designed to connect</p>
            <p>
              Within these pages, we hope you will find inspiration to curate
              and design interiors that engage the senses, evoke emotion, and
              create connections. Like an unspoken language, this season’s
              collection integrates color, texture, and material to translate
              the simplicity and beauty found in nature for a reimagining of
              today’s interiors.
            </p>
          </div>
        </div>
      </section>

      <section id="locations" class="locations section-pad">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Visit Us</p>
            <h2>Experience Caracole.</h2>
          </div>
          <p>
            See the materials. Feel the comfort. Discover what brings your
            vision to life.
          </p>
          <!-- <a
            class="round-link"
            href="https://caracole.ph/contact-us"
            aria-label="Contact Caracole"
            >↗</a
          > -->
        </div>
        <div class="location-grid">
          <article
            v-for="(location, locationIndex) in locations"
            :key="location.name"
            class="location-card"
            tabindex="0"
            @mouseenter="startLocationCarousel(locationIndex)"
            @mouseleave="stopLocationCarousel(locationIndex)"
            @focusin="startLocationCarousel(locationIndex)"
            @focusout="handleLocationFocusOut(locationIndex, $event)"
          >
            <div class="location-card__image">
              <img
                v-for="(image, imageIndex) in location.images"
                :key="image"
                :src="image"
                :alt="
                  imageIndex === locationImageIndexes[locationIndex]
                    ? `${location.name} showroom view ${imageIndex + 1}`
                    : ''
                "
                :aria-hidden="
                  imageIndex !== locationImageIndexes[locationIndex]
                "
                :class="{
                  active: imageIndex === locationImageIndexes[locationIndex],
                }"
                loading="lazy"
              />
              <span>{{ location.label }}</span>
              <div class="location-card__progress" aria-hidden="true">
                <i
                  v-for="(_, imageIndex) in location.images"
                  :key="imageIndex"
                  :class="{
                    active: imageIndex === locationImageIndexes[locationIndex],
                  }"
                ></i>
              </div>
            </div>
            <div class="location-card__info">
              <h3>{{ location.name }}</h3>
              <p>{{ location.address }}</p>
              <div>
                <span v-for="line in location.hours" :key="line">{{
                  line
                }}</span>
              </div>
              <p>{{ location.phones }}</p>
              <button
                class="location-card__visit"
                type="button"
                @click="openServiceModal('appointment', location.branch)"
              >
                Plan your visit <span>↗</span>
              </button>
            </div>
          </article>
        </div>
      </section>

      <section class="newsletter">
        <div>
          <p class="eyebrow light">A world of considered beauty</p>
          <h2>Stay inspired.</h2>
          <p>
            New collections, room stories, and invitations from Caracole
            Philippines.
          </p>
        </div>
        <form @submit.prevent="submitNewsletter">
          <template v-if="!newsletterSent">
            <label class="sr-only" for="email">Email address</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="Your email address"
              required
            />
            <button type="submit">Join the list ↗</button>
          </template>
          <p v-else class="newsletter-thanks">
            Thank you. Welcome to the world of Caracole.
          </p>
        </form>
      </section>
    </main>

    <ProductListingPage
      v-else-if="isListingPage"
      :category="listingCategory || ''"
      :subcategory="listingSubcategory"
      :new-arrivals-page="isNewArrivalsPage"
    />
    <main v-else-if="isShopTheLookPage" id="main" class="shop-the-look-page">
      <header class="shop-the-look-page__intro">
        <p class="eyebrow">Shop the Look</p>
        <h1>Spaces, composed.</h1>
        <p>Explore the environments created to bring Caracole pieces together in one considered view.</p>
      </header>
      <section class="shop-the-look-page__grid" aria-label="Shop the Look environments">
        <button
          v-for="environment in allShopTheLooks"
          :key="environment.id"
          class="shop-the-look-page__card"
          type="button"
          @click="openShopTheLookEnvironment(environment)"
        >
          <span class="shop-the-look-page__image"><img :src="environment.image" :alt="environment.name" /></span>
          <h2>{{ environment.name }}</h2>
        </button>
      </section>
      <p v-if="isLoadingShopTheLook" class="shop-the-look-page__status">Loading environments…</p>
      <p v-else-if="!shopTheLookEnvironments.length" class="shop-the-look-page__status">No environments are available yet.</p>
    </main>
    <ProductDetailPage v-else-if="isProductPage && selectedProduct" :product="selectedProduct" />
    <main v-else-if="isProductPage" id="main" class="catalog-page"><section class="catalog-empty"><p class="eyebrow">{{ catalogStatus === 'error' ? 'Catalog unavailable' : 'Loading product' }}</p><h2>{{ catalogStatus === 'error' ? 'We couldn’t load this product.' : 'Gathering the details.' }}</h2><p v-if="catalogStatus === 'error'">{{ catalogError }}</p><button v-if="catalogStatus === 'error'" type="button" @click="loadCatalog({ force: true }).catch(() => {})">Try again</button></section></main>
    <CartPage v-else-if="isCartPage" />
    <CheckoutPage v-else-if="isCheckoutPage" />
    <TestimonialsPage v-else-if="isTestimonialsPage" />
    <OrderHistoryPage v-else-if="isOrdersPage" />
    <WishlistPage v-else-if="isWishlistPage" />
    <DesignerListPage v-else-if="isDesignerListPage" :designers="designerProfiles" />
    <DesignerProfilePage
      v-else-if="isDesignerProfilePage && selectedDesigner"
      :designer="selectedDesigner"
    />
    <CheckoutReviewPage v-else />

    <Teleport to="body">
      <Transition name="shop-look-viewer">
        <div v-if="selectedShopTheLook" class="shop-look-viewer-backdrop" role="presentation" @scroll.passive="handleShopTheLookViewerScroll" @click.self="closeShopTheLookEnvironment">
          <section ref="shopTheLookViewer" class="shop-look-viewer" role="dialog" aria-modal="true" :aria-label="`${selectedShopTheLook.name} environment`" tabindex="-1" @keydown="trapShopTheLookViewerFocus">
            <button class="shop-look-viewer__close" type="button" aria-label="Close environment" @click="closeShopTheLookEnvironment"><i class="pi pi-times" aria-hidden="true"></i></button>
            <div class="shop-look-viewer__media">
              <button v-if="allShopTheLooks.length > 1" class="shop-look-viewer__carousel-control shop-look-viewer__carousel-control--previous" type="button" aria-label="Show previous environment" @click="browseShopTheLookEnvironment(-1)"><i class="pi pi-arrow-left" aria-hidden="true"></i></button>
              <div :key="selectedShopTheLook.id" class="shop-look-viewer__image-wrap">
                <img :src="selectedShopTheLook.image" :alt="`${selectedShopTheLook.name} room styled with Caracole furniture`" />
                <a v-for="(product, index) in selectedShopTheLook.products" :key="product.id" class="shop-look-viewer__pin" :class="{ 'is-pin-highlighted': shopTheLookHover.productId === product.id && shopTheLookHover.source === 'pin', 'is-product-highlighted': shopTheLookHover.productId === product.id && shopTheLookHover.source === 'product' }" :href="product.href" :style="{ left: `${product.x}%`, top: `${product.y}%` }" :aria-label="`View ${product.name}`" @mouseenter="setShopTheLookHover(product.id, 'pin')" @mouseleave="clearShopTheLookHover" @focus="setShopTheLookHover(product.id, 'pin')" @blur="clearShopTheLookHover">{{ String(index + 1).padStart(2, '0') }}</a>
              </div>
              <button v-if="allShopTheLooks.length > 1" class="shop-look-viewer__carousel-control shop-look-viewer__carousel-control--next" type="button" aria-label="Show next environment" @click="browseShopTheLookEnvironment(1)"><i class="pi pi-arrow-right" aria-hidden="true"></i></button>
            </div>
            <section class="shop-look-viewer__products" aria-label="Products in this environment">
              <div><p class="eyebrow">Shop the Look</p><h2>{{ selectedShopTheLook.name }}</h2><div v-if="selectedShopTheLook.description" class="shop-look-viewer__description" v-html="selectedShopTheLook.description"></div></div>
              <div class="shop-look-viewer__product-list">
                <a v-for="(product, index) in selectedShopTheLook.products" :key="product.id" :data-shop-look-product="product.id" :href="product.href" :class="{ 'is-highlighted': shopTheLookHover.productId === product.id }" @mouseenter="setShopTheLookHover(product.id, 'product')" @mouseleave="clearShopTheLookHover" @focus="setShopTheLookHover(product.id, 'product')" @blur="clearShopTheLookHover">
                  <span>{{ String(index + 1).padStart(2, '0') }}</span>
                  <img v-if="product.image" :src="product.image" :alt="product.name" />
                  <span v-else class="shop-look-viewer__product-placeholder"><i class="pi pi-image" aria-hidden="true"></i></span>
                  <strong><small>EDP {{ product.edpNumber }}</small>{{ product.name }}</strong><i class="pi pi-arrow-up-right" aria-hidden="true"></i>
                </a>
                <p v-if="!selectedShopTheLook.products.length" class="shop-look-viewer__empty">No products have been assigned to this environment yet.</p>
              </div>
            </section>
          </section>
          <Transition name="shop-look-preview">
            <a v-if="shopTheLookProductPreview" class="shop-look-viewer__product-preview" :style="{ left: `${shopTheLookProductPreview.horizontalPosition}px` }" :href="shopTheLookProductPreview.product.href">
              <img v-if="shopTheLookProductPreview.product.image" :src="shopTheLookProductPreview.product.image" :alt="shopTheLookProductPreview.product.name" />
              <span v-else class="shop-look-viewer__product-placeholder"><i class="pi pi-image" aria-hidden="true"></i></span>
              <span><small>EDP {{ shopTheLookProductPreview.product.edpNumber }}</small><strong>{{ shopTheLookProductPreview.product.name }}</strong></span>
              <i class="pi pi-arrow-down" aria-hidden="true"></i>
            </a>
          </Transition>
        </div>
      </Transition>
    </Teleport>

    <footer class="footer">
      <div class="footer-brand">
        <img src="/brand/caracole-logo.png" alt="Caracole" />
        <p>Modern luxury,<br />made personal.</p>
      </div>
      <div class="footer-links">
        <div>
          <span>Explore</span><a href="/products/living">Living</a
          ><a href="/products/dining">Dining</a
          ><a href="/products/bedroom">Bedroom</a
          ><a href="/products/mirrors-accessories">Mirrors &amp; Accessories</a
          ><a href="/products/entertainment">Entertainment</a
          ><a href="/products/new-arrivals">New Arrivals</a>
        </div>
        <div>
          <span>Discover</span><a :href="homeLink('#story')">Our Story</a
          ><a href="/designers">Designers</a
          ><a href="/testimonials">Testimonials</a
          ><a href="/wishlist">Wishlist</a
          ><a href="/shop-the-look">Shop the Look</a
          ><button type="button" @click="openServiceModal('appointment')">
            Book an Appointment</button
          ><button type="button" @click="openServiceModal('contact')">
            Contact Us
          </button>
        </div>
        <div>
          <span>Follow</span
          ><a href="https://www.instagram.com/caracoleph/">Instagram</a
          ><a href="https://www.facebook.com/caracolephilippines/">Facebook</a
          ><a href="https://www.pinterest.com/">Pinterest</a>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© {{ new Date().getFullYear() }} Caracole Philippines</span
        ><span>Privacy · Terms</span><a :href="homeLink()">Back to top ↑</a>
      </div>
    </footer>
  </div>
</template>
