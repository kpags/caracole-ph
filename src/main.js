import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import App from './App.vue'
import './styles.css'

createApp(App)
  .use(PrimeVue, { unstyled: true })
  .mount('#app')
