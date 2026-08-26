<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  section: { type: String, required: true },
  sectionId: { type: String, default: '' },
  authorizedRequest: { type: Function, required: true }
})

const categories = [
  { name: 'Living', image: '/media/shop-the-look/living-room.jpeg' },
  { name: 'Dining', image: '/media/shop-the-look/dining-room.jpeg' },
  { name: 'Bedroom', image: '/media/shop-the-look/bedroom.jpeg' },
  { name: 'Mirrors & Accessories', image: '/media/shop-the-look/mirrors_living_room.jpeg' },
  { name: 'Entertainment', image: '/media/shop-the-look/entertainment_living_room_two.jpeg' }
]

const displays = ref([])
const designers = ref([])
const isLoading = ref(false)
const error = ref('')
const message = ref('')
const savingCategory = ref('')
const categoryInput = ref({})
const categoryPendingRestore = ref('')
const designerFormOpen = ref(false)
const savingDesigner = ref(false)
const deletingDesignerId = ref('')
const designerPendingDelete = ref(null)
const editingDesignerId = ref('')
const thumbnailFile = ref(null)
const headerFile = ref(null)
const thumbnailPreview = ref('')
const headerPreview = ref('')
const designerForm = ref(emptyDesignerForm())

const categoryCards = computed(() => {
  const byName = new Map(displays.value.map((display) => [display.name, display]))
  return categories.map((category) => ({ ...category, display: byName.get(category.name) || null }))
})
const featuredDesignerCount = computed(() => designers.value.filter((designer) => designer.isFeatured && designer.id !== editingDesignerId.value).length)

function emptyDesignerForm() {
  return {
    name: '',
    link: '',
    tagline: '',
    briefStory: '',
    isFeatured: false,
    featuredProducts: []
  }
}

function revokePreview(value) {
  if (value?.startsWith('blob:')) URL.revokeObjectURL(value)
}

function resetDesignerForm() {
  revokePreview(thumbnailPreview.value)
  revokePreview(headerPreview.value)
  designerForm.value.featuredProducts.forEach((product) => revokePreview(product.previewUrl))
  editingDesignerId.value = ''
  thumbnailFile.value = null
  headerFile.value = null
  thumbnailPreview.value = ''
  headerPreview.value = ''
  designerForm.value = emptyDesignerForm()
  error.value = ''
}

async function loadSection() {
  isLoading.value = true
  error.value = ''
  try {
    if (props.section === 'main-categories') {
      const response = await props.authorizedRequest('/api/v1/content/main-categories')
      displays.value = response.displays || []
    } else {
      const response = await props.authorizedRequest('/api/v1/content/designers')
      designers.value = response.designers || []
    }
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    isLoading.value = false
  }
}

function openCategoryPicker(name) {
  categoryInput.value[name]?.click()
}

async function saveCategoryImage(name, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  savingCategory.value = name
  error.value = ''
  message.value = ''
  try {
    const body = new FormData()
    body.append('image', file)
    await props.authorizedRequest(`/api/v1/content/main-categories/${encodeURIComponent(name)}`, { method: 'PUT', body })
    message.value = `${name} display image was saved.`
    await loadSection()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    savingCategory.value = ''
  }
}

function requestCategoryRestore(name) {
  categoryPendingRestore.value = name
}

function closeCategoryRestoreDialog() {
  if (savingCategory.value) return
  categoryPendingRestore.value = ''
}

async function restoreCategoryImage() {
  const name = categoryPendingRestore.value
  if (!name) return
  savingCategory.value = name
  error.value = ''
  message.value = ''
  try {
    await props.authorizedRequest(`/api/v1/content/main-categories/${encodeURIComponent(name)}`, { method: 'DELETE' })
    message.value = `${name} now uses its default image.`
    categoryPendingRestore.value = ''
    await loadSection()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    savingCategory.value = ''
  }
}

function openDesignerForm(designer = null) {
  resetDesignerForm()
  if (designer) {
    editingDesignerId.value = designer.id
    thumbnailPreview.value = designer.thumbnailImageUrl
    headerPreview.value = designer.headerImageUrl
    designerForm.value = {
      name: designer.name,
      link: designer.link || '',
      tagline: designer.tagline,
      briefStory: designer.briefStory,
      isFeatured: designer.isFeatured,
      featuredProducts: (designer.featuredProducts || []).map((product) => ({
        name: product.name,
        shortDescription: product.shortDescription,
        lifestyleImageUrl: product.lifestyleImageUrl,
        previewUrl: product.lifestyleImageUrl,
        file: null
      }))
    }
  }
  designerFormOpen.value = true
}

