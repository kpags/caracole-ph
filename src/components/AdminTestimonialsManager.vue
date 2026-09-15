<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import 'primeicons/primeicons.css'

const props = defineProps({ apiBaseUrl: { type: String, required: true } })
const MAX_TESTIMONIALS = 10
const testimonials = ref([])
const status = ref('')
const toast = ref('')
const isLoading = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const isEditorOpen = ref(false)
const isDeleteOpen = ref(false)
const editorDialog = ref(null)
const deleteDialog = ref(null)
const editingId = ref(null)
const deleteTarget = ref(null)
const draggingId = ref(null)
const mediaInput = ref(null)
const mediaFile = ref(null)
const previewUrl = ref('')
const existingMediaUrl = ref('')
const form = ref(emptyForm())
let toastTimer

function emptyForm(position = 0) {
  return { name: '', designation: '', mainTestimony: '', subTestimony: '', position }
}

const slots = computed(() => Array.from({ length: MAX_TESTIMONIALS }, (_, position) => ({
  position, testimonial: testimonials.value.find((item) => item.position === position) || null
})))
const currentPreview = computed(() => previewUrl.value || existingMediaUrl.value)
const currentPreviewType = computed(() => mediaFile.value?.type.startsWith('video/') ? 'video' : testimonials.value.find((item) => item.id === editingId.value)?.mediaType || 'image')

