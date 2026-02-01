import './style.css'
import { GridStack } from 'gridstack'
import mqtt from 'mqtt'

// --- Constants & Templates ---
const WIDGET_TYPES = {
  sensor: { icon: '📊', name: 'Sensor Display' },
  switch: { icon: '🔘', name: 'Smart Switch' },
  chart: { icon: '📈', name: 'Trend Graph' },
  light: { icon: '💡', name: 'Lighting Control' }
}

const DEFAULT_DATA = {
  pages: [
    {
      id: 'p-default',
      name: 'Main Console',
      widgets: [
        { id: 'w1', x: 0, y: 0, w: 4, h: 4, type: 'sensor', title: 'Power', icon: '⚡', subtitle: 'Main Load', value: '2.4', unit: 'kW' },
        { id: 'w2', x: 4, y: 0, w: 4, h: 4, type: 'sensor', title: 'Climate', icon: '🌡️', subtitle: 'Living Room', value: '22.4', unit: '°C' },
        { id: 'w3', x: 8, y: 0, w: 4, h: 4, type: 'switch', title: 'Lights', icon: '💡', subtitle: 'All Zones', status: 'OFF' }
      ]
    }
  ],
  settings: {
    mqtt_host: 'broker.hivemq.com',
    mqtt_port: 8000,
    mqtt_topic: 'mission-control/status',
    theme_accent: '#00f2ff'
  }
}

// --- State Engine ---
class DashboardEngine {
  constructor() {
    const saved = localStorage.getItem('mc_v2_data')
    this.state = saved ? JSON.parse(saved) : DEFAULT_DATA
    this.activePageId = this.state.pages[0].id
    this.isEditMode = false
    this.grid = null
    this.mqttClient = null
    
    this.init()
  }

  init() {
    this.renderBase()
    this.initMqtt()
    this.initGrid()
    this.bindGlobalEvents()
  }

  save() {
    localStorage.setItem('mc_v2_data', JSON.stringify(this.state))
  }

  // --- UI Components ---
  renderBase() {
    document.querySelector('#app').innerHTML = `
      <div class="grid-glow"></div>
      <div class="flex flex-col h-screen w-screen bg-bg-main text-white overflow-hidden font-sans">
        <!-- Persistent Navigation Bar -->
        <header class="h-20 flex items-center justify-between px-8 glass border-b z-[60]">
          <div class="flex items-center gap-12">
            <div class="group cursor-pointer">
              <div class="text-xl font-black tracking-[0.1em] uppercase">MISSION<span class="text-accent ml-1 transition-all group-hover:drop-shadow-[0_0_10px_rgba(0,242,255,0.5)]">CONTROL</span></div>
              <div class="text-[8px] text-white/20 tracking-[0.4em] -mt-1 font-bold">STATION_SUB_01</div>
            </div>
            
            <nav id="page-tabs" class="hidden lg:flex gap-2 h-full items-center">
              ${this.renderTabs()}
              <button id="add-page" class="p-2 text-white/20 hover:text-white transition-colors text-lg">+</button>
            </nav>
          </div>

          <div class="flex items-center gap-4">
            <button id="toggle-edit" class="px-4 py-2 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all">
              ${this.isEditMode ? '✅ Done' : '🛠️ Edit Grid'}
            </button>
            <button id="open-settings" class="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-all border border-white/5 text-lg">⚙️</button>
          </div>
        </header>

        <!-- Dynamic Content Area -->
        <main id="dashboard-container" class="flex-1 relative overflow-hidden ${this.isEditMode ? 'edit-mode' : ''}">
          <div class="grid-stack custom-scrollbar overflow-y-auto h-full p-8"></div>
          
          <!-- Edit Toolbar (Visible only in edit mode) -->
          <div id="edit-toolbar" class="fixed bottom-8 left-1/2 -translate-x-1/2 glass px-6 py-4 rounded-3xl border shadow-2xl flex gap-6 items-center z-[70] ${this.isEditMode ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'} transition-all duration-500">
             <button id="add-widget" class="bg-accent text-black font-black text-[10px] px-6 py-2 rounded-full uppercase tracking-tighter hover:scale-105 transition-transform">Add Widget</button>
             <div class="w-px h-6 bg-white/10"></div>
             <div class="text-[9px] text-white/40 uppercase font-bold tracking-widest">Layout Management</div>
          </div>
        </main>
      </div>

      <!-- Settings Panel -->
      <div id="settings-panel" class="fixed inset-y-0 right-0 w-full max-w-sm glass border-l z-[100] translate-x-full transition-transform duration-500 ease-in-out p-12">
        <div class="flex justify-between items-center mb-12">
          <h2 class="text-2xl font-black uppercase tracking-tighter">Settings</h2>
          <button id="close-settings" class="text-3xl opacity-20 hover:opacity-100 transition-opacity">×</button>
        </div>
        
        <div class="space-y-10">
          <div class="space-y-4">
            <label class="text-[10px] uppercase font-black text-white/40 tracking-widest">MQTT Backbone</label>
            <input id="cfg-mqtt-host" class="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-accent transition-colors" value="${this.state.settings.mqtt_host}">
            <div class="flex justify-between items-center px-2">
               <div class="text-xs font-bold text-white/60">Status</div>
               <div id="mqtt-indicator" class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]"></div>
                  <span class="text-[9px] font-black uppercase text-white/30">Offline</span>
               </div>
            </div>
          </div>

          <div class="space-y-4 pt-10 border-t border-white/5 text-center">
            <p class="text-[10px] text-white/20 italic font-medium leading-relaxed">Mission Control v2.0 - Developed for Subsubl. Local storage synchronization active.</p>
            <button id="save-settings" class="w-full py-4 bg-white text-black font-black uppercase text-xs rounded-2xl hover:bg-accent transition-colors">Apply Changes</button>
          </div>
        </div>
      </div>
    `
  }

