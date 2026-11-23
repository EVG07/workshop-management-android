const { CapacitorSQLite } = window.Capacitor.Plugins;
const DB_NAME = 'taller_mecanico_db';
let dbReady = false;

async function iniciarBD() {
  try {
    await CapacitorSQLite.createConnection({
      database: DB_NAME,
      version: 1,
      encrypted: false,
      mode: 'no-encryption'
    });
  } catch (err) {
    // Si la conexión ya existe, continuamos.
    console.warn('createConnection:', err);
  }

  try {
    await CapacitorSQLite.open({ database: DB_NAME });
  } catch (err) {
    console.warn('open:', err);
  }

  await CapacitorSQLite.execute({
    database: DB_NAME,
    statements: 'PRAGMA foreign_keys = ON;'
  });

  const esquemaSQL = `
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      numero TEXT,
      notas TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vehiculos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      marca TEXT NOT NULL,
      modelo TEXT NOT NULL,
      placas TEXT NOT NULL UNIQUE,
      notas TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS servicios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehiculo_id INTEGER NOT NULL,
      servicio TEXT NOT NULL,
      descripcion TEXT,
      costo REAL DEFAULT 0,
      ultima_fecha DATETIME,
      proximo_mantenimiento DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reparaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehiculo_id INTEGER NOT NULL,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      falla TEXT NOT NULL,
      descripcion TEXT,
      costo REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_vehiculos_cliente ON vehiculos(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_servicios_vehiculo ON servicios(vehiculo_id);
    CREATE INDEX IF NOT EXISTS idx_reparaciones_vehiculo ON reparaciones(vehiculo_id);
    CREATE INDEX IF NOT EXISTS idx_servicios_proximo_mantenimiento ON servicios(proximo_mantenimiento);
  `;

  await CapacitorSQLite.execute({ database: DB_NAME, statements: esquemaSQL });
  dbReady = true;
  await cargarTodo();
}

async function esperarBD() {
  if (dbReady) return;
  for (let i = 0; i < 50 && !dbReady; i++) await new Promise(r => setTimeout(r, 50));
  if (!dbReady) throw new Error('La base de datos aún no está disponible.');
}

