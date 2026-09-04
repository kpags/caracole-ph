<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import InputChips from 'primevue/inputchips'

const props = defineProps({
  event: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  authorizedRequest: { type: Function, required: true }
})

const recipients = ref({ to: [], cc: [], bcc: [] })
const isLoading = ref(false)
const isSaving = ref(false)
const isTesting = ref(false)
const error = ref('')
const message = ref('')

const eventLabel = computed(() => props.title.toLocaleLowerCase())

function makeEmptyRecipients() {
  return { to: [], cc: [], bcc: [] }
}

function normalizeField(field) {
  const unique = []
  for (const value of recipients.value[field]) {
    const email = String(value || '').trim().toLocaleLowerCase()
    if (email && !unique.includes(email)) unique.push(email)
  }
  recipients.value[field] = unique
  if (field !== 'to') recipients.value[field] = recipients.value[field].filter((email) => !recipients.value.to.includes(email))
  if (field === 'bcc') recipients.value.bcc = recipients.value.bcc.filter((email) => !recipients.value.cc.includes(email))
}

function normalizeRecipients() {
  normalizeField('to')
  normalizeField('cc')
  normalizeField('bcc')
}

function keepRecipientEnterInField(event) {
  if (event.target instanceof HTMLInputElement && event.target.classList.contains('p-inputchips-input')) event.preventDefault()
}

async function loadRecipients() {
  isLoading.value = true
  error.value = ''
  message.value = ''
  try {
    const response = await props.authorizedRequest(`/api/v1/emailing/recipients/${props.event}`)
    recipients.value = {
      to: response.recipients?.to || [],
      cc: response.recipients?.cc || [],
      bcc: response.recipients?.bcc || []
    }
  } catch (requestError) {
    recipients.value = makeEmptyRecipients()
    error.value = requestError.message
  } finally {
    isLoading.value = false
  }
}

async function saveRecipients() {
  error.value = ''
  message.value = ''
  normalizeRecipients()
  isSaving.value = true
  try {
    const response = await props.authorizedRequest(`/api/v1/emailing/recipients/${props.event}`, {
      method: 'PUT',
      body: JSON.stringify(recipients.value)
    })
    recipients.value = response.recipients
    message.value = `Recipients for ${eventLabel.value} saved.`
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    isSaving.value = false
  }
}

async function sendTestEmail() {
  error.value = ''
  message.value = ''
  normalizeRecipients()
  isTesting.value = true
  try {
    const response = await props.authorizedRequest(`/api/v1/emailing/recipients/${props.event}/test`, {
      method: 'POST',
      body: JSON.stringify(recipients.value)
    })
    message.value = response.message
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    isTesting.value = false
  }
}

watch(() => props.event, () => void loadRecipients())
onMounted(() => void loadRecipients())
</script>

<template>
  <section class="admin-emailing" aria-labelledby="admin-emailing-title">
    <header class="admin-emailing__heading">
      <div>
        <p class="admin-eyebrow">Email delivery</p>
        <h2 id="admin-emailing-title">{{ title }}</h2>
        <p>{{ description }}</p>
      </div>
      <span class="admin-emailing__event"><i class="pi pi-send" aria-hidden="true" /> Administrator notification</span>
    </header>

    <form class="admin-emailing__form" @submit.prevent="saveRecipients" @keydown.enter="keepRecipientEnterInField">
      <p class="admin-emailing__guide">Press Enter or a comma after each email address. Paste a comma-separated list to add multiple recipients.</p>
      <label>
        <span>To</span>
        <InputChips v-model="recipients.to" input-id="emailing-to" separator="," :allow-duplicate="false" :disabled="isLoading || isSaving || isTesting" :input-props="{ inputmode: 'email' }" placeholder="Enter email address" @add="normalizeField('to')" @remove="normalizeField('to')" />
        <small>Primary recipients for this notification.</small>
      </label>
      <label>
        <span>CC</span>
        <InputChips v-model="recipients.cc" input-id="emailing-cc" separator="," :allow-duplicate="false" :disabled="isLoading || isSaving || isTesting" :input-props="{ inputmode: 'email' }" placeholder="Enter email address" @add="normalizeField('cc')" @remove="normalizeField('cc')" />
        <small>Visible copy recipients.</small>
      </label>
      <label>
        <span>BCC</span>
        <InputChips v-model="recipients.bcc" input-id="emailing-bcc" separator="," :allow-duplicate="false" :disabled="isLoading || isSaving || isTesting" :input-props="{ inputmode: 'email' }" placeholder="Enter email address" @add="normalizeField('bcc')" @remove="normalizeField('bcc')" />
        <small>Private copy recipients.</small>
      </label>
      <p v-if="error" class="admin-users__error" role="alert">{{ error }}</p>
      <p v-if="message" class="admin-users__success" role="status">{{ message }}</p>
      <footer>
        <button class="admin-emailing__test" type="button" :disabled="isLoading || isSaving || isTesting" @click="sendTestEmail"><i v-if="isTesting" class="pi pi-spinner pi-spin" aria-hidden="true" /><i v-else class="pi pi-send" aria-hidden="true" />{{ isTesting ? 'Sending test…' : 'Send Test Email' }}</button>
        <button class="admin-content-manager__primary" type="submit" :disabled="isLoading || isSaving || isTesting"><i v-if="isSaving" class="pi pi-spinner pi-spin" aria-hidden="true" /><i v-else class="pi pi-save" aria-hidden="true" />{{ isSaving ? 'Saving…' : 'Save recipients' }}</button>
      </footer>
    </form>
  </section>
</template>