function closeDesignerForm() {
  designerFormOpen.value = false
  resetDesignerForm()
}

function setImage(kind, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (kind === 'thumbnail') {
    revokePreview(thumbnailPreview.value)
    thumbnailFile.value = file
    thumbnailPreview.value = URL.createObjectURL(file)
  } else {
    revokePreview(headerPreview.value)
    headerFile.value = file
    headerPreview.value = URL.createObjectURL(file)
  }
}

function addFeaturedProduct() {
  if (designerForm.value.featuredProducts.length >= 5) return
  designerForm.value.featuredProducts.push({ name: '', shortDescription: '', lifestyleImageUrl: '', previewUrl: '', file: null })
}

function removeFeaturedProduct(index) {
  const [product] = designerForm.value.featuredProducts.splice(index, 1)
  revokePreview(product?.previewUrl)
}

function setLifestyleImage(index, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const product = designerForm.value.featuredProducts[index]
  revokePreview(product.previewUrl)
  product.file = file
  product.previewUrl = URL.createObjectURL(file)
}

function validateDesignerForm() {
  if (!designerForm.value.name.trim() || !designerForm.value.tagline.trim() || !designerForm.value.briefStory.trim()) return 'Complete the name, tagline, and brief story.'
  if (!editingDesignerId.value && (!thumbnailFile.value || !headerFile.value)) return 'Upload both the thumbnail and header image.'
  if (designerForm.value.isFeatured && featuredDesignerCount.value >= 2) return 'Only two designers can be featured on the home page.'
  for (const [index, product] of designerForm.value.featuredProducts.entries()) {
    if (!product.name.trim() || !product.shortDescription.trim() || (!product.file && !product.lifestyleImageUrl)) return `Complete featured product ${index + 1}, including its lifestyle image.`
  }
  return ''
}

async function saveDesigner() {
  const validationError = validateDesignerForm()
  if (validationError) {
    error.value = validationError
    return
  }
  savingDesigner.value = true
  error.value = ''
  message.value = ''
  try {
    const body = new FormData()
    body.append('name', designerForm.value.name.trim())
    body.append('link', designerForm.value.link.trim())
    body.append('tagline', designerForm.value.tagline.trim())
    body.append('briefStory', designerForm.value.briefStory.trim())
    body.append('isFeatured', String(designerForm.value.isFeatured))
    body.append('featuredProducts', JSON.stringify(designerForm.value.featuredProducts.map((product) => ({
      name: product.name.trim(),
      shortDescription: product.shortDescription.trim(),
      ...(product.lifestyleImageUrl ? { lifestyleImageUrl: product.lifestyleImageUrl } : {})
    }))))
    if (thumbnailFile.value) body.append('thumbnailImage', thumbnailFile.value)
    if (headerFile.value) body.append('headerImage', headerFile.value)
    designerForm.value.featuredProducts.forEach((product, index) => {
      if (product.file) body.append(`lifestyleImage${index}`, product.file)
    })
    await props.authorizedRequest(editingDesignerId.value ? `/api/v1/content/designers/${editingDesignerId.value}` : '/api/v1/content/designers', {
      method: editingDesignerId.value ? 'PATCH' : 'POST', body
    })
    message.value = `Designer profile ${editingDesignerId.value ? 'updated' : 'created'}.`
    closeDesignerForm()
    await loadSection()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    savingDesigner.value = false
  }
}

function requestDesignerDelete(designer) {
  designerPendingDelete.value = designer
}

function closeDesignerDeleteDialog() {
  if (deletingDesignerId.value) return
  designerPendingDelete.value = null
}

async function deleteDesigner() {
  const designer = designerPendingDelete.value
  if (!designer) return
  deletingDesignerId.value = designer.id
  error.value = ''
  try {
    await props.authorizedRequest(`/api/v1/content/designers/${designer.id}`, { method: 'DELETE' })
    message.value = `${designer.name}'s profile was deleted.`
    designerPendingDelete.value = null
    await loadSection()
  } catch (requestError) {
    error.value = requestError.message
  } finally {
    deletingDesignerId.value = ''
  }
}

watch(() => props.section, () => {
  resetDesignerForm()
  void loadSection()
})

onMounted(loadSection)
onBeforeUnmount(resetDesignerForm)
</script>