function normalizar(txt = '') {
  return String(txt).trim();
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function query(statement, values = []) {
  await esperarBD();
  return CapacitorSQLite.query({ database: DB_NAME, statement, values });
}

async function run(statement, values = []) {
  await esperarBD();
  return CapacitorSQLite.run({ database: DB_NAME, statement, values });
}

// =========================
// CLIENTES - CRUD COMPLETO
// =========================
async function agregarCliente(nombre, numero = '', notas = '') {
  nombre = normalizar(nombre);
  if (!nombre) throw new Error('El nombre del cliente es obligatorio.');
  await run(
    'INSERT INTO clientes (nombre, numero, notas) VALUES (?, ?, ?);',
    [nombre, normalizar(numero), normalizar(notas)]
  );
  await cargarTodo();
}

async function obtenerClientes(busqueda = '') {
  const q = `%${normalizar(busqueda)}%`;
  const res = await query(
    `SELECT id, nombre, numero, notas, created_at
     FROM clientes
     WHERE nombre LIKE ? OR numero LIKE ? OR notas LIKE ?
     ORDER BY nombre COLLATE NOCASE ASC, id DESC;`,
    [q, q, q]
  );
  return res.values || [];
}

async function obtenerCliente(id) {
  const res = await query('SELECT * FROM clientes WHERE id = ? LIMIT 1;', [Number(id)]);
  return (res.values || [])[0] || null;
}

async function actualizarCliente(id, nombre, numero = '', notas = '') {
  nombre = normalizar(nombre);
  if (!nombre) throw new Error('El nombre del cliente es obligatorio.');
  await run(
    'UPDATE clientes SET nombre = ?, numero = ?, notas = ? WHERE id = ?;',
    [nombre, normalizar(numero), normalizar(notas), Number(id)]
  );
  await cargarTodo();
}

async function eliminarCliente(id) {
  const cliente = await obtenerCliente(id);
  if (!cliente) throw new Error('Cliente no encontrado.');
  await run('DELETE FROM clientes WHERE id = ?;', [Number(id)]);
  await cargarTodo();
}

// =========================
// VEHÍCULOS - CRUD COMPLETO
// =========================
async function agregarVehiculo(clienteId, marca, modelo, placas, notas = '') {
  clienteId = Number(clienteId);
  marca = normalizar(marca);
  modelo = normalizar(modelo);
  placas = normalizar(placas).toUpperCase();

  if (!clienteId || !marca || !modelo || !placas) {
    throw new Error('Cliente, marca, modelo y placas son obligatorios.');
  }

  await run(
    `INSERT INTO vehiculos (cliente_id, marca, modelo, placas, notas)
     VALUES (?, ?, ?, ?, ?);`,
    [clienteId, marca, modelo, placas, normalizar(notas)]
  );
  await cargarTodo();
}

async function obtenerVehiculos(busqueda = '') {
  const q = `%${normalizar(busqueda)}%`;
  const res = await query(
    `SELECT v.id, v.cliente_id, v.marca, v.modelo, v.placas, v.notas,
            c.nombre AS cliente_nombre, c.numero AS cliente_numero
     FROM vehiculos v
     INNER JOIN clientes c ON c.id = v.cliente_id
     WHERE v.marca LIKE ? OR v.modelo LIKE ? OR v.placas LIKE ?
        OR v.notas LIKE ? OR c.nombre LIKE ? OR c.numero LIKE ?
     ORDER BY v.id DESC;`,
    [q, q, q, q, q, q]
  );
  return res.values || [];
}

async function obtenerVehiculo(id) {
  const res = await query(
    `SELECT v.*, c.nombre AS cliente_nombre, c.numero AS cliente_numero
     FROM vehiculos v
     INNER JOIN clientes c ON c.id = v.cliente_id
     WHERE v.id = ? LIMIT 1;`,
    [Number(id)]
  );
  return (res.values || [])[0] || null;
}

async function actualizarVehiculo(id, clienteId, marca, modelo, placas, notas = '') {
  clienteId = Number(clienteId);
  marca = normalizar(marca);
  modelo = normalizar(modelo);
  placas = normalizar(placas).toUpperCase();

  if (!clienteId || !marca || !modelo || !placas) {
    throw new Error('Cliente, marca, modelo y placas son obligatorios.');
  }

  await run(
    `UPDATE vehiculos
     SET cliente_id = ?, marca = ?, modelo = ?, placas = ?, notas = ?
     WHERE id = ?;`,
    [clienteId, marca, modelo, placas, normalizar(notas), Number(id)]
  );
  await cargarTodo();
}

async function eliminarVehiculo(id) {
  const vehiculo = await obtenerVehiculo(id);
  if (!vehiculo) throw new Error('Vehículo no encontrado.');
  await run('DELETE FROM vehiculos WHERE id = ?;', [Number(id)]);
  await cargarTodo();
}

async function listarClientesParaSelector(busqueda = '') {
  return obtenerClientes(busqueda);
}

async function listarVehiculosConCliente(busqueda = '') {
  return obtenerVehiculos(busqueda);
}

// =========================
// SERVICIOS - se conserva el CRUD existente
// =========================
async function agregarServicio(vehiculoId, servicio, descripcion, costo, ultimaFecha, proximaFecha) {
  await run(
    `INSERT INTO servicios (vehiculo_id, servicio, descripcion, costo, ultima_fecha, proximo_mantenimiento)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [Number(vehiculoId), normalizar(servicio), normalizar(descripcion), Number(costo) || 0, ultimaFecha || null, proximaFecha || null]
  );
}

// =========================
// RENDER / UI
// =========================
async function cargarTodo() {
  try {
    await refrescarClientes();
    await refrescarVehiculos();
    await refrescarSelectoresClientes();
  } catch (err) {
    console.error('Error al cargar información:', err);
  }
}

async function refrescarClientes() {
  const busqueda = document.getElementById('buscarClientes')?.value || '';
  const lista = document.getElementById('listaClientes');
  if (!lista) return;

  const clientes = await obtenerClientes(busqueda);
  if (!clientes.length) {
    lista.innerHTML = '<li class="empty">No hay clientes que coincidan.</li>';
    return;
  }

  lista.innerHTML = clientes.map(c => `
    <li class="item-card">
      <div>
        <strong>${escapeHtml(c.nombre)}</strong>
        <small>${escapeHtml(c.numero || 'Sin teléfono')}</small>
        ${c.notas ? `<small>${escapeHtml(c.notas)}</small>` : ''}
      </div>
      <span class="tag">ID ${c.id}</span>
    </li>
  `).join('');
}

async function refrescarVehiculos() {
  const busqueda = document.getElementById('buscarVehiculos')?.value || '';
  const lista = document.getElementById('listaVehiculos');
  if (!lista) return;

  const vehiculos = await obtenerVehiculos(busqueda);
  if (!vehiculos.length) {
    lista.innerHTML = '<li class="empty">No hay vehículos que coincidan.</li>';
    return;
  }

  lista.innerHTML = vehiculos.map(v => `
    <li class="item-card">
      <div>
        <strong>${escapeHtml(v.marca)} ${escapeHtml(v.modelo)}</strong>
        <small>Placas: <code>${escapeHtml(v.placas)}</code></small>
        <small>Dueño: ${escapeHtml(v.cliente_nombre)}${v.cliente_numero ? ' · ' + escapeHtml(v.cliente_numero) : ''}</small>
        ${v.notas ? `<small>${escapeHtml(v.notas)}</small>` : ''}
      </div>
      <span class="tag">ID ${v.id}</span>
    </li>
  `).join('');
}

async function refrescarSelectoresClientes() {
  const selects = [document.getElementById('fClienteSelect'), document.getElementById('eClienteSelect')].filter(Boolean);
  const clientes = await obtenerClientes('');
  selects.forEach(sel => {
    const current = sel.value;
    sel.innerHTML = '<option value="">Selecciona un cliente...</option>' +
      clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}${c.numero ? ' · ' + escapeHtml(c.numero) : ''}</option>`).join('');
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  });
  const hint = document.getElementById('sinClientesHint');
  if (hint) hint.style.display = clientes.length ? 'none' : 'block';
}

