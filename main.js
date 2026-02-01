import './style.css'
import mqtt from 'mqtt'

// --- Mock Data ---
const state = {
  power: { value: 2.4, unit: 'kW', trend: 45 },
  temp: { value: 22.4, unit: '°C', trend: 65 },
  humidity: { value: 48, unit: '%', trend: 48 },
  solar: { value: 5.1, unit: 'kW', trend: 85 },
  lighting: { status: 'OFF', trend: 0 },
  security: { status: 'ARMED', trend: 100 }
}

// --- MQTT Implementation ---
const MQTT_CONFIG = {
  host: 'broker.hivemq.com',
  port: 8000,
  topic: 'mission-control/status',
}

let client = null;

try {
  client = mqtt.connect(`ws://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}/mqtt`)

  client.on('connect', () => {
    console.log('Connected to Mission Control Broker')
    client.subscribe(MQTT_CONFIG.topic)
    updateMqttStatus()
  })

  client.on('message', (topic, message) => {
    console.log(`Received: ${message.toString()} from ${topic}`)
  })

  client.on('error', (err) => {
    console.error('MQTT Error:', err)
    updateMqttStatus()
  })
} catch (e) {
  console.error('Failed to initialize MQTT:', e)
}

// --- UI Render ---
function render() {
  const app = document.querySelector('#app')
  if (!app) return;

  app.innerHTML = `
    <div class="grid-glow"></div>
    <div class="flex flex-col h-screen w-screen overflow-hidden bg-bg-main">
      <header class="p-6 md:p-8 flex justify-between items-center border-b border-white/5 bg-black/40 backdrop-blur-xl z-10">
        <div class="text-xl font-black tracking-tighter uppercase text-white">Mission<span class="text-accent ml-1">Control</span></div>
        <div class="flex gap-6 md:gap-8 text-[10px] uppercase tracking-widest text-white/40 font-medium">
          <div class="hidden sm:block">System<span class="text-accent ml-2">Online</span></div>
          <div class="hidden sm:block">Nodes<span class="text-accent ml-2">12</span></div>
          <div>MQTT<span class="ml-2 transition-colors duration-300" id="mqtt-status">Connecting...</span></div>
        </div>
      </header>
      
      <main class="flex-1 p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar">
        ${createCard('⚡', 'Grid Power', 'Main Load', `${state.power.value}<span class="text-xs ml-1 opacity-40">${state.power.unit}</span>`, state.power.trend)}
        ${createCard('🌡️', 'Environment', 'Living Room', `${state.temp.value}<span class="text-xs ml-1 opacity-40">${state.temp.unit}</span>`, state.temp.trend)}
        ${createCard('💧', 'Humidity', 'Studio', `${state.humidity.value}<span class="text-xs ml-1 opacity-40">${state.humidity.unit}</span>`, state.humidity.trend)}
        ${createCard('☀️', 'Solar', 'PV Array', `${state.solar.value}<span class="text-xs ml-1 opacity-40">${state.solar.unit}</span>`, state.solar.trend)}
        ${createCard('💡', 'Lighting', 'All Zones', `<span class="${state.lighting.status === 'OFF' ? 'text-white/20' : 'text-accent'}">${state.lighting.status}</span>`, state.lighting.trend)}
        ${createCard('🛡️', 'Security', 'Perimeter', `<span class="text-accent">${state.security.status}</span>`, state.security.trend)}
      </main>
    </div>
  `
  updateMqttStatus()
}

function createCard(icon, subtitle, title, value, trend) {
  return `
    <div class="group bg-surface border border-white/5 p-6 rounded-2xl relative overflow-hidden transition-all duration-500 hover:border-accent/30 hover:bg-white/[0.02] active:scale-[0.98]">
      <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div class="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 text-xl text-accent shadow-inner transition-all duration-500 group-hover:scale-110 group-hover:bg-accent/10 group-hover:text-white">
        ${icon}
      </div>
      
      <div class="space-y-1 mb-6">
        <div class="text-[10px] text-white/30 uppercase tracking-[0.2em] font-bold">${subtitle}</div>
        <div class="text-base font-bold text-white/90 group-hover:text-white transition-colors">${title}</div>
      </div>

      <div class="text-4xl font-black tracking-tight text-white mb-8 tabular-nums">
        ${value}
      </div>

      <div class="relative h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div class="absolute inset-y-0 left-0 bg-accent rounded-full shadow-[0_0_15px_rgba(0,242,255,0.6)] transition-all duration-1000 ease-out" style="width: ${trend}%"></div>
      </div>
    </div>
  `
}

function updateMqttStatus() {
  const statusEl = document.getElementById('mqtt-status')
  if (!statusEl) return

  const isConnected = client && client.connected
  statusEl.textContent = isConnected ? 'Active' : 'Offline'
  statusEl.className = isConnected ? 'text-accent ml-2' : 'text-orange-500 ml-2'
}

// Initial Render
render()

// Update status every second
setInterval(updateMqttStatus, 1000)
