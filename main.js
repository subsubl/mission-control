import './style.css'
import { GridStack } from 'gridstack'
import mqtt from 'mqtt'

// --- Types & Defaults ---
const DEFAULT_PAGES = [
  {
    id: 'p1',
    name: 'Main Floor',
    widgets: [
      { id: 'w1', x: 0, y: 0, w: 4, h: 4, type: 'sensor', title: 'Power', icon: '⚡', subtitle: 'Main Load', value: '2.4', unit: 'kW' },
      { id: 'w2', x: 4, y: 0, w: 4, h: 4, type: 'sensor', title: 'Climate', icon: '🌡️', subtitle: 'Living Room', value: '22.4', unit: '°C' },
      { id: 'w3', x: 8, y: 0, w: 4, h: 4, type: 'switch', title: 'Lights', icon: '💡', subtitle: 'All Zones', status: 'OFF' }
    ]
  },
  {
    id: 'p2',
    name: 'Studio',
    widgets: [
      { id: 'w4', x: 0, y: 0, w: 6, h: 4, type: 'chart', title: 'Network', icon: '🌐', subtitle: 'Latency' }
    ]
  }
]

// --- State Management ---
class DashboardState {
  constructor() {
    const saved = localStorage.getItem('mc_userdata')
    this.data = saved ? JSON.parse(saved) : {
      pages: DEFAULT_PAGES,
      settings: {
        mqtt_host: 'broker.hivemq.com',
        mqtt_port: 8000,
        mqtt_topic: 'mission-control/status'
      }
    }
    this.currentPageId = this.data.pages[0].id
    this.editMode = false
  }

  save() {
    localStorage.setItem('mc_userdata', JSON.stringify(this.data))
  }

  updateWidget(pageId, widgetId, patch) {
    const page = this.data.pages.find(p => p.id === pageId)
    const widget = page.widgets.find(w => w.id === widgetId)
    Object.assign(widget, patch)
    this.save()
  }

  addPage(name) {
    const newPage = { id: Date.now().toString(), name, widgets: [] }
    this.data.pages.push(newPage)
    this.save()
    return newPage
  }
}

const state = new DashboardState()
let grid = null
let mqttClient = null

// --- MQTT Connection ---
function initMqtt() {
  if (mqttClient) mqttClient.end()
  const { mqtt_host, mqtt_port } = state.data.settings
  try {
    mqttClient = mqtt.connect(`ws://${mqtt_host}:${mqtt_port}/mqtt`)
    mqttClient.on('connect', () => ui.updateMqttStatus(true))
    mqttClient.on('close', () => ui.updateMqttStatus(false))
  } catch (e) {
    console.error('MQTT Connection Error:', e)
  }
}