async function buscarClientesParaAsignar() {
  const input = document.getElementById('buscarClienteAsignar');
  const list = document.getElementById('resultadosClientesAsignar');
  const select = document.getElementById('fClienteSelect');
  if (!input || !list || !select) return;

  const clientes = await obtenerClientes(input.value);
  list.innerHTML = clientes.map(c => `
    <button type="button" class="search-result" data-id="${c.id}">
      <strong>${escapeHtml(c.nombre)}</strong>
      <span>${escapeHtml(c.numero || 'Sin teléfono')}</span>
    </button>
  `).join('') || '<div class="search-empty">Sin resultados.</div>';

  list.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      select.value = btn.dataset.id;
      input.value = btn.querySelector('strong').textContent;
      list.innerHTML = '';
    });
  });
}

async function cargarClienteEdicion(id) {
  const c = await obtenerCliente(id);
  if (!c) throw new Error('Cliente no encontrado.');
  document.getElementById('eClienteId').value = c.id;
  document.getElementById('eNombre').value = c.nombre || '';
  document.getElementById('eNumero').value = c.numero || '';
  document.getElementById('eNotas').value = c.notas || '';
  document.getElementById('clienteEdicionPanel').style.display = 'block';
}

async function cargarVehiculoEdicion(id) {
  const v = await obtenerVehiculo(id);
  if (!v) throw new Error('Vehículo no encontrado.');
  await refrescarSelectoresClientes();
  document.getElementById('eVehiculoId').value = v.id;
  document.getElementById('eClienteSelect').value = String(v.cliente_id);
  document.getElementById('eMarca').value = v.marca || '';
  document.getElementById('eModelo').value = v.modelo || '';
  document.getElementById('ePlacas').value = v.placas || '';
  document.getElementById('eVehiculoNotas').value = v.notas || '';
  document.getElementById('vehiculoEdicionPanel').style.display = 'block';
}

window.listarClientesParaSelector = listarClientesParaSelector;
window.agregarCliente = agregarCliente;
window.agregarVehiculo = agregarVehiculo;
window.agregarServicio = agregarServicio;
window.listarVehiculosConCliente = listarVehiculosConCliente;
window.actualizarCliente = actualizarCliente;
window.actualizarVehiculo = actualizarVehiculo;
window.eliminarCliente = eliminarCliente;
window.eliminarVehiculo = eliminarVehiculo;
window.obtenerCliente = obtenerCliente;
window.obtenerVehiculo = obtenerVehiculo;

window.addEventListener('DOMContentLoaded', () => {
  iniciarBD().catch(err => {
    console.error('Error al inicializar BD:', err);
    window.showToast?.('No se pudo inicializar SQLite', true);
  });
});
