const API_URL = 'http://localhost:3000';
let socket, token = null;

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelector(sel);

// Authentication management
const Auth = {
    current: 'login',

    switchToLogin() {
        this.current = 'login';
        $$('.auth-slider').style.transform = 'translateX(0%)';
    },

    switchToRegister() {
        this.current = 'register';
        $$('.auth-slider').style.transform = 'translateX(-50%)';
    },

    register() {
        const u = $('regUsername').value.trim();
        const p = $('regPassword').value;
        if (!u || !p) return showMsg('All fields required', true);

        api('/users', 'POST', { username: u, password: p }, (data) => {
            token = data.token;
            localStorage.setItem('token', token);
            initApp();
        });
    },

    login() {
        const u = $('loginUsername').value.trim();
        const p = $('loginPassword').value;
        if (!u || !p) return showMsg('All fields required', true);
        api('/login', 'POST', { username: u, password: p }, data => {
            token = data.token;
            localStorage.setItem('token', token);
            initApp();
        });
    },

    logout() {
        if (socket?.connected) socket.disconnect();
        if (token) {
            fetch(`${API_URL}/logout`, {
                method: 'POST',
                keepalive: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token })
            }).catch(() => {});
        }
        localStorage.removeItem('token');
        token = null;
        location.reload();
    }
};

// API request helper with error handling
function api(path, method, body, success) {
    fetch(`${API_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: body ? JSON.stringify(body) : null
    })
        .then(async (r) => {
            const data = await r.json();

            if (r.ok) {
                return data;
            } else {
                return Promise.reject(data.error || 'Unknown error');
            }
        })
        .then(data => success(data))
        .catch(err => {
            showMsg(err, true);
        });
}

// Initialize application after authentication
function initApp() {
    $('auth').classList.add('hidden');
    $('app').classList.remove('hidden');
    initSocket();
    fetchThings();
}

// Initialize WebSocket connection
function initSocket() {
    socket = io(API_URL, { auth: { token } });
    socket.on('things:list', renderThings);
    socket.on('thing:registered', fetchThings);
    socket.on('thing:updated', updateThing);
}

// Fetch list of connected things from gateway
function fetchThings() {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    fetch(`${API_URL}/things`, { headers })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(renderThings)
        .catch(() => {
            if (token) localStorage.removeItem('token');
            token = null;
            $('app').classList.add('hidden');
            $('auth').classList.remove('hidden');
            renderThings([]);
        });
}

// Get visual representation for each device type
function getDeviceVisual(type) {
    switch(type) {
        case 'lamp':
            return `
                <div class="lamp-base"></div>
                <div class="lamp-stand"></div>
                <div class="lamp-bulb"></div>
                <div class="lamp-glow"></div>
            `;
        case 'motion':
            return `
                <div class="motion-sensor">
                    <div class="motion-eye"></div>
                    <div class="motion-waves"></div>
                </div>
            `;
        case 'thermostat':
            return `
                <div class="thermostat-body">
                    <div class="thermostat-ring"></div>
                    <div class="thermostat-display">
                        <span class="temp-value">--°</span>
                    </div>
                </div>
            `;
        default:
            return `<div class="default-device">?</div>`;
    }
}

// Render things list with controls
function renderThings(things) {
    const unique = {};
    things.forEach(t => { if (!unique[t.type]) unique[t.type] = t; });

    $('things').innerHTML = Object.values(unique).map(t => `
    <div class="thing">
      <div class="thing-visual">
        <div id="visual-${t.id}" class="device-visual ${t.type}-device">
          ${getDeviceVisual(t.type)}
        </div>
      </div>
      <div class="thing-info">
        <h3>${t.name} <small>(${t.type})</small></h3>
        <div id="props-${t.id}" class="properties">Loading...</div>
        ${token ? `
        <div class="btn-group">
          ${t.type === 'lamp' ? `
            <button onclick="Thing.action('${t.id}', 'turnOn')">Turn On</button>
            <button onclick="Thing.action('${t.id}', 'turnOff')">Turn Off</button>
          ` : ''}
          ${t.type === 'motion' ? `
            <button onclick="Thing.action('${t.id}', 'simulateMotion')">Simulate Motion</button>
          ` : ''}
          ${t.type === 'thermostat' ? `
            <button onclick="Thing.action('${t.id}', 'setMode', {mode: 'manual'})">Manual Mode</button>
            <button onclick="Thing.action('${t.id}', 'setMode', {mode: 'eco'})">Eco Mode</button>
            <button onclick="Thing.action('${t.id}', 'setMode', {mode: 'comfort'})">Comfort Mode</button>
          ` : ''}
        </div>
        ` : ''}
      </div>
    </div>
  `).join('');

    // Fetch and render properties for each thing
    Object.values(unique).forEach(async t => {
        try {
            const res = await fetch(`http://localhost:3000/things/${t.id}/properties`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error('Unauthorized or server error');
            const props = await res.json();
            renderProperties(t.id, t.type, props.properties);
            updateDeviceVisual(t.id, t.type, props.properties);
        } catch (err) {
            console.error(`Failed to fetch properties for ${t.name}:`, err);
            $(`props-${t.id}`).innerHTML = '<span class="error">Unauthorized or offline</span>';
        }
    });
}