<template>
  <section v-if="section === 'main-categories'" :id="sectionId" class="admin-content-manager" aria-labelledby="main-category-displays-title">
    <header class="admin-content-manager__heading">
      <div><h2 id="main-category-displays-title">Main Categories Display</h2><p>Upload a custom image for each homepage collection. Without one, the original collection imagery remains visible.</p></div>
    </header>
    <div class="admin-content-manager__note"><i class="pi pi-info-circle" aria-hidden="true"></i><ul><li>Use a high-quality image at least <strong>2400 × 1600 px</strong>.</li><li>The homepage crops each image responsively for desktop and mobile.</li></ul></div>
    <p v-if="error" class="admin-content-manager__error" role="alert">{{ error }}</p><p v-else-if="message" class="admin-content-manager__success" role="status">{{ message }}</p>
    <div v-if="isLoading" class="admin-content-manager__empty">Loading category displays…</div>
    <div v-else class="admin-category-displays">
      <article v-for="category in categoryCards" :key="category.name" class="admin-category-display">
        <img :src="category.display?.imageUrl || category.image" :alt="`${category.name} collection`" />
        <div><p>{{ category.name }}</p><small>{{ category.display ? 'Custom image active' : 'Default image active' }}</small></div>
        <input :ref="(element) => { if (element) categoryInput[category.name] = element }" type="file" accept="image/jpeg,image/png,image/webp" @change="saveCategoryImage(category.name, $event)" />
        <div class="admin-category-display__actions"><button type="button" :disabled="savingCategory === category.name" @click="openCategoryPicker(category.name)"><i class="pi pi-upload" aria-hidden="true"></i>{{ savingCategory === category.name ? 'Saving…' : category.display ? 'Replace' : 'Upload' }}</button><button v-if="category.display" type="button" :disabled="savingCategory === category.name" @click="requestCategoryRestore(category.name)">Use default</button></div>
      </article>
    </div>
    <Teleport to="body">
      <div v-if="categoryPendingRestore" class="admin-category-restore-dialog-backdrop" role="presentation" @mousedown.self="closeCategoryRestoreDialog">
        <section class="admin-category-restore-dialog" role="alertdialog" aria-modal="true" aria-labelledby="restore-category-title" aria-describedby="restore-category-description">
          <i class="pi pi-undo" aria-hidden="true"></i>
          <h3 id="restore-category-title">Use Default Image?</h3>
          <p id="restore-category-description">Restore the default image for <strong>{{ categoryPendingRestore }}</strong>? The current custom image will no longer be shown on the homepage.</p>
          <footer><button type="button" :disabled="Boolean(savingCategory)" @click="closeCategoryRestoreDialog">Cancel</button><button type="button" :disabled="Boolean(savingCategory)" @click="restoreCategoryImage">{{ savingCategory ? 'Restoring…' : 'Use Default' }}</button></footer>
        </section>
      </div>
    </Teleport>
  </section>

  <section v-else :id="sectionId" class="admin-content-manager" aria-labelledby="designer-profiles-title">
    <header class="admin-content-manager__heading"><div><h2 id="designer-profiles-title">Designers</h2><p>Create and curate the designer profiles displayed throughout the storefront.</p></div><button class="admin-content-manager__primary" type="button" @click="openDesignerForm()"><i class="pi pi-plus" aria-hidden="true"></i> Add Designer</button></header>
    <p v-if="error" class="admin-content-manager__error" role="alert">{{ error }}</p><p v-else-if="message" class="admin-content-manager__success" role="status">{{ message }}</p>
    <div v-if="isLoading" class="admin-content-manager__empty">Loading designer profiles…</div>
    <div v-else class="admin-designer-content-list"><article v-for="designer in designers" :key="designer.id"><img :src="designer.thumbnailImageUrl" :alt="designer.name" /><div><p>{{ designer.name }}</p><small>{{ designer.tagline }}</small><span v-if="designer.isFeatured">Featured on homepage</span></div><div><button type="button" @click="openDesignerForm(designer)"><i class="pi pi-pencil" aria-hidden="true"></i> Edit</button><button type="button" :disabled="deletingDesignerId === designer.id" @click="requestDesignerDelete(designer)"><i class="pi pi-trash" aria-hidden="true"></i>{{ deletingDesignerId === designer.id ? 'Deleting…' : 'Delete' }}</button></div></article><p v-if="!designers.length" class="admin-content-manager__empty">No designer profiles have been created.</p></div>

    <Teleport to="body">
      <div v-if="designerFormOpen" class="admin-designer-content-dialog-backdrop" role="presentation" @mousedown.self="closeDesignerForm">
        <section class="admin-designer-content-form" role="dialog" aria-modal="true" :aria-label="editingDesignerId ? 'Edit designer' : 'Add designer'">
          <header><div><h3>{{ editingDesignerId ? 'Edit Designer' : 'Add Designer' }}</h3><p>Profile content is published immediately after saving.</p></div><button type="button" aria-label="Close designer editor" @click="closeDesignerForm"><i class="pi pi-times" aria-hidden="true"></i></button></header>
          <form @submit.prevent="saveDesigner">
            <div class="admin-designer-content-form__media">
              <label><span>Thumbnail Image</span><small>Transparent PNG or WebP, minimum 1200 × 1500 px.</small><input type="file" accept="image/jpeg,image/png,image/webp" @change="setImage('thumbnail', $event)" /><img v-if="thumbnailPreview" :src="thumbnailPreview" alt="Thumbnail preview" /><i v-else class="pi pi-image" aria-hidden="true"></i></label>
              <label><span>Header Image</span><small>Minimum 2400 × 1400 px for the responsive profile header.</small><input type="file" accept="image/jpeg,image/png,image/webp" @change="setImage('header', $event)" /><img v-if="headerPreview" :src="headerPreview" alt="Header preview" /><i v-else class="pi pi-image" aria-hidden="true"></i></label>
            </div>
            <div class="admin-designer-content-form__fields"><label><span>Name</span><input v-model="designerForm.name" required maxlength="160" /></label><label><span>Social Link <em>optional</em></span><input v-model="designerForm.link" type="url" maxlength="2048" placeholder="https://" /></label><label><span>Tagline <em>{{ designerForm.tagline.length }} / 100</em></span><input v-model="designerForm.tagline" required maxlength="100" /></label><label class="admin-designer-content-form__story"><span>Brief Story <em>{{ designerForm.briefStory.length }} / 300</em></span><textarea v-model="designerForm.briefStory" required maxlength="300"></textarea></label></div>
            <section class="admin-designer-content-form__featured-products"><header><div><h4>Featured Products</h4><p>Up to five selected products with a lifestyle image.</p></div><button type="button" :disabled="designerForm.featuredProducts.length >= 5" @click="addFeaturedProduct"><i class="pi pi-plus" aria-hidden="true"></i> Add Product</button></header><div v-if="!designerForm.featuredProducts.length" class="admin-content-manager__empty">No featured products yet.</div><article v-for="(product, index) in designerForm.featuredProducts" :key="`${index}-${product.lifestyleImageUrl}`"><div class="admin-designer-content-form__product-image"><input type="file" accept="image/jpeg,image/png,image/webp" @change="setLifestyleImage(index, $event)" /><img v-if="product.previewUrl" :src="product.previewUrl" :alt="product.name || `Featured product ${index + 1}`" /><i v-else class="pi pi-image" aria-hidden="true"></i><small>Minimum 1600 × 1600 px.</small></div><div><label><span>Name</span><input v-model="product.name" required maxlength="160" /></label><label><span>Short Description <em>{{ product.shortDescription.length }} / 150</em></span><textarea v-model="product.shortDescription" required maxlength="150"></textarea></label></div><button type="button" aria-label="Remove featured product" @click="removeFeaturedProduct(index)"><i class="pi pi-trash" aria-hidden="true"></i></button></article></section>
            <label class="admin-designer-content-form__featured"><input v-model="designerForm.isFeatured" type="checkbox" :disabled="!designerForm.isFeatured && featuredDesignerCount >= 2" /><span><strong>Featured</strong><small>Show this designer on the homepage. Maximum of 2 featured designers.</small></span></label>
            <footer><button type="button" @click="closeDesignerForm">Cancel</button><button class="admin-content-manager__primary" type="submit" :disabled="savingDesigner">{{ savingDesigner ? 'Saving…' : editingDesignerId ? 'Save Changes' : 'Create Designer' }}</button></footer>
          </form>
        </section>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="designerPendingDelete" class="admin-designer-delete-dialog-backdrop" role="presentation" @mousedown.self="closeDesignerDeleteDialog">
        <section class="admin-designer-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-designer-title" aria-describedby="delete-designer-description">
          <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
          <h3 id="delete-designer-title">Delete Designer?</h3>
          <p id="delete-designer-description">This removes <strong>{{ designerPendingDelete.name }}</strong>, their profile content, and associated images. This cannot be undone.</p>
          <footer><button type="button" :disabled="Boolean(deletingDesignerId)" @click="closeDesignerDeleteDialog">Cancel</button><button type="button" :disabled="Boolean(deletingDesignerId)" @click="deleteDesigner">{{ deletingDesignerId ? 'Deleting…' : 'Delete Designer' }}</button></footer>
        </section>
      </div>
    </Teleport>
  </section>
</template>
