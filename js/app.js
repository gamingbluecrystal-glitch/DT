/**
 * SmartBus Main Application Logic (Vanilla JS)
 * Zero hardcoded data: all state is dynamic and user-configurable.
 */

function getRealTimeMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

const AppState = {
  stops: [],
  buses: [],
  routes: [],
  trips: [],
  stopsMap: new Map(),
  busesMap: new Map(),
  routesMap: new Map(),

  selectedStopId: '',
  filterNext20Min: true,
  simulatedMinutes: getRealTimeMinutes(),
  isSimulating: true,
  simulationSpeed: 1,

  activeRouteModal: null,
  map: null,
  layersGroup: null,
  userLocationLayer: null,
  userLocation: null
};

function refreshMaps() {
  AppState.stopsMap = new Map(AppState.stops.map(s => [s.id, s]));
  AppState.busesMap = new Map(AppState.buses.map(b => [b.id, b]));
  AppState.routesMap = new Map(AppState.routes.map(r => [r.id, r]));
}

function reloadDataFromStorage() {
  AppState.stops = StorageService.getStops();
  AppState.buses = StorageService.getBuses();
  AppState.routes = StorageService.getRoutes();
  AppState.trips = StorageService.getTrips();
  refreshMaps();

  if (AppState.stops.length > 0) {
    const exists = AppState.stops.some(s => s.id === AppState.selectedStopId);
    if (!exists) {
      AppState.selectedStopId = AppState.stops[0].id;
    }
  } else {
    AppState.selectedStopId = '';
  }
}

