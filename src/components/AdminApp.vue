<script setup>
import { computed, ref } from 'vue'
import 'primeicons/primeicons.css'

const active = ref('Hero Banners')
const isAuthenticated = ref(false)
const isForgotPassword = ref(false)
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const resetRequested = ref(false)
const resetOtp = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const formError = ref('')
const formMessage = ref('')
const isSubmitting = ref(false)
const expanded = ref({ Users: false, Inquiries: false })
const orderedGroups = [
  { title: 'Hero Banners', icon: 'pi pi-flag', items: [] },
  { title: 'Products', icon: 'pi pi-list', items: [] },
  { title: 'Appointments', icon: 'pi pi-clock', items: [] },
  { title: 'Inquiries', icon: 'pi pi-send', items: ['General', 'Product Inquiries'] },
  { title: 'Newsletter', icon: 'pi pi-envelope', items: [] },
  { title: 'Users', icon: 'pi pi-users', items: ['Admin', 'Designers', 'Customers'] },
]
const groups = [
  { title: 'Users', icon: '◎', items: ['Admin', 'Designers', 'Customers'] },
  { title: 'Newsletter', icon: '✉', items: [] },
  { title: 'Appointments', icon: '◷', items: [] },
  { title: 'Inquiries', icon: '⌁', items: ['General', 'Product Inquiries'] },
  { title: 'Products', icon: '▤', items: [] },
  { title: 'Hero Banners', icon: '⚑', items: [] },
]

const activeGroup = computed(() => orderedGroups.find((group) => group.title === active.value || group.items.includes(active.value)))
function select(item) {
  if (item === 'Logout') {
    isAuthenticated.value = false
    password.value = ''
    void endSession()
    return
  }
  active.value = item
}
function toggle(group) {
  expanded.value[group.title] = !expanded.value[group.title]
  select(group.title)
}
const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')

async function request(path, payload) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'Something went wrong. Please try again.')
  return body
}

async function submitLogin() {
  formError.value = ''
  isSubmitting.value = true
  try {
    const response = await request('/api/v1/auth/admin/login', { email: email.value, password: password.value })
    sessionStorage.setItem('caracole-admin-access-token', response.accessToken)
    sessionStorage.setItem('caracole-admin-refresh-token', response.refreshToken)
    sessionStorage.setItem('caracole-admin-user', JSON.stringify(response.user))
    isAuthenticated.value = true
  } catch (error) {
    formError.value = error.message
  } finally {
    isSubmitting.value = false
  }
}

async function requestPasswordReset() {
  formError.value = ''
  isSubmitting.value = true
  try {
    const response = await request('/api/v1/auth/forgot-password', { email: email.value })
    formMessage.value = response.message
    resetRequested.value = true
  } catch (error) {
    formError.value = error.message
  } finally {
    isSubmitting.value = false
  }
}

async function submitPasswordReset() {
  formError.value = ''
  if (newPassword.value !== confirmPassword.value) {
    formError.value = 'Passwords do not match.'
    return
  }
  isSubmitting.value = true
  try {
    const response = await request('/api/v1/auth/reset-password', { email: email.value, otp: resetOtp.value, password: newPassword.value })
    formMessage.value = response.message
    newPassword.value = ''
    confirmPassword.value = ''
    resetOtp.value = ''
  } catch (error) {
    formError.value = error.message
  } finally {
    isSubmitting.value = false
  }
}

async function endSession() {
  const refreshToken = sessionStorage.getItem('caracole-admin-refresh-token')
  sessionStorage.removeItem('caracole-admin-access-token')
  sessionStorage.removeItem('caracole-admin-refresh-token')
  sessionStorage.removeItem('caracole-admin-user')
  if (refreshToken) {
    try { await request('/api/v1/auth/logout', { refreshToken }) } catch { /* Local session is already cleared. */ }
  }
}

function showLogin() {
  isForgotPassword.value = false
  resetRequested.value = false
  formError.value = ''
  formMessage.value = ''
}
</script>

