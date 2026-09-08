<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Checkbox from 'primevue/checkbox'
import { paymentGatewayLogoUrl } from '../data/payment-gateway-logos.js'
const props = defineProps({
  section: { type: String, required: true },
  authorizedRequest: { type: Function, required: true }
})

const gateways = ref([])
const gatewayPagination = ref({ page: 1, limit: 10, totalItems: 0, totalPages: 0 })
const payments = ref([])
const paymentPagination = ref({ page: 1, limit: 10, totalItems: 0, totalPages: 0 })
const loading = ref(false)
const error = ref('')
const notice = ref('')
const pickerOpen = ref(false)
const editorOpen = ref(false)
const editingGateway = ref(null)
const savingGateway = ref(false)
const testingCredential = ref('')
const dialogToast = ref(null)
const editorTab = ref('credentials')
const webhooks = ref([])
const webhookEvents = ref([])
const webhookForm = ref(blankWebhookForm())
const loadingWebhooks = ref(false)
const savingWebhook = ref(false)
const deletingWebhookId = ref('')
const deletingGateway = ref(false)
const selectedPayment = ref(null)
const paymentDetailOpen = ref(false)
const loadingPayment = ref(false)
const form = ref(blankForm())
let dialogToastTimer

const isGateways = computed(() => props.section === 'Payment Gateways')
const editorTitle = computed(() => editingGateway.value ? 'Edit PayMongo' : 'Connect PayMongo')

function blankCredentials() { return { publicKey: '', secretKey: '', sendEmailReceipt: false } }
function blankForm() { return { useTestMode: true, test: blankCredentials(), live: blankCredentials() } }
function blankWebhookForm() { return { mode: 'TEST', eventType: '', url: '' } }
function date(value) { return value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '--' }
function money(value, currency = 'PHP') { return new Intl.NumberFormat('en-PH', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0)) }
function statusClass(status) { return `admin-payments__status--${String(status || 'PENDING').toLowerCase()}` }
function providerLabel(provider) { return String(provider || '').toUpperCase() === 'PAYMONGO' ? 'PayMongo' : String(provider || '') }
function providerLogo(provider) { return paymentGatewayLogoUrl(provider, import.meta.env.VITE_MEDIA_BASE_URL) }

async function loadGateways(page = gatewayPagination.value.page) {
  loading.value = true; error.value = ''
  try {
    const response = await props.authorizedRequest(`/api/v1/payments/gateways?page=${page}&limit=10`)
    gateways.value = response.gateways || []; gatewayPagination.value = response.pagination
  } catch (cause) { error.value = cause.message; gateways.value = [] } finally { loading.value = false }
}

async function loadPayments(page = paymentPagination.value.page) {
  loading.value = true; error.value = ''
  try {
    const response = await props.authorizedRequest(`/api/v1/payments?page=${page}&limit=10`)
    payments.value = response.payments || []; paymentPagination.value = response.pagination
  } catch (cause) { error.value = cause.message; payments.value = [] } finally { loading.value = false }
}

async function loadActive() { if (isGateways.value) await loadGateways(1); else await loadPayments(1) }

function resetEditorWebhooks() {
  editorTab.value = 'credentials'
  webhooks.value = []
  webhookEvents.value = []
  webhookForm.value = blankWebhookForm()
}

function openPicker() { pickerOpen.value = true; notice.value = ''; error.value = '' }
function openPaymongoEditor() { pickerOpen.value = false; editingGateway.value = null; form.value = blankForm(); resetEditorWebhooks(); editorOpen.value = true }
function openEdit(gateway) {
  editingGateway.value = gateway; notice.value = ''; error.value = ''
  form.value = {
    useTestMode: gateway.useTestMode,
    test: { publicKey: gateway.credentials?.test?.publicKey || '', secretKey: '', sendEmailReceipt: Boolean(gateway.credentials?.test?.sendEmailReceipt) },
    live: { publicKey: gateway.credentials?.live?.publicKey || '', secretKey: '', sendEmailReceipt: Boolean(gateway.credentials?.live?.sendEmailReceipt) }
  }
  resetEditorWebhooks()
  editorOpen.value = true
}

