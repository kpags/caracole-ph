<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import "primeicons/primeicons.css";

const active = ref("Hero Banners");
const isAuthenticated = ref(hasStoredAdminSession());
const isForgotPassword = ref(false);
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const resetRequested = ref(false);
const resetOtp = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const formError = ref("");
const formMessage = ref("");
const isSubmitting = ref(false);
const expanded = ref({ Contents: true, Users: false, Inquiries: false });
const orderedGroups = [
  { title: "Contents", icon: "pi pi-flag", items: ["Hero Banners"] },
  { title: "Products", icon: "pi pi-list", items: [] },
  { title: "Appointments", icon: "pi pi-clock", items: [] },
  {
    title: "Inquiries",
    icon: "pi pi-send",
    items: ["General", "Product"],
  },
  { title: "Newsletter", icon: "pi pi-envelope", items: [] },
  {
    title: "Users",
    icon: "pi pi-users",
    items: ["Admin", "Designers", "Customers"],
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
      group.title === active.value || group.items.includes(active.value),
  ),
);

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
  if (item === "Logout") {
    isAuthenticated.value = false;
    password.value = "";
    void endSession();
    return;
  }
  active.value = item;
}

function showAdminLanding() {
  active.value = "Hero Banners";
  expanded.value.Contents = true;
}

function toggle(group) {
  expanded.value[group.title] = !expanded.value[group.title];
}

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
    const error = new Error(responseBody.message || "Unable to update hero banners.");
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
  if (isAuthenticated.value) {
    await refreshAdminSession();
    if (isAuthenticated.value) await loadHeroBanners();
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
    await loadHeroBanners();
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
  <section v-if="!isAuthenticated" class="admin-login-page">
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
    <aside class="admin-sidebar">
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
            @click="group.items.length ? toggle(group) : select(group.title)"
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
              :key="item"
              type="button"
              :class="{ 'is-current': active === item }"
              @click="select(item)"
            >
              {{ item }}
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
      <header class="admin-topbar">
        <p>{{ active }}</p>
        <span>Administrator</span>
      </header>
      <section class="admin-content" :class="{ 'admin-content--hero-banners': active === 'Hero Banners' }">
        <p class="admin-eyebrow">Caracole Administration</p>
        <h1>{{ active }}</h1>
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
                <h2 id="existing-hero-banners-title">Existing Hero Banners</h2>
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

          <Transition name="admin-dialog-fade">
            <div v-if="isDeleteConfirmationOpen" class="admin-confirmation" role="presentation" @click.self="isDeleteConfirmationOpen = false">
              <section class="admin-confirmation__dialog" role="dialog" aria-modal="true" aria-labelledby="delete-hero-banner-title">
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
        </template>
        <div v-else class="admin-placeholder">Hello World</div>
      </section>
    </main>
  </div>
</template>
