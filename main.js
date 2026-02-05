import './style.css'
import { GridStack } from 'gridstack'
import mqtt from 'mqtt'

// --- Constants & Config ---
const DEFAULT_DATA = {
  pages: [
    {
      id: 'p-default',
      name: 'Main Console',
      columns: 12,
      widgets: [
        { id: 'w1', x: 0, y: 0, w: 4, h: 5, type: 'sensor', title: 'Power', icon: 'zap', subtitle: 'Main Load', value: '2.4', unit: 'kW' },
        { id: 'w2', x: 4, y: 0, w: 4, h: 5, type: 'sensor', title: 'Climate', icon: 'thermometer', subtitle: 'Living Room', value: '22.4', unit: '°C' },
        { id: 'w3', x: 8, y: 0, w: 4, h: 5, type: 'switch', title: 'Lights', icon: 'lightbulb', subtitle: 'All Zones', status: 'OFF' }
      ]
    }
  ],
  settings: {
    mqtt_host: window.location.hostname || 'localhost',
    mqtt_port: 1883,
    mqtt_topic: 'ha/state/#',
    ha_url: 'http://homeassistant.local:8123',
    ha_token: ''
  }
}

const GRID_OPTIONS = [2, 4, 6, 8, 12]

// --- Dashboard Logic ---
class Dashboard {
  constructor() {
    const saved = localStorage.getItem('mc_v2_data')
    this.state = saved ? JSON.parse(saved) : DEFAULT_DATA
    this.activePageId = this.state.pages[0].id
    this.editingPageId = this.activePageId
    this.isEditMode = false
    this.grid = null
    this.mqttClient = null
    this.haEntities = []
    this.showEntityBrowser = false
    this.discoveryMode = false
    
    this.init()
  }

  init() {
    this.render()
    this.initMqtt()
    this.setupGrid()
    this.bindEvents()
    this.setupVisuals()
  }

  save() {
    localStorage.setItem('mc_v2_data', JSON.stringify(this.state))
  }

