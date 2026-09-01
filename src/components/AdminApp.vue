<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import "primeicons/primeicons.css";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import AdminContentManager from "./AdminContentManager.vue";

const ADMIN_VIEW_STORAGE_KEY = "caracole-admin-view";
const isAdminInvitationSetup = /^\/admin\/setup-password\/?$/.test(window.location.pathname);
const adminInvitationToken = new URLSearchParams(window.location.search).get("token") || "";
const contentSectionIds = {
  "Hero Banners": "hero-banners",
  "Shop the Look": "shop-the-look",
  "Main Categories Display": "main-categories-display",
  "Content Designers": "content-designers",
};
const storedAdminView = getStoredAdminView();
const active = ref(storedAdminView.active);
const isAuthenticated = ref(hasStoredAdminSession());
const isForgotPassword = ref(false);
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const isMobileSidebarOpen = ref(false);
const resetRequested = ref(false);
const resetOtp = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const formError = ref("");
const formMessage = ref("");
const isSubmitting = ref(false);
const expanded = ref(storedAdminView.expanded);
const activeContentLink = ref(storedAdminView.activeContentLink);
const orderedGroups = [
  { title: "Contents", icon: "pi pi-flag", items: [
    { key: "Hero Banners", label: "Hero Banners" },
    { key: "Shop the Look", label: "Shop the Look" },
    { key: "Main Categories Display", label: "Main Categories Display" },
    { key: "Content Designers", label: "Designers" },
  ] },
  { title: "Products", icon: "pi pi-list", items: [] },
  {
    title: "Carts",
    icon: "pi pi-shopping-cart",
    items: [
      { key: "Registered Carts", label: "Registered Carts" },
      { key: "Guest Carts", label: "Guest Carts" },
    ],
  },
  { title: "Appointments", icon: "pi pi-clock", items: [] },
  {
    title: "Inquiries",
    icon: "pi pi-send",
    items: [{ key: "General", label: "General" }, { key: "Product", label: "Product" }],
  },
  { title: "Newsletter", icon: "pi pi-envelope", items: [] },
  {
    title: "Users",
    icon: "pi pi-users",
    items: [
      { key: "Admin", label: "Admin" },
      { key: "Registered Designers", label: "Designers" },
      { key: "Customers", label: "Customers" },
    ],
  },
];
const heroBannerForm = ref({
  title: "",
  subtitle: "",
  description: "",
  category: "",
  position: "",
});
const heroBannerMedia = ref(null);
const heroBannerPreviewUrl = ref("");
const heroBannerExistingMedia = ref(null);
const heroBannerInput = ref(null);
const heroBannerStatus = ref("");
const editingBannerId = ref(null);
const existingHeroBanners = ref([]);
const isLoadingHeroBanners = ref(false);
const isSavingHeroBanner = ref(false);
const isDeletingHeroBanner = ref(false);
const isDeleteConfirmationOpen = ref(false);
const draggingHeroBannerId = ref(null);
const isHeroBannerFormOpen = ref(false);
const shopTheLookEnvironments = ref([]);
const shopTheLookProducts = ref([]);
const shopTheLookProductCache = ref({});
const isLoadingShopTheLook = ref(false);
const isSavingShopTheLook = ref(false);
const isDeletingShopTheLook = ref(false);
const isShopTheLookEditorOpen = ref(false);
const isShopTheLookDeleteConfirmationOpen = ref(false);
const shopTheLookEnvironmentToDelete = ref(null);
const shopTheLookDeleteError = ref("");
const shopTheLookToast = ref(null);
const shopTheLookEditorDialog = ref(null);
const shopTheLookDeleteDialog = ref(null);
const heroBannerDeleteDialog = ref(null);
const editingEnvironmentId = ref(null);
const shopTheLookForm = ref({ name: "", position: 0 });
const shopTheLookDescription = ref("");
const shopTheLookDescriptionEditor = ref(null);
const shopTheLookImage = ref(null);
const shopTheLookPreviewUrl = ref("");
const shopTheLookExistingImageUrl = ref("");
const shopTheLookImageInput = ref(null);
const shopTheLookHotspots = ref([]);
const shopTheLookStatus = ref("");
const shopTheLookMenu = ref({ open: false, x: 0, y: 0, hotspotId: null, xPercent: 0, yPercent: 0 });
const movingHotspotId = ref(null);
const assigningHotspotId = ref(null);
const selectedHotspotId = ref(null);
const shopTheLookProductSearch = ref("");
const shopTheLookZoom = ref(100);
const shopTheLookImageDimensions = ref({ width: 1920, height: 1080 });
const adminProducts = ref([]);
const adminProductFilters = ref({ search: "", category: "", subcategory: "", series: "", minPrice: "", maxPrice: "" });
const adminProductFilterOptions = ref({ categories: [], subcategories: [], series: [] });
const adminProductPagination = ref({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
const isLoadingAdminProducts = ref(false);
const adminProductsError = ref("");
const selectedAdminProduct = ref(null);
const isAdminProductDetailsOpen = ref(false);
const adminProductDialog = ref(null);
const adminCarts = ref([]);
const adminCartFilters = ref({ search: "", dateFrom: "", dateTo: "" });
const adminCartPagination = ref({ page: 1, limit: 10, totalItems: 0, totalPages: 0 });
const isLoadingAdminCarts = ref(false);
const adminCartsError = ref("");
const selectedAdminCart = ref(null);
const isAdminCartDetailsOpen = ref(false);
const adminCartDialog = ref(null);
const adminUsers = ref([]);
const adminUserSearch = ref("");
const adminUserRole = ref("");
const isLoadingAdminUsers = ref(false);
const designers = ref([]);
const designerStatusFilter = ref("");
const isLoadingDesigners = ref(false);
const usersError = ref("");
const selectedDesigner = ref(null);
const isDesignerDetailsOpen = ref(false);
const isDesignerReviewOpen = ref(false);
const isSavingDesignerReview = ref(false);
const designerDetailsDialog = ref(null);
const designerReviewDialog = ref(null);
const isInviteUserOpen = ref(false);
const isInvitingUser = ref(false);
const inviteUserError = ref("");
const adminUserInviteMessage = ref("");
const inviteUserDialog = ref(null);
const inviteUserForm = ref({ firstName: "", lastName: "", email: "", role: "staff" });
const inviteSetupPassword = ref("");
const inviteSetupConfirmPassword = ref("");
const showInviteSetupPassword = ref(false);
const showInviteSetupConfirmPassword = ref(false);
const inviteSetupError = ref("");
const inviteSetupMessage = ref("");
const isCompletingInvite = ref(false);
let shopTheLookQuill = null;
let shopTheLookToastTimer = null;
let adminProductSearchTimer = null;
let adminCartSearchTimer = null;
let adminUserSearchTimer = null;

const shopTheLookSlots = computed(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((position) => ({
  position,
  environment: shopTheLookEnvironments.value.find((environment) => environment.position === position) || null,
})));
const shopTheLookPreview = computed(() => shopTheLookPreviewUrl.value || shopTheLookExistingImageUrl.value);
const shopTheLookDescriptionLength = computed(() => getShopTheLookDescriptionText(shopTheLookDescription.value).length);
const isAdminModalOpen = computed(() => isShopTheLookEditorOpen.value || isShopTheLookDeleteConfirmationOpen.value || isDeleteConfirmationOpen.value || isAdminProductDetailsOpen.value || isAdminCartDetailsOpen.value || isDesignerDetailsOpen.value || isDesignerReviewOpen.value || isInviteUserOpen.value);
const assignedProduct = (hotspot) => shopTheLookProductCache.value[hotspot.productId]
  || shopTheLookProducts.value.find((product) => (product.recordId || product.id) === hotspot.productId)
  || null;
const availableShopTheLookProducts = computed(() => {
  const assignedIds = new Set(shopTheLookHotspots.value.map((hotspot) => hotspot.productId).filter(Boolean));
  return shopTheLookProducts.value.filter((product) => !assignedIds.has(product.recordId || product.id));
});
const shopTheLookImageStyle = computed(() => ({
  width: `${Math.round(shopTheLookImageDimensions.value.width * shopTheLookZoom.value / 100)}px`,
  height: `${Math.round(shopTheLookImageDimensions.value.height * shopTheLookZoom.value / 100)}px`,
}));
const filteredDesigners = computed(() => designers.value.filter((designer) => !designerStatusFilter.value || (designer.reviewStatus || "PENDING") === designerStatusFilter.value));

const heroBannerPreview = computed(
  () => heroBannerPreviewUrl.value || heroBannerExistingMedia.value?.mediaUrl || "",
);
const heroBannerPreviewType = computed(() => {
  if (heroBannerMedia.value) {
    return heroBannerMedia.value.type.startsWith("video/") ? "video" : "image";
  }
  return heroBannerExistingMedia.value?.mediaType || "image";
});
const heroBannerSlots = computed(() =>
  [0, 1, 2].map((position) => ({
    position,
    banner: existingHeroBanners.value.find((banner) => banner.position === position) || null,
  })),
);

const activeGroup = computed(() =>
  orderedGroups.find(
    (group) =>
      group.title === active.value || group.items.some((item) => itemKey(item) === active.value),
  ),
);
const adminTopbarTitle = computed(() => {
  if (["Users", "Carts"].includes(activeGroup.value?.title)) return itemLabel(activeGroup.value.items.find((item) => itemKey(item) === active.value) || active.value);
  return activeGroup.value?.items.length ? activeGroup.value.title : active.value;
});
const currentAdminEmail = computed(() => {
  try {
    return JSON.parse(sessionStorage.getItem("caracole-admin-user") || "{}").email?.toLocaleLowerCase() || "";
  } catch {
    return "";
  }
});
const currentAdminIsSuperuser = computed(() => {
  try {
    return Boolean(JSON.parse(sessionStorage.getItem("caracole-admin-user") || "{}").isSuperuser);
  } catch {
    return false;
  }
});

function getStoredAdminView() {
  const fallback = { active: "Hero Banners", activeContentLink: "Hero Banners", expanded: { Contents: true, Carts: false, Users: false, Inquiries: false } };
  try {
    const value = JSON.parse(sessionStorage.getItem(ADMIN_VIEW_STORAGE_KEY) || "null");
    const allowedItems = ["Hero Banners", "Shop the Look", "Main Categories Display", "Content Designers", "Products", "Registered Carts", "Guest Carts", "Appointments", "General", "Product", "Newsletter", "Admin", "Registered Designers", "Customers"];
    if (value?.active === "Designers") value.active = "Registered Designers";
    if (value?.activeContentLink === "Designers") value.activeContentLink = "Registered Designers";
    if (value?.active === "Session Carts") value.active = "Guest Carts";
    if (value?.activeContentLink === "Session Carts") value.activeContentLink = "Guest Carts";
    if (contentSectionIds[value?.active]) {
      value.activeContentLink = value.active;
      value.active = "Hero Banners";
    }
    if (!value || !allowedItems.includes(value.active) || !allowedItems.includes(value.activeContentLink)) return fallback;
    return { active: value.active, activeContentLink: value.activeContentLink, expanded: { ...fallback.expanded, ...(value.expanded || {}) } };
  } catch {
    return fallback;
  }
}

function itemKey(item) {
  return typeof item === "string" ? item : item.key;
}

function itemLabel(item) {
  return typeof item === "string" ? item : item.label;
}

function hasStoredAdminSession() {
  const accessToken = sessionStorage.getItem("caracole-admin-access-token");
  const refreshToken = sessionStorage.getItem("caracole-admin-refresh-token");
  const storedUser = sessionStorage.getItem("caracole-admin-user");

  if (!accessToken || !refreshToken || !storedUser) return false;

  try {
    const user = JSON.parse(storedUser);
    return Boolean(user.isStaff || user.isSuperuser);
  } catch {
    return false;
  }
}

function select(item) {
  item = itemKey(item);
  isMobileSidebarOpen.value = false;
  if (item === "Logout") {
    isAuthenticated.value = false;
    password.value = "";
    void endSession();
    return;
  }
  if (contentSectionIds[item]) {
    active.value = "Hero Banners";
    activeContentLink.value = item;
    expanded.value.Contents = true;
    void nextTick(() => document.getElementById(contentSectionIds[item])?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return;
  }
  active.value = item;
  activeContentLink.value = item;
  if (["Hero Banners", "Shop the Look", "Main Categories Display", "Content Designers"].includes(item)) expanded.value.Contents = true;
  if (["Admin", "Registered Designers", "Customers"].includes(item)) expanded.value.Users = true;
  if (["Registered Carts", "Guest Carts"].includes(item)) expanded.value.Carts = true;
  if (item === "Products") void loadAdminProducts({ page: 1, refreshOptions: !adminProductFilterOptions.value.categories.length });
  if (["Registered Carts", "Guest Carts"].includes(item)) void loadAdminCarts({ page: 1 });
  if (item === "Admin") void loadAdminUsers();
  if (item === "Registered Designers") void loadDesigners();
}

function showAdminLanding() {
  active.value = "Hero Banners";
  activeContentLink.value = "Hero Banners";
  expanded.value.Contents = true;
}

function toggle(group) {
  expanded.value[group.title] = !expanded.value[group.title];
}

function selectGroup(group) {
  if (group.title === "Users") {
    expanded.value.Users = true;
    select("Admin");
    return;
  }
  if (group.title === "Carts") {
    expanded.value.Carts = true;
    select("Registered Carts");
    return;
  }
  if (group.items.length) toggle(group);
  else select(group.title);
}

function closeMobileSidebar() {
  isMobileSidebarOpen.value = false;
}

function toggleMobileSidebar() {
  if (isMobileSidebarOpen.value) {
    closeMobileSidebar();
    return;
  }
  expanded.value = { ...expanded.value, Contents: false, Carts: false, Inquiries: false, Users: false };
  isMobileSidebarOpen.value = true;
}

function handleAdminKeydown(event) {
  if (event.key === "Escape") closeMobileSidebar();
}

watch([active, activeContentLink, expanded], () => {
  if (!isAuthenticated.value) return;
  sessionStorage.setItem(ADMIN_VIEW_STORAGE_KEY, JSON.stringify({ active: active.value, activeContentLink: activeContentLink.value, expanded: expanded.value }));
}, { deep: true });

watch(isMobileSidebarOpen, (isOpen) => {
  document.body.classList.toggle("admin-sidebar-open", isOpen);
});

function openMediaPicker() {
  heroBannerInput.value?.click();
}

function setHeroBannerMedia(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    heroBannerStatus.value = "Choose an image or video file.";
    return;
  }

  if (heroBannerPreviewUrl.value) URL.revokeObjectURL(heroBannerPreviewUrl.value);
  heroBannerMedia.value = file;
  heroBannerExistingMedia.value = null;
  heroBannerPreviewUrl.value = URL.createObjectURL(file);
  heroBannerStatus.value = "";
}

function editHeroBanner(banner) {
  editingBannerId.value = banner.id;
  heroBannerForm.value = {
    title: banner.title,
    subtitle: banner.subtitle,
    description: banner.description,
    category: banner.category,
    position: banner.position,
  };
  heroBannerMedia.value = null;
  if (heroBannerPreviewUrl.value) URL.revokeObjectURL(heroBannerPreviewUrl.value);
  heroBannerPreviewUrl.value = "";
  heroBannerExistingMedia.value = banner;
  heroBannerStatus.value = `Editing “${banner.title}”. Add new media only if it needs to change.`;
  void showHeroBannerForm();
}

function clearHeroBannerForm() {
  editingBannerId.value = null;
  heroBannerForm.value = { title: "", subtitle: "", description: "", category: "", position: "" };
  heroBannerMedia.value = null;
  if (heroBannerPreviewUrl.value) URL.revokeObjectURL(heroBannerPreviewUrl.value);
  heroBannerPreviewUrl.value = "";
  heroBannerExistingMedia.value = null;
  heroBannerStatus.value = "";
  if (heroBannerInput.value) heroBannerInput.value.value = "";
}

async function showHeroBannerForm() {
  isHeroBannerFormOpen.value = true;
  await nextTick();
  document.querySelector(".admin-hero-banner-editor")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function closeHeroBannerForm() {
  clearHeroBannerForm();
  isHeroBannerFormOpen.value = false;
  isDeleteConfirmationOpen.value = false;
}

function openHeroBannerDeleteConfirmation() {
  if (editingBannerId.value) isDeleteConfirmationOpen.value = true;
}

async function deleteHeroBanner() {
  if (!editingBannerId.value) return;

  isDeletingHeroBanner.value = true;
  heroBannerStatus.value = "";
  try {
    await authorizedRequest(`/api/v1/hero-banners/${editingBannerId.value}`, {
      method: "DELETE",
    });
    closeHeroBannerForm();
    await loadHeroBanners();
  } catch (error) {
    isDeleteConfirmationOpen.value = false;
    heroBannerStatus.value = error.message;
  } finally {
    isDeletingHeroBanner.value = false;
  }
}

onBeforeUnmount(() => {
  if (heroBannerPreviewUrl.value) URL.revokeObjectURL(heroBannerPreviewUrl.value);
  if (shopTheLookPreviewUrl.value) URL.revokeObjectURL(shopTheLookPreviewUrl.value);
  if (shopTheLookToastTimer) window.clearTimeout(shopTheLookToastTimer);
  if (adminProductSearchTimer) window.clearTimeout(adminProductSearchTimer);
  if (adminUserSearchTimer) window.clearTimeout(adminUserSearchTimer);
  document.body.classList.remove("modal-scroll-lock");
  document.body.classList.remove("admin-sidebar-open");
  window.removeEventListener("keydown", handleAdminKeydown);
  const appRoot = document.getElementById("app");
  if (appRoot) appRoot.inert = false;
});

function trapAdminDialogFocus(event, dialog) {
  if (event.key !== "Tab" || !dialog) return;
  const focusable = [...dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
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

watch(isAdminModalOpen, async (isOpen) => {
  const appRoot = document.getElementById("app");
  document.body.classList.toggle("modal-scroll-lock", isOpen);
  if (appRoot) appRoot.inert = isOpen;
  if (!isOpen) return;
  await nextTick();
  const dialog = isInviteUserOpen.value
    ? inviteUserDialog.value
    : isShopTheLookEditorOpen.value
      ? shopTheLookEditorDialog.value
    : isShopTheLookDeleteConfirmationOpen.value
      ? shopTheLookDeleteDialog.value
      : isAdminProductDetailsOpen.value
        ? adminProductDialog.value
        : isAdminCartDetailsOpen.value
          ? adminCartDialog.value
          : isDesignerDetailsOpen.value
            ? designerDetailsDialog.value
            : isDesignerReviewOpen.value
              ? designerReviewDialog.value
              : heroBannerDeleteDialog.value;
  dialog?.querySelector("button, input, textarea, select")?.focus();
});
const apiBaseUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:3000"
).replace(/\/$/, "");

async function request(path, payload) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.message || "Something went wrong. Please try again.");
    error.status = response.status;
    throw error;
  }
  return body;
}

async function authorizedRequest(path, { method = "GET", body } = {}) {
  const accessToken = sessionStorage.getItem("caracole-admin-access-token");
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body,
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(responseBody.message || "Unable to complete this request.");
    error.status = response.status;
    throw error;
  }
  return responseBody;
}