// Render properties with interactive controls
function renderProperties(thingId, thingType, properties) {
    const el = document.getElementById(`props-${thingId}`);
    if (!el) return;

    const readOnlyNumbers = ['currentTemperature'];

    const colorMap = {
        'white': '#ffffff',
        'red': '#f44336',
        'blue': '#2196f3',
        'green': '#4caf50',
        'yellow': '#ffeb3b'
    };

    const propertyInputs = Object.entries(properties).map(([key, value]) => {
        const inputType = typeof value === 'boolean' ? 'checkbox' :
            typeof value === 'number' ? 'number' : 'text';
        const inputValue = typeof value === 'boolean' ? (value ? 'checked' : '') :
            `value="${value}"`;

        const isNumberReadonly = inputType === 'number' && readOnlyNumbers.includes(key);

        const sliderId = `${thingId}-${key}-slider`;
        const valueId = `${thingId}-${key}-value`;

        return `
        <div class="property-row">
            <label>${key}:</label>
            ${token ? `
                ${inputType === 'checkbox' ? `
                    <input type="checkbox" 
                           id="${thingId}-${key}" 
                           ${inputValue}
                           disabled>
                `
            : key === 'brightness' ? `
                    <div class="slider-wrapper">
                        <input type="range"
                               id="${sliderId}"
                               min="0"
                               max="100"
                               step="1"
                               ${inputValue}
                               oninput="document.getElementById('${valueId}').textContent = this.value"
                               onchange="Thing.updateProperty('${thingId}', '${key}', parseFloat(this.value), '${thingType}')"
                               style="background: linear-gradient(to right, #263238, ${colorMap[properties.color] || '#ffeb3b'});"
                        >
                        <span id="${valueId}" class="slider-value">${value}</span>
                    </div>
                `
                : inputType === 'number' ? `
                    ${key === 'targetTemperature' ? `
                        <div class="slider-wrapper">
                            <input type="range"
                                   id="${sliderId}"
                                   min="10"
                                   max="30"
                                   step="0.5"
                                   ${inputValue}
                                   ${properties.mode !== 'manual' ? 'disabled' : ''} 
                                   style="background: linear-gradient(to right, #2196f3, #ffeb3b, #ff9800, #f44336);"
                                   oninput="document.getElementById('${valueId}').textContent = this.value"
                                   onchange="Thing.updateProperty('${thingId}', '${key}', parseFloat(this.value), '${thingType}')">
                            <span id="${valueId}" class="slider-value">${value}</span>
                        </div>
                    ` : `
                    <input type="number" 
                               id="${thingId}-${key}" 
                               ${inputValue}
                               step="0.1"
                               ${isNumberReadonly ? 'readonly' : `onchange="Thing.updateProperty('${thingId}', '${key}', parseFloat(this.value), '${thingType}')"`}>
                    `}
                ` : key === 'color' ? `
                    <select id="${thingId}-${key}" 
                            onchange="Thing.updateProperty('${thingId}', '${key}', this.value, '${thingType}')">
                        <option value="white" ${value === 'white' ? 'selected' : ''}>White</option>
                        <option value="red" ${value === 'red' ? 'selected' : ''}>Red</option>
                        <option value="blue" ${value === 'blue' ? 'selected' : ''}>Blue</option>
                        <option value="green" ${value === 'green' ? 'selected' : ''}>Green</option>
                        <option value="yellow" ${value === 'yellow' ? 'selected' : ''}>Yellow</option>
                    </select>
                ` : key === 'mode' ? `
                    <select id="${thingId}-${key}" 
                            onchange="Thing.updateProperty('${thingId}', '${key}', this.value, '${thingType}')">
                        <option value="manual" ${value === 'manual' ? 'selected' : ''}>Manual</option>
                        <option value="eco" ${value === 'eco' ? 'selected' : ''}>Eco</option>
                        <option value="comfort" ${value === 'comfort' ? 'selected' : ''}>Comfort</option>
                    </select>
                ` : `
                    <input type="text" 
                           id="${thingId}-${key}" 
                           ${inputValue}
                           readonly>
                `}
            ` : `
                <span class="value">${value}</span>
            `}
        </div>
        `;
    }).join('');

    el.innerHTML = propertyInputs;
}

