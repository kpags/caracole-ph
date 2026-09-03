<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({ authorizedRequest: { type: Function, required: true } })

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const branches = ref([])
const isLoading = ref(false)
const error = ref('')
const toast = ref(null)
const isEditorOpen = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const branchToDelete = ref(null)
const editingId = ref('')
const form = ref(emptyForm())
let toastTimer = null

const editorTitle = computed(() => editingId.value ? 'Edit Showroom Branch' : 'Add Showroom Branch')

function emptySlot() { return { image: null, imageId: '', file: null, previewUrl: '', cleared: false } }
function emptyForm() {
  return {
    name: '', address: '', contactNumbers: [''],
    schedules: [{ dayStart: 0, dayEnd: 4, timeOpen: '10:00', timeClose: '18:00' }],
    imageSlots: [emptySlot(), emptySlot(), emptySlot()]
  }
}

function revokeSlotPreview(slot) {
  if (slot?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(slot.previewUrl)
}

function resetForm() {
  form.value.imageSlots.forEach(revokeSlotPreview)
  form.value = emptyForm()
  editingId.value = ''
  error.value = ''
}

async function loadBranches() {
  isLoading.value = true
  error.value = ''
  try {
    const response = await props.authorizedRequest('/api/v1/showrooms')
    branches.value = response.branches || []
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    isLoading.value = false
  }
}

function openEditor(branch = null) {
  resetForm()
  if (branch) {
    editingId.value = branch.id
    form.value = {
      name: branch.name,
      address: branch.address,
      contactNumbers: [...(branch.contactNumbers || [])],
      schedules: (branch.schedules || []).map(({ dayStart, dayEnd, timeOpen, timeClose }) => ({ dayStart, dayEnd, timeOpen, timeClose })),
      imageSlots: [0, 1, 2].map((position) => {
        const image = (branch.images || []).find((item) => item.position === position)
        return { image: image?.imageUrl || null, imageId: image?.id || '', file: null, previewUrl: image?.imageUrl || '', cleared: false }
      })
    }
  }
  isEditorOpen.value = true
}

function closeEditor(force = false) {
  if (isSaving.value && !force) return
  isEditorOpen.value = false
  resetForm()
}

function showToast(text, type = 'success') {
  if (toastTimer) window.clearTimeout(toastTimer)
  toast.value = { text, type }
  toastTimer = window.setTimeout(() => {
    toast.value = null
    toastTimer = null
  }, 4200)
}

function setImage(position, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const slot = form.value.imageSlots[position]
  revokeSlotPreview(slot)
  slot.file = file
  slot.previewUrl = URL.createObjectURL(file)
  slot.cleared = false
}

function removeImage(position) {
  const slot = form.value.imageSlots[position]
  revokeSlotPreview(slot)
  slot.file = null
  slot.previewUrl = ''
  slot.cleared = Boolean(slot.image)
}

function addContactNumber() {
  if (form.value.contactNumbers.length < 2) form.value.contactNumbers.push('')
}

function removeContactNumber(index) {
  if (form.value.contactNumbers.length > 1) form.value.contactNumbers.splice(index, 1)
}

function addSchedule() {
  if (form.value.schedules.length < 14) form.value.schedules.push({ dayStart: 0, dayEnd: 4, timeOpen: '10:00', timeClose: '18:00' })
}

function removeSchedule(index) {
  if (form.value.schedules.length > 1) form.value.schedules.splice(index, 1)
}

function validationError() {
  if (!form.value.name.trim() || !form.value.address.trim()) return 'Enter the branch name and address.'
  const contacts = form.value.contactNumbers.map((number) => number.trim()).filter(Boolean)
  if (!contacts.length) return 'Enter at least one contact number.'
  if (contacts.length > 2) return 'A branch may have at most two contact numbers.'
  if (!form.value.schedules.length) return 'Add at least one schedule.'
  for (const schedule of form.value.schedules) {
    if (Number(schedule.dayEnd) < Number(schedule.dayStart)) return 'A schedule cannot end before it begins.'
    if (!schedule.timeOpen || !schedule.timeClose) return 'Complete every schedule time range.'
  }
  const imageCount = form.value.imageSlots.filter((slot) => slot.file || (slot.image && !slot.cleared)).length
  if (!imageCount) return 'Add at least one showroom image.'
  return ''
}

async function saveBranch() {
  const validation = validationError()
  if (validation) { error.value = validation; return }
  isSaving.value = true
  error.value = ''
  try {
    const isUpdate = Boolean(editingId.value)
    const body = new FormData()
    body.append('name', form.value.name.trim())
    body.append('address', form.value.address.trim())
    body.append('contactNumbers', JSON.stringify(form.value.contactNumbers.map((number) => number.trim()).filter(Boolean)))
    body.append('schedules', JSON.stringify(form.value.schedules.map((schedule) => ({
      dayStart: Number(schedule.dayStart), dayEnd: Number(schedule.dayEnd), timeOpen: schedule.timeOpen, timeClose: schedule.timeClose
    }))))
    const clearPositions = []
    form.value.imageSlots.forEach((slot, position) => {
      if (slot.file) body.append(`image${position}`, slot.file)
      else if (slot.cleared) clearPositions.push(position)
    })
    if (editingId.value) body.append('clearImagePositions', JSON.stringify(clearPositions))
    await props.authorizedRequest(editingId.value ? `/api/v1/showrooms/${editingId.value}` : '/api/v1/showrooms', {
      method: editingId.value ? 'PATCH' : 'POST', body
    })
    closeEditor(true)
    showToast(`Showroom branch ${isUpdate ? 'updated' : 'saved'}.`, 'success')
    await loadBranches()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    isSaving.value = false
  }
}

function requestDelete(branch) { branchToDelete.value = branch }
function closeDelete() { if (!isDeleting.value) branchToDelete.value = null }

async function deleteBranch() {
  if (!branchToDelete.value) return
  isDeleting.value = true
  error.value = ''
  try {
    const branchName = branchToDelete.value.name
    await props.authorizedRequest(`/api/v1/showrooms/${branchToDelete.value.id}`, { method: 'DELETE' })
    branchToDelete.value = null
    showToast(`“${branchName}” was deleted.`, 'delete')
    await loadBranches()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    isDeleting.value = false
  }
}

onMounted(loadBranches)
onBeforeUnmount(() => {
  resetForm()
  if (toastTimer) window.clearTimeout(toastTimer)
})
</script>

<template>
  <section id="showroom-display" class="admin-showrooms" aria-labelledby="showroom-display-title">
    <header class="admin-showrooms__heading">
      <div><h2 id="showroom-display-title">Showroom Display</h2><p>Manage the branches and images shown in the Visit Us section.</p></div>
      <button class="admin-content-manager__primary" type="button" @click="openEditor()"><i class="pi pi-plus" aria-hidden="true"></i> Add Branch</button>
    </header>
    <div class="admin-showrooms__note"><i class="pi pi-image" aria-hidden="true"></i><p>Use landscape images at <strong>2640 × 1600 px</strong> (1.65:1) for a consistent showroom display. Add one to three images per branch.</p></div>
    <p v-if="error" class="admin-content-manager__error" role="alert">{{ error }}</p>
    <p v-if="isLoading" class="admin-content-manager__empty">Loading showroom branches…</p>
    <div v-else class="admin-showrooms__list">
      <article v-for="branch in branches" :key="branch.id" class="admin-showroom-card">
        <img v-if="branch.images[0]" :src="branch.images[0].imageUrl" :alt="branch.name" /><span v-else><i class="pi pi-image" aria-hidden="true"></i></span>
        <div><h3>{{ branch.name }}</h3><p>{{ branch.address }}</p><small>{{ branch.images.length }} image{{ branch.images.length === 1 ? '' : 's' }} · {{ branch.schedules.length }} schedule{{ branch.schedules.length === 1 ? '' : 's' }}</small></div>
        <footer><button type="button" @click="openEditor(branch)"><i class="pi pi-pencil" aria-hidden="true"></i> Edit</button><button type="button" @click="requestDelete(branch)"><i class="pi pi-trash" aria-hidden="true"></i> Delete</button></footer>
      </article>
      <p v-if="!branches.length" class="admin-content-manager__empty">No showroom branches have been created.</p>
    </div>

    <Teleport to="body">
      <div v-if="isEditorOpen" class="admin-showroom-dialog-backdrop" role="presentation" @mousedown.self="closeEditor">
        <section class="admin-showroom-dialog" role="dialog" aria-modal="true" :aria-label="editorTitle">
          <header><div><h3>{{ editorTitle }}</h3><p>Images are saved privately through the server to R2.</p></div><button type="button" aria-label="Close showroom editor" @click="closeEditor"><i class="pi pi-times" aria-hidden="true"></i></button></header>
          <form @submit.prevent="saveBranch">
            <section class="admin-showroom-images"><label v-for="(slot, position) in form.imageSlots" :key="position"><span>Image {{ position + 1 }} <em>{{ position === 0 ? 'recommended first slide' : 'optional' }}</em></span><input type="file" accept="image/jpeg,image/png,image/webp" @change="setImage(position, $event)" /><img v-if="slot.previewUrl" :src="slot.previewUrl" :alt="`Showroom image ${position + 1} preview`" /><i v-else class="pi pi-image" aria-hidden="true"></i><button v-if="slot.previewUrl" type="button" @click.prevent="removeImage(position)">Remove</button></label></section>
            <div class="admin-showroom-fields"><label><span>Branch Name</span><input v-model="form.name" maxlength="160" required /></label><label class="admin-showroom-fields__wide"><span>Address</span><textarea v-model="form.address" maxlength="500" required></textarea></label></div>
            <section class="admin-showroom-repeater"><header><div><h4>Schedule</h4><p>Add each day and opening-time range.</p></div><button type="button" :disabled="form.schedules.length >= 14" @click="addSchedule"><i class="pi pi-plus" aria-hidden="true"></i> Add Schedule</button></header><div v-for="(schedule, index) in form.schedules" :key="index" class="admin-showroom-schedule"><label><span>From Day</span><select v-model.number="schedule.dayStart"><option v-for="(day, dayIndex) in WEEKDAYS" :key="day" :value="dayIndex">{{ day }}</option></select></label><label><span>To Day</span><select v-model.number="schedule.dayEnd"><option v-for="(day, dayIndex) in WEEKDAYS" :key="day" :value="dayIndex">{{ day }}</option></select></label><label><span>Open</span><input v-model="schedule.timeOpen" type="time" required /></label><label><span>Close</span><input v-model="schedule.timeClose" type="time" required /></label><button type="button" :disabled="form.schedules.length === 1" aria-label="Remove schedule" @click="removeSchedule(index)"><i class="pi pi-trash" aria-hidden="true"></i></button></div></section>
            <section class="admin-showroom-repeater"><header><div><h4>Contact Numbers</h4><p>One or two numbers displayed below the address.</p></div><button type="button" :disabled="form.contactNumbers.length >= 2" @click="addContactNumber"><i class="pi pi-plus" aria-hidden="true"></i> Add Number</button></header><div v-for="(_number, index) in form.contactNumbers" :key="index" class="admin-showroom-contact"><label><span>Contact Number {{ index + 1 }}</span><input v-model="form.contactNumbers[index]" maxlength="60" required /></label><button type="button" :disabled="form.contactNumbers.length === 1" aria-label="Remove contact number" @click="removeContactNumber(index)"><i class="pi pi-trash" aria-hidden="true"></i></button></div></section>
            <footer><button type="button" @click="closeEditor">Cancel</button><button class="admin-content-manager__primary" type="submit" :disabled="isSaving">{{ isSaving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Branch' }}</button></footer>
          </form>
        </section>
      </div>
      <div v-if="branchToDelete" class="admin-showroom-dialog-backdrop" role="presentation" @mousedown.self="closeDelete"><section class="admin-showroom-delete" role="alertdialog" aria-modal="true"><i class="pi pi-exclamation-triangle" aria-hidden="true"></i><h3>Delete Showroom Branch?</h3><p>This removes <strong>{{ branchToDelete.name }}</strong> and its uploaded showroom images. This cannot be undone.</p><footer><button type="button" :disabled="isDeleting" @click="closeDelete">Cancel</button><button type="button" :disabled="isDeleting" @click="deleteBranch">{{ isDeleting ? 'Deleting…' : 'Delete Branch' }}</button></footer></section></div>
      <Transition name="admin-showroom-toast"><div v-if="toast" class="admin-showroom-toast" :class="`admin-showroom-toast--${toast.type}`" role="status"><i :class="toast.type === 'success' ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'" aria-hidden="true"></i><span>{{ toast.text }}</span></div></Transition>
    </Teleport>
  </section>
</template>