// --- Map Initialization & Updates ---
function initMap() {
  const container = document.getElementById('map-container');
  if (!container || AppState.map) return;

  const hasStops = AppState.stops.length > 0 && typeof AppState.stops[0].lat === 'number';
  const centerLat = hasStops ? AppState.stops[0].lat : 20.0;
  const centerLng = hasStops ? AppState.stops[0].lng : 77.0;
  const initialZoom = hasStops ? 13 : 5;

  AppState.map = L.map('map-container', {
    center: [centerLat, centerLng],
    zoom: initialZoom,
    minZoom: 4,
    maxZoom: 19,
    zoomControl: true
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    maxNativeZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(AppState.map);

  AppState.layersGroup = L.layerGroup().addTo(AppState.map);
  AppState.userLocationLayer = L.layerGroup().addTo(AppState.map);

  setTimeout(() => {
    if (AppState.map) AppState.map.invalidateSize();
  }, 200);
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function renderUserLocation(lat, lng, accuracy, panTo = true) {
  if (!AppState.map || !AppState.userLocationLayer) return;

  AppState.userLocation = { lat, lng, accuracy };
  AppState.userLocationLayer.clearLayers();

  // Draw accuracy circle
  if (accuracy && accuracy > 0) {
    const radius = Math.max(accuracy, 25);
    L.circle([lat, lng], {
      radius: radius,
      color: '#2563eb',
      fillColor: '#60a5fa',
      fillOpacity: 0.18,
      weight: 1.5
    }).addTo(AppState.userLocationLayer);
  }

  // Draw pulsating blue marker
  const userIcon = L.divIcon({
    className: 'custom-user-location',
    html: '<div class="user-location-pin"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const marker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 1000 });

  // Calculate nearest stop if any stops exist
  let nearestInfoHtml = '';
  if (AppState.stops && AppState.stops.length > 0) {
    let nearestStop = null;
    let minDistance = Infinity;

    AppState.stops.forEach(s => {
      if (typeof s.lat === 'number' && typeof s.lng === 'number') {
        const d = calculateDistanceKm(lat, lng, s.lat, s.lng);
        if (d < minDistance) {
          minDistance = d;
          nearestStop = s;
        }
      }
    });

    if (nearestStop) {
      const distStr = minDistance < 1 ? `${Math.round(minDistance * 1000)} m` : `${minDistance.toFixed(2)} km`;
      nearestInfoHtml = `
        <div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0;">
          <strong>Nearest Stop:</strong> ${nearestStop.name} (${distStr})<br/>
          <button id="btn-select-nearest-stop" style="
            margin-top: 5px;
            background: #2563eb;
            color: #ffffff;
            border: none;
            border-radius: 4px;
            padding: 4px 9px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
          ">View Arrivals at this Stop</button>
        </div>
      `;
    }
  }

  const popupDiv = document.createElement('div');
  popupDiv.style.fontSize = '12px';
  popupDiv.style.lineHeight = '1.4';
  popupDiv.innerHTML = `
    <div style="font-weight: 800; color: #2563eb; margin-bottom: 2px;">📍 Your Current Location</div>
    <div style="color: #64748b; font-size: 11px;">Accuracy: &plusmn;${Math.round(accuracy || 0)}m</div>
    <div style="color: #334155; margin-top: 2px;">Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</div>
    ${nearestInfoHtml}
  `;

  marker.bindPopup(popupDiv);
  marker.addTo(AppState.userLocationLayer);

  // Hook up button to select stop
  marker.on('popupopen', () => {
    const selBtn = document.getElementById('btn-select-nearest-stop');
    if (selBtn) {
      selBtn.onclick = () => {
        if (AppState.stops && AppState.stops.length > 0) {
          let nearestStop = null;
          let minDistance = Infinity;
          AppState.stops.forEach(s => {
            if (typeof s.lat === 'number' && typeof s.lng === 'number') {
              const d = calculateDistanceKm(lat, lng, s.lat, s.lng);
              if (d < minDistance) {
                minDistance = d;
                nearestStop = s;
              }
            }
          });
          if (nearestStop) {
            AppState.selectedStopId = nearestStop.id;
            renderApp();
            marker.closePopup();
          }
        }
      };
    }
  });

  if (panTo) {
    AppState.map.setView([lat, lng], Math.max(AppState.map.getZoom(), 14));
    setTimeout(() => {
      marker.openPopup();
    }, 250);
  }
}

function handleLocateUser() {
  const btn = document.getElementById('btn-locate-me');
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Locating...';
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📍 My Location';
      }
      const { latitude, longitude, accuracy } = position.coords;
      renderUserLocation(latitude, longitude, accuracy, true);
    },
    (error) => {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📍 My Location';
      }
      let errorMsg = 'Unable to retrieve your location.';
      if (error.code === 1) {
        errorMsg = 'Location permission was denied. Please allow location access in your browser.';
      } else if (error.code === 2) {
        errorMsg = 'Position unavailable. Please check your network or GPS connection.';
      } else if (error.code === 3) {
        errorMsg = 'Location request timed out. Please try again.';
      }
      alert(errorMsg);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000
    }
  );
}

function updateMap() {
  if (!AppState.map || !AppState.layersGroup) return;

  AppState.layersGroup.clearLayers();

  // 1. Draw Routes Polylines (Google Maps Road Snapping)
  AppState.routes.forEach(route => {
    if (!route.isActive || !route.stops) return;

    const geom = (route.roadGeometry && Array.isArray(route.roadGeometry) && route.roadGeometry.length > 0)
      ? route.roadGeometry
      : null;

    if (geom && geom.length > 1) {
      // Outer road casing (Google Maps transit style)
      L.polyline(geom, {
        color: '#ffffff',
        weight: 8,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(AppState.layersGroup);

      // Inner vibrant transit line
      L.polyline(geom, {
        color: route.color || '#dc2626',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(AppState.layersGroup);
    } else {
      const latlngs = [];
      route.stops.forEach(rs => {
        const stop = AppState.stopsMap.get(rs.stopId);
        if (stop && typeof stop.lat === 'number' && typeof stop.lng === 'number') {
          latlngs.push([stop.lat, stop.lng]);
        }
      });

      if (latlngs.length > 1) {
        L.polyline(latlngs, {
          color: '#ffffff',
          weight: 7,
          opacity: 0.9
        }).addTo(AppState.layersGroup);

        L.polyline(latlngs, {
          color: route.color || '#b91c1c',
          weight: 4,
          opacity: 0.9
        }).addTo(AppState.layersGroup);
      }
    }
  });

  // 2. Draw Stops Markers
  AppState.stops.forEach(stop => {
    if (typeof stop.lat !== 'number' || typeof stop.lng !== 'number') return;
    const isSelected = stop.id === AppState.selectedStopId;

    const markerHtml = `
      <div style="
        width: ${isSelected ? '20px' : '14px'};
        height: ${isSelected ? '20px' : '14px'};
        border-radius: 50%;
        background-color: ${isSelected ? '#b91c1c' : '#ffffff'};
        border: 2px solid ${isSelected ? '#ffffff' : '#b91c1c'};
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
        cursor: pointer;
      "></div>
    `;

    const icon = L.divIcon({
      className: 'custom-stop-pin',
      html: markerHtml,
      iconSize: [isSelected ? 20 : 14, isSelected ? 20 : 14],
      iconAnchor: [isSelected ? 10 : 7, isSelected ? 10 : 7]
    });

    const marker = L.marker([stop.lat, stop.lng], { icon });
    marker.on('click', () => {
      AppState.selectedStopId = stop.id;
      renderApp();
    });
    marker.bindPopup(`
      <div style="font-size: 12px;">
        <strong>${stop.name}</strong> ${stop.code ? `(${stop.code})` : ''}<br/>
        ${isSelected ? '<span style="color:#b91c1c;font-weight:bold;">● Selected Stop</span>' : 'Click to select this stop'}
      </div>
    `);
    marker.addTo(AppState.layersGroup);
  });

  // 3. Draw Active Buses on Road (Linear Interpolated Position)
  const activeBuses = getActiveBusesOnRoad();
  activeBuses.forEach(({ bus, route, location }) => {
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number' || location.lat === null) return;

    const busHtml = `<div class="bus-pin-label">🚌 ${bus.busNumber}</div>`;
    const busIcon = L.divIcon({
      className: 'custom-bus-pin',
      html: busHtml,
      iconSize: [60, 24],
      iconAnchor: [30, 12]
    });

    const marker = L.marker([location.lat, location.lng], { icon: busIcon, zIndexOffset: 200 });
    marker.bindPopup(`
      <div style="font-size: 12px; line-height: 1.4;">
        <strong style="color:#b91c1c;">${bus.busNumber}</strong> ${bus.plateNumber ? `(${bus.plateNumber})` : ''}<br/>
        <b>Route:</b> ${route.name}<br/>
        <b>Status:</b> ${location.currentSegmentDescription}<br/>
        <small style="color: #b91c1c;">* Estimated Position (Non-GPS)</small>
      </div>
    `);
    marker.addTo(AppState.layersGroup);
  });

  const stopCountEl = document.getElementById('map-stops-counter');
  if (stopCountEl) {
    stopCountEl.textContent = AppState.stops.length > 0 ? `${AppState.stops.length} stop${AppState.stops.length === 1 ? '' : 's'} on map` : 'No stops configured';
  }
}

function getActiveBusesOnRoad() {
  const list = [];
  for (const trip of AppState.trips) {
    if (!trip.isActive) continue;
    const route = AppState.routesMap.get(trip.routeId);
    const bus = AppState.busesMap.get(trip.busId);
    if (!route || !bus || bus.status !== 'active') continue;

    const loc = EtaEngine.calculateEstimatedLocation(trip, AppState.stopsMap, AppState.simulatedMinutes, AppState.routesMap);
    if (loc && loc.isTripActive && typeof loc.lat === 'number' && loc.lat !== null) {
      list.push({ bus, route, trip, location: loc });
    }
  }
  return list;
}

// --- Render Methods ---
function renderHeader() {
  const clockEl = document.getElementById('nav-clock-time');
  if (clockEl) {
    clockEl.textContent = EtaEngine.minutesToTimeString(AppState.simulatedMinutes);
  }
}

function renderSimulationBar() {
  const input = document.getElementById('sim-time-input');
  if (input) {
    input.value = EtaEngine.minutesToTimeString(AppState.simulatedMinutes, true);
  }
}

function renderStopSelector() {
  const dropdown = document.getElementById('stop-select');
  if (!dropdown) return;

  dropdown.innerHTML = '';
  if (AppState.stops.length === 0) {
    dropdown.innerHTML = '<option value="">No bus stops configured</option>';
    return;
  }

  AppState.stops.forEach(stop => {
    const opt = document.createElement('option');
    opt.value = stop.id;
    opt.textContent = stop.code ? `${stop.name} (${stop.code})` : stop.name;
    if (stop.id === AppState.selectedStopId) {
      opt.selected = true;
    }
    dropdown.appendChild(opt);
  });
}

function formatEtaDisplay(eta) {
  if (eta <= 0) return 'Now';
  const num = Number(eta);
  return Number.isInteger(num) ? `${num} min` : `${num.toFixed(2)} min`;
}

function renderBusList() {
  const listContainer = document.getElementById('bus-cards-container');
  const stopNameEl = document.getElementById('arrivals-stop-name');
  const btn20 = document.getElementById('btn-filter-20min');
  const btnAll = document.getElementById('btn-filter-all');

  const selectedStop = AppState.stopsMap.get(AppState.selectedStopId);

  if (stopNameEl) {
    stopNameEl.textContent = selectedStop ? selectedStop.name : '';
  }

  if (btn20 && btnAll) {
    btn20.classList.toggle('active', AppState.filterNext20Min);
    btnAll.classList.toggle('active', !AppState.filterNext20Min);
  }

  if (!listContainer) return;
  listContainer.innerHTML = '';

  if (AppState.stops.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <h4>No Transit Data Available</h4>
        <p style="color: var(--text-muted); font-size: 13px; margin-top: 6px;">Live transit schedules will appear here once active.</p>
      </div>
    `;
    return;
  }

  const arrivals = EtaEngine.getBusesForStop(
    AppState.selectedStopId,
    AppState.simulatedMinutes,
    AppState.trips,
    AppState.routesMap,
    AppState.busesMap,
    AppState.stopsMap,
    AppState.filterNext20Min
  );

  if (arrivals.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <h4>No upcoming buses scheduled</h4>
        <button class="btn-primary" id="btn-empty-show-all" style="margin-top: 10px;">View All Trips</button>
      </div>
    `;
    const btnEmptyAll = document.getElementById('btn-empty-show-all');
    if (btnEmptyAll) {
      btnEmptyAll.addEventListener('click', () => {
        AppState.filterNext20Min = false;
        renderBusList();
      });
    }
    return;
  }

  arrivals.forEach(item => {
    const card = document.createElement('div');
    card.className = 'bus-card';

    let statusClass = 'later';
    if (item.status === 'Arriving Soon') statusClass = 'soon';
    else if (item.status === 'Upcoming') statusClass = 'upcoming';

    card.innerHTML = `
      <div class="bus-card-top">
        <div class="bus-id-group">
          <span class="bus-badge">${item.bus.busNumber}</span>
          ${item.bus.plateNumber ? `<span class="bus-plate">(${item.bus.plateNumber})</span>` : ''}
        </div>
        <span class="status-tag ${statusClass}">${item.status}</span>
      </div>

      <div class="bus-card-route">
        ${item.originStop.name} &rarr; <span>${item.destinationStop.name}</span>
      </div>

      <div class="bus-eta-grid">
        <div>
          <span class="eta-label">Estimated Arrival</span>
          <span class="eta-value-big">${formatEtaDisplay(item.etaMinutes)}</span>
        </div>
        <div style="text-align: right;">
          <span class="eta-label">Expected Time</span>
          <span class="eta-time-val">${item.expectedArrivalTime}</span>
        </div>
      </div>

      <div class="bus-card-footer">
        <span class="stops-remaining">
          ${item.stopsRemaining === 0 ? 'At current stop' : `${item.stopsRemaining} stop${item.stopsRemaining === 1 ? '' : 's'} away`}
        </span>
        <button class="btn-view-route" data-trip-id="${item.tripId}">View Route</button>
      </div>
    `;

    const viewBtn = card.querySelector('.btn-view-route');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        openRouteModal(item);
      });
    }

    listContainer.appendChild(card);
  });
}

function openRouteModal(item) {
  AppState.activeRouteModal = item;
  const modalOverlay = document.getElementById('route-modal-overlay');
  if (!modalOverlay) return;

  document.getElementById('modal-bus-title').textContent = `Route Details: ${item.bus.busNumber}`;
  document.getElementById('modal-bus-subtitle').textContent = `${item.originStop.name} → ${item.destinationStop.name}`;
  document.getElementById('modal-segment-desc').textContent = item.location.currentSegmentDescription;
  document.getElementById('modal-prev-stop').textContent = item.location.previousStop ? item.location.previousStop.name : item.originStop.name;
  document.getElementById('modal-next-stop').textContent = item.location.nextStop ? item.location.nextStop.name : item.destinationStop.name;
  document.getElementById('modal-stops-remaining').textContent = String(item.stopsRemaining);
  document.getElementById('modal-est-arrival').textContent = item.expectedArrivalTime;

  const tbody = document.getElementById('modal-timeline-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    item.timeline.forEach((tl, idx) => {
      const tr = document.createElement('tr');
      if (tl.isTarget) tr.className = 'target-stop';
      else if (tl.isCurrent) tr.className = 'current-segment';

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>
          ${tl.stop.name}
          ${tl.isTarget ? '<span style="color:#b91c1c;font-size:10px;text-transform:uppercase;margin-left:4px;">(Your Stop)</span>' : ''}
        </td>
        <td style="font-family: var(--font-mono);">${tl.arrivalTime}</td>
        <td style="font-family: var(--font-mono);">${tl.departureTime}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  modalOverlay.classList.add('open');

  if (AppState.map && typeof item.location.lat === 'number' && item.location.lat !== null) {
    AppState.map.panTo([item.location.lat, item.location.lng]);
  }
}

function closeRouteModal() {
  AppState.activeRouteModal = null;
  const modalOverlay = document.getElementById('route-modal-overlay');
  if (modalOverlay) {
    modalOverlay.classList.remove('open');
  }
}

// Master Render
function renderApp() {
  renderHeader();
  renderSimulationBar();
  renderStopSelector();
  renderBusList();
  updateMap();
}

// --- App Bootstrap ---
function initApp() {
  if (window.location.hash.toLowerCase().includes('admin')) {
    window.location.replace('admin.html');
    return;
  }

  if (typeof FirebaseService !== 'undefined') {
    FirebaseService.init();
  }
  StorageService.initDefaults();
  reloadDataFromStorage();

  AppState.simulatedMinutes = getRealTimeMinutes();

  initMap();

  const brandHeader = document.getElementById('brand-header');
  if (brandHeader) {
    brandHeader.addEventListener('click', () => {
      window.location.hash = '';
      renderApp();
    });
  }

  const locateBtn = document.getElementById('btn-locate-me');
  if (locateBtn) {
    locateBtn.addEventListener('click', handleLocateUser);
  }

  document.getElementById('stop-select').addEventListener('change', (e) => {
    AppState.selectedStopId = e.target.value;
    renderBusList();
    const stop = AppState.stopsMap.get(AppState.selectedStopId);
    if (AppState.map && stop && typeof stop.lat === 'number') {
      AppState.map.panTo([stop.lat, stop.lng]);
    }
  });

  document.getElementById('btn-filter-20min').addEventListener('click', () => {
    AppState.filterNext20Min = true;
    renderBusList();
  });

  document.getElementById('btn-filter-all').addEventListener('click', () => {
    AppState.filterNext20Min = false;
    renderBusList();
  });

  // Time simulation controls
  const timeInput = document.getElementById('sim-time-input');
  if (timeInput) {
    timeInput.addEventListener('change', (e) => {
      AppState.simulatedMinutes = EtaEngine.timeStringToMinutes(e.target.value);
      renderApp();
    });
  }

  // Modal close handlers
  document.getElementById('btn-modal-close-x').addEventListener('click', closeRouteModal);
  document.getElementById('btn-modal-close-footer').addEventListener('click', closeRouteModal);
  document.getElementById('route-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'route-modal-overlay') closeRouteModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeRouteModal();
  });

  window.addEventListener('smartbus_storage_updated', () => {
    reloadDataFromStorage();
    renderApp();
  });

  window.addEventListener('hashchange', () => {
    if (window.location.hash.toLowerCase().includes('admin')) {
      window.location.replace('admin.html');
    }
  });

  setInterval(() => {
    if (!AppState.isSimulating) return;
    AppState.simulatedMinutes = (AppState.simulatedMinutes + (AppState.simulationSpeed / 60)) % 1440;
    renderHeader();
    renderSimulationBar();
    renderBusList();
    updateMap();
  }, 1000);

  renderApp();
}

document.addEventListener('DOMContentLoaded', initApp);