// Thing actions and property updates
const Thing = {
    action(thingId, actionName, params = {}) {
        socket.emit('thing:action', { thingId, action: actionName, params, token });
    },

    updateProperty(thingId, propertyName, value, thingType) {
        const actionMap = {
            lamp: {
                brightness: value => ({ action: 'setBrightness', params: { value } }),
                color: value => ({ action: 'setColor', params: { color: value } })
            },
            thermostat: {
                mode: value => ({ action: 'setMode', params: { mode: value } }),
                targetTemperature: value => ({ action: 'setTarget', params: { value } })
            }
        };

        if (actionMap[thingType] && actionMap[thingType][propertyName]) {
            const actionOrFn = actionMap[thingType][propertyName];
            if (typeof actionOrFn === 'function') {
                const result = actionOrFn(value);
                if (typeof result === 'string') {
                    this.action(thingId, result);
                } else {
                    this.action(thingId, result.action, result.params);
                }
            } else {
                this.action(thingId, actionOrFn.action, actionOrFn.params);
            }
        }
    }
};

// Update thing display when properties change
function updateThing(data) {
    if (data.properties) {
        const colorMap = {
            'white': '#ffffff',
            'red': '#f44336',
            'blue': '#2196f3',
            'green': '#4caf50',
            'yellow': '#ffeb3b'
        };

        Object.entries(data.properties).forEach(([key, value]) => {
            const inputId = `${data.thingId}-${key}`;
            const input = document.getElementById(inputId);

            if (key === 'brightness') {
                const slider = document.getElementById(`${data.thingId}-brightness-slider`);
                const valueSpan = document.getElementById(`${data.thingId}-brightness-value`);
                if (slider) slider.value = value;
                if (valueSpan) valueSpan.textContent = value;
            }
            else if (key === 'targetTemperature') {
                const slider = document.getElementById(`${data.thingId}-targetTemperature-slider`);
                const valueSpan = document.getElementById(`${data.thingId}-targetTemperature-value`);
                if (slider) slider.value = value;
                if (valueSpan) valueSpan.textContent = value;
            }
            else if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value;
                } else if (input.tagName === 'SELECT') {
                    input.value = value;

                    if (key === 'mode') {
                        const targetTempSlider = document.getElementById(`${data.thingId}-targetTemperature-slider`);
                        if (targetTempSlider) {
                            targetTempSlider.disabled = (value !== 'manual');
                        }
                    }
                    if (key === 'color') {
                        const slider = document.getElementById(`${data.thingId}-brightness-slider`);
                        if(slider) {
                            const colorHex = colorMap[value] || '#ffeb3b';
                            slider.style.background = `linear-gradient(to right, #263238, ${colorHex})`;
                        }
                    }
                } else {
                    input.value = value;
                }
            }
        });

        const visual = document.getElementById(`visual-${data.thingId}`);
        if (visual) {
            const type = visual.classList.contains('lamp-device') ? 'lamp' :
                visual.classList.contains('motion-device') ? 'motion' : 'thermostat';

            updateDeviceVisual(data.thingId, type, data.properties);
        }
    }
}

