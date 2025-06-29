import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

import Icons from 'unplugin-icons/vite'
import IconsResolver from 'unplugin-icons/resolver'

export default defineConfig({
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'electron/main.ts'
      },
      preload: {
        input: path.join(__dirname, 'electron/preload.ts')
      },
      renderer: process.env.NODE_ENV === 'test' ? undefined : {}
    }),
    // ElementPlus({}),
    AutoImport({
      // 导入 vue 中的函数
      imports: ['vue'],
      // 导入 element plus 中的函数
      resolvers: [ElementPlusResolver(), IconsResolver({ prefix: 'i' })],
      dts: true
    }),
    Components({
      // 导入自己实现的组件 🧐
      dirs: ['src/components'],
      // 导入 element plus 中的组件
      resolvers: [ElementPlusResolver(), IconsResolver({ enabledCollections: ['ep'], prefix: 'i' })],
      dts: true
    }),
    Icons({
      autoInstall: true,
    }),
  ]
})