// --- UI Engine ---
const ui = {
  render() {
    document.querySelector('#app').innerHTML = `
      <div class="grid-glow"></div>
      <div class="flex flex-col h-screen w-screen bg-bg-main overflow-hidden">
        <!-- Header -->
        <header class="h-16 flex items-center justify-between px-6 glass border-b z-50">
          <div class="flex items-center gap-8">
            <div class="text-lg font-black tracking-tighter uppercase tracking-widest text-white">
              Mission<span class="text-accent ml-0.5">Control</span>
            </div>
            <nav id="page-tabs" class="hidden md:flex gap-4 h-full items-center">
              ${this.renderTabs()}
            </nav>
          </div>
          <div class="flex items-center gap-4">
            <button id="toggle-edit" class="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white">
              ${state.editMode ? '✅ Done' : '🛠️ Edit'}
            </button>
            <button id="open-settings" class="p-2 rounded-lg hover:bg-white/5 transition-colors">⚙️</button>
          </div>
        </header>

        <!-- Main Content -->
        <main class="flex-1 overflow-hidden relative">
          <div class="grid-stack overflow-y-auto h-full p-4 custom-scrollbar"></div>
        </main>
      </div>

      <!-- Settings Overlay -->
      <div id="settings-overlay" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] hidden flex items-center justify-center">
        <div class="bg-surface border border-white/10 w-full max-w-md p-8 rounded-3xl shadow-2xl">
          <div class="flex justify-between items-center mb-8">
            <h2 class="text-xl font-bold">Settings</h2>
            <button id="close-settings" class="text-2xl opacity-40 hover:opacity-100">×</button>
          </div>
          <div class="space-y-6">
            <div class="space-y-2 text-xs uppercase tracking-widest text-white/40 font-bold">MQTT Broker</div>
            <input id="set-mqtt-host" class="w-full bg-white/5 border border-white/10 p-3 rounded-xl focus:border-accent outline-none" value="${state.data.settings.mqtt_host}">
            <div class="flex justify-between items-center pt-4">
              <div class="text-sm">Status</div>
              <div id="mqtt-status-dot" class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-orange-500"></span>
                <span class="text-xs text-white/60">Offline</span>
              </div>
            </div>
            <button id="save-settings" class="w-full bg-accent text-black font-bold py-4 rounded-xl mt-8 hover:brightness-110 transition-all">Save Changes</button>
          </div>
        </div>
      </div>
    `
    this.initGrid()
    this.bindEvents()
    initMqtt()
  },

  renderTabs() {
    return state.data.pages.map(page => `
      <button class="px-2 py-1 text-xs uppercase tracking-widest transition-all ${page.id === state.currentPageId ? 'tab-active' : 'text-white/40 hover:text-white'}" data-page="${page.id}">
        ${page.name}
      </button>
    `).join('')
  },

  initGrid() {
    grid = GridStack.init({
      cellHeight: 20,
      margin: 10,
      float: true,
      staticGrid: !state.editMode,
      alwaysShowResizeHandle: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    })

    const currentPage = state.data.pages.find(p => p.id === state.currentPageId)
    this.loadWidgets(currentPage.widgets)

    grid.on('change', (event, items) => {
      items.forEach(item => {
        state.updateWidget(state.currentPageId, item.id, {
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h
        })
      })
    })
  },

  loadWidgets(widgets) {
    grid.removeAll()
    widgets.forEach(w => {
      const el = document.createElement('div')
      el.setAttribute('gs-id', w.id)
      el.innerHTML = `
        <div class="grid-stack-item-content flex flex-col p-6 group relative">
          ${state.editMode ? '<div class="absolute top-2 right-2 text-[10px] opacity-20">:: drag</div>' : ''}
          <div class="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center mb-4 text-accent transition-transform duration-500 group-hover:scale-110">${w.icon || '📦'}</div>
          <div class="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold truncate">${w.subtitle || ''}</div>
          <div class="text-sm font-semibold mb-auto truncate">${w.title}</div>
          ${w.value ? `
            <div class="text-2xl md:text-3xl font-black tracking-tight text-white mt-4 tabular-nums">
              ${w.value}<span class="text-[10px] ml-1 opacity-40">${w.unit || ''}</span>
            </div>
          ` : ''}
          ${w.status ? `
             <div class="mt-4 flex items-center gap-3">
               <div class="w-12 h-6 bg-white/10 rounded-full relative p-1 cursor-pointer transition-colors ${w.status === 'ON' ? 'bg-accent/40' : ''}">
                 <div class="absolute w-4 h-4 bg-white rounded-full transition-all ${w.status === 'ON' ? 'translate-x-6' : 'translate-x-0'}"></div>
               </div>
               <span class="text-[10px] font-bold ${w.status === 'ON' ? 'text-accent' : 'text-white/40'}">${w.status}</span>
             </div>
          ` : ''}
        </div>
      `
      grid.addWidget(el, { x: w.x, y: w.y, w: w.w, h: w.h, id: w.id })
    })
  },

  updateMqttStatus(connected) {
    const dot = document.querySelector('#mqtt-status-dot')
    if (dot) {
      dot.innerHTML = `
        <span class="w-2 h-2 rounded-full ${connected ? 'bg-accent' : 'bg-orange-500'} ${connected ? 'animate-pulse' : ''}"></span>
        <span class="text-xs text-white/60">${connected ? 'Active' : 'Offline'}</span>
      `
    }
  },

  bindEvents() {
    document.querySelectorAll('[data-page]').forEach(btn => {
      btn.onclick = (e) => {
        state.currentPageId = e.target.dataset.page
        this.render()
      }
    })

    document.getElementById('toggle-edit').onclick = () => {
      state.editMode = !state.editMode
      this.render()
    }

    document.getElementById('open-settings').onclick = () => {
      document.getElementById('settings-overlay').classList.remove('hidden')
    }

    document.getElementById('close-settings').onclick = () => {
      document.getElementById('settings-overlay').classList.add('hidden')
    }

    document.getElementById('save-settings').onclick = () => {
      state.data.settings.mqtt_host = document.getElementById('set-mqtt-host').value
      state.save()
      initMqtt()
      document.getElementById('settings-overlay').classList.add('hidden')
    }
    
    // Swipe Logic Mockup (Mobile optimized)
    let touchStartX = 0
    document.querySelector('main').addEventListener('touchstart', (e) => touchStartX = e.touches[0].clientX)
    document.querySelector('main').addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].clientX
      if (Math.abs(diff) > 100) {
        const idx = state.data.pages.findIndex(p => p.id === state.currentPageId)
        if (diff > 0 && idx < state.data.pages.length - 1) {
          state.currentPageId = state.data.pages[idx + 1].id
          this.render()
        } else if (diff < 0 && idx > 0) {
          state.currentPageId = state.data.pages[idx - 1].id
          this.render()
        }
      }
    })
  }
}

ui.render()