// Update visual representation of devices
function updateDeviceVisual(thingId, type, properties) {
    const visual = document.getElementById(`visual-${thingId}`);
    if (!visual) return;

    if (type === 'lamp') {
        const bulb = visual.querySelector('.lamp-bulb');
        const glow = visual.querySelector('.lamp-glow');

        const brightness = properties.brightness || 0;
        const isEffectivelyOn = properties.on && brightness > 0;

        if (isEffectivelyOn) {
            const colorMap = {
                'white': '#ffffff',
                'red': '#f44336',
                'blue': '#2196f3',
                'green': '#4caf50',
                'yellow': '#ffeb3b'
            };
            const color = colorMap[properties.color] || '#ffeb3b';

            const brightnessFactor = brightness / 100;

            bulb.style.background = `radial-gradient(circle, ${color}, #ffd600)`;
            bulb.style.opacity = 0.3 + (brightnessFactor * 0.7);
            bulb.style.boxShadow = `0 0 ${20 * brightnessFactor}px ${color}`;

            glow.style.opacity = brightnessFactor * 0.7;
            glow.style.background = `radial-gradient(circle, ${color}88, transparent)`;
            visual.classList.add('active');
        } else {
            bulb.style.background = '#555';
            bulb.style.opacity = 1;
            bulb.style.boxShadow = 'inset 0 -5px 10px rgba(0,0,0,0.3)';
            glow.style.opacity = 0;
            visual.classList.remove('active');
        }
    } else if (type === 'motion') {
        if (properties.motion) {
            visual.classList.add('detecting');
            setTimeout(() => visual.classList.remove('detecting'), 2000);
        }
    } else if (type === 'thermostat') {
        const tempDisplay = visual.querySelector('.temp-value');
        const body = visual.querySelector('.thermostat-body');

        if (tempDisplay && properties.currentTemperature !== undefined) {
            tempDisplay.textContent = `${Math.round(properties.currentTemperature)}°`;
        }

        if (properties.mode === 'comfort') {
            body.style.borderColor = '#ff5722';
            body.style.boxShadow = '0 4px 20px rgba(255,87,34,0.3), inset 0 2px 5px rgba(255,255,255,0.8)';
        } else if (properties.mode === 'eco') {
            body.style.borderColor = '#4caf50';
            body.style.boxSizing = '0 4px 20px rgba(76,175,80,0.3), inset 0 2px 5px rgba(255,255,255,0.8)';
        } else {
            body.style.borderColor = '#9e9e9e';
            body.style.boxSizing = '0 4px 20px rgba(0,0,0,0.2), inset 0 2px 5px rgba(255,255,255,0.8)';
        }
    }
}

// Display message to user
function showMsg(msg, isError = false) {
    const el = $('authMsg');
    el.textContent = msg;
    el.className = isError ? 'msg error' : 'msg success';
}

// Auto-login on page load if token exists
token = localStorage.getItem('token');
if (token) {
    api('/things', 'GET', null, () => initApp(), err => {
        if (err === 401) Auth.logout();
        else showMsg('Server error', true);
    });
} else {
    fetchThings();
}

// Handle logout in other tabs
window.addEventListener('storage', (event) => {
    if (event.key === 'token' && event.newValue === null) {
        if (socket?.connected) socket.disconnect();
        token = null;
        location.reload();
    }
});