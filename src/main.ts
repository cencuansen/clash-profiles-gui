import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css'; // 引入 Element Plus 样式
import App from './App.vue';
import 'element-plus/theme-chalk/dark/css-vars.css';

import * as ElementPlusIconsVue from '@element-plus/icons-vue'


const app = createApp(App);
app.use(ElementPlus); // 注册 Element Plus

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app');