async function loadHeroBanners() {
  isLoadingHeroBanners.value = true;
  try {
    const response = await authorizedRequest("/api/v1/hero-banners");
    existingHeroBanners.value = response.heroBanners;
  } catch (error) {
    heroBannerStatus.value = error.message;
  } finally {
    isLoadingHeroBanners.value = false;
  }
}

async function loadShopTheLook() {
  isLoadingShopTheLook.value = true;
  try {
    const [environmentResponse, productResponse] = await Promise.all([
      authorizedRequest("/api/v1/shop-the-look"),
      authorizedRequest("/api/v1/products?limit=100"),
    ]);
    shopTheLookEnvironments.value = environmentResponse.environments || [];
    shopTheLookProducts.value = productResponse.products || [];
    rememberShopTheLookProducts([...(environmentResponse.products || []), ...shopTheLookProducts.value]);
  } catch (error) {
    shopTheLookStatus.value = error.message;
  } finally {
    isLoadingShopTheLook.value = false;
  }
}

async function loadShopTheLookProducts(search = "") {
  const query = new URLSearchParams({ limit: "100" });
  if (search.trim()) query.set("search", search.trim());
  try {
    const response = await authorizedRequest(`/api/v1/products?${query}`);
    shopTheLookProducts.value = response.products || [];
    rememberShopTheLookProducts(shopTheLookProducts.value);
  } catch (error) {
    shopTheLookStatus.value = error.message;
  }
}

function buildAdminProductsQuery(page = 1) {
  const query = new URLSearchParams({ page: String(page), limit: "10" });
  for (const [key, value] of Object.entries(adminProductFilters.value)) {
    if (String(value).trim()) query.set(key, String(value).trim());
  }
  return query;
}

async function loadAdminProductFilterOptions() {
  const query = new URLSearchParams();
  if (adminProductFilters.value.category) query.set("category", adminProductFilters.value.category);
  const response = await authorizedRequest(`/api/v1/admin/products/filter-options?${query}`);
  adminProductFilterOptions.value = response;
}

async function loadAdminProducts({ page = adminProductPagination.value.page, refreshOptions = false } = {}) {
  isLoadingAdminProducts.value = true;
  adminProductsError.value = "";
  try {
    if (refreshOptions) await loadAdminProductFilterOptions();
    const response = await authorizedRequest(`/api/v1/admin/products?${buildAdminProductsQuery(page)}`);
    adminProducts.value = response.products || [];
    adminProductPagination.value = response.pagination;
  } catch (error) {
    adminProductsError.value = error.message;
    adminProducts.value = [];
  } finally {
    isLoadingAdminProducts.value = false;
  }
}

async function applyAdminProductFilters({ categoryChanged = false } = {}) {
  if (categoryChanged) adminProductFilters.value.subcategory = "";
  await loadAdminProducts({ page: 1, refreshOptions: true });
}

function scheduleAdminProductSearch() {
  if (adminProductSearchTimer) window.clearTimeout(adminProductSearchTimer);
  adminProductSearchTimer = window.setTimeout(() => void loadAdminProducts({ page: 1 }), 300);
}

function resetAdminProductFilters() {
  adminProductFilters.value = { search: "", category: "", subcategory: "", series: "", minPrice: "", maxPrice: "" };
  void loadAdminProducts({ page: 1, refreshOptions: true });
}

async function openAdminProductDetails(product) {
  adminProductsError.value = "";
  try {
    const response = await authorizedRequest(`/api/v1/admin/products/${product.id}`);
    selectedAdminProduct.value = response.product;
    isAdminProductDetailsOpen.value = true;
  } catch (error) {
    adminProductsError.value = error.message;
  }
}

function formatAdminProductPrice(product) {
  if (product.srp === null || product.srp === undefined) return "--";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: product.currencyCode || "PHP", maximumFractionDigits: 2 }).format(product.srp);
}

function activeCartPath() {
  return active.value === "Guest Carts" ? "sessions" : "registered";
}

function buildAdminCartsQuery(page) {
  const query = new URLSearchParams({ page: String(page), limit: "10" });
  if (adminCartFilters.value.search.trim()) query.set("search", adminCartFilters.value.search.trim());
  if (adminCartFilters.value.dateFrom) query.set("dateFrom", adminCartFilters.value.dateFrom);
  if (adminCartFilters.value.dateTo) query.set("dateTo", adminCartFilters.value.dateTo);
  return query;
}

async function loadAdminCarts({ page = adminCartPagination.value.page } = {}) {
  if (!["Registered Carts", "Guest Carts"].includes(active.value)) return;
  isLoadingAdminCarts.value = true;
  adminCartsError.value = "";
  try {
    const response = await authorizedRequest(`/api/v1/carts/${activeCartPath()}?${buildAdminCartsQuery(page)}`);
    adminCarts.value = response.carts || [];
    adminCartPagination.value = response.pagination;
  } catch (error) {
    adminCartsError.value = error.message;
    adminCarts.value = [];
  } finally {
    isLoadingAdminCarts.value = false;
  }
}

function scheduleAdminCartSearch() {
  if (adminCartSearchTimer) window.clearTimeout(adminCartSearchTimer);
  adminCartSearchTimer = window.setTimeout(() => void loadAdminCarts({ page: 1 }), 300);
}

function resetAdminCartFilters() {
  adminCartFilters.value = { search: "", dateFrom: "", dateTo: "" };
  void loadAdminCarts({ page: 1 });
}

async function openAdminCartDetails(cart) {
  adminCartsError.value = "";
  try {
    const response = await authorizedRequest(`/api/v1/carts/${cart.id}`);
    selectedAdminCart.value = response.cart;
    isAdminCartDetailsOpen.value = true;
  } catch (error) {
    adminCartsError.value = error.message;
  }
}

function formatAdminCartDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatAdminCartPrice(cart) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: cart?.currencyCode || "PHP", maximumFractionDigits: 2 }).format(Number(cart?.totalPrice) || 0);
}

