import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router';
import pinia from './stores';

// Naive UI imports
import naive from 'naive-ui';

const app = createApp(App);

app.use(router);
app.use(pinia);
app.use(naive);

app.mount('#app');
