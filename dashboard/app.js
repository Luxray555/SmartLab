const API_URL = 'http://localhost:3000';
let socket, token = null;

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelector(sel);

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
        api('/users', 'POST', { username: u, password: p }, () => {
            this.login();
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
        localStorage.removeItem('token');
        token = null;
        location.reload();
    }
};

function api(path, method, body, success) {
    fetch(`${API_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: body ? JSON.stringify(body) : null
    })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(data => success(data))
        .catch(err => showMsg(err === 401 ? 'Invalid credentials' : 'Server error', true));
}

function initApp() {
    $('auth').classList.add('hidden');
    $('app').classList.remove('hidden');
    initSocket();
    fetchThings();
}

function initSocket() {
    socket = io(API_URL, { auth: { token } });
    socket.on('things:list', renderThings);
    socket.on('thing:registered', fetchThings);
    socket.on('thing:updated', updateThing);
}

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

function renderThings(things) {
    const unique = {};
    things.forEach(t => { if (!unique[t.type]) unique[t.type] = t; });

    $('things').innerHTML = Object.values(unique).map(t => `
    <div class="thing">
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
          <button onclick="Thing.action('${t.id}', 'turnOn')">Turn On</button>
          <button onclick="Thing.action('${t.id}', 'turnOff')">Turn Off</button>
          <button onclick="Thing.action('${t.id}', 'setMode', {mode: 'eco'})">Eco Mode</button>
          <button onclick="Thing.action('${t.id}', 'setMode', {mode: 'comfort'})">Comfort Mode</button>
        ` : ''}
      </div>
      ` : ''}
    </div>
  `).join('');

    Object.values(unique).forEach(async t => {
        try {
            const res = await fetch(`${t.endpoint}/properties`);
            const props = await res.json();
            renderProperties(t.id, t.type, props);
        } catch (err) {
            console.error(`Failed to fetch properties for ${t.name}:`, err);
        }
    });
}

function renderProperties(thingId, thingType, properties) {
    const el = document.getElementById(`props-${thingId}`);
    if (!el) return;

    const readOnlyNumbers = ['currentTemperature', 'targetTemperature'];

    const propertyInputs = Object.entries(properties).map(([key, value]) => {
        const inputType = typeof value === 'boolean' ? 'checkbox' :
            typeof value === 'number' ? 'number' : 'text';
        const inputValue = typeof value === 'boolean' ? (value ? 'checked' : '') :
            `value="${value}"`;

        const isNumberReadonly = inputType === 'number' && readOnlyNumbers.includes(key);

        return `
        <div class="property-row">
            <label>${key}:</label>
            ${token ? `
                ${inputType === 'checkbox' ? `
                    <input type="checkbox" 
                           id="${thingId}-${key}" 
                           ${inputValue}
                           disabled>
                ` : inputType === 'number' ? `
                    <input type="number" 
                           id="${thingId}-${key}" 
                           ${inputValue}
                           step="0.1"
                           ${isNumberReadonly ? 'readonly' : `onchange="Thing.updateProperty('${thingId}', '${key}', parseFloat(this.value), '${thingType}')"`}>
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
                        <option value="off" ${value === 'off' ? 'selected' : ''}>Off</option>
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

function updateThing(data) {
    if (data.properties) {
        Object.entries(data.properties).forEach(([key, value]) => {
            const inputId = `${data.thingId}-${key}`;
            const input = document.getElementById(inputId);

            if (input) {
                if (input.type === 'checkbox') {
                    input.checked = value;
                } else if (input.tagName === 'SELECT') {
                    input.value = value;
                } else {
                    input.value = value;
                }
            }
        });
    }
}

function showMsg(msg, isError = false) {
    const el = $('authMsg');
    el.textContent = msg;
    el.className = isError ? 'msg error' : 'msg success';
}

token = localStorage.getItem('token');
if (token) {
    api('/things', 'GET', null, () => initApp());
} else {
    fetchThings();
}