  renderTabs() {
    return this.state.pages.map(p => `
      <button class="px-6 py-2 text-[10px] uppercase font-black tracking-[0.2em] transition-all border-b-2 ${p.id === this.activePageId ? 'tab-active' : 'text-white/20 border-transparent hover:text-white/60'}" data-pid="${p.id}">
        ${p.name}
      </button>
    `).join('')
  }

  // --- Grid Management ---
  initGrid() {
    this.grid = GridStack.init({
      cellHeight: 20,
      margin: 12,
      float: true,
      staticGrid: !this.isEditMode,
      column: 12,
      disableOneColumnMode: false,
    })

    const activePage = this.state.pages.find(p => p.id === this.activePageId)
    this.loadWidgets(activePage.widgets)

    this.grid.on('change', (e, items) => {
      items.forEach(item => {
        const widget = activePage.widgets.find(w => w.id === item.id)
        if (widget) {
          widget.x = item.x; widget.y = item.y; widget.w = item.w; widget.h = item.h
        }
      })
      this.save()
    })
  }

  loadWidgets(widgets) {
    this.grid.removeAll()
    widgets.forEach(w => this.addWidgetToGrid(w))
  }

  addWidgetToGrid(w) {
    const el = document.createElement('div')
    el.setAttribute('gs-id', w.id)
    el.innerHTML = `
      <div class="grid-stack-item-content group">
        <div class="widget-control">
          <button class="remove-w p-1 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded transition-colors" data-wid="${w.id}">×</button>
        </div>
        <div class="h-full flex flex-col p-8">
           <div class="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-accent text-xl mb-6 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:bg-accent/10 group-hover:text-white">
             ${w.icon || '📦'}
           </div>
           <div class="space-y-1 mb-auto">
             <div class="text-[9px] text-white/30 uppercase font-black tracking-widest">${w.subtitle || ''}</div>
             <div class="text-sm font-bold text-white/90 group-hover:text-white transition-colors uppercase tracking-tight">${w.title}</div>
           </div>
           ${w.value ? `
             <div class="text-4xl font-black tracking-tighter mt-6 tabular-nums text-white">
               ${w.value}<span class="text-xs ml-1 opacity-20">${w.unit || ''}</span>
             </div>
           ` : ''}
           <div class="mt-8 relative h-1 bg-white/5 rounded-full overflow-hidden">
             <div class="absolute inset-y-0 left-0 bg-accent rounded-full status-pulse shadow-[0_0_15px_rgba(0,242,255,0.4)]" style="width: 40%"></div>
           </div>
        </div>
      </div>
    `
    this.grid.addWidget(el, { x: w.x, y: w.y, w: w.w, h: w.h, id: w.id })
    
    el.querySelector('.remove-w').onclick = (e) => {
      const wid = e.target.dataset.wid
      const page = this.state.pages.find(p => p.id === this.activePageId)
      page.widgets = page.widgets.filter(w => w.id !== wid)
      this.grid.removeWidget(el)
      this.save()
    }
  }