function adminCartStatusClass(status) {
  return status === "Abandoned" ? "is-inactive" : "is-active";
}

async function loadAdminUsers() {
  isLoadingAdminUsers.value = true;
  usersError.value = "";
  try {
    const query = new URLSearchParams();
    if (adminUserSearch.value.trim()) query.set("search", adminUserSearch.value.trim());
    if (adminUserRole.value) query.set("role", adminUserRole.value);
    const response = await authorizedRequest(`/api/v1/users/admins?${query}`);
    adminUsers.value = response.users || [];
  } catch (error) {
    usersError.value = error.message;
    adminUsers.value = [];
  } finally {
    isLoadingAdminUsers.value = false;
  }
}

function scheduleAdminUserSearch() {
  if (adminUserSearchTimer) window.clearTimeout(adminUserSearchTimer);
  adminUserSearchTimer = window.setTimeout(() => void loadAdminUsers(), 300);
}

function resetAdminUserFilters() {
  adminUserSearch.value = "";
  adminUserRole.value = "";
  void loadAdminUsers();
}

function openInviteUser() {
  if (!currentAdminIsSuperuser.value) return;
  inviteUserError.value = "";
  adminUserInviteMessage.value = "";
  inviteUserForm.value = { firstName: "", lastName: "", email: "", role: "staff" };
  isInviteUserOpen.value = true;
}

function closeInviteUser() {
  if (isInvitingUser.value) return;
  isInviteUserOpen.value = false;
  inviteUserError.value = "";
}

async function inviteAdminUser() {
  inviteUserError.value = "";
  isInvitingUser.value = true;
  try {
    const response = await authorizedRequest("/api/v1/users/admin-invitations", {
      method: "POST",
      body: JSON.stringify({
        firstName: inviteUserForm.value.firstName.trim(),
        lastName: inviteUserForm.value.lastName.trim(),
        email: inviteUserForm.value.email.trim(),
        role: inviteUserForm.value.role,
      }),
    });
    isInviteUserOpen.value = false;
    await loadAdminUsers();
    usersError.value = "";
    adminUserInviteMessage.value = response.message;
  } catch (error) {
    inviteUserError.value = error.message;
  } finally {
    isInvitingUser.value = false;
  }
}

async function completeAdminInvitation() {
  inviteSetupError.value = "";
  if (!adminInvitationToken) {
    inviteSetupError.value = "This invitation link is invalid or incomplete.";
    return;
  }
  if (inviteSetupPassword.value.length < 8) {
    inviteSetupError.value = "Use at least 8 characters for your password.";
    return;
  }
  if (inviteSetupPassword.value !== inviteSetupConfirmPassword.value) {
    inviteSetupError.value = "Passwords must match exactly.";
    return;
  }
  isCompletingInvite.value = true;
  try {
    const response = await request("/api/v1/auth/admin-invitations/complete", { token: adminInvitationToken, password: inviteSetupPassword.value });
    inviteSetupMessage.value = response.message;
    inviteSetupPassword.value = "";
    inviteSetupConfirmPassword.value = "";
  } catch (error) {
    inviteSetupError.value = error.message;
  } finally {
    isCompletingInvite.value = false;
  }
}

async function loadDesigners() {
  isLoadingDesigners.value = true;
  usersError.value = "";
  try {
    const response = await authorizedRequest("/api/v1/users/designers");
    designers.value = response.designers || [];
  } catch (error) {
    usersError.value = error.message;
    designers.value = [];
  } finally {
    isLoadingDesigners.value = false;
  }
}

async function openDesignerDetails(designer) {
  usersError.value = "";
  try {
    const response = await authorizedRequest(`/api/v1/users/designers/${designer.id}`);
    selectedDesigner.value = response.designer;
    isDesignerDetailsOpen.value = true;
  } catch (error) {
    usersError.value = error.message;
  }
}

function openDesignerReview(designer) {
  selectedDesigner.value = designer;
  isDesignerReviewOpen.value = true;
}

