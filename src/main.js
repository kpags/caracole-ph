import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import App from './App.vue'
import AdminApp from './components/AdminApp.vue'
import './styles.css'

createApp(window.location.pathname.startsWith('/admin') ? AdminApp : App)
  .use(PrimeVue, { unstyled: true })
  .mount('#app')