<template>
  <section v-if="!isAuthenticated" class="admin-login-page">
    <form v-if="!isForgotPassword" class="admin-login-card" @submit.prevent="submitLogin">
      <a class="admin-login-brand" href="/" aria-label="Caracole home">caracole</a>
      <p class="admin-login-eyebrow">Caracole Philippines</p>
      <h1>Admin sign in</h1>
      <p class="admin-login-copy">Use your administrator account to access the Caracole workspace.</p>

      <label for="admin-email">Email address</label>
      <input id="admin-email" v-model="email" type="email" autocomplete="email" required placeholder="name@company.com">

      <label for="admin-password">Password</label>
      <div class="admin-password-field">
        <input id="admin-password" v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" required placeholder="Enter your password">
        <button type="button" :aria-label="showPassword ? 'Hide password' : 'Show password'" @click="showPassword = !showPassword"><i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"></i></button>
      </div>

      <p v-if="formError" class="admin-form-error" role="alert">{{ formError }}</p>
      <button class="admin-login-submit" type="submit" :disabled="isSubmitting">{{ isSubmitting ? 'Signing in...' : 'Sign in' }} <i class="pi pi-arrow-right" aria-hidden="true"></i></button>
      <button class="admin-forgot-link" type="button" @click="isForgotPassword = true">Forgot password?</button>
    </form>

    <form v-else class="admin-login-card" @submit.prevent="resetRequested ? submitPasswordReset() : requestPasswordReset()">
      <a class="admin-login-brand" href="/" aria-label="Caracole home">caracole</a>
      <p class="admin-login-eyebrow">Account recovery</p>
      <h1>Reset password</h1>
      <p class="admin-login-copy">Enter your administrator email and we’ll send password-reset instructions.</p>

      <label for="admin-reset-email">Email address</label>
      <input id="admin-reset-email" v-model="email" type="email" autocomplete="email" required placeholder="name@company.com">
      <p v-if="resetRequested" class="admin-reset-message">{{ formMessage }}</p>
      <template v-if="resetRequested && !formMessage.includes('successfully')">
        <label for="admin-reset-otp">One-time code</label>
        <input id="admin-reset-otp" v-model="resetOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required placeholder="6-digit code">
        <label for="admin-new-password">New password</label>
        <input id="admin-new-password" v-model="newPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="At least 8 characters">
        <label for="admin-confirm-password">Confirm new password</label>
        <input id="admin-confirm-password" v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="Repeat your new password">
      </template>
      <p v-if="formError" class="admin-form-error" role="alert">{{ formError }}</p>
      <button v-if="!resetRequested" class="admin-login-submit" type="submit" :disabled="isSubmitting">{{ isSubmitting ? 'Sending...' : 'Send reset instructions' }} <i class="pi pi-arrow-right" aria-hidden="true"></i></button>
      <button v-else-if="!formMessage.includes('successfully')" class="admin-login-submit" type="submit" :disabled="isSubmitting">{{ isSubmitting ? 'Resetting...' : 'Reset password' }} <i class="pi pi-arrow-right" aria-hidden="true"></i></button>
      <button class="admin-forgot-link" type="button" @click="showLogin">Back to sign in</button>
    </form>
  </section>

  <div v-else class="admin-shell">
    <aside class="admin-sidebar">
      <a class="admin-brand" href="/admin" aria-label="Caracole admin home">caracole</a>

      <nav class="admin-nav" aria-label="Admin navigation">
        <section v-for="group in orderedGroups" :key="group.title" class="admin-nav__group">
          <button class="admin-nav__item" :class="{ 'is-active': activeGroup?.title === group.title }" type="button" :aria-expanded="group.items.length ? expanded[group.title] : undefined" :aria-controls="group.items.length ? `admin-submenu-${group.title}` : undefined" @click="group.items.length ? toggle(group) : select(group.title)">
             <i :class="group.icon" aria-hidden="true"></i><span>{{ group.title }}</span>
            <span v-if="group.items.length" class="admin-nav__chevron">⌄</span>
          </button>
          <div v-if="group.items.length && expanded[group.title]" :id="`admin-submenu-${group.title}`" class="admin-nav__children" role="group" :aria-label="`${group.title} sections`">
            <button v-for="item in group.items" :key="item" type="button" :class="{ 'is-current': active === item }" @click="select(item)">{{ item }}</button>
          </div>
        </section>
      </nav>

      <div class="admin-account">
        <span class="admin-account__avatar">A</span>
        <span><strong>System Administrator</strong><small>Admin service</small></span>
      </div>
      <button class="admin-logout" type="button" @click="select('Logout')"><span>⇥</span> Logout</button>
    </aside>

    <main class="admin-main">
      <header class="admin-topbar"><p>{{ active }}</p><span>Administrator</span></header>
      <section class="admin-content">
        <p class="admin-eyebrow">Caracole Administration</p>
        <h1>{{ active }}</h1>
        <div class="admin-placeholder">Hello World</div>
      </section>
    </main>
  </div>
</template>