function credentialPayload(value) {
  const payload = { publicKey: value.publicKey.trim(), sendEmailReceipt: Boolean(value.sendEmailReceipt) }
  if (value.secretKey.trim()) payload.secretKey = value.secretKey.trim()
  return payload
}

function showDialogToast(type, message) {
  window.clearTimeout(dialogToastTimer)
  dialogToast.value = { type, message }
  dialogToastTimer = window.setTimeout(() => { dialogToast.value = null }, 3000)
}

async function testCredentials(mode) {
  const credentials = mode === 'TEST' ? form.value.test : form.value.live
  const secretKey = credentials.secretKey.trim()
  if (!secretKey && !editingGateway.value?.id) {
    showDialogToast('error', 'Enter a secret key before testing credentials.')
    return
  }
  testingCredential.value = mode
  try {
    const payload = { mode }
    if (secretKey) payload.secretKey = secretKey
    if (editingGateway.value?.id) payload.gatewayId = editingGateway.value.id
    const response = await props.authorizedRequest('/api/v1/payments/gateways/paymongo/test-credentials', { method: 'POST', body: JSON.stringify(payload) })
    showDialogToast('success', response.message || `${mode === 'TEST' ? 'Test' : 'Live'} PayMongo credentials are valid.`)
  } catch (cause) {
    showDialogToast('error', cause.message || 'PayMongo could not verify these credentials.')
  } finally {
    testingCredential.value = ''
  }
}

async function loadWebhooks() {
  if (!editingGateway.value?.id) return
  loadingWebhooks.value = true
  try {
    const response = await props.authorizedRequest(`/api/v1/payments/gateways/${editingGateway.value.id}/webhooks?mode=${webhookForm.value.mode}`)
    webhooks.value = (response.webhooks || []).filter((webhook) => webhook.mode === webhookForm.value.mode)
    webhookEvents.value = response.events || []
    if (!webhookEvents.value.includes(webhookForm.value.eventType)) webhookForm.value.eventType = webhookEvents.value[0] || ''
  } catch (cause) {
    showDialogToast('error', cause.message || 'Webhooks could not be loaded.')
  } finally {
    loadingWebhooks.value = false
  }
}

function selectEditorTab(tab) {
  editorTab.value = tab
  if (tab === 'webhooks') void loadWebhooks()
}

async function registerWebhook() {
  if (!editingGateway.value?.id || !webhookForm.value.eventType) return
  savingWebhook.value = true
  try {
    const payload = { mode: webhookForm.value.mode, eventType: webhookForm.value.eventType }
    if (webhookForm.value.url.trim()) payload.url = webhookForm.value.url.trim()
    await props.authorizedRequest(`/api/v1/payments/gateways/${editingGateway.value.id}/webhooks`, { method: 'POST', body: JSON.stringify(payload) })
    webhookForm.value.url = ''
    await loadWebhooks()
    showDialogToast('success', 'PayMongo webhook registered.')
  } catch (cause) {
    showDialogToast('error', cause.message || 'PayMongo webhook could not be registered.')
  } finally {
    savingWebhook.value = false
  }
}

async function removeWebhook(webhook) {
  if (!editingGateway.value?.id || !window.confirm('Delete this PayMongo webhook?')) return
  deletingWebhookId.value = webhook.id
  try {
    await props.authorizedRequest(`/api/v1/payments/gateways/${editingGateway.value.id}/webhooks/${webhook.id}?mode=${webhookForm.value.mode}`, { method: 'DELETE' })
    webhooks.value = webhooks.value.filter((item) => item.id !== webhook.id)
    showDialogToast('success', 'PayMongo webhook removed.')
  } catch (cause) {
    showDialogToast('error', cause.message || 'PayMongo webhook could not be removed.')
  } finally {
    deletingWebhookId.value = ''
  }
}

