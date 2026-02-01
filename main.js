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

// --- MQTT Implementation Skeleton ---
const MQTT_CONFIG = {
  host: 'broker.hivemq.com', // Change this to your broker
  port: 8000, // WebSocket port for browser
  topic: 'mission-control/status',
}

const client = mqtt.connect(`ws://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}/mqtt`)

client.on('connect', () => {
  console.log('Connected to Mission Control Broker')
  client.subscribe(MQTT_CONFIG.topic)
})

client.on('message', (topic, message) => {
  console.log(`Received: ${message.toString()} from ${topic}`)
  // Update state and re-render here
})

// --- UI Render ---
function render() {
  document.querySelector('#app').innerHTML = `
    <div class="grid-glow"></div>
    <div class="flex flex-col h-full">
      <header class="p-8 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div class="text-xl font-black tracking-tighter uppercase">Mission<span class="text-accent ml-1">Control</span></div>
        <div class="flex gap-8 text-[10px] uppercase tracking-widest text-white/40">
          <div>System<span class="text-accent ml-2">Online</span></div>
          <div>Nodes<span class="text-accent ml-2">12</span></div>
          <div>MQTT<span class="text-accent ml-2" id="mqtt-status">Connecting...</span></div>
        </div>
      </header>
      
      <main class="flex-1 p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto">
        ${createCard('⚡', 'Grid Power', 'Main Load', `${state.power.value}<span>${state.power.unit}</span>`, state.power.trend)}
        ${createCard('🌡️', 'Environment', 'Living Room', `${state.temp.value}<span>${state.temp.unit}</span>`, state.temp.trend)}
        ${createCard('💧', 'Humidity', 'Studio', `${state.humidity.value}<span>${state.humidity.unit}</span>`, state.humidity.trend)}
        ${createCard('☀️', 'Solar', 'PV Array', `${state.solar.value}<span>${state.solar.unit}</span>`, state.solar.trend)}
        ${createCard('💡', 'Lighting', 'All Zones', state.lighting.status, state.lighting.trend)}
        ${createCard('🛡️', 'Security', 'Perimeter', state.security.status, state.security.trend)}
      </main>
    </div>
  `
  
  // Update MQTT status text if connected
  if (client.connected) {
    const statusEl = document.getElementById('mqtt-status')
    if (statusEl) statusEl.textContent = 'Active'
  }
}

function createCard(icon, subtitle, title, value, trend) {
  return `
    <div class="group bg-surface border border-white/5 p-6 rounded-xl relative overflow-hidden transition-all duration-300 hover:border-accent/40 hover:bg-accent/[0.02] hover:-translate-y-1">
      <div class="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center mb-4 text-accent transition-transform duration-500 group-hover:scale-110">${icon}</div>
      <div class="text-[10px] text-white/40 uppercase tracking-widest mb-1">${subtitle}</div>
      <div class="text-sm font-semibold mb-4">${title}</div>
      <div class="text-3xl font-bold tracking-tight mb-6">
        ${value}
      </div>
      <div class="h-1 bg-white/5 rounded-full relative">
        <div class="absolute inset-y-0 left-0 bg-accent rounded-full shadow-[0_0_10px_#00f2ff] transition-all duration-1000 ease-out" style="width: ${trend}%"></div>
      </div>
    </div>
  `
}

render()

// Update status every second
setInterval(() => {
  const statusEl = document.getElementById('mqtt-status')
  if (statusEl) {
    statusEl.textContent = client.connected ? 'Active' : 'Connecting...'
    statusEl.className = client.connected ? 'text-accent ml-2' : 'text-orange-500 ml-2'
  }
}, 1000)