async function reviewDesigner(status) {
  if (!selectedDesigner.value) return;
  isSavingDesignerReview.value = true;
  usersError.value = "";
  try {
    await authorizedRequest(`/api/v1/users/designers/${selectedDesigner.value.id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    isDesignerReviewOpen.value = false;
    await loadDesigners();
  } catch (error) {
    usersError.value = error.message;
  } finally {
    isSavingDesignerReview.value = false;
  }
}

function formatDesignerDate(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(value));
}

function designerStatusLabel(status) {
  return status ? `${status.charAt(0)}${status.slice(1).toLocaleLowerCase()}` : "Pending";
}

function designerStatusClass(status) {
  return `is-${(status || "PENDING").toLocaleLowerCase()}`;
}

function resetDesignerStatusFilter() {
  designerStatusFilter.value = "";
}

function showShopTheLookToast(message, type = "success") {
  if (shopTheLookToastTimer) window.clearTimeout(shopTheLookToastTimer);
  shopTheLookToast.value = { message, type };
  shopTheLookToastTimer = window.setTimeout(() => {
    shopTheLookToast.value = null;
    shopTheLookToastTimer = null;
  }, 4200);
}

function rememberShopTheLookProducts(products) {
  const remembered = { ...shopTheLookProductCache.value };
  for (const product of products) {
    const id = product.recordId || product.id;
    if (id) remembered[id] = product;
  }
  shopTheLookProductCache.value = remembered;
}

function clearShopTheLookEditor() {
  editingEnvironmentId.value = null;
  shopTheLookForm.value = { name: "", position: 0 };
  shopTheLookDescription.value = "";
  shopTheLookQuill = null;
  shopTheLookImage.value = null;
  if (shopTheLookPreviewUrl.value) URL.revokeObjectURL(shopTheLookPreviewUrl.value);
  shopTheLookPreviewUrl.value = "";
  shopTheLookExistingImageUrl.value = "";
  shopTheLookHotspots.value = [];
  shopTheLookStatus.value = "";
  shopTheLookMenu.value.open = false;
  movingHotspotId.value = null;
  assigningHotspotId.value = null;
  shopTheLookProductSearch.value = "";
  selectedHotspotId.value = null;
  shopTheLookZoom.value = 100;
  shopTheLookImageDimensions.value = { width: 1920, height: 1080 };
  if (shopTheLookImageInput.value) shopTheLookImageInput.value.value = "";
}

async function openShopTheLookEditor(slot) {
  clearShopTheLookEditor();
  shopTheLookForm.value.position = slot.position;
  if (slot.environment) {
    editingEnvironmentId.value = slot.environment.id;
    shopTheLookForm.value.name = slot.environment.name;
    shopTheLookDescription.value = slot.environment.description || "";
    shopTheLookExistingImageUrl.value = slot.environment.imageUrl;
    shopTheLookHotspots.value = [...(slot.environment.hotspots || [])];
  }
  isShopTheLookEditorOpen.value = true;
  await nextTick();
  initializeShopTheLookDescriptionEditor();
}

function closeShopTheLookEditor() {
  clearShopTheLookEditor();
  isShopTheLookEditorOpen.value = false;
}

function openShopTheLookDeleteConfirmation(environment) {
  shopTheLookEnvironmentToDelete.value = environment;
  shopTheLookDeleteError.value = "";
  isShopTheLookDeleteConfirmationOpen.value = true;
}

function closeShopTheLookDeleteConfirmation(force = false) {
  if (isDeletingShopTheLook.value && !force) return;
  isShopTheLookDeleteConfirmationOpen.value = false;
  shopTheLookEnvironmentToDelete.value = null;
  shopTheLookDeleteError.value = "";
}

async function deleteShopTheLookEnvironment() {
  const environment = shopTheLookEnvironmentToDelete.value;
  if (!environment) return;

  isDeletingShopTheLook.value = true;
  shopTheLookDeleteError.value = "";
  try {
    await authorizedRequest(`/api/v1/shop-the-look/${environment.id}`, { method: "DELETE" });
    await loadShopTheLook();
    showShopTheLookToast(`“${environment.name}” was deleted.`, "delete");
    closeShopTheLookDeleteConfirmation(true);
  } catch (error) {
    shopTheLookDeleteError.value = error.message;
    showShopTheLookToast(error.message, "error");
  } finally {
    isDeletingShopTheLook.value = false;
  }
}

function openShopTheLookImagePicker() {
  shopTheLookImageInput.value?.click();
}

function setShopTheLookImage(event) {
  const [file] = event.target.files || [];
  if (!file) return;
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    shopTheLookStatus.value = "Use a JPG, JPEG, or PNG image.";
    return;
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    if (image.naturalWidth < 1920 || image.naturalHeight < 1080) {
      URL.revokeObjectURL(url);
      shopTheLookStatus.value = "Environment images must be at least 1920 × 1080 pixels.";
      if (shopTheLookImageInput.value) shopTheLookImageInput.value.value = "";
      return;
    }
    if (shopTheLookPreviewUrl.value) URL.revokeObjectURL(shopTheLookPreviewUrl.value);
    shopTheLookImage.value = file;
    shopTheLookPreviewUrl.value = url;
    shopTheLookExistingImageUrl.value = "";
    shopTheLookImageDimensions.value = { width: image.naturalWidth, height: image.naturalHeight };
    shopTheLookStatus.value = "";
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    shopTheLookStatus.value = "That image could not be read.";
  };
  image.src = url;
}

function updateShopTheLookImageDimensions(event) {
  const image = event.target;
  if (image.naturalWidth && image.naturalHeight) {
    shopTheLookImageDimensions.value = { width: image.naturalWidth, height: image.naturalHeight };
  }
}

function adjustShopTheLookZoom(amount) {
  shopTheLookZoom.value = Math.max(50, Math.min(100, shopTheLookZoom.value + amount));
}

function getShopTheLookDescriptionText(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

function initializeShopTheLookDescriptionEditor() {
  if (!shopTheLookDescriptionEditor.value) return;
  shopTheLookQuill = new Quill(shopTheLookDescriptionEditor.value, {
    theme: "snow",
    formats: ["header", "bold", "italic", "underline", "strike", "blockquote"],
    modules: {
      toolbar: [[{ header: [2, 3, false] }], ["bold", "italic", "underline", "strike"], ["blockquote"], ["clean"]],
    },
  });
  shopTheLookQuill.root.innerHTML = shopTheLookDescription.value || "";
  shopTheLookQuill.root.addEventListener("paste", (event) => {
    const html = event.clipboardData?.getData("text/html") || "";
    if (!/<\s*(?:a|img)\b/i.test(html)) return;
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") || "";
    if (text) shopTheLookQuill.insertText(shopTheLookQuill.getSelection()?.index ?? shopTheLookQuill.getLength(), text, "user");
  });
  shopTheLookQuill.on("text-change", () => {
    const html = shopTheLookQuill.root.innerHTML;
    shopTheLookDescription.value = html === "<p><br></p>" ? "" : html;
  });
}

function removeShopTheLookImage() {
  shopTheLookImage.value = null;
  if (shopTheLookPreviewUrl.value) URL.revokeObjectURL(shopTheLookPreviewUrl.value);
  shopTheLookPreviewUrl.value = "";
  shopTheLookExistingImageUrl.value = "";
  shopTheLookStatus.value = "Choose a replacement image before saving this environment.";
  if (shopTheLookImageInput.value) shopTheLookImageInput.value.value = "";
}

function getImagePoint(event) {
  const image = event.currentTarget.querySelector(".shop-look-editor__image");
  const rect = image?.getBoundingClientRect();
  if (!rect) return { x: 50, y: 50 };
  return {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
  };
}

function openShopTheLookMenu(event, hotspot = null) {
  const point = getImagePoint(event);
  shopTheLookMenu.value = {
    open: true,
    x: Math.min(event.clientX, window.innerWidth - 220),
    y: Math.min(event.clientY, window.innerHeight - 150),
    hotspotId: hotspot?.id || null,
    xPercent: point.x,
    yPercent: point.y,
  };
  selectedHotspotId.value = hotspot?.id || null;
}

function addShopTheLookHotspot() {
  const { xPercent, yPercent } = shopTheLookMenu.value;
  shopTheLookHotspots.value.push({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, x: xPercent, y: yPercent, productId: null });
  selectedHotspotId.value = shopTheLookHotspots.value.at(-1).id;
  shopTheLookMenu.value.open = false;
}

function prepareHotspotMove() {
  movingHotspotId.value = shopTheLookMenu.value.hotspotId;
  shopTheLookMenu.value.open = false;
  shopTheLookStatus.value = "Click a new position on the image to move this hotspot.";
}

function moveHotspotFromImage(event) {
  if (!movingHotspotId.value) {
    shopTheLookMenu.value.open = false;
    return;
  }
  const point = getImagePoint(event);
  shopTheLookHotspots.value = shopTheLookHotspots.value.map((hotspot) => hotspot.id === movingHotspotId.value ? { ...hotspot, x: point.x, y: point.y } : hotspot);
  selectedHotspotId.value = movingHotspotId.value;
  movingHotspotId.value = null;
  shopTheLookStatus.value = "";
}

function removeShopTheLookHotspot(id) {
  shopTheLookHotspots.value = shopTheLookHotspots.value.filter((hotspot) => hotspot.id !== id);
  selectedHotspotId.value = null;
  assigningHotspotId.value = null;
  shopTheLookMenu.value.open = false;
}

function assignShopTheLookProduct(hotspot, productId) {
  const product = shopTheLookProducts.value.find((item) => (item.recordId || item.id) === productId);
  if (product) rememberShopTheLookProducts([product]);
  shopTheLookHotspots.value = shopTheLookHotspots.value.map((item) => item.id === hotspot.id ? { ...item, productId: productId || null } : item);
  assigningHotspotId.value = null;
}

function openProductAssignment(hotspotId) {
  assigningHotspotId.value = assigningHotspotId.value === hotspotId ? null : hotspotId;
  shopTheLookProductSearch.value = "";
  if (assigningHotspotId.value) void loadShopTheLookProducts();
}

async function saveShopTheLook() {
  if (!shopTheLookForm.value.name.trim()) {
    shopTheLookStatus.value = "Enter an environment name.";
    return;
  }
  if (shopTheLookDescriptionLength.value === 0 || shopTheLookDescriptionLength.value > 200) {
    shopTheLookStatus.value = "Enter an environment description of up to 200 characters.";
    return;
  }
  if (!shopTheLookPreview.value) {
    shopTheLookStatus.value = "Upload an environment image at least 1920 × 1080 pixels before saving.";
    return;
  }
  isSavingShopTheLook.value = true;
  shopTheLookStatus.value = "";
  const action = editingEnvironmentId.value ? "updated" : "saved";
  const environmentName = shopTheLookForm.value.name.trim();
  try {
    const body = new FormData();
    body.append("name", shopTheLookForm.value.name.trim());
    body.append("description", shopTheLookDescription.value);
    body.append("position", String(shopTheLookForm.value.position));
    body.append("hotspots", JSON.stringify(shopTheLookHotspots.value));
    if (shopTheLookImage.value) body.append("image", shopTheLookImage.value);
    await authorizedRequest(editingEnvironmentId.value ? `/api/v1/shop-the-look/${editingEnvironmentId.value}` : "/api/v1/shop-the-look", {
      method: editingEnvironmentId.value ? "PATCH" : "POST",
      body,
    });
    closeShopTheLookEditor();
    await loadShopTheLook();
    showShopTheLookToast(`“${environmentName}” was ${action}.`, "success");
  } catch (error) {
    shopTheLookStatus.value = error.message;
    showShopTheLookToast(error.message, "error");
  } finally {
    isSavingShopTheLook.value = false;
  }
}

async function saveHeroBanner() {
  if (!editingBannerId.value && !heroBannerMedia.value) {
    heroBannerStatus.value = "Select a video or image before saving the banner.";
    return;
  }

  isSavingHeroBanner.value = true;
  heroBannerStatus.value = "";
  try {
    const body = new FormData();
    body.append("title", heroBannerForm.value.title);
    body.append("subtitle", heroBannerForm.value.subtitle);
    body.append("description", heroBannerForm.value.description);
    body.append("category", heroBannerForm.value.category);
    body.append("position", String(heroBannerForm.value.position));
    if (heroBannerMedia.value) body.append("media", heroBannerMedia.value);

    await authorizedRequest(
      editingBannerId.value
        ? `/api/v1/hero-banners/${editingBannerId.value}`
        : "/api/v1/hero-banners",
      { method: editingBannerId.value ? "PATCH" : "POST", body },
    );
    closeHeroBannerForm();
    await loadHeroBanners();
  } catch (error) {
    heroBannerStatus.value = error.message;
  } finally {
    isSavingHeroBanner.value = false;
  }
}

function chooseHeroBannerPosition(position) {
  clearHeroBannerForm();
  heroBannerForm.value.position = position;
  void showHeroBannerForm();
}

function startHeroBannerDrag(event, bannerId) {
  draggingHeroBannerId.value = bannerId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", bannerId);
}

async function moveHeroBanner(targetPosition) {
  const sourceId = draggingHeroBannerId.value;
  draggingHeroBannerId.value = null;
  const sourceBanner = existingHeroBanners.value.find((banner) => banner.id === sourceId);
  if (!sourceBanner || sourceBanner.position === targetPosition) return;

  const targetBanner = existingHeroBanners.value.find((banner) => banner.position === targetPosition);
  const previousBanners = existingHeroBanners.value;
  existingHeroBanners.value = existingHeroBanners.value
    .map((banner) => {
      if (banner.id === sourceId) return { ...banner, position: targetPosition };
      if (targetBanner && banner.id === targetBanner.id) return { ...banner, position: sourceBanner.position };
      return banner;
    })
    .sort((left, right) => left.position - right.position);

  try {
    await authorizedRequest(`/api/v1/hero-banners/${sourceId}`, {
      method: "PATCH",
      body: JSON.stringify({ position: targetPosition }),
    });
    await loadHeroBanners();
  } catch (error) {
    existingHeroBanners.value = previousBanners;
    heroBannerStatus.value = error.message;
  }
}

function clearStoredAdminSession() {
  sessionStorage.removeItem("caracole-admin-access-token");
  sessionStorage.removeItem("caracole-admin-refresh-token");
  sessionStorage.removeItem("caracole-admin-user");
  sessionStorage.removeItem(ADMIN_VIEW_STORAGE_KEY);
}

async function loadRestoredAdminPage() {
  if (active.value === "Products") await loadAdminProducts({ page: 1, refreshOptions: !adminProductFilterOptions.value.categories.length });
  if (["Registered Carts", "Guest Carts"].includes(active.value)) await loadAdminCarts({ page: 1 });
  if (active.value === "Admin") await loadAdminUsers();
  if (active.value === "Registered Designers") await loadDesigners();
  if (contentSectionIds[activeContentLink.value]) {
    await nextTick();
    document.getElementById(contentSectionIds[activeContentLink.value])?.scrollIntoView({ block: "start" });
  }
}

async function refreshAdminSession() {
  const refreshToken = sessionStorage.getItem("caracole-admin-refresh-token");
  if (!refreshToken) return;

  try {
    const response = await request("/api/v1/auth/refresh", { refreshToken });
    sessionStorage.setItem("caracole-admin-access-token", response.accessToken);
    sessionStorage.setItem("caracole-admin-refresh-token", response.refreshToken);
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      clearStoredAdminSession();
      isAuthenticated.value = false;
    }
  }
}

onMounted(async () => {
  window.addEventListener("keydown", handleAdminKeydown);
  if (isAuthenticated.value) {
    await refreshAdminSession();
    if (isAuthenticated.value) {
      await Promise.all([loadHeroBanners(), loadShopTheLook()]);
      await loadRestoredAdminPage();
    }
  }
});

async function submitLogin() {
  formError.value = "";
  isSubmitting.value = true;
  try {
    const response = await request("/api/v1/auth/admin/login", {
      email: email.value,
      password: password.value,
    });
    sessionStorage.setItem("caracole-admin-access-token", response.accessToken);
    sessionStorage.setItem(
      "caracole-admin-refresh-token",
      response.refreshToken,
    );
    sessionStorage.setItem(
      "caracole-admin-user",
      JSON.stringify(response.user),
    );
    showAdminLanding();
    isAuthenticated.value = true;
    await Promise.all([loadHeroBanners(), loadShopTheLook()]);
  } catch (error) {
    formError.value = error.message;
  } finally {
    isSubmitting.value = false;
  }
}

async function requestPasswordReset() {
  formError.value = "";
  isSubmitting.value = true;
  try {
    const response = await request("/api/v1/auth/forgot-password", {
      email: email.value,
    });
    formMessage.value = response.message;
    resetRequested.value = true;
  } catch (error) {
    formError.value = error.message;
  } finally {
    isSubmitting.value = false;
  }
}

async function submitPasswordReset() {
  formError.value = "";
  if (newPassword.value !== confirmPassword.value) {
    formError.value = "Passwords do not match.";
    return;
  }
  isSubmitting.value = true;
  try {
    const response = await request("/api/v1/auth/reset-password", {
      email: email.value,
      otp: resetOtp.value,
      password: newPassword.value,
    });
    formMessage.value = response.message;
    newPassword.value = "";
    confirmPassword.value = "";
    resetOtp.value = "";
  } catch (error) {
    formError.value = error.message;
  } finally {
    isSubmitting.value = false;
  }
}

async function endSession() {
  const refreshToken = sessionStorage.getItem("caracole-admin-refresh-token");
  clearStoredAdminSession();
  if (refreshToken) {
    try {
      await request("/api/v1/auth/logout", { refreshToken });
    } catch {
      /* Local session is already cleared. */
    }
  }
}

function showLogin() {
  isForgotPassword.value = false;
  resetRequested.value = false;
  formError.value = "";
  formMessage.value = "";
}
</script>

<template>
  <section v-if="isAdminInvitationSetup" class="admin-login-page">
    <form class="admin-login-card" @submit.prevent="completeAdminInvitation">
      <a class="admin-login-brand" href="/" aria-label="Caracole home">caracole</a>
      <p class="admin-login-eyebrow">Caracole Philippines</p>
      <h1>Set up your password</h1>
      <p class="admin-login-copy">Complete your administrator registration by creating a secure password.</p>
      <template v-if="!inviteSetupMessage">
        <div class="admin-setup-requirements"><strong>Password requirements</strong><ul><li>At least 8 characters</li><li>Passwords must match exactly</li></ul></div>
        <label for="admin-invite-password">Password</label>
        <div class="admin-password-field"><input id="admin-invite-password" v-model="inviteSetupPassword" :type="showInviteSetupPassword ? 'text' : 'password'" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters" /><button type="button" :aria-label="showInviteSetupPassword ? 'Hide password' : 'Show password'" @click="showInviteSetupPassword = !showInviteSetupPassword"><i :class="showInviteSetupPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i></button></div>
        <label for="admin-invite-confirm-password">Confirm password</label>
        <div class="admin-password-field"><input id="admin-invite-confirm-password" v-model="inviteSetupConfirmPassword" :type="showInviteSetupConfirmPassword ? 'text' : 'password'" autocomplete="new-password" minlength="8" required placeholder="Repeat your password" /><button type="button" :aria-label="showInviteSetupConfirmPassword ? 'Hide password' : 'Show password'" @click="showInviteSetupConfirmPassword = !showInviteSetupConfirmPassword"><i :class="showInviteSetupConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i></button></div>
      </template>
      <p v-if="inviteSetupError" class="admin-form-error" role="alert">{{ inviteSetupError }}</p>
      <p v-if="inviteSetupMessage" class="admin-reset-message" role="status">{{ inviteSetupMessage }}</p>
      <button v-if="!inviteSetupMessage" class="admin-login-submit" type="submit" :disabled="isCompletingInvite">{{ isCompletingInvite ? 'Activating...' : 'Activate admin account' }}<i class="pi pi-arrow-right" aria-hidden="true"></i></button>
      <a v-else class="admin-forgot-link" href="/admin">Go to admin sign in</a>
    </form>
  </section>

  <section v-else-if="!isAuthenticated" class="admin-login-page">
    <form
      v-if="!isForgotPassword"
      class="admin-login-card"
      @submit.prevent="submitLogin"
    >
      <a class="admin-login-brand" href="/" aria-label="Caracole home"
        >caracole</a
      >
      <p class="admin-login-eyebrow">Caracole Philippines</p>
      <h1>Admin sign in</h1>
      <p class="admin-login-copy">
        Use your administrator account to access the Caracole workspace.
      </p>

      <label for="admin-email">Email address</label>
      <input
        id="admin-email"
        v-model="email"
        type="email"
        autocomplete="email"
        required
        placeholder="name@company.com"
      />

      <label for="admin-password">Password</label>
      <div class="admin-password-field">
        <input
          id="admin-password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          required
          placeholder="Enter your password"
        />
        <button
          type="button"
          :aria-label="showPassword ? 'Hide password' : 'Show password'"
          @click="showPassword = !showPassword"
        >
          <i
            :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"
            aria-hidden="true"
          ></i>
        </button>
      </div>

      <p v-if="formError" class="admin-form-error" role="alert">
        {{ formError }}
      </p>
      <button class="admin-login-submit" type="submit" :disabled="isSubmitting">
        {{ isSubmitting ? "Signing in..." : "Sign in" }}
        <i class="pi pi-arrow-right" aria-hidden="true"></i>
      </button>
      <button
        class="admin-forgot-link"
        type="button"
        @click="isForgotPassword = true"
      >
        Forgot password?
      </button>
    </form>

    <form
      v-else
      class="admin-login-card"
      @submit.prevent="
        resetRequested ? submitPasswordReset() : requestPasswordReset()
      "
    >
      <a class="admin-login-brand" href="/" aria-label="Caracole home"
        >caracole</a
      >
      <p class="admin-login-eyebrow">Account recovery</p>
      <h1>Reset password</h1>
      <p class="admin-login-copy">
        Enter your administrator email and we’ll send password-reset
        instructions.
      </p>

      <label for="admin-reset-email">Email address</label>
      <input
        id="admin-reset-email"
        v-model="email"
        type="email"
        autocomplete="email"
        required
        placeholder="name@company.com"
      />
      <p v-if="resetRequested" class="admin-reset-message">{{ formMessage }}</p>
      <template v-if="resetRequested && !formMessage.includes('successfully')">
        <label for="admin-reset-otp">One-time code</label>
        <input
          id="admin-reset-otp"
          v-model="resetOtp"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
          required
          placeholder="6-digit code"
        />
        <label for="admin-new-password">New password</label>
        <input
          id="admin-new-password"
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
          placeholder="At least 8 characters"
        />
        <label for="admin-confirm-password">Confirm new password</label>
        <input
          id="admin-confirm-password"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          minlength="8"
          required
          placeholder="Repeat your new password"
        />
      </template>
      <p v-if="formError" class="admin-form-error" role="alert">
        {{ formError }}
      </p>
      <button
        v-if="!resetRequested"
        class="admin-login-submit"
        type="submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? "Sending..." : "Send reset instructions" }}
        <i class="pi pi-arrow-right" aria-hidden="true"></i>
      </button>
      <button
        v-else-if="!formMessage.includes('successfully')"
        class="admin-login-submit"
        type="submit"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? "Resetting..." : "Reset password" }}
        <i class="pi pi-arrow-right" aria-hidden="true"></i>
      </button>
      <button class="admin-forgot-link" type="button" @click="showLogin">
        Back to sign in
      </button>
    </form>
  </section>

  <div v-else class="admin-shell">
    <button class="admin-mobile-nav-toggle" :class="{ 'is-sidebar-open': isMobileSidebarOpen }" type="button" aria-label="Open navigation" :aria-expanded="isMobileSidebarOpen" aria-controls="admin-sidebar" @click="toggleMobileSidebar"><i class="pi pi-bars" aria-hidden="true"></i></button>
    <Transition name="admin-sidebar-fade"><button v-if="isMobileSidebarOpen" class="admin-sidebar-backdrop" type="button" aria-label="Close navigation" @click="closeMobileSidebar"></button></Transition>
    <aside id="admin-sidebar" class="admin-sidebar" :class="{ 'is-mobile-open': isMobileSidebarOpen }">
      <button class="admin-sidebar__close" type="button" aria-label="Close navigation" @click="closeMobileSidebar"><i class="pi pi-times" aria-hidden="true"></i></button>
      <a class="admin-brand" href="/admin" aria-label="Caracole Philippines admin home">
        <span class="admin-brand__wordmark">caracole</span>
        <small>Philippines</small>
      </a>

      <nav class="admin-nav" aria-label="Admin navigation">
        <section
          v-for="group in orderedGroups"
          :key="group.title"
          class="admin-nav__group"
        >
          <button
            class="admin-nav__item"
            :class="{ 'is-active': activeGroup?.title === group.title }"
            type="button"
            :aria-expanded="
              group.items.length ? expanded[group.title] : undefined
            "
            :aria-controls="
              group.items.length ? `admin-submenu-${group.title}` : undefined
            "
            @click="selectGroup(group)"
          >
            <i :class="group.icon" aria-hidden="true"></i
            ><span>{{ group.title }}</span>
            <i
              v-if="group.items.length"
              class="pi pi-angle-right admin-nav__chevron"
              :class="{ 'is-expanded': expanded[group.title] }"
              aria-hidden="true"
            ></i>
          </button>
          <div
            v-if="group.items.length && expanded[group.title]"
            :id="`admin-submenu-${group.title}`"
            class="admin-nav__children"
            role="group"
            :aria-label="`${group.title} sections`"
          >
            <button
              v-for="item in group.items"
              :key="itemKey(item)"
              type="button"
              :class="{ 'is-current': activeContentLink === itemKey(item) }"
              @click="select(item)"
            >
              {{ itemLabel(item) }}
            </button>
          </div>
        </section>
      </nav>

      <div class="admin-account">
        <span class="admin-account__avatar">A</span>
        <span
          ><strong>System Administrator</strong
          ><small>Admin service</small></span
        >
      </div>
      <button class="admin-logout" type="button" @click="select('Logout')">
        <span>⇥</span> Logout
      </button>
    </aside>

    <main class="admin-main">
      <section :id="active === 'Hero Banners' ? 'hero-banners' : undefined" class="admin-content" :class="{ 'admin-content--hero-banners': active === 'Hero Banners', 'admin-content--products': active === 'Products', 'admin-content--carts': ['Registered Carts', 'Guest Carts'].includes(active), 'admin-content--users': ['Admin', 'Registered Designers', 'Customers'].includes(active) }">
        <h1>{{ adminTopbarTitle }}</h1>
        <template v-if="active === 'Hero Banners'">
          <Transition name="admin-editor-slide">
            <div v-if="isHeroBannerFormOpen" class="admin-hero-banner-editor">
              <div class="admin-hero-banner-heading">
                <div>
                  <h2>{{ editingBannerId ? 'Edit Hero Banner' : 'Add Hero Banner' }}</h2>
                  <p>Manage the homepage hero experience. Add up to 3 banners.</p>
                </div>
                <strong>{{ existingHeroBanners.length }} / 3 <span>banners used</span></strong>
              </div>

              <form class="admin-hero-banner-form" @submit.prevent="saveHeroBanner">
                <div class="admin-media-field">
              <div class="admin-field-label">
                <label for="hero-banner-media">Video / Image <span>(16:9 ratio, HQ)</span></label>
              </div>
              <input
                id="hero-banner-media"
                ref="heroBannerInput"
                class="admin-media-field__input"
                type="file"
                accept="image/*,video/*"
                @change="setHeroBannerMedia"
              />
              <button
                class="admin-media-field__dropzone"
                :class="{ 'has-preview': heroBannerPreview }"
                type="button"
                @click="openMediaPicker"
              >
                <template v-if="heroBannerPreview">
                  <video v-if="heroBannerPreviewType === 'video'" :src="heroBannerPreview" muted playsinline></video>
                  <img v-else :src="heroBannerPreview" :alt="heroBannerMedia?.name || 'Selected banner media'" />
                  <span class="admin-media-field__replace">Replace media</span>
                </template>
                <template v-else>
                  <i class="pi pi-cloud-upload" aria-hidden="true"></i>
                  <strong>Click to upload video or image</strong>
                  <span>or drag and drop</span>
                  <small>MP4, MOV, WEBM, JPG, PNG · 16:9 ratio recommended</small>
                </template>
              </button>
              <p class="admin-media-field__hint"><i class="pi pi-info-circle" aria-hidden="true"></i> For best results, upload high-quality 16:9 media. Recommended resolution: 1920×1080 or higher.</p>
            </div>

            <div class="admin-hero-banner-fields">
              <label>
                <span>Title <em>{{ heroBannerForm.title.length }} / 80</em></span>
                <input v-model="heroBannerForm.title" maxlength="80" required placeholder="Enter banner title" />
              </label>
              <label>
                <span>Subtitle <em>{{ heroBannerForm.subtitle.length }} / 120</em></span>
                <input v-model="heroBannerForm.subtitle" maxlength="120" placeholder="Enter subtitle" />
              </label>
              <label>
                <span>Brief Description <em>{{ heroBannerForm.description.length }} / 200</em></span>
                <textarea v-model="heroBannerForm.description" maxlength="200" required placeholder="Enter a brief description"></textarea>
              </label>
              <label>
                <span>Category</span>
                <select v-model="heroBannerForm.category" required>
                  <option value="" disabled>Select category</option>
                  <option>Living</option>
                  <option>Dining</option>
                  <option>Bedroom</option>
                  <option>Mirrors & Accessories</option>
                  <option>Entertainments</option>
                </select>
              </label>
              <label>
                <span>Placement</span>
                <select v-model.number="heroBannerForm.position" required>
                  <option value="" disabled>Select a position</option>
                  <option
                    v-for="slot in heroBannerSlots"
                    :key="slot.position"
                    :value="slot.position"
                    :disabled="Boolean(slot.banner && slot.banner.id !== editingBannerId)"
                  >
                    Position {{ slot.position + 1 }}{{ slot.banner && slot.banner.id !== editingBannerId ? ' (in use)' : '' }}
                  </option>
                </select>
              </label>
              <p v-if="heroBannerStatus" class="admin-hero-banner-status" aria-live="polite">{{ heroBannerStatus }}</p>
              <div class="admin-hero-banner-actions">
                <button v-if="editingBannerId" class="admin-hero-banner-actions__delete" type="button" @click="openHeroBannerDeleteConfirmation">Delete</button>
                <button type="button" @click="closeHeroBannerForm">Cancel</button>
                <button type="submit" :disabled="isSavingHeroBanner">{{ isSavingHeroBanner ? 'Saving...' : editingBannerId ? 'Update Banner' : 'Save Banner' }}</button>
              </div>
            </div>
              </form>
            </div>
          </Transition>

          <section class="admin-existing-banners" aria-labelledby="existing-hero-banners-title">
            <header>
              <div>
                <h2 id="existing-hero-banners-title">Hero Banners</h2>
                <p>Choose a placement when creating a banner, or drag a saved banner to another slot.</p>
              </div>
            </header>
            <p v-if="isLoadingHeroBanners" class="admin-existing-banners__empty">Loading hero banners…</p>
            <template v-else>
              <article
                v-for="slot in heroBannerSlots"
                :key="slot.position"
                class="admin-existing-banner"
                :class="{
                  'is-dragging': slot.banner && draggingHeroBannerId === slot.banner.id,
                  'admin-existing-banner--empty': !slot.banner,
                }"
                :draggable="Boolean(slot.banner)"
                @dragstart="slot.banner && startHeroBannerDrag($event, slot.banner.id)"
                @dragend="draggingHeroBannerId = null"
                @dragover.prevent
                @drop.prevent="moveHeroBanner(slot.position)"
              >
                <template v-if="slot.banner">
                  <i class="pi pi-bars admin-existing-banner__handle" aria-label="Drag to reorder"></i>
                  <div class="admin-existing-banner__preview"><span>{{ slot.banner.category }}</span><video v-if="slot.banner.mediaType === 'video'" :src="slot.banner.mediaUrl" muted playsinline preload="metadata"></video><img v-else :src="slot.banner.mediaUrl" :alt="slot.banner.title" /><i v-if="slot.banner.mediaType === 'video'" class="pi pi-play-circle" aria-hidden="true"></i></div>
                  <div class="admin-existing-banner__copy">
                    <h3>{{ slot.banner.title }}</h3>
                    <p>{{ slot.banner.subtitle }}</p>
                    <small>{{ slot.banner.description }}</small>
                    <b :class="`admin-category--${slot.banner.category.toLowerCase()}`">{{ slot.banner.category }}</b>
                  </div>
                  <span class="admin-existing-banner__status"><i class="pi pi-circle-fill" aria-hidden="true"></i> Position {{ slot.position + 1 }}</span>
                  <button type="button" @click="editHeroBanner(slot.banner)">Edit</button>
                </template>
                <template v-else>
                  <i class="pi pi-plus-circle admin-existing-banner__handle" aria-hidden="true"></i>
                  <div class="admin-existing-banner__preview admin-existing-banner__preview--empty"><span>Position {{ slot.position + 1 }}</span><i class="pi pi-image" aria-hidden="true"></i></div>
                  <div class="admin-existing-banner__copy">
                    <h3>Empty placement</h3>
                    <small>This slot is showing the original homepage hero banner until you add one.</small>
                  </div>
                  <span class="admin-existing-banner__status admin-existing-banner__status--empty">Available</span>
                  <button
                    v-if="isHeroBannerFormOpen && !editingBannerId && heroBannerForm.position === slot.position"
                    class="admin-existing-banner__cancel"
                    type="button"
                    @click="closeHeroBannerForm"
                  >
                    Cancel
                  </button>
                  <button v-else type="button" @click="chooseHeroBannerPosition(slot.position)">Create</button>
                </template>
              </article>
            </template>
          </section>

          <section id="shop-the-look" class="admin-shop-look" aria-labelledby="shop-the-look-title">
            <header class="admin-shop-look__heading">
              <div>
                <h2 id="shop-the-look-title">Shop the Look</h2>
                <p>Create up to 10 environments and place product hotspots on each scene.</p>
              </div>
              <strong>{{ shopTheLookEnvironments.length }} / 10 <span>environments used</span></strong>
            </header>

            <p v-if="isLoadingShopTheLook" class="admin-shop-look__loading">Loading environments…</p>
            <div v-else class="admin-shop-look__slots">
              <article v-for="slot in shopTheLookSlots" :key="slot.position" class="admin-shop-look-slot" :class="{ 'admin-shop-look-slot--empty': !slot.environment }">
                <div class="admin-shop-look-slot__number">{{ String(slot.position + 1).padStart(2, '0') }}</div>
                <div class="admin-shop-look-slot__preview">
                  <img v-if="slot.environment" :src="slot.environment.imageUrl" :alt="slot.environment.name" />
                  <i v-else class="pi pi-image" aria-hidden="true"></i>
                </div>
                <div class="admin-shop-look-slot__copy">
                  <h3>{{ slot.environment?.name || 'Empty environment' }}</h3>
                  <p v-if="slot.environment">{{ slot.environment.hotspots?.length || 0 }} hotspot{{ slot.environment.hotspots?.length === 1 ? '' : 's' }} assigned</p>
                  <p v-else>Upload an environment image and link its products.</p>
                </div>
                <div v-if="slot.environment" class="admin-shop-look-slot__actions">
                  <button type="button" @click="openShopTheLookEditor(slot)">Edit</button>
                  <button class="admin-shop-look-slot__delete" type="button" @click="openShopTheLookDeleteConfirmation(slot.environment)">Delete</button>
                </div>
                <button v-else type="button" @click="openShopTheLookEditor(slot)">Create</button>
              </article>
            </div>
          </section>

          <AdminContentManager section="main-categories" section-id="main-categories-display" :authorized-request="authorizedRequest" />
          <AdminContentManager section="designer-profiles" section-id="content-designers" :authorized-request="authorizedRequest" />

          <Teleport to="body">
            <Transition name="admin-dialog-fade">
              <div v-if="isShopTheLookEditorOpen" class="shop-look-editor-backdrop" role="presentation" @click.self="closeShopTheLookEditor">
                <section ref="shopTheLookEditorDialog" class="shop-look-editor" role="dialog" aria-modal="true" aria-labelledby="shop-look-editor-title" tabindex="-1" @keydown="trapAdminDialogFocus($event, shopTheLookEditorDialog)">
                  <header class="shop-look-editor__head">
                    <div>
                      <p class="admin-eyebrow">Shop the Look / Environment {{ shopTheLookForm.position + 1 }}</p>
                      <h2 id="shop-look-editor-title">{{ editingEnvironmentId ? 'Edit Environment' : 'Create Environment' }}</h2>
                      <span>Create a scene and assign products to the hotspots.</span>
                    </div>
                    <div>
                      <button type="button" @click="closeShopTheLookEditor">Cancel</button>
                      <button class="shop-look-editor__save" type="button" :disabled="isSavingShopTheLook" @click="saveShopTheLook">{{ isSavingShopTheLook ? 'Saving…' : 'Save Environment' }}</button>
                    </div>
                  </header>

                  <div class="shop-look-editor__fields">
                    <label>
                      <span>Environment Name</span>
                      <input v-model="shopTheLookForm.name" maxlength="120" placeholder="e.g. Warm Living Room" />
                    </label>
                    <div class="shop-look-editor__upload">
                      <span>Environment Image</span>
                      <input ref="shopTheLookImageInput" type="file" accept="image/jpeg,image/png" @change="setShopTheLookImage" />
                      <div v-if="shopTheLookPreview" class="shop-look-editor__file">
                        <i class="pi pi-image" aria-hidden="true"></i>
                        <strong>{{ shopTheLookImage?.name || 'Current environment image' }}</strong>
                        <button type="button" @click="openShopTheLookImagePicker">Replace</button>
                        <button class="shop-look-editor__trash" type="button" aria-label="Remove environment image" @click="removeShopTheLookImage"><i class="pi pi-trash" aria-hidden="true"></i></button>
                      </div>
                      <button v-else class="shop-look-editor__upload-empty" type="button" @click="openShopTheLookImagePicker"><i class="pi pi-image" aria-hidden="true"></i><span>Upload image</span></button>
                      <small>Minimum 1920 × 1080 pixels, JPG, JPEG, or PNG.</small>
                    </div>
                  </div>

                  <p v-if="shopTheLookStatus" class="shop-look-editor__status" role="status">{{ shopTheLookStatus }}</p>

                  <div class="shop-look-editor__workspace">
                    <div class="shop-look-editor__canvas-panel">
                      <div class="shop-look-editor__canvas-toolbar">
                        <span>{{ movingHotspotId ? 'Choose a new hotspot position' : 'Right-click the image to add a hotspot' }}</span>
                        <div><button type="button" :disabled="shopTheLookZoom <= 50" aria-label="Zoom out" @click="adjustShopTheLookZoom(-10)"><i class="pi pi-minus" aria-hidden="true"></i></button><b>{{ shopTheLookZoom }}%</b><button type="button" :disabled="shopTheLookZoom >= 100" aria-label="Zoom in" @click="adjustShopTheLookZoom(10)"><i class="pi pi-plus" aria-hidden="true"></i></button></div>
                      </div>
                      <div class="shop-look-editor__canvas-wrap">
                      <div v-if="shopTheLookPreview" class="shop-look-editor__canvas" :class="{ 'is-moving': movingHotspotId }" @click="moveHotspotFromImage" @contextmenu.prevent="openShopTheLookMenu($event)">
                        <img class="shop-look-editor__image" :src="shopTheLookPreview" :style="shopTheLookImageStyle" alt="Environment hotspot canvas" draggable="false" @load="updateShopTheLookImageDimensions" />
                        <button v-for="(hotspot, index) in shopTheLookHotspots" :key="hotspot.id" class="shop-look-hotspot" :class="{ 'is-selected': selectedHotspotId === hotspot.id, 'is-assigned': Boolean(hotspot.productId) }" type="button" :style="{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }" :aria-label="`Hotspot ${index + 1}`" @click.stop="selectedHotspotId = hotspot.id" @contextmenu.stop.prevent="openShopTheLookMenu($event, hotspot)">{{ index + 1 }}</button>
                      </div>
                      <div v-else class="shop-look-editor__canvas-empty"><i class="pi pi-image" aria-hidden="true"></i><p>Upload an image at least 1920 × 1080 pixels to start placing hotspots.</p></div>
                      </div>
                    </div>
                    <aside class="shop-look-editor__hotspots" aria-label="Hotspots and product assignments">
                      <header><h3>Hotspots &amp; Product Assignment</h3><p>Right-click the image to add, edit, or remove a hotspot.</p></header>
                      <div v-if="shopTheLookHotspots.length" class="shop-look-editor__hotspot-list">
                        <article v-for="(hotspot, index) in shopTheLookHotspots" :key="hotspot.id" :class="{ 'is-selected': selectedHotspotId === hotspot.id }" @click="selectedHotspotId = hotspot.id">
                          <b>{{ index + 1 }}</b>
                          <div>
                            <strong>{{ assignedProduct(hotspot)?.name || 'No product assigned' }}</strong>
                            <small v-if="assignedProduct(hotspot)">{{ assignedProduct(hotspot).edpNumber || assignedProduct(hotspot).handle }}</small>
                          </div>
                          <button type="button" @click.stop="openProductAssignment(hotspot.id)">{{ assignedProduct(hotspot) ? 'Change Product' : 'Assign Product' }}</button>
                          <button class="shop-look-editor__remove-hotspot" type="button" :aria-label="`Remove hotspot ${index + 1}`" @click.stop="removeShopTheLookHotspot(hotspot.id)"><i class="pi pi-times" aria-hidden="true"></i></button>
                          <div v-if="assigningHotspotId === hotspot.id" class="shop-look-editor__product-picker">
                            <div class="shop-look-editor__product-dropdown">
                              <button class="shop-look-editor__product-trigger" type="button" @click.stop="openProductAssignment(hotspot.id)">
                                <span>{{ assignedProduct(hotspot)?.name || 'Choose a product' }}</span>
                                <i class="pi pi-chevron-up" aria-hidden="true"></i>
                              </button>
                              <div class="shop-look-editor__product-menu" @click.stop>
                                <label class="shop-look-editor__product-search">
                                  <i class="pi pi-search" aria-hidden="true"></i>
                                  <input v-model="shopTheLookProductSearch" type="search" placeholder="Search products" autofocus @input="loadShopTheLookProducts(shopTheLookProductSearch)" />
                                  <button v-if="shopTheLookProductSearch" type="button" aria-label="Clear product search" @click="shopTheLookProductSearch = ''; loadShopTheLookProducts()"><i class="pi pi-times" aria-hidden="true"></i></button>
                                </label>
                                <div class="shop-look-editor__product-options" role="listbox" aria-label="Products">
                                  <button class="shop-look-editor__product-option" :class="{ 'is-selected': !hotspot.productId }" type="button" role="option" :aria-selected="!hotspot.productId" @click="assignShopTheLookProduct(hotspot, '')">
                                    <span class="shop-look-editor__product-placeholder"><i class="pi pi-ban" aria-hidden="true"></i></span>
                                    <span><strong>No product assigned</strong><small>Remove the current assignment</small></span>
                                  </button>
                                  <button v-for="product in availableShopTheLookProducts" :key="product.recordId || product.id" class="shop-look-editor__product-option" type="button" role="option" :aria-selected="false" @click="assignShopTheLookProduct(hotspot, product.recordId || product.id)">
                                    <img v-if="product.image" :src="product.image" alt="" />
                                    <span v-else class="shop-look-editor__product-placeholder"><i class="pi pi-image" aria-hidden="true"></i></span>
                                    <span><strong>{{ product.name }}</strong><small>EDP {{ product.edpNumber || '--' }}</small></span>
                                  </button>
                                  <p v-if="!availableShopTheLookProducts.length">No available products match this search.</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      </div>
                      <div v-else class="shop-look-editor__hotspots-empty"><i class="pi pi-map-marker" aria-hidden="true"></i><p>No hotspots yet.</p><small>Right-click anywhere on the image and choose Add Hotspot.</small></div>
                    </aside>
                  </div>

                  <section class="shop-look-editor__description" aria-labelledby="shop-look-description-title">
                    <header>
                      <div>
                        <h3 id="shop-look-description-title">Environment Description</h3>
                        <p>Write the customer-facing description for this environment.</p>
                      </div>
                      <strong :class="{ 'is-valid': shopTheLookDescriptionLength > 0 && shopTheLookDescriptionLength <= 200 }">{{ shopTheLookDescriptionLength }} / 200 characters</strong>
                    </header>
                    <div ref="shopTheLookDescriptionEditor" class="shop-look-editor__description-editor"></div>
                    <small>Up to 200 characters. Formatting is supported; images and links are not allowed.</small>
                  </section>
                </section>

                <div v-if="shopTheLookMenu.open" class="shop-look-context-menu" :style="{ left: `${shopTheLookMenu.x}px`, top: `${shopTheLookMenu.y}px` }" @click.stop>
                  <button v-if="!shopTheLookMenu.hotspotId" type="button" @click="addShopTheLookHotspot"><i class="pi pi-plus" aria-hidden="true"></i> Add Hotspot {{ shopTheLookHotspots.length + 1 }}</button>
                  <template v-else>
                    <button type="button" @click="prepareHotspotMove"><i class="pi pi-pencil" aria-hidden="true"></i> Edit Hotspot</button>
                    <button type="button" @click="removeShopTheLookHotspot(shopTheLookMenu.hotspotId)"><i class="pi pi-trash" aria-hidden="true"></i> Remove Hotspot</button>
                  </template>
                </div>
              </div>
            </Transition>
          </Teleport>

          <Teleport to="body">
            <Transition name="admin-dialog-fade">
              <div v-if="isShopTheLookDeleteConfirmationOpen" class="admin-confirmation" role="presentation" @click.self="closeShopTheLookDeleteConfirmation">
                <section ref="shopTheLookDeleteDialog" class="admin-confirmation__dialog" role="dialog" aria-modal="true" aria-labelledby="delete-environment-title" tabindex="-1" @keydown="trapAdminDialogFocus($event, shopTheLookDeleteDialog)">
                <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
                <h2 id="delete-environment-title">Delete Environment?</h2>
                <p>“{{ shopTheLookEnvironmentToDelete?.name }}” and its uploaded image will be permanently removed. This slot will become available again.</p>
                <p v-if="shopTheLookDeleteError" class="admin-confirmation__error" role="alert">{{ shopTheLookDeleteError }}</p>
                <div>
                  <button type="button" :disabled="isDeletingShopTheLook" @click="closeShopTheLookDeleteConfirmation">Cancel</button>
                  <button type="button" :disabled="isDeletingShopTheLook" @click="deleteShopTheLookEnvironment">{{ isDeletingShopTheLook ? 'Deleting…' : 'Delete Environment' }}</button>
                </div>
                </section>
              </div>
            </Transition>
          </Teleport>

          <Teleport to="body">
            <Transition name="admin-dialog-fade">
              <div v-if="shopTheLookToast" class="admin-shop-look-toast" :class="`admin-shop-look-toast--${shopTheLookToast.type}`" role="status">
                <i :class="shopTheLookToast.type === 'success' ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'" aria-hidden="true"></i>
                <span>{{ shopTheLookToast.message }}</span>
              </div>
            </Transition>
          </Teleport>

          <Teleport to="body">
            <Transition name="admin-dialog-fade">
              <div v-if="isDeleteConfirmationOpen" class="admin-confirmation" role="presentation" @click.self="isDeleteConfirmationOpen = false">
                <section ref="heroBannerDeleteDialog" class="admin-confirmation__dialog" role="dialog" aria-modal="true" aria-labelledby="delete-hero-banner-title" tabindex="-1" @keydown="trapAdminDialogFocus($event, heroBannerDeleteDialog)">
                <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
                <h2 id="delete-hero-banner-title">Delete Hero Banner?</h2>
                <p>This permanently removes the banner and its uploaded media. The original placeholder will appear in this position.</p>
                <div>
                  <button type="button" :disabled="isDeletingHeroBanner" @click="isDeleteConfirmationOpen = false">Cancel</button>
                  <button type="button" :disabled="isDeletingHeroBanner" @click="deleteHeroBanner">{{ isDeletingHeroBanner ? 'Deleting...' : 'Delete Banner' }}</button>
                </div>
                </section>
              </div>
            </Transition>
          </Teleport>
        </template>
        <template v-else-if="active === 'Products'">
          <section class="admin-products" aria-labelledby="admin-products-title">
            <p id="admin-products-title" class="admin-products__sync-note">Browse the locally synchronized catalog. Changes in Shopify will appear after the next scheduled sync.</p>

            <div class="admin-products__filters" aria-label="Product filters">
              <label class="admin-products__search">
                <span><i class="pi pi-search" aria-hidden="true"></i> Search catalog</span>
                <input v-model="adminProductFilters.search" type="search" placeholder="Name, EDP number, or article number" @input="scheduleAdminProductSearch" />
              </label>
              <label>
                <span>Main Category</span>
                <select v-model="adminProductFilters.category" @change="applyAdminProductFilters({ categoryChanged: true })">
                  <option value="">All main categories</option>
                  <option v-for="category in adminProductFilterOptions.categories" :key="category" :value="category">{{ category }}</option>
                </select>
              </label>
              <label>
                <span>Subcategory</span>
                <select v-model="adminProductFilters.subcategory" :disabled="!adminProductFilters.category" @change="applyAdminProductFilters()">
                  <option value="">{{ adminProductFilters.category ? 'All subcategories' : 'Choose a main category first' }}</option>
                  <option v-for="subcategory in adminProductFilterOptions.subcategories" :key="subcategory" :value="subcategory">{{ subcategory }}</option>
                </select>
              </label>
              <label>
                <span>Series</span>
                <select v-model="adminProductFilters.series" @change="applyAdminProductFilters()">
                  <option value="">All series</option>
                  <option v-for="series in adminProductFilterOptions.series" :key="series" :value="series">{{ series }}</option>
                </select>
              </label>
              <label>
                <span>Minimum SRP</span>
                <input v-model="adminProductFilters.minPrice" type="number" min="0" step="0.01" placeholder="₱ 0" @change="applyAdminProductFilters()" />
              </label>
              <label>
                <span>Maximum SRP</span>
                <input v-model="adminProductFilters.maxPrice" type="number" min="0" step="0.01" placeholder="No maximum" @change="applyAdminProductFilters()" />
              </label>
              <button class="admin-products__reset" type="button" @click="resetAdminProductFilters"><i class="pi pi-filter-slash" aria-hidden="true"></i> Reset filters</button>
            </div>

            <p v-if="adminProductsError" class="admin-products__error" role="alert">{{ adminProductsError }}</p>
            <DataTable
              :value="adminProducts"
              :loading="isLoadingAdminProducts"
              :lazy="true"
              paginator
              :rows="10"
              :first="(adminProductPagination.page - 1) * 10"
              :totalRecords="adminProductPagination.totalItems"
              :rowsPerPageOptions="[]"
              class="admin-products__table"
              dataKey="id"
              @page="loadAdminProducts({ page: $event.page + 1 })"
            >
              <template #empty><div class="admin-products__empty">No products match the selected filters.</div></template>
              <template #loading><div class="admin-products__empty">Loading catalog products…</div></template>
              <Column header="Product" style="min-width: 300px">
                <template #body="{ data }">
                  <div class="admin-product-cell">
                    <img v-if="data.image" :src="data.image" :alt="data.name" />
                    <span v-else class="admin-product-cell__image-placeholder"><i class="pi pi-image" aria-hidden="true"></i></span>
                    <div><strong>{{ data.name }}</strong><small>EDP: {{ data.edpNumber }}</small><small>Article: {{ data.articleNumber }}</small></div>
                  </div>
                </template>
              </Column>
              <Column header="Category" style="min-width: 190px">
                <template #body="{ data }"><div class="admin-product-category"><strong>{{ data.mainCategory }}</strong><small>{{ data.subcategory }}</small></div></template>
              </Column>
              <Column field="series" header="Series" style="min-width: 150px" />
              <Column header="SRP" style="min-width: 135px"><template #body="{ data }"><span class="admin-product-price">{{ formatAdminProductPrice(data) }}</span></template></Column>
              <Column header="Actions" style="width: 94px"><template #body="{ data }"><button class="admin-product-action" type="button" :aria-label="`View ${data.name}`" title="View product" @click="openAdminProductDetails(data)"><i class="pi pi-eye" aria-hidden="true"></i></button></template></Column>
            </DataTable>
          </section>

          <Teleport to="body">
            <Transition name="admin-dialog-fade">
              <div v-if="isAdminProductDetailsOpen" class="admin-product-dialog-backdrop" role="presentation" @click.self="isAdminProductDetailsOpen = false">
                <section ref="adminProductDialog" class="admin-product-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-product-dialog-title" tabindex="-1" @keydown="trapAdminDialogFocus($event, adminProductDialog)">
                  <header><div><p class="admin-eyebrow">Catalog Product</p><h2 id="admin-product-dialog-title">{{ selectedAdminProduct?.name }}</h2></div><button type="button" aria-label="Close product details" @click="isAdminProductDetailsOpen = false"><i class="pi pi-times" aria-hidden="true"></i></button></header>
                  <div class="admin-product-dialog__body">
                    <img v-if="selectedAdminProduct?.image" :src="selectedAdminProduct.image" :alt="selectedAdminProduct.name" />
                    <div v-else class="admin-product-dialog__image-placeholder"><i class="pi pi-image" aria-hidden="true"></i></div>
                    <dl><div><dt>EDP Number</dt><dd>{{ selectedAdminProduct?.edpNumber }}</dd></div><div><dt>Article Number</dt><dd>{{ selectedAdminProduct?.articleNumber }}</dd></div><div><dt>Category</dt><dd>{{ selectedAdminProduct?.mainCategory }}<small>{{ selectedAdminProduct?.subcategory }}</small></dd></div><div><dt>Series</dt><dd>{{ selectedAdminProduct?.series }}</dd></div><div><dt>SRP</dt><dd>{{ selectedAdminProduct ? formatAdminProductPrice(selectedAdminProduct) : '--' }}</dd></div></dl>
                  </div>
                  <div v-if="selectedAdminProduct?.description" class="admin-product-dialog__description"><h3>Description</h3><p>{{ selectedAdminProduct.description }}</p></div>
                  <section v-if="selectedAdminProduct?.attributes?.length" class="admin-product-dialog__attributes" aria-labelledby="admin-product-attributes-title">
                    <h3 id="admin-product-attributes-title">Attributes</h3>
                    <dl><template v-for="attribute in selectedAdminProduct.attributes" :key="attribute.key"><dt>{{ attribute.name }}</dt><dd>{{ attribute.value }}</dd></template></dl>
                  </section>
                </section>
              </div>
            </Transition>
          </Teleport>
        </template>
        <template v-else-if="['Registered Carts', 'Guest Carts'].includes(active)">
          <section class="admin-carts" aria-labelledby="admin-carts-title">
            <p id="admin-carts-title" class="admin-carts__intro">Active carts with at least one item. Carts without activity for seven days are marked abandoned.</p>
            <div class="admin-carts__filters" aria-label="Cart filters">
              <label class="admin-carts__search"><span><i class="pi pi-search" aria-hidden="true"></i> Search {{ active === 'Registered Carts' ? 'registered carts' : 'guest carts' }}</span><input v-model="adminCartFilters.search" type="search" :placeholder="active === 'Registered Carts' ? 'Email, first name, or last name' : 'Session ID'" @input="scheduleAdminCartSearch" /></label>
              <label><span>Date from</span><input v-model="adminCartFilters.dateFrom" type="date" @change="loadAdminCarts({ page: 1 })" /></label>
              <label><span>Date to</span><input v-model="adminCartFilters.dateTo" type="date" :min="adminCartFilters.dateFrom || undefined" @change="loadAdminCarts({ page: 1 })" /></label>
              <button type="button" @click="resetAdminCartFilters"><i class="pi pi-filter-slash" aria-hidden="true"></i> Reset filters</button>
            </div>
            <p v-if="adminCartsError" class="admin-carts__error" role="alert">{{ adminCartsError }}</p>
            <DataTable
              :value="adminCarts"
              :loading="isLoadingAdminCarts"
              :lazy="true"
              paginator
              :rows="10"
              :first="(adminCartPagination.page - 1) * 10"
              :totalRecords="adminCartPagination.totalItems"
              :rowsPerPageOptions="[]"
              class="admin-carts__table"
              dataKey="id"
              @page="loadAdminCarts({ page: $event.page + 1 })"
            >
              <template #empty><div class="admin-carts__empty">No {{ active === 'Registered Carts' ? 'registered' : 'guest' }} carts match the selected filters.</div></template>
              <template #loading><div class="admin-carts__empty">Loading carts…</div></template>
              <Column header="Date Created" style="min-width: 175px"><template #body="{ data }">{{ formatAdminCartDate(data.createdAt) }}</template></Column>
              <Column header="Date Updated" style="min-width: 175px"><template #body="{ data }">{{ formatAdminCartDate(data.updatedAt) }}</template></Column>
              <template v-if="active === 'Registered Carts'">
                <Column field="email" header="Email" style="min-width: 250px" />
                <Column field="name" header="Name" style="min-width: 190px" />
              </template>
              <Column v-else field="sessionId" header="Session ID" style="min-width: 265px"><template #body="{ data }"><code class="admin-carts__session-id">{{ data.sessionId }}</code></template></Column>
              <Column header="Total Cart Price" style="min-width: 155px"><template #body="{ data }"><strong class="admin-carts__price">{{ formatAdminCartPrice(data) }}</strong></template></Column>
              <Column header="Status" style="min-width: 120px"><template #body="{ data }"><span class="admin-users__role" :class="adminCartStatusClass(data.status)">{{ data.status }}</span></template></Column>
              <Column header="Actions" style="width: 100px"><template #body="{ data }"><button class="admin-product-action" type="button" :aria-label="`View cart ${data.id}`" title="View cart" @click="openAdminCartDetails(data)"><i class="pi pi-eye" aria-hidden="true"></i></button></template></Column>
            </DataTable>
          </section>

          <Teleport to="body">
            <Transition name="admin-dialog-fade">
              <div v-if="isAdminCartDetailsOpen" class="admin-product-dialog-backdrop" role="presentation" @click.self="isAdminCartDetailsOpen = false">
                <section ref="adminCartDialog" class="admin-product-dialog admin-cart-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-cart-dialog-title" tabindex="-1" @keydown="trapAdminDialogFocus($event, adminCartDialog)">
                  <header><div><p class="admin-eyebrow">{{ selectedAdminCart?.email ? 'Registered cart' : 'Session cart' }}</p><h2 id="admin-cart-dialog-title">{{ selectedAdminCart?.email || selectedAdminCart?.sessionId }}</h2></div><button type="button" aria-label="Close cart details" @click="isAdminCartDetailsOpen = false"><i class="pi pi-times" aria-hidden="true"></i></button></header>
                  <dl class="admin-cart-dialog__summary"><div><dt>Created</dt><dd>{{ formatAdminCartDate(selectedAdminCart?.createdAt) }}</dd></div><div><dt>Last Updated</dt><dd>{{ formatAdminCartDate(selectedAdminCart?.updatedAt) }}</dd></div><div v-if="selectedAdminCart?.email"><dt>Customer</dt><dd>{{ selectedAdminCart?.name }}</dd></div><div><dt>Status</dt><dd><span class="admin-users__role" :class="adminCartStatusClass(selectedAdminCart?.status)">{{ selectedAdminCart?.status }}</span></dd></div><div><dt>Cart Total</dt><dd>{{ formatAdminCartPrice(selectedAdminCart) }}</dd></div></dl>
                  <section class="admin-cart-dialog__items" aria-labelledby="admin-cart-items-title"><h3 id="admin-cart-items-title">Cart Items <small>{{ selectedAdminCart?.itemCount || 0 }}</small></h3><article v-for="item in selectedAdminCart?.items || []" :key="item.id"><img v-if="item.image" :src="item.image" :alt="item.name" /><span v-else class="admin-cart-dialog__image-placeholder"><i class="pi pi-image" aria-hidden="true"></i></span><div><strong>{{ item.name }}</strong><small v-if="item.edpNumber && item.edpNumber !== '--'">EDP: {{ item.edpNumber }}</small><small>Quantity: {{ item.quantity }}</small></div><b>{{ formatAdminCartPrice({ totalPrice: item.totalPrice, currencyCode: selectedAdminCart?.currencyCode }) }}</b></article></section>
                </section>
              </div>
            </Transition>
          </Teleport>
        </template>
        <template v-else-if="active === 'Admin'">
          <section class="admin-users" aria-labelledby="admin-users-title">
            <p id="admin-users-title" class="admin-users__intro">Manage staff and superuser accounts with access to the administration workspace.</p>
            <div class="admin-users__filters" aria-label="Admin user filters">
              <label class="admin-users__search"><span><i class="pi pi-search" aria-hidden="true"></i> Search users</span><input v-model="adminUserSearch" type="search" placeholder="First name, last name, or email" @input="scheduleAdminUserSearch" /></label>
              <label><span>Role</span><select v-model="adminUserRole" @change="loadAdminUsers"><option value="">All roles</option><option value="staff">Staff</option><option value="superuser">Superuser</option></select></label>
              <button class="admin-users__reset-filters" type="button" @click="resetAdminUserFilters"><i class="pi pi-filter-slash" aria-hidden="true"></i> Reset filters</button>
              <button class="admin-users__invite" type="button" :disabled="!currentAdminIsSuperuser" :title="currentAdminIsSuperuser ? 'Invite an administrator' : 'Only superusers can invite administrators'" @click="openInviteUser"><i class="pi pi-user-plus" aria-hidden="true"></i> Invite User</button>
            </div>
            <p v-if="adminUserInviteMessage" class="admin-users__success" role="status">{{ adminUserInviteMessage }}</p>
            <p v-if="usersError" class="admin-users__error" role="alert">{{ usersError }}</p>
            <DataTable :value="adminUsers" :loading="isLoadingAdminUsers" paginator :rows="10" class="admin-users__table" dataKey="id">
              <template #empty><div class="admin-users__empty">No admin users match the selected filters.</div></template>
              <template #loading><div class="admin-users__empty">Loading admin users…</div></template>
              <Column header="Email" style="min-width: 290px"><template #body="{ data }">{{ data.email }} <small v-if="data.email.toLocaleLowerCase() === currentAdminEmail" class="admin-users__current-user">(you)</small></template></Column>
              <Column field="name" header="Name" style="min-width: 220px" />
              <Column header="Role" style="min-width: 150px"><template #body="{ data }"><span class="admin-users__role" :class="`is-${data.role.toLocaleLowerCase()}`">{{ data.role }}</span></template></Column>
              <Column header="Active" style="min-width: 110px"><template #body="{ data }"><span class="admin-users__role" :class="data.active ? 'is-active' : 'is-inactive'">{{ data.active ? 'Yes' : 'No' }}</span></template></Column>
            </DataTable>

            <Teleport to="body">
              <Transition name="admin-dialog-fade">
                <div v-if="isInviteUserOpen" class="admin-product-dialog-backdrop" role="presentation" @click.self="closeInviteUser">
                  <section ref="inviteUserDialog" class="admin-invite-user-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-user-title" tabindex="-1" @keydown="trapAdminDialogFocus($event, inviteUserDialog)">
                    <header><div><p class="admin-eyebrow">Administrator access</p><h2 id="invite-user-title">Invite User</h2><p>Create an inactive account and email a secure password-setup link.</p></div><button type="button" aria-label="Close invite user dialog" :disabled="isInvitingUser" @click="closeInviteUser"><i class="pi pi-times" aria-hidden="true"></i></button></header>
                    <form @submit.prevent="inviteAdminUser"><div class="admin-invite-user-dialog__fields"><label><span>First Name</span><input v-model="inviteUserForm.firstName" required maxlength="100" autocomplete="given-name" /></label><label><span>Last Name</span><input v-model="inviteUserForm.lastName" required maxlength="100" autocomplete="family-name" /></label><label class="admin-invite-user-dialog__email"><span>Email</span><input v-model="inviteUserForm.email" type="email" required maxlength="320" autocomplete="email" /></label><label><span>Role</span><select v-model="inviteUserForm.role"><option value="staff">Staff</option><option value="superuser">Superuser</option></select></label></div><p v-if="inviteUserError" class="admin-users__error" role="alert">{{ inviteUserError }}</p><footer><button type="button" :disabled="isInvitingUser" @click="closeInviteUser">Cancel</button><button type="submit" :disabled="isInvitingUser">{{ isInvitingUser ? 'Sending…' : 'Send Invitation' }}</button></footer></form>
                  </section>
                </div>
              </Transition>
            </Teleport>
          </section>
        </template>
        <template v-else-if="active === 'Registered Designers'">
          <section class="admin-users" aria-labelledby="designers-title">
            <p id="designers-title" class="admin-users__intro">Review registered designers and view their submitted account details.</p>
            <div class="admin-users__filters admin-users__filters--designers" aria-label="Designer filters">
              <label><span>Status</span><select v-model="designerStatusFilter"><option value="">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></label>
              <button type="button" @click="resetDesignerStatusFilter"><i class="pi pi-filter-slash" aria-hidden="true"></i> Reset filters</button>
            </div>
            <p v-if="usersError" class="admin-users__error" role="alert">{{ usersError }}</p>
            <DataTable :value="filteredDesigners" :loading="isLoadingDesigners" paginator :rows="10" class="admin-users__table" dataKey="id">
              <template #empty><div class="admin-users__empty">No designers match the selected status.</div></template>
              <template #loading><div class="admin-users__empty">Loading designers…</div></template>
              <Column field="firstName" header="First Name" style="min-width: 180px" />
              <Column field="lastName" header="Last Name" style="min-width: 180px" />
              <Column field="email" header="Email" style="min-width: 270px" />
              <Column field="mobileNumber" header="Mobile Number" style="min-width: 165px" />
              <Column header="Status" style="min-width: 130px"><template #body="{ data }"><span class="admin-users__role" :class="designerStatusClass(data.reviewStatus)">{{ designerStatusLabel(data.reviewStatus) }}</span></template></Column>
              <Column header="Actions" style="width: 120px"><template #body="{ data }"><div class="admin-users__actions"><button type="button" :aria-label="`View ${data.name}`" title="View designer" @click="openDesignerDetails(data)"><i class="pi pi-eye" aria-hidden="true"></i></button><button type="button" :aria-label="`Evaluate ${data.name}`" title="Evaluate designer" @click="openDesignerReview(data)"><i class="pi pi-user-edit" aria-hidden="true"></i></button></div></template></Column>
            </DataTable>
          </section>

          <Teleport to="body">
            <Transition name="admin-dialog-fade">
              <div v-if="isDesignerDetailsOpen" class="admin-product-dialog-backdrop" role="presentation" @click.self="isDesignerDetailsOpen = false">
                <section ref="designerDetailsDialog" class="admin-product-dialog admin-designer-dialog" role="dialog" aria-modal="true" aria-labelledby="designer-details-title" tabindex="-1" @keydown="trapAdminDialogFocus($event, designerDetailsDialog)">
                  <header><div><p class="admin-eyebrow">Designer</p><h2 id="designer-details-title">{{ selectedDesigner?.name }}</h2></div><button type="button" aria-label="Close designer details" @click="isDesignerDetailsOpen = false"><i class="pi pi-times" aria-hidden="true"></i></button></header>
                  <dl class="admin-designer-dialog__details"><div><dt>Email</dt><dd>{{ selectedDesigner?.email }}</dd></div><div><dt>Mobile Number</dt><dd>{{ selectedDesigner?.mobileNumber }}</dd></div><div><dt>Birthdate</dt><dd>{{ formatDesignerDate(selectedDesigner?.birthdate) }}</dd></div><div><dt>Review Status</dt><dd><span class="admin-users__role" :class="`is-${selectedDesigner?.reviewStatus?.toLocaleLowerCase()}`">{{ designerStatusLabel(selectedDesigner?.reviewStatus) }}</span></dd></div><div><dt>Company</dt><dd>{{ selectedDesigner?.company || '--' }}</dd></div><div><dt>Office Address</dt><dd>{{ selectedDesigner?.officeAddress || '--' }}</dd></div><div><dt>Company Website</dt><dd><a v-if="selectedDesigner?.companyWebsite" :href="selectedDesigner.companyWebsite" target="_blank" rel="noreferrer">{{ selectedDesigner.companyWebsite }}</a><template v-else>--</template></dd></div><div><dt>Touchpoint</dt><dd>{{ selectedDesigner?.touchpoint || '--' }}</dd></div><div><dt>How did you hear about us?</dt><dd>{{ selectedDesigner?.howDidYouHearAboutUs || '--' }}</dd></div><div><dt>Reviewed</dt><dd>{{ selectedDesigner?.reviewedAt ? `${formatDesignerDate(selectedDesigner.reviewedAt)} by ${selectedDesigner.reviewedBy?.email || 'Administrator'}` : '--' }}</dd></div></dl>
                </section>
              </div>
            </Transition>
          </Teleport>
          <Teleport to="body">
            <Transition name="admin-dialog-fade">
              <div v-if="isDesignerReviewOpen" class="admin-product-dialog-backdrop" role="presentation" @click.self="!isSavingDesignerReview && (isDesignerReviewOpen = false)">
                <section ref="designerReviewDialog" class="admin-designer-review-dialog" role="dialog" aria-modal="true" aria-labelledby="designer-review-title" tabindex="-1" @keydown="trapAdminDialogFocus($event, designerReviewDialog)">
                  <i class="pi pi-user-edit" aria-hidden="true"></i><h2 id="designer-review-title">Evaluate designer</h2><p>Choose a review status for <strong>{{ selectedDesigner?.name }}</strong>. This does not change their account access.</p><div><button type="button" :disabled="isSavingDesignerReview" @click="isDesignerReviewOpen = false">Close</button><button type="button" class="admin-designer-review-dialog__reject" :disabled="isSavingDesignerReview" @click="reviewDesigner('REJECTED')">Reject</button><button type="button" class="admin-designer-review-dialog__approve" :disabled="isSavingDesignerReview" @click="reviewDesigner('APPROVED')">{{ isSavingDesignerReview ? 'Saving…' : 'Approve' }}</button></div>
                </section>
              </div>
            </Transition>
          </Teleport>
        </template>
        <template v-else-if="active === 'Customers'">
          <section class="admin-users admin-users--empty" aria-labelledby="customers-title"><p id="customers-title">No customers yet.</p></section>
        </template>
        <div v-else class="admin-placeholder">Hello World</div>
      </section>
    </main>
  </div>
</template>