  // --- Rendering ---
  render() {
    const currentPage = this.state.pages.find(p => p.id === this.activePageId)
    const editingPage = this.state.pages.find(p => p.id === this.editingPageId)

    document.querySelector('#app').innerHTML = `
      <div class="grid-glow"></div>
      <div class="flex flex-col h-screen w-screen overflow-hidden">
        <!-- Dashboard Header -->
        <header class="h-20 flex items-center justify-between px-10 glass border-b z-[60]">
          <div class="flex items-center gap-16">
            <div class="group cursor-default">
              <div class="text-xl font-black tracking-[0.2em] uppercase text-white">MISSION<span class="text-accent ml-1 transition-all group-hover:drop-shadow-[0_0_12px_rgba(0,242,255,0.6)]">CONTROL</span></div>
              <div class="text-[7px] text-white/20 tracking-[0.6em] -mt-1 font-black uppercase">Core Station</div>
            </div>
            
            <nav id="page-tabs" class="hidden xl:flex gap-4 h-full items-center">
              ${this.state.pages.map(p => `
                <button class="px-4 py-2 text-[10px] uppercase font-black tracking-[0.2em] transition-all border-b-2 ${p.id === this.activePageId ? 'tab-active text-accent' : 'text-white/20 border-transparent hover:text-white/60'}" data-pid="${p.id}">
                  ${p.name}
                </button>
              `).join('')}
              <button id="add-page" class="w-8 h-8 rounded-full flex items-center justify-center text-white/10 hover:text-white/40 hover:bg-white/5 transition-all text-xl">+</button>
            </nav>
          </div>

          <div class="flex items-center gap-6">
            <button id="toggle-edit" class="px-5 py-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest transition-all text-white">
              ${this.isEditMode ? '✅ Save Layout' : '🛠️ Customize'}
            </button>
            <button id="open-settings" class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 text-white"><i data-lucide="settings" class="w-4 h-4"></i></button>
          </div>
        </header>

        <!-- Main Workspace -->
        <main id="workspace" class="flex-1 relative overflow-hidden ${this.isEditMode ? 'edit-mode' : ''}">
          <div class="grid-stack custom-scrollbar overflow-y-auto h-full p-10"></div>
          
          <!-- Command Bar (Edit Mode) -->
          <div id="command-bar" class="fixed bottom-10 left-1/2 -translate-x-1/2 glass px-8 py-5 rounded-[2.5rem] border shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] flex gap-8 items-center z-[70] ${this.isEditMode ? 'translate-y-0 opacity-100' : 'translate-y-32 opacity-0'} transition-all duration-700">
             <button id="add-widget" class="btn-primary">Add Widget</button>
             <button id="browse-entities" class="px-5 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest transition-all text-white">Browse HA</button>
             <div class="w-px h-8 bg-white/10"></div>
             <div class="flex flex-col">
                <span class="text-[8px] text-white/20 uppercase font-black tracking-widest mb-0.5">Active Layout</span>
                <span class="text-[10px] font-bold text-white/60">${currentPage.columns || 12} Columns</span>
             </div>
          </div>
        </main>
      </div>

      <!-- Entity Browser Overlay -->
      <div id="entity-browser" class="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] ${this.showEntityBrowser ? 'flex' : 'hidden'} items-center justify-center p-8 text-white">
        <div class="bg-surface border border-white/10 w-full max-w-4xl h-[80vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden">
          <div class="p-10 border-b border-white/5 flex justify-between items-center">
            <div>
              <h2 class="text-2xl font-black uppercase tracking-tighter">Entity Explorer</h2>
              <p class="text-[9px] text-white/30 uppercase tracking-[0.3em] mt-1">Discovered Home Assistant Nodes</p>
            </div>
            <button id="close-browser" class="text-4xl font-thin opacity-20 hover:opacity-100">×</button>
          </div>
          <div class="flex-1 overflow-y-auto p-10 custom-scrollbar">
            <div id="entity-list" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${this.renderEntityList()}
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Side Panel -->
      <div id="settings-panel" class="fixed inset-y-0 right-0 w-full max-w-md glass border-l z-[100] translate-x-full transition-all duration-700 ease-in-out p-16 shadow-[-50px_0_100px_rgba(0,0,0,0.5)] overflow-y-auto custom-scrollbar text-white">
        <div class="flex justify-between items-start mb-16">
          <div>
            <h2 class="text-3xl font-black uppercase tracking-tighter">Settings</h2>
            <div class="text-[9px] font-bold text-accent uppercase tracking-[0.3em] mt-1">Connectivity & Layout</div>
          </div>
          <button id="close-settings" class="text-4xl font-thin opacity-20 hover:opacity-100 transition-opacity leading-none">×</button>
        </div>
        
        <div class="space-y-12">
          <!-- Page & Layout Section -->
          <div class="space-y-6">
            <label class="text-[10px] uppercase font-black text-white/30 tracking-widest">Layout Config</label>
            <div class="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/5">
              <div class="text-[10px] text-white/40 uppercase font-bold">Target Page</div>
              <select id="set-layout-page" class="w-full bg-black/40 border border-white/10 p-4 rounded-2xl outline-none focus:border-accent text-sm appearance-none">
                ${this.state.pages.map(p => `<option value="${p.id}" ${p.id === this.editingPageId ? 'selected' : ''}>${p.name}</option>`).join('')}
              </select>

              <div class="text-[10px] text-white/40 uppercase font-bold pt-4">Column Density</div>
              <div class="grid grid-cols-5 gap-2">
                ${GRID_OPTIONS.map(cols => `
                  <button class="grid-select-btn flex flex-col items-center gap-2 p-3 rounded-xl border ${editingPage.columns === cols ? 'border-accent bg-accent/10' : 'border-white/5 hover:bg-white/5'}" data-cols="${cols}">
                    <div class="w-full aspect-square grid ${this.getPreviewGridClass(cols)} gap-0.5 opacity-40">
                      ${Array(cols).fill().map(() => `<div class="bg-white/40 rounded-[1px]"></div>`).join('')}
                    </div>
                    <span class="text-[9px] font-black">${cols}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- MQTT Config -->
          <div class="space-y-5">
            <label class="flex items-center justify-between text-[10px] uppercase font-black text-white/30 tracking-widest">
              <span class="flex items-center gap-3"><i data-lucide="radio" class="w-3 h-3 text-accent"></i> MQTT Broker</span>
              <button id="toggle-discovery" class="text-accent hover:underline">${this.discoveryMode ? 'Stop Discovery' : 'Start Discovery'}</button>
            </label>
            <input id="cfg-mqtt-host" class="input-field" placeholder="Broker URL" value="${this.state.settings.mqtt_host}">
            <input id="cfg-mqtt-port" class="input-field" placeholder="Port" value="${this.state.settings.mqtt_port}">
          </div>

          <!-- HA Config -->
          <div class="space-y-5">
            <label class="flex items-center gap-3 text-[10px] uppercase font-black text-white/30 tracking-widest">
              <i data-lucide="home" class="w-3 h-3 text-accent"></i> Home Assistant
            </label>
            <input id="cfg-ha-url" class="input-field" placeholder="HA Instance URL" value="${this.state.settings.ha_url}">
            <input id="cfg-ha-token" class="input-field" type="password" placeholder="Long-Lived Access Token" value="${this.state.settings.ha_token}">
          </div>

          <div class="pt-10 border-t border-white/5 space-y-4">
            <button id="save-settings" class="w-full py-5 bg-white text-black font-black uppercase text-xs rounded-2xl hover:bg-accent transition-all shadow-[0_20px_40px_rgba(0,0,0,0.3)]">Apply Global Config</button>
          </div>
        </div>
      </div>
    `
    lucide.createIcons()
  }

  getPreviewGridClass(cols) {
    if (cols === 2) return 'grid-cols-2';
    if (cols === 4) return 'grid-cols-4';
    if (cols === 6) return 'grid-cols-6';
    if (cols === 8) return 'grid-cols-8';
    return 'grid-cols-4'; // 12 fits better in 4 for preview
  }

  renderEntityList() {
    if (this.haEntities.length === 0) return `<div class="text-white/20 text-[10px] uppercase font-bold p-8 border border-white/5 rounded-2xl text-center col-span-full">No entities discovered. Check HA settings.</div>`
    
    return this.haEntities.map(e => `
      <div class="bg-white/5 border border-white/10 p-5 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors group cursor-pointer add-ha-widget" data-eid="${e.entity_id}">
        <div class="flex items-center gap-5">
          <div class="w-10 h-10 bg-black/20 rounded-xl flex items-center justify-center text-accent">
            <i data-lucide="${this.getIconForDomain(e.entity_id)}" class="w-4 h-4"></i>
          </div>
          <div class="flex flex-col">
            <span class="text-white/80 font-bold text-sm">${e.attributes.friendly_name || e.entity_id}</span>
            <span class="text-[8px] text-white/20 font-black tracking-widest uppercase">${e.entity_id}</span>
          </div>
        </div>
        <div class="text-accent opacity-0 group-hover:opacity-100 transition-opacity text-xs font-black">+ ADD</div>
      </div>
    `).join('')
  }

  getIconForDomain(eid) {
    const domain = eid.split('.')[0]
    switch(domain) {
      case 'light': return 'lightbulb';
      case 'switch': return 'toggle-right';
      case 'sensor': return 'activity';
      case 'climate': return 'thermometer';
      case 'binary_sensor': return 'shield';
      default: return 'box';
    }
  }

  // --- Grid Engine ---
  setupGrid() {
    const currentPage = this.state.pages.find(p => p.id === this.activePageId)
    const cols = currentPage.columns || 12

    this.grid = GridStack.init({
      cellHeight: 20,
      margin: 15,
      float: true,
      staticGrid: !this.isEditMode,
      column: cols,
      animate: true,
      disableOneColumnMode: false,
    })

    this.loadWidgets(currentPage.widgets)

    this.grid.on('change', (e, items) => {
      items.forEach(item => {
        const w = currentPage.widgets.find(widget => widget.id === item.id)
        if (w) { w.x = item.x; w.y = item.y; w.w = item.w; w.h = item.h }
      })
      this.save()
    })
  }

  loadWidgets(widgets) {
    this.grid.removeAll()
    widgets.forEach(w => this.addWidgetToUI(w))
  }

  addWidgetToUI(w) {
    const el = document.createElement('div')
    el.setAttribute('gs-id', w.id)
    el.innerHTML = `
      <div class="grid-stack-item-content group ${w.ha_entity && w.value === 'on' ? 'status-on' : ''}">
        <div class="widget-control">
          <button class="remove-w w-6 h-6 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-all" data-wid="${w.id}">×</button>
        </div>
        <div class="h-full flex flex-col p-8 select-none">
           <div class="w-12 h-12 bg-white/[0.03] rounded-2xl flex items-center justify-center text-accent mb-8 shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:bg-accent/10 group-hover:text-white">
             <i data-lucide="${w.icon || 'box'}" class="w-5 h-5"></i>
           </div>
           <div class="space-y-1 mb-auto">
             <div class="text-[9px] text-white/20 uppercase font-black tracking-[0.2em]">${w.subtitle || ''}</div>
             <div class="text-sm font-black text-white/80 group-hover:text-white transition-colors uppercase tracking-tighter">${w.title}</div>
           </div>
           ${w.value !== undefined ? `
             <div class="text-4xl font-black tracking-tighter mt-10 tabular-nums text-white flex items-baseline">
               <span class="value-text">${w.value}</span><span class="text-xs ml-2 opacity-10 font-bold uppercase">${w.unit || ''}</span>
             </div>
           ` : ''}
           ${w.type === 'switch' || w.type === 'light' ? `
             <div class="text-xs font-black mt-10 uppercase tracking-widest text-accent status-text">${w.status || (w.value || 'OFF').toUpperCase()}</div>
           ` : ''}
           <div class="mt-10 relative h-1 bg-white/5 rounded-full overflow-hidden">
             <div class="absolute inset-y-0 left-0 bg-accent rounded-full status-pulse shadow-[0_0_15px_#00f2ff]" style="width: 40%"></div>
           </div>
        </div>
      </div>
    `
    this.grid.addWidget(el, { x: w.x, y: w.y, w: w.w, h: w.h, id: w.id })
    lucide.createIcons()

    el.querySelector('.remove-w').onclick = (e) => {
      const wid = e.target.dataset.wid
      const page = this.state.pages.find(p => p.id === this.activePageId)
      page.widgets = page.widgets.filter(w => w.id !== wid)
      this.grid.removeWidget(el)
      this.save()
    }
  }

  // --- Interaction & Visuals ---
  setupVisuals() {
    document.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      document.documentElement.style.setProperty('--mouse-x', `${x}%`)
      document.documentElement.style.setProperty('--mouse-y', `${y}%`)
    })
  }

  bindEvents() {
    // --- Spixi Integration ---
    if (window.spixi) {
      window.spixi.onMessage = (data) => {
        console.log('[SPIXI] Raw Data:', data)
        try {
          const payload = JSON.parse(data)
          if (payload.type === 'UPDATE') {
            this.handleMqttMessage(payload.topic, JSON.stringify(payload.data))
          }
        } catch (e) {
          console.warn('[SPIXI] Non-JSON message received:', data)
        }
      }
    }

    document.querySelectorAll('[data-pid]').forEach(btn => {
      btn.onclick = (e) => this.switchPage(e.target.dataset.pid)
    })

    document.getElementById('toggle-edit').onclick = () => {
      this.isEditMode = !this.isEditMode
      this.render(); this.setupGrid(); this.bindEvents()
    }

    document.getElementById('open-settings').onclick = () => {
      document.getElementById('settings-panel').classList.remove('translate-x-full')
    }
    document.getElementById('close-settings').onclick = () => {
      document.getElementById('settings-panel').classList.add('translate-x-full')
    }

    document.getElementById('set-layout-page').onchange = (e) => {
      this.editingPageId = e.target.value
      this.render(); this.setupGrid(); this.bindEvents();
      document.getElementById('settings-panel').classList.remove('translate-x-full')
    }

    document.querySelectorAll('.grid-select-btn').forEach(btn => {
      btn.onclick = (e) => {
        const cols = parseInt(btn.dataset.cols)
        const page = this.state.pages.find(p => p.id === this.editingPageId)
        page.columns = cols
        this.save()
        this.render(); this.setupGrid(); this.bindEvents();
        document.getElementById('settings-panel').classList.remove('translate-x-full')
      }
    })

    document.getElementById('save-settings').onclick = () => {
      this.state.settings.mqtt_host = document.getElementById('cfg-mqtt-host').value
      this.state.settings.mqtt_port = document.getElementById('cfg-mqtt-port').value
      this.state.settings.ha_url = document.getElementById('cfg-ha-url').value
      this.state.settings.ha_token = document.getElementById('cfg-ha-token').value
      this.save()
      this.initMqtt()
      this.fetchHaEntities()
      document.getElementById('settings-panel').classList.add('translate-x-full')
    }

    document.getElementById('browse-entities').onclick = () => {
      this.showEntityBrowser = true
      this.render(); this.setupGrid(); this.bindEvents()
    }

    document.getElementById('close-browser').onclick = () => {
      this.showEntityBrowser = false
      this.render(); this.setupGrid(); this.bindEvents()
    }

    document.querySelectorAll('.add-ha-widget').forEach(btn => {
      btn.onclick = () => {
        const eid = btn.dataset.eid
        const entity = this.haEntities.find(e => e.entity_id === eid)
        
        // --- Spixi Communication ---
        if (window.spixi) {
          window.spixi.sendMessage(`TRACK_ENTITY:${eid}`)
        }

        const page = this.state.pages.find(p => p.id === this.activePageId)
        const w = {
          id: 'ha-' + Date.now(),
          ha_entity: eid,
          x: 0, y: 0, w: 4, h: 5,
          type: eid.split('.')[0],
          title: entity.attributes.friendly_name || eid,
          icon: this.getIconForDomain(eid),
          subtitle: 'HA_NODE',
          value: entity.state,
          unit: entity.attributes.unit_of_measurement || ''
        }
        page.widgets.push(w)
        this.addWidgetToUI(w)
        this.save()
        this.showEntityBrowser = false
        this.render(); this.setupGrid(); this.bindEvents()
      }
    })

    document.getElementById('add-page').onclick = () => {
      const name = prompt('NEW STATION NAME:')
      if (name) {
        const id = 'p-' + Date.now()
        this.state.pages.push({ id, name, widgets: [], columns: 12 })
        this.switchPage(id)
      }
    }

    document.getElementById('add-widget').onclick = () => {
      const page = this.state.pages.find(p => p.id === this.activePageId)
      const w = { id: 'w-' + Date.now(), x: 0, y: 0, w: 4, h: 5, type: 'sensor', title: 'DATAPOINT', icon: 'activity', subtitle: 'REMOTE_NODE' }
      page.widgets.push(w)
      this.addWidgetToUI(w)
      this.save()
    }
  }

  switchPage(pid) {
    this.activePageId = pid
    this.editingPageId = pid
    this.render(); this.setupGrid(); this.bindEvents()
  }

  // --- External Integrations ---
  initMqtt() {
    if (this.mqttClient) this.mqttClient.end()
    const { mqtt_host, mqtt_port, mqtt_topic } = this.state.settings
    try {
      this.mqttClient = mqtt.connect(`ws://${mqtt_host}:${mqtt_port}/mqtt`)
      this.mqttClient.on('connect', () => {
        this.updateMqttUI(true)
        this.mqttClient.subscribe(mqtt_topic)
      })
      this.mqttClient.on('close', () => this.updateMqttUI(false))
      this.mqttClient.on('message', (topic, message) => {
        this.handleMqttMessage(topic, message)
      })
    } catch (e) { console.warn('MQTT System Offline') }
  }

  handleMqttMessage(topic, message) {
    try {
      const data = JSON.parse(message.toString())
      const entityId = topic.replace('ha/state/', '')
      
      // Update internal state
      this.state.pages.forEach(page => {
        page.widgets.forEach(w => {
          if (w.ha_entity === entityId) {
            w.value = data.state
            // Update UI element directly for speed
            const el = document.querySelector(`[gs-id="${w.id}"]`)
            if (el) {
              const valEl = el.querySelector('.value-text')
              if (valEl) valEl.textContent = data.state
              
              // Handle switches
              if (w.type === 'switch' || w.type === 'light') {
                const statusEl = el.querySelector('.status-text')
                if (statusEl) statusEl.textContent = data.state.toUpperCase()
                el.classList.toggle('status-on', data.state === 'on')
              }
            }
          }
        })
      })
    } catch (e) {}
  }

  updateMqttUI(connected) {
    const dot = document.querySelector('#mqtt-dot')
    const lbl = document.querySelector('#mqtt-label')
    if (dot && lbl) {
      dot.className = `w-1.5 h-1.5 rounded-full ${connected ? 'bg-accent shadow-[0_0_8px_#00f2ff] animate-pulse' : 'bg-orange-500'}`
      lbl.textContent = `MQTT: ${connected ? 'Active' : 'Offline'}`
    }
  }

  async fetchHaEntities() {
    const { ha_url, ha_token } = this.state.settings
    if (!ha_url || !ha_token) return
    
    try {
      const res = await fetch(`${ha_url}/api/states`, {
        headers: { 'Authorization': `Bearer ${ha_token}`, 'Content-Type': 'application/json' }
      })
      this.haEntities = await res.json()
      if (this.showEntityBrowser) this.render() 
    } catch (e) { console.error('HA Integration Failed') }
  }
}

window.addEventListener('load', () => new Dashboard())
