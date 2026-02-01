# Mission Control - Integration & Polish Plan

## Phase 1: Home Assistant Backbone
- [ ] **HA Connectivity:** Add fields in Settings for `HA_URL` and `HA_TOKEN`.
- [ ] **Entity Discovery:** Implement a service to fetch all entities from `/api/states`.
- [ ] **Entity Browser:** Create a searchable UI component to browse and select HA entities when adding widgets.

## Phase 2: MQTT Pooling & Discovery
- [ ] **Wildcard Listen:** Implement a "Discovery Mode" that subscribes to `#` to map the local network topics.
- [ ] **Topic Mapping:** Allow manual mapping of discovered MQTT topics to widget properties (e.g., `tele/sonoff/SENSOR` -> JSON path `AM2301.Temperature`).

## Phase 3: Visual & UX Polish
- [ ] **Responsive Refinement:** Ensure grid adapts perfectly to tablet vs desktop view.
- [ ] **Micro-animations:** Add subtle entry animations for widgets and "live" pulse effects for sensor updates.
- [ ] **Icon Set:** Integrate a comprehensive SVG icon library (e.g., Lucide) for better device representation.
- [ ] **Theme Polish:** Refine the "Shelly" look—ultra-thin borders, high-contrast typography, and consistent spacing.

## Phase 4: Persistence & Sync
- [ ] **Local Storage V2:** Improve state serialization to handle complex entity mappings.
- [ ] **Export/Import:** Add ability to backup dashboard configuration to a JSON file.