function accessToken() { return sessionStorage.getItem('caracole-admin-access-token') }
function showSuccessToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3000)
}
async function authorizedRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${props.apiBaseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken()}`, ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    body
  })
  const responseBody = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(responseBody.message || 'Unable to complete this request.')
  return responseBody
}

async function loadTestimonials() {
  isLoading.value = true
  status.value = ''
  try {
    const response = await authorizedRequest('/api/v1/testimonials')
    testimonials.value = response.testimonials || []
  } catch (error) {
    status.value = error.message
  } finally {
    isLoading.value = false
  }
}

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  mediaFile.value = null
  if (mediaInput.value) mediaInput.value.value = ''
}

async function validateMedia(file) {
  if (!file) return ''
  if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type)) return 'Use JPG, PNG, WebP, MP4, or WebM media.'
  const objectUrl = URL.createObjectURL(file)
  try {
    const details = await new Promise((resolve, reject) => {
      const element = file.type.startsWith('video/') ? document.createElement('video') : new Image()
      const ready = () => resolve({ width: element.videoWidth || element.naturalWidth, height: element.videoHeight || element.naturalHeight, duration: element.duration })
      element.onloadedmetadata = ready
      element.onload = ready
      element.onerror = () => reject(new Error('This media could not be read.'))
      element.src = objectUrl
    })
    if (file.type.startsWith('video/') && (!Number.isFinite(details.duration) || details.duration > 10)) return 'Videos must be 10 seconds or shorter.'
    return ''
  } catch (error) {
    return error.message
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function setMedia(event) {
  const file = event.target.files?.[0]
  if (!file) return
  status.value = await validateMedia(file)
  if (status.value) { event.target.value = ''; return }
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  mediaFile.value = file
  previewUrl.value = URL.createObjectURL(file)
}

function openCreate(position) {
  editingId.value = null
  form.value = emptyForm(position)
  status.value = ''
  clearPreview()
  existingMediaUrl.value = ''
  isEditorOpen.value = true
}

function openEdit(testimonial) {
  editingId.value = testimonial.id
  form.value = { name: testimonial.name, designation: testimonial.designation, mainTestimony: testimonial.mainTestimony, subTestimony: testimonial.subTestimony, position: testimonial.position }
  status.value = ''
  clearPreview()
  existingMediaUrl.value = testimonial.mediaContent
  isEditorOpen.value = true
}

function closeEditor() {
  isEditorOpen.value = false
  status.value = ''
  clearPreview()
  existingMediaUrl.value = ''
}

async function save() {
  status.value = ''
  if (!editingId.value && !mediaFile.value) { status.value = 'Choose testimonial media.'; return }
  const body = new FormData()
  for (const key of ['name', 'designation', 'mainTestimony', 'subTestimony']) body.append(key, form.value[key])
  if (!editingId.value) body.append('position', String(form.value.position))
  if (mediaFile.value) body.append('media', mediaFile.value)
  isSaving.value = true
  try {
    const isEditing = Boolean(editingId.value)
    await authorizedRequest(isEditing ? `/api/v1/testimonials/${editingId.value}` : '/api/v1/testimonials', { method: isEditing ? 'PATCH' : 'POST', body })
    await loadTestimonials()
    closeEditor()
    showSuccessToast(isEditing ? 'Testimonial updated successfully.' : 'Testimonial created successfully.')
  } catch (error) {
    status.value = error.message
  } finally {
    isSaving.value = false
  }
}

async function askDelete(testimonial) {
  if (!testimonial) return
  isEditorOpen.value = false
  await nextTick()
  deleteTarget.value = testimonial
  isDeleteOpen.value = true
}
function closeDelete() { isDeleteOpen.value = false; deleteTarget.value = null }
async function remove() {
  if (!deleteTarget.value) return
  isDeleting.value = true
  try {
    await authorizedRequest(`/api/v1/testimonials/${deleteTarget.value.id}`, { method: 'DELETE' })
    await loadTestimonials()
    closeDelete()
    showSuccessToast('Testimonial deleted successfully.')
  } catch (error) {
    status.value = error.message
  } finally { isDeleting.value = false }
}

function startDrag(event, id) { draggingId.value = id; event.dataTransfer.effectAllowed = 'move' }
async function dropOn(targetId) {
  const source = draggingId.value
  draggingId.value = null
  if (!source || !targetId || source === targetId) return
  try {
    const response = await authorizedRequest('/api/v1/testimonials/reorder', { method: 'PATCH', body: JSON.stringify({ sourceId: source, targetId }) })
    testimonials.value = response.testimonials || []
  } catch (error) { status.value = error.message; await loadTestimonials() }
}

function trapFocus(event, dialog) {
  if (event.key === 'Escape') { isEditorOpen.value ? closeEditor() : closeDelete(); return }
  if (event.key !== 'Tab' || !dialog) return
  const items = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])')]
  if (!items.length) return
  const first = items[0], last = items.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

watch(() => isEditorOpen.value || isDeleteOpen.value, async (open) => {
  document.body.classList.toggle('modal-scroll-lock', open)
  const appRoot = document.getElementById('app')
  if (appRoot) appRoot.inert = open
  if (!open) return
  await nextTick()
  ;(isEditorOpen.value ? editorDialog.value : deleteDialog.value)?.querySelector('button, input, textarea, select')?.focus()
})

onMounted(() => { void loadTestimonials() })
onBeforeUnmount(() => { clearPreview(); clearTimeout(toastTimer); document.body.classList.remove('modal-scroll-lock') })
</script>

<template>
  <section id="testimonials" class="admin-testimonials" aria-labelledby="testimonials-title">
    <header class="admin-testimonials__heading">
      <div><h2 id="testimonials-title">Testimonials</h2><p>Create up to 10 customer stories for the public testimonial page.</p></div>
      <strong>{{ testimonials.length }} / 10 <span>testimonials used</span></strong>
    </header>
    <p v-if="status && !isEditorOpen" class="admin-testimonials__status" role="alert">{{ status }}</p>
    <p v-if="isLoading" class="admin-testimonials__loading">Loading testimonials…</p>
    <div v-else class="admin-testimonials__slots">
      <article v-for="slot in slots" :key="slot.position" class="admin-testimonial-slot" :class="{ 'is-dragging': slot.testimonial && draggingId === slot.testimonial.id, 'is-empty': !slot.testimonial }" :draggable="Boolean(slot.testimonial)" @dragstart="slot.testimonial && startDrag($event, slot.testimonial.id)" @dragend="draggingId = null" @dragover.prevent @drop.prevent="slot.testimonial && dropOn(slot.testimonial.id)">
        <template v-if="slot.testimonial">
          <i class="pi pi-bars admin-testimonial-slot__handle" aria-label="Drag to reorder"></i>
          <div class="admin-testimonial-slot__media"><video v-if="slot.testimonial.mediaType === 'video'" :src="slot.testimonial.mediaContent" muted playsinline preload="metadata"></video><img v-else :src="slot.testimonial.mediaContent" :alt="slot.testimonial.name" /><i v-if="slot.testimonial.mediaType === 'video'" class="pi pi-play-circle"></i></div>
          <div class="admin-testimonial-slot__copy"><h3>{{ slot.testimonial.name }}</h3><p>{{ slot.testimonial.designation }}</p><small>{{ slot.testimonial.mainTestimony }}</small></div>
          <span>Position {{ slot.position + 1 }}</span><button type="button" @click="openEdit(slot.testimonial)">Edit</button><button class="admin-testimonial-slot__delete" type="button" @click="askDelete(slot.testimonial)">Delete</button>
        </template>
        <template v-else>
          <i class="pi pi-plus-circle admin-testimonial-slot__handle"></i><div class="admin-testimonial-slot__media admin-testimonial-slot__media--empty"><i class="pi pi-image"></i></div><div class="admin-testimonial-slot__copy"><h3>Empty placement</h3><small>Upload a customer story for position {{ slot.position + 1 }}.</small></div><span>Available</span><button type="button" @click="openCreate(slot.position)">Create</button>
        </template>
      </article>
    </div>

    <Teleport to="body"><Transition name="admin-dialog-fade"><div v-if="isEditorOpen" class="admin-testimonial-dialog-backdrop" @click.self="closeEditor"><section ref="editorDialog" class="admin-testimonial-dialog" role="dialog" aria-modal="true" aria-labelledby="testimonial-editor-title" tabindex="-1" @keydown="trapFocus($event, editorDialog)"><header><div><p class="admin-eyebrow">Testimonials / Position {{ form.position + 1 }}</p><h2 id="testimonial-editor-title">{{ editingId ? 'Edit Testimonial' : 'Create Testimonial' }}</h2></div><button type="button" @click="closeEditor">Cancel</button></header><form @submit.prevent="save"><div class="admin-testimonial-dialog__fields"><label><span>Name</span><input v-model="form.name" maxlength="160" required /></label><label><span>Designation</span><input v-model="form.designation" maxlength="120" required /></label><label><span>Main testimony <em>{{ form.mainTestimony.length }} / 150</em></span><textarea v-model="form.mainTestimony" maxlength="150" required></textarea></label><label><span>Brief testimony <em>{{ form.subTestimony.length }} / 100</em></span><textarea v-model="form.subTestimony" maxlength="100" required></textarea></label></div><div class="admin-testimonial-dialog__upload"><span>Image or video</span><input ref="mediaInput" id="testimonial-media" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" @change="setMedia" /><label :class="{ 'has-preview': currentPreview }" for="testimonial-media"><template v-if="currentPreview"><video v-if="currentPreviewType === 'video'" :src="currentPreview" muted playsinline></video><img v-else :src="currentPreview" alt="Selected testimonial media" /><b>Replace media</b></template><template v-else><i class="pi pi-cloud-upload"></i><strong>Upload testimonial media</strong><small>Images of any dimensions are accepted. Videos up to 10 seconds.</small></template></label></div><p v-if="status" class="admin-testimonials__status" role="alert">{{ status }}</p><footer><button v-if="editingId" class="admin-testimonial-dialog__delete" type="button" @click="askDelete(testimonials.find((item) => item.id === editingId))">Delete</button><button type="button" @click="closeEditor">Cancel</button><button type="submit" :disabled="isSaving">{{ isSaving ? 'Saving…' : 'Save Testimonial' }}</button></footer></form></section></div></Transition></Teleport>
    <Teleport to="body"><Transition name="admin-dialog-fade"><div v-if="isDeleteOpen" class="admin-testimonial-dialog-backdrop"><section ref="deleteDialog" class="admin-testimonial-delete" role="dialog" aria-modal="true" aria-labelledby="testimonial-delete-title" tabindex="-1" @keydown="trapFocus($event, deleteDialog)"><i class="pi pi-trash"></i><h2 id="testimonial-delete-title">Delete testimonial?</h2><p>This will remove {{ deleteTarget?.name }} and its Cloudflare media file.</p><div><button type="button" @click="closeDelete">Cancel</button><button type="button" :disabled="isDeleting" @click="remove">{{ isDeleting ? 'Deleting…' : 'Delete' }}</button></div></section></div></Transition></Teleport>
    <Teleport to="body"><Transition name="admin-testimonial-toast"><div v-if="toast" class="admin-testimonial-toast" role="status"><i class="pi pi-check-circle" aria-hidden="true"></i><span>{{ toast }}</span></div></Transition></Teleport>
  </section>
</template>

<style scoped>
.admin-testimonials { margin-top: 54px; padding-top: 38px; border-top: 1px solid #dddeda; scroll-margin-top: 26px; }
.admin-testimonials__heading { display: flex; align-items: end; justify-content: space-between; gap: 28px; margin-bottom: 18px; }
.admin-testimonials__heading h2 { margin: 0; color: #30343a; font-size: 20px; font-weight: 700; }
.admin-testimonials__heading p, .admin-testimonial-slot__copy p { margin: 7px 0 0; color: #7a7d82; font-size: 12px; }
.admin-testimonials__heading strong { color: #3b3e43; font-size: 13px; }.admin-testimonials__heading strong span { color: #7d8084; font-weight: 400; }
.admin-testimonials__loading { display: grid; min-height: 145px; place-items: center; margin: 0; border: 1px solid #e3e4e1; background: #fff; color: #7a7e81; font-size: 13px; }
.admin-testimonials__slots { border: 1px solid #e3e4e1; background: #fff; }.admin-testimonial-slot { display: grid; grid-template-columns: 20px 175px minmax(0, 1fr) auto auto auto; gap: 17px; align-items: center; min-height: 106px; padding: 13px 16px; cursor: grab; }.admin-testimonial-slot + .admin-testimonial-slot { border-top: 1px solid #e3e4e1; }.admin-testimonial-slot.is-empty { background: #fbfbfa; cursor: default; }.admin-testimonial-slot.is-dragging { opacity: .45; }.admin-testimonial-slot__handle { color: #8f9293; font-size: 12px; }.admin-testimonial-slot__media { position: relative; display: grid; height: 76px; place-items: center; overflow: hidden; border-radius: 4px; background: #eeeae2; color: #a98b57; }.admin-testimonial-slot__media--empty { border: 1px dashed #c7b38e; }.admin-testimonial-slot__media :is(img, video) { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }.admin-testimonial-slot__media > .pi { position: relative; z-index: 1; font-size: 24px; text-shadow: 0 1px 4px rgba(0,0,0,.45); }.admin-testimonial-slot__copy h3 { margin: 0; color: #34363a; font-size: 15px; }.admin-testimonial-slot__copy small { display: block; max-width: 490px; margin-top: 6px; overflow: hidden; color: #707378; font-size: 11px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }.admin-testimonial-slot > span { color: #777b7e; font-size: 10px; white-space: nowrap; }.admin-testimonial-slot > button, .admin-testimonial-dialog header > button, .admin-testimonial-dialog footer button { min-height: 36px; padding: 0 17px; border: 1px solid #d4d6d4; border-radius: 5px; background: #fff; color: #4a4d51; cursor: pointer; font-size: 12px; font-weight: 700; }.admin-testimonial-slot > button:hover, .admin-testimonial-dialog header > button:hover, .admin-testimonial-dialog footer button:hover:not(:disabled) { border-color: #bd8a3c; background: #bd8a3c; color: #fff; }.admin-testimonials__status { margin: 0 0 14px; color: #a0433d; font-size: 12px; }
.admin-testimonial-dialog-backdrop { position: fixed; z-index: 400; inset: 0; overflow-y: auto; padding: 24px; background: rgba(23,24,22,.48); }.admin-testimonial-dialog { width: min(1040px, calc(100vw - 48px)); margin: 0 auto; padding: 30px; border: 1px solid #e2e2df; border-radius: 9px; background: #fbfbfa; box-shadow: 0 28px 80px rgba(0,0,0,.26); }.admin-testimonial-dialog > header { display: flex; align-items: start; justify-content: space-between; gap: 30px; padding-bottom: 24px; border-bottom: 1px solid #e3e4e1; }.admin-testimonial-dialog .admin-eyebrow { margin: 0 0 9px; color: #8a6e3e; font-size: 9px; }.admin-testimonial-dialog .admin-eyebrow::before { display: none; }.admin-testimonial-dialog h2 { margin: 0; color: #30343a; font-size: 25px; }.admin-testimonial-dialog form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, .85fr); gap: 24px 30px; padding-top: 25px; }.admin-testimonial-dialog__fields { display: grid; gap: 15px; }.admin-testimonial-dialog__fields label { display: grid; gap: 7px; }.admin-testimonial-dialog__fields span, .admin-testimonial-dialog__upload > span { color: #35383d; font-size: 12px; font-weight: 700; }.admin-testimonial-dialog__fields em { float: right; color: #85898c; font-style: normal; font-weight: 400; }.admin-testimonial-dialog input, .admin-testimonial-dialog textarea { width: 100%; box-sizing: border-box; border: 1px solid #dedfdd; border-radius: 6px; background: #fff; color: #34373b; font: 12px inherit; outline: 0; }.admin-testimonial-dialog input { height: 43px; padding: 0 13px; }.admin-testimonial-dialog textarea { min-height: 84px; padding: 11px 13px; resize: vertical; }.admin-testimonial-dialog :is(input, textarea):focus { border-color: #bd8a3c; box-shadow: 0 0 0 3px rgba(189,138,60,.11); }.admin-testimonial-dialog__upload { display: grid; align-content: start; gap: 9px; }.admin-testimonial-dialog__upload > input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }.admin-testimonial-dialog__upload > label { position: relative; display: grid; min-height: 280px; place-content: center; justify-items: center; gap: 10px; overflow: hidden; border: 1px dashed #c9cbca; border-radius: 6px; background: #fff; color: #6e7276; cursor: pointer; text-align: center; }.admin-testimonial-dialog__upload > label.has-preview { background: #242521; }.admin-testimonial-dialog__upload :is(img, video) { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }.admin-testimonial-dialog__upload b { position: relative; z-index: 1; padding: 9px 13px; border: 1px solid rgba(255,255,255,.75); border-radius: 5px; background: rgba(22,22,20,.6); color: #fff; font-size: 11px; opacity: 0; transition: opacity .2s; }.admin-testimonial-dialog__upload label:hover b, .admin-testimonial-dialog__upload label:focus-visible b { opacity: 1; }.admin-testimonial-dialog__upload .pi { color: #a98b57; font-size: 30px; }.admin-testimonial-dialog__upload strong { color: #464a4e; font-size: 13px; }.admin-testimonial-dialog__upload small { max-width: 260px; color: #7c8084; font-size: 10px; line-height: 1.5; }.admin-testimonial-dialog footer { display: flex; grid-column: 1 / -1; justify-content: end; gap: 10px; padding-top: 2px; }.admin-testimonial-dialog footer button:last-child { border-color: #293a4d; background: #293a4d; color: #fff; }.admin-testimonial-dialog__delete { margin-right: auto; border-color: #b64747 !important; color: #b64747 !important; }.admin-testimonial-dialog__delete:hover { background: #b64747 !important; color: #fff !important; }.admin-testimonial-dialog button:disabled { cursor: wait; opacity: .7; }
.admin-testimonial-delete { width: min(100%, 420px); margin: 16vh auto; padding: 30px; border: 1px solid #e5e2dc; border-radius: 8px; background: #fff; box-shadow: 0 20px 50px rgba(0,0,0,.18); text-align: center; }.admin-testimonial-delete > .pi { display: grid; width: 42px; height: 42px; place-items: center; margin: 0 auto 15px; border-radius: 999px; background: #fbebeb; color: #b64747; font-size: 18px; }.admin-testimonial-delete h2 { margin: 0; color: #34383e; font-size: 21px; }.admin-testimonial-delete p { margin: 10px 0 24px; color: #6e7275; font-size: 12px; line-height: 1.6; }.admin-testimonial-delete > div { display: flex; justify-content: center; gap: 10px; }.admin-testimonial-delete button { min-height: 36px; padding: 0 17px; border: 1px solid #d4d6d4; border-radius: 5px; background: #fff; color: #4a4d51; cursor: pointer; font-size: 12px; font-weight: 700; }.admin-testimonial-delete button:last-child { border-color: #b64747; background: #b64747; color: #fff; }
.admin-testimonial-slot__delete { border-color: #e2c8c4 !important; color: #a34742 !important; }.admin-testimonial-slot__delete:hover { border-color: #b64747 !important; background: #b64747 !important; color: #fff !important; }
.admin-testimonial-toast { position: fixed; z-index: 4300; top: 22px; left: 50%; display: flex; width: min(calc(100vw - 32px), 460px); align-items: center; gap: 10px; padding: 14px 18px; border-radius: 6px; background: #347e50; color: #fff; box-shadow: 0 12px 35px rgba(0,0,0,.23); font-size: 12px; font-weight: 700; transform: translateX(-50%); }.admin-testimonial-toast .pi { font-size: 15px; }.admin-testimonial-toast-enter-active, .admin-testimonial-toast-leave-active { transition: opacity .24s ease, transform .32s ease; }.admin-testimonial-toast-enter-from, .admin-testimonial-toast-leave-to { opacity: 0; transform: translate(-50%, -18px); }
@media (max-width: 720px) { .admin-testimonials__heading { align-items: start; flex-direction: column; gap: 11px; }.admin-testimonial-slot { grid-template-columns: 20px minmax(0, 1fr) auto; gap: 12px; }.admin-testimonial-slot__media { grid-column: 2; height: 150px; }.admin-testimonial-slot__copy { grid-column: 2; }.admin-testimonial-slot > span { display: none; }.admin-testimonial-slot > button { grid-column: 3; }.admin-testimonial-slot > button:nth-of-type(1) { grid-row: 1; }.admin-testimonial-slot > button:nth-of-type(2) { grid-row: 2; }.admin-testimonial-dialog-backdrop { padding: 10px; }.admin-testimonial-dialog { width: 100%; box-sizing: border-box; min-height: 100%; padding: 18px; border-radius: 0; }.admin-testimonial-dialog > header { align-items: start; flex-direction: column; gap: 14px; }.admin-testimonial-dialog > header > button { width: 100%; }.admin-testimonial-dialog form { grid-template-columns: 1fr; }.admin-testimonial-dialog__upload { grid-row: -1; }.admin-testimonial-dialog footer { flex-wrap: wrap; }.admin-testimonial-dialog footer button { flex: 1; }.admin-testimonial-dialog__delete { flex-basis: 100%; margin-right: 0; } }
</style>