async function saveGateway() {
  savingGateway.value = true; error.value = ''; notice.value = ''
  try {
    const payload = { useTestMode: form.value.useTestMode, isEnabled: true, test: credentialPayload(form.value.test), live: credentialPayload(form.value.live) }
    if (!payload.live.publicKey && !payload.live.secretKey) delete payload.live
    if (!payload.test.publicKey && !payload.test.secretKey) delete payload.test
    const response = editingGateway.value
      ? await props.authorizedRequest(`/api/v1/payments/gateways/${editingGateway.value.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await props.authorizedRequest('/api/v1/payments/gateways/paymongo', { method: 'POST', body: JSON.stringify(payload) })
    editingGateway.value = response.gateway
    notice.value = 'PayMongo gateway integrated and active.'
    form.value.test.secretKey = ''; form.value.live.secretKey = ''
    await loadGateways(1)
  } catch (cause) { error.value = cause.message } finally { savingGateway.value = false }
}

async function removeGateway(gateway) {
  if (!window.confirm('Delete this gateway? Registered PayMongo webhooks will be removed and payment history will remain.')) return
  deletingGateway.value = true; error.value = ''; notice.value = ''
  try { await props.authorizedRequest(`/api/v1/payments/gateways/${gateway.id}`, { method: 'DELETE' }); notice.value = 'PayMongo gateway deleted.'; await loadGateways(1) } catch (cause) { error.value = cause.message } finally { deletingGateway.value = false }
}

async function openPayment(payment) {
  loadingPayment.value = true; selectedPayment.value = null; paymentDetailOpen.value = true; error.value = ''
  try { const response = await props.authorizedRequest(`/api/v1/payments/${payment.id}`); selectedPayment.value = response.payment } catch (cause) { error.value = cause.message } finally { loadingPayment.value = false }
}

watch(() => props.section, () => { void loadActive() })
onMounted(() => { void loadActive() })
onBeforeUnmount(() => { window.clearTimeout(dialogToastTimer) })
</script>

<template>
  <section class="admin-payments" :aria-labelledby="isGateways ? 'payment-gateways-title' : 'payments-title'">
    <template v-if="isGateways">
      <header class="admin-payments__heading"><div><p class="admin-eyebrow">Payment infrastructure</p><h2 id="payment-gateways-title">Payment Gateways</h2><p>Connect and manage secure payment providers.</p></div><button type="button" @click="openPicker"><i class="pi pi-plus" aria-hidden="true" /> Connect</button></header>
      <p v-if="notice" class="admin-payments__notice" role="status">{{ notice }}</p><p v-if="error" class="admin-payments__error" role="alert">{{ error }}</p>
      <DataTable :value="gateways" :loading="loading" :lazy="true" paginator :rows="10" :first="(gatewayPagination.page - 1) * 10" :totalRecords="gatewayPagination.totalItems" :rowsPerPageOptions="[]" class="admin-payments__table" dataKey="id" @page="loadGateways($event.page + 1)"><template #empty><div class="admin-payments__empty">No payment gateways are connected.</div></template><template #loading><div class="admin-payments__empty">Loading gateways…</div></template><Column field="provider" header="Gateway" style="min-width: 200px"><template #body="{ data }"><span class="admin-payments__provider"><img :src="providerLogo(data.provider)" :alt="`${providerLabel(data.provider)} logo`" /><strong>{{ providerLabel(data.provider) }}</strong></span></template></Column><Column header="Status" style="min-width: 125px"><template #body="{ data }"><span class="admin-payments__status" :class="data.isEnabled ? 'admin-payments__status--paid' : 'admin-payments__status--failed'">{{ data.isEnabled ? 'Enabled' : 'Disabled' }}</span></template></Column><Column field="activeMode" header="Active Mode" style="min-width: 125px" /><Column header="Email Receipt" style="min-width: 140px"><template #body="{ data }">{{ data.credentials?.[data.activeMode?.toLowerCase()]?.sendEmailReceipt ? 'Enabled' : 'Off' }}</template></Column><Column header="Webhooks" style="min-width: 105px"><template #body="{ data }">{{ data.webhookCount }}</template></Column><Column header="Updated" style="min-width: 180px"><template #body="{ data }">{{ date(data.updatedAt) }}</template></Column><Column header="Actions" style="min-width: 150px"><template #body="{ data }"><div class="admin-payments__actions"><button type="button" @click="openEdit(data)"><i class="pi pi-pencil" aria-hidden="true" /> Edit</button><button type="button" class="is-danger" :disabled="deletingGateway" @click="removeGateway(data)"><i class="pi pi-trash" aria-hidden="true" /> Delete</button></div></template></Column></DataTable>
    </template>
    <template v-else>
      <header class="admin-payments__heading"><div><p class="admin-eyebrow">Transaction record</p><h2 id="payments-title">Payments</h2><p>Payment attempts and verified PayMongo results.</p></div></header><p v-if="error" class="admin-payments__error" role="alert">{{ error }}</p>
      <DataTable :value="payments" :loading="loading" :lazy="true" paginator :rows="10" :first="(paymentPagination.page - 1) * 10" :totalRecords="paymentPagination.totalItems" :rowsPerPageOptions="[]" class="admin-payments__table" dataKey="id" @page="loadPayments($event.page + 1)"><template #empty><div class="admin-payments__empty">No payments have been created.</div></template><template #loading><div class="admin-payments__empty">Loading payments…</div></template><Column field="orderNumber" header="Order" style="min-width: 165px" /><Column header="Customer" style="min-width: 220px"><template #body="{ data }"><strong>{{ data.customerName || '--' }}</strong><small>{{ data.customerEmail || '' }}</small></template></Column><Column header="Gateway" style="min-width: 135px"><template #body="{ data }">{{ data.provider }} · {{ data.mode }}</template></Column><Column header="Amount" style="min-width: 130px"><template #body="{ data }">{{ money(data.amount, data.currencyCode) }}</template></Column><Column header="Method" style="min-width: 120px"><template #body="{ data }">{{ data.paymentMethod || '--' }}</template></Column><Column header="Status" style="min-width: 120px"><template #body="{ data }"><span class="admin-payments__status" :class="statusClass(data.status)">{{ data.status }}</span></template></Column><Column header="Created" style="min-width: 180px"><template #body="{ data }">{{ date(data.createdAt) }}</template></Column><Column header="Actions" style="min-width: 100px"><template #body="{ data }"><button class="admin-product-action" type="button" title="View payment" @click="openPayment(data)"><i class="pi pi-eye" aria-hidden="true" /></button></template></Column></DataTable>
    </template>
  </section>

  <Teleport to="body"><Transition name="admin-dialog-fade"><div v-if="pickerOpen" class="admin-product-dialog-backdrop" @click.self="pickerOpen = false"><section class="admin-payment-picker" role="dialog" aria-modal="true"><header><div><p class="admin-eyebrow">Connect payment gateway</p><h2>Choose a provider</h2></div><button type="button" aria-label="Close" @click="pickerOpen = false"><i class="pi pi-times" /></button></header><div><button type="button" class="admin-payment-picker__provider" @click="openPaymongoEditor"><span class="admin-payment-picker__icon"><img :src="providerLogo('PAYMONGO')" alt="PayMongo logo" /></span><span><strong>PayMongo</strong><small>Hosted Checkout for Philippine payments</small></span><i class="pi pi-arrow-right" /></button><button type="button" class="admin-payment-picker__provider" disabled><span class="admin-payment-picker__icon"><img :src="providerLogo('STRIPE')" alt="Stripe logo" /></span><span><strong>Stripe</strong><small>Coming soon</small></span><span class="admin-payment-picker__coming">Disabled</span></button></div></section></div></Transition></Teleport>

  <Teleport to="body">
    <Transition name="admin-dialog-fade">
      <div v-if="editorOpen" class="admin-product-dialog-backdrop" @click.self="!savingGateway && (editorOpen = false)">
        <section class="admin-payment-editor" role="dialog" aria-modal="true">
          <Transition name="admin-payment-toast">
            <p v-if="dialogToast" class="admin-payment-editor__toast" :class="`is-${dialogToast.type}`" role="status">{{ dialogToast.message }}</p>
          </Transition>
          <header>
            <div>
              <p class="admin-eyebrow">Payment gateway</p>
              <h2>{{ editorTitle }}</h2>
              <p>PayMongo credentials stay encrypted and are never shown again.</p>
            </div>
            <button type="button" aria-label="Close" :disabled="savingGateway" @click="editorOpen = false"><i class="pi pi-times" /></button>
          </header>
          <nav v-if="editingGateway" class="admin-payment-editor__tabs" aria-label="Payment gateway settings">
            <button type="button" :class="{ 'is-active': editorTab === 'credentials' }" @click="selectEditorTab('credentials')">Credentials</button>
            <button type="button" :class="{ 'is-active': editorTab === 'webhooks' }" @click="selectEditorTab('webhooks')">Webhooks</button>
          </nav>
          <form @submit.prevent="editorTab === 'credentials' && saveGateway()">
            <template v-if="editorTab === 'credentials'">
              <p class="admin-payment-editor__base">Base URL <code>https://api.paymongo.com</code></p>
              <div class="admin-payment-editor__credentials">
                <fieldset>
                  <legend>Test mode</legend>
                  <label><span>Public Key</span><input v-model="form.test.publicKey" autocomplete="off" placeholder="pk_test_…" /></label>
                  <label><span>Secret Key</span><input v-model="form.test.secretKey" type="password" autocomplete="new-password" :placeholder="editingGateway?.credentials?.test?.configured ? 'Leave blank to keep existing key' : 'sk_test_…'" /></label>
                  <label class="admin-payment-editor__check" for="paymongo-test-receipt"><Checkbox v-model="form.test.sendEmailReceipt" input-id="paymongo-test-receipt" binary /><span>Send Email Receipt</span></label>
                  <button type="button" class="admin-payment-editor__test-credential" :disabled="Boolean(testingCredential)" @click="testCredentials('TEST')"><i v-if="testingCredential === 'TEST'" class="pi pi-spinner pi-spin" /> {{ testingCredential === 'TEST' ? 'Testing…' : 'Test Credentials' }}</button>
                </fieldset>
                <fieldset>
                  <legend>Live mode</legend>
                  <label><span>Public Key</span><input v-model="form.live.publicKey" autocomplete="off" placeholder="pk_live_…" /></label>
                  <label><span>Secret Key</span><input v-model="form.live.secretKey" type="password" autocomplete="new-password" :placeholder="editingGateway?.credentials?.live?.configured ? 'Leave blank to keep existing key' : 'sk_live_…'" /></label>
                  <label class="admin-payment-editor__check" for="paymongo-live-receipt"><Checkbox v-model="form.live.sendEmailReceipt" input-id="paymongo-live-receipt" binary /><span>Send Email Receipt</span></label>
                  <button type="button" class="admin-payment-editor__test-credential" :disabled="Boolean(testingCredential)" @click="testCredentials('LIVE')"><i v-if="testingCredential === 'LIVE'" class="pi pi-spinner pi-spin" /> {{ testingCredential === 'LIVE' ? 'Testing…' : 'Test Credentials' }}</button>
                </fieldset>
              </div>
              <label class="admin-payment-editor__test-mode" for="paymongo-test-mode"><Checkbox v-model="form.useTestMode" input-id="paymongo-test-mode" binary /><span>Enable Test Mode</span></label>
              <p v-if="error" class="admin-payments__error" role="alert">{{ error }}</p>
              <p v-if="notice" class="admin-payments__notice" role="status">{{ notice }}</p>
              <footer>
                <button type="button" :disabled="savingGateway" @click="editorOpen = false">Cancel</button>
                <button type="submit" :disabled="savingGateway"><i v-if="savingGateway" class="pi pi-spinner pi-spin" /> {{ savingGateway ? 'Integrating…' : 'Integrate' }}</button>
              </footer>
            </template>
            <section v-else class="admin-payment-editor__webhooks" aria-label="PayMongo webhooks">
              <p class="admin-payment-editor__webhooks-intro">Register a PayMongo event for the selected mode. Leave the URL blank to use this site’s secure callback.</p>
              <div class="admin-payment-editor__mode"><label><span>Mode</span><select v-model="webhookForm.mode" @change="loadWebhooks"><option value="TEST">Test mode</option><option value="LIVE">Live mode</option></select></label></div>
              <div v-if="loadingWebhooks" class="admin-payments__empty"><i class="pi pi-spinner pi-spin" /> Loading webhooks…</div>
              <template v-else>
                <div class="admin-payment-editor__webhook-form">
                  <label><span>Event</span><select v-model="webhookForm.eventType"><option v-for="event in webhookEvents" :key="event" :value="event">{{ event }}</option></select></label>
                  <label><span>Webhook URL <small>Optional</small></span><input v-model="webhookForm.url" type="url" placeholder="Use this site’s secure callback" /></label>
                  <button type="button" :disabled="savingWebhook || !webhookForm.eventType" @click="registerWebhook"><i v-if="savingWebhook" class="pi pi-spinner pi-spin" /> {{ savingWebhook ? 'Registering…' : 'Register' }}</button>
                </div>
                <div class="admin-payment-editor__webhook-list">
                  <article v-for="webhook in webhooks" :key="webhook.id"><div><strong>{{ webhook.eventType }}</strong><small><span class="admin-payment-editor__webhook-mode">{{ webhook.mode === 'LIVE' ? 'Live mode' : 'Test mode' }}</span>{{ webhook.url }}</small></div><button type="button" :disabled="Boolean(deletingWebhookId)" @click="removeWebhook(webhook)"><i v-if="deletingWebhookId === webhook.id" class="pi pi-spinner pi-spin" /><i v-else class="pi pi-trash" /> Delete</button></article>
                  <p v-if="!webhooks.length">No {{ webhookForm.mode.toLowerCase() }} webhooks are registered.</p>
                </div>
              </template>
            </section>
          </form>
        </section>
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body"><Transition name="admin-dialog-fade"><div v-if="paymentDetailOpen" class="admin-product-dialog-backdrop" @click.self="paymentDetailOpen = false"><section class="admin-payment-detail" role="dialog" aria-modal="true"><header><div><p class="admin-eyebrow">Payment detail</p><h2>{{ selectedPayment?.orderNumber || 'Loading payment…' }}</h2></div><button type="button" aria-label="Close" @click="paymentDetailOpen = false"><i class="pi pi-times" /></button></header><div v-if="loadingPayment" class="admin-payments__empty"><i class="pi pi-spinner pi-spin" /> Loading payment…</div><template v-else-if="selectedPayment"><dl><div><dt>Status</dt><dd><span class="admin-payments__status" :class="statusClass(selectedPayment.status)">{{ selectedPayment.status }}</span></dd></div><div><dt>Total</dt><dd>{{ money(selectedPayment.amount, selectedPayment.currencyCode) }}</dd></div><div><dt>Checkout Session</dt><dd>{{ selectedPayment.providerCheckoutSessionId || '--' }}</dd></div><div><dt>Payment ID</dt><dd>{{ selectedPayment.providerPaymentId || '--' }}</dd></div><div><dt>Method</dt><dd>{{ selectedPayment.paymentMethod || '--' }}</dd></div><div><dt>Paid At</dt><dd>{{ date(selectedPayment.paidAt) }}</dd></div></dl><section><h3>Payment attempts</h3><article v-for="attempt in selectedPayment.attempts" :key="attempt.id"><span>{{ attempt.paymentMethod || 'PayMongo attempt' }}</span><strong>{{ attempt.status }}</strong><small>{{ attempt.providerPaymentId || attempt.providerPaymentIntentId || '--' }}</small></article><p v-if="!selectedPayment.attempts.length">No provider attempts recorded yet.</p></section><section><h3>Webhook audit</h3><article v-for="log in selectedPayment.webhookLogs" :key="log.id"><span>{{ log.eventType || 'Unknown event' }}</span><strong>{{ log.signatureVerified ? 'Verified' : 'Rejected' }}</strong><small>{{ date(log.createdAt) }}{{ log.processingError ? ` · ${log.processingError}` : '' }}</small></article><p v-if="!selectedPayment.webhookLogs.length">No webhook deliveries are linked yet.</p></section></template><p v-else class="admin-payments__error">{{ error || 'Payment could not be loaded.' }}</p></section></div></Transition></Teleport>
</template>
