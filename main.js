import './style.css'

document.querySelector('#app').innerHTML = `
  <div class="grid-glow"></div>
  <header>
    <div class="logo">Mission<span>Control</span></div>
    <div class="status-bar">
      <div class="status-item">System<span>Online</span></div>
      <div class="status-item">Nodes<span>12</span></div>
      <div class="status-item">Security<span>Active</span></div>
    </div>
  </header>
  
  <main>
    <div class="card">
      <div class="card-icon">⚡</div>
      <div class="card-subtitle">Grid Power</div>
      <div class="card-title">Main Load</div>
      <div class="card-value">2.4<span>kW</span></div>
      <div class="control-strip">
        <div class="control-fill" style="width: 45%"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-icon">🌡️</div>
      <div class="card-subtitle">Environment</div>
      <div class="card-title">Living Room</div>
      <div class="card-value">22.4<span>°C</span></div>
      <div class="control-strip">
        <div class="control-fill" style="width: 65%"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-icon">💧</div>
      <div class="card-subtitle">Humidity</div>
      <div class="card-title">Studio</div>
      <div class="card-value">48<span>%</span></div>
      <div class="control-strip">
        <div class="control-fill" style="width: 48%"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-icon">☀️</div>
      <div class="card-subtitle">Solar</div>
      <div class="card-title">PV Array</div>
      <div class="card-value">5.1<span>kW</span></div>
      <div class="control-strip">
        <div class="control-fill" style="width: 85%"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-icon">💡</div>
      <div class="card-subtitle">Lighting</div>
      <div class="card-title">All Zones</div>
      <div class="card-value">OFF</div>
      <div class="control-strip">
        <div class="control-fill" style="width: 0%"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-icon">🛡️</div>
      <div class="card-subtitle">Security</div>
      <div class="card-title">Perimeter</div>
      <div class="card-value">ARMED</div>
      <div class="control-strip">
        <div class="control-fill" style="width: 100%"></div>
      </div>
    </div>
  </main>
`