  // --- Logic & Events ---
  initMqtt() {
    if (this.mqttClient) this.mqttClient.end()
    try {
      this.mqttClient = mqtt.connect(`ws://${this.state.settings.mqtt_host}:${this.state.settings.mqtt_port}/mqtt`)
      this.mqttClient.on('connect', () => this.updateMqttUI(true))
      this.mqttClient.on('close', () => this.updateMqttUI(false))
    } catch (e) {
      console.warn('MQTT System Error:', e)
    }
  }

  updateMqttUI(connected) {
    const el = document.querySelector('#mqtt-indicator')
    if (!el) return
    el.innerHTML = `
      <div class="w-2 h-2 rounded-full ${connected ? 'bg-accent shadow-[0_0_8px_#00f2ff]' : 'bg-orange-500 shadow-[0_0_8px_#f97316]'} ${connected ? 'status-pulse' : ''}"></div>
      <span class="text-[9px] font-black uppercase ${connected ? 'text-accent' : 'text-white/30'}">${connected ? 'Active' : 'Offline'}</span>
    `
  }

  bindGlobalEvents() {
    document.querySelectorAll('[data-pid]').forEach(btn => {
      btn.onclick = (e) => {
        this.activePageId = e.target.dataset.pid
        this.renderBase()
        this.initGrid()
        this.bindGlobalEvents()
      }
    })

    document.getElementById('toggle-edit').onclick = () => {
      this.isEditMode = !this.isEditMode
      this.renderBase()
      this.initGrid()
      this.bindGlobalEvents()
    }

    document.getElementById('open-settings').onclick = () => {
      document.getElementById('settings-panel').classList.remove('translate-x-full')
    }

    document.getElementById('close-settings').onclick = () => {
      document.getElementById('settings-panel').classList.add('translate-x-full')
    }

    document.getElementById('save-settings').onclick = () => {
      this.state.settings.mqtt_host = document.getElementById('cfg-mqtt-host').value
      this.save()
      this.initMqtt()
      document.getElementById('settings-panel').classList.add('translate-x-full')
    }

    document.getElementById('add-page').onclick = () => {
      const name = prompt('Page Name:')
      if (name) {
        const p = { id: 'p-' + Date.now(), name, widgets: [] }
        this.state.pages.push(p)
        this.activePageId = p.id
        this.save()
        this.renderBase()
        this.initGrid()
        this.bindGlobalEvents()
      }
    }

    document.getElementById('add-widget').onclick = () => {
      const page = this.state.pages.find(p => p.id === this.activePageId)
      const w = { id: 'w-' + Date.now(), x: 0, y: 0, w: 4, h: 4, type: 'sensor', title: 'New Widget', icon: '📦', subtitle: 'Parameter' }
      page.widgets.push(w)
      this.addWidgetToGrid(w)
      this.save()
    }

    // Mobile Swipe Handler
    let tStart = 0
    document.querySelector('main').addEventListener('touchstart', (e) => tStart = e.touches[0].clientX)
    document.querySelector('main').addEventListener('touchend', (e) => {
      if (this.isEditMode) return
      const diff = tStart - e.changedTouches[0].clientX
      if (Math.abs(diff) > 100) {
        const idx = this.state.pages.findIndex(p => p.id === this.activePageId)
        if (diff > 0 && idx < this.state.pages.length - 1) this.switchPage(this.state.pages[idx+1].id)
        if (diff < 0 && idx > 0) this.switchPage(this.state.pages[idx-1].id)
      }
    })
  }

  switchPage(pid) {
    this.activePageId = pid
    this.renderBase()
    this.initGrid()
    this.bindGlobalEvents()
  }
}

// Initialise Application
window.addEventListener('load', () => new DashboardEngine())
