// server.js - VERSIÓN COMPLETA EN ESPAÑOL
// Para: El Chicho Shop
// Fecha: 2025 - Versión 5.0 (TODO en español - Base de datos incluida)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'elchicho_secret_key_2024';

// ============================================
// CONFIGURACIÓN POSTGRESQL
// ============================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Error inesperado en PostgreSQL:', err);
});

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logger
app.use((req, res, next) => {
  console.log(`🔥 ${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
  next();
});

// ============================================
// MIDDLEWARE DE AUTENTICACIÓN
// ============================================

function autenticarToken(req, res, next) {
  const cabeceraAuth = req.headers['authorization'];
  const token = cabeceraAuth && cabeceraAuth.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      exito: false,
      mensaje: 'Token no proporcionado'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, usuario) => {
    if (err) {
      return res.status(403).json({
        exito: false,
        mensaje: 'Token inválido o expirado'
      });
    }
    req.usuario = usuario;
    next();
  });
}

// ============================================
// INICIALIZACIÓN DE BASE DE DATOS
// ============================================

async function inicializarBaseDatos() {
  console.log('🔄 Inicializando base de datos...');
  
  try {
    const prueba = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL conectado:', prueba.rows[0].now);

    // Tabla de categorías
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "categorias" creada/verificada');

    // Tabla de subcategorías
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subcategorias (
        id SERIAL PRIMARY KEY,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
        nombre TEXT NOT NULL,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "subcategorias" creada/verificada');

    // Tabla de productos
    await pool.query(`
      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
        subcategoria_id INTEGER REFERENCES subcategorias(id) ON DELETE SET NULL,
        precio DECIMAL(10, 2) NOT NULL,
        invertido DECIMAL(10, 2) DEFAULT 0,
        descripcion TEXT,
        imagen_base64 TEXT,
        stock INTEGER DEFAULT 0,
        estado VARCHAR(20) DEFAULT 'ACTIVO',
        destacado BOOLEAN DEFAULT false,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "productos" creada/verificada');

    // Tabla de administradores
    await pool.query(`
      CREATE TABLE IF NOT EXISTS administradores (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(100) UNIQUE NOT NULL,
        contrasena_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        correo VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'admin',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "administradores" creada/verificada');

    // Tabla de clientes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(100) UNIQUE NOT NULL,
        contrasena_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        correo VARCHAR(255) UNIQUE NOT NULL,
        telefono VARCHAR(20),
        rol VARCHAR(50) DEFAULT 'cliente',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "clientes" creada/verificada');

    // Tabla de ventas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ventas (
        id SERIAL PRIMARY KEY,
        numero_orden VARCHAR(100) UNIQUE NOT NULL,
        datos_carrito JSONB NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        nombre_cliente VARCHAR(255),
        correo_cliente VARCHAR(255),
        telefono_cliente VARCHAR(20),
        estado VARCHAR(50) DEFAULT 'pendiente',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "ventas" creada/verificada');

    // RECREAR ADMINISTRADOR
    await pool.query("DELETE FROM administradores WHERE usuario = $1", [process.env.ADMIN_USERNAME]);
    
    const contrasenaHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    
    await pool.query(`
      INSERT INTO administradores (usuario, contrasena_hash, nombre, correo, rol)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      process.env.ADMIN_USERNAME,
      contrasenaHash,
      'Administrador Principal',
      process.env.ADMIN_EMAIL,
      'admin'
    ]);
    
    console.log('✅ Administrador recreado desde .env');
    console.log('👤 Usuario:', process.env.ADMIN_USERNAME);
    console.log('🔑 Contraseña:', process.env.ADMIN_PASSWORD);
    console.log('🎉 Base de datos inicializada correctamente\n');
    
    return true;

  } catch (error) {
    console.error('❌ Error en inicialización:', error.message);
    return false;
  }
}

// ============================================
// RUTAS PÚBLICAS
// ============================================

app.get('/', (req, res) => {
  res.json({
    mensaje: '🚀 El Chicho Shop API v5.0',
    estado: 'Operativo',
    entorno: process.env.NODE_ENV,
    endpoints: {
      publicos: {
        salud: 'GET /api/salud',
        productos: 'GET /api/productos',
        productoPorId: 'GET /api/productos/:id',
        categorias: 'GET /api/categorias',
        crearVenta: 'POST /api/ventas',
        registroCliente: 'POST /api/clientes/registro',
        loginCliente: 'POST /api/clientes/login'
      },
      admin: {
        login: 'POST /api/admin/login',
        verificar: 'GET /api/admin/verificar',
        categorias: 'GET /api/admin/categorias',
        crearCategoria: 'POST /api/admin/categorias',
        eliminarCategoria: 'DELETE /api/admin/categorias/:id',
        subcategorias: 'GET /api/admin/categorias/:id/subcategorias',
        crearSubcategoria: 'POST /api/admin/subcategorias',
        eliminarSubcategoria: 'DELETE /api/admin/subcategorias/:id',
        productos: 'GET /api/admin/productos',
        crearProducto: 'POST /api/admin/productos',
        actualizarProducto: 'PUT /api/admin/productos/:id',
        eliminarProducto: 'DELETE /api/admin/productos/:id',
        tablero: 'GET /api/admin/tablero',
        ventas: 'GET /api/admin/ventas'
      }
    }
  });
});

app.get('/api/salud', async (req, res) => {
  try {
    const pruebaDb = await pool.query('SELECT NOW()');
    const cantidadProductos = await pool.query('SELECT COUNT(*) FROM productos');
    
    res.json({
      exito: true,
      mensaje: '✅ Servidor funcionando',
      marca_tiempo: new Date().toISOString(),
      base_datos: {
        conectada: true,
        hora: pruebaDb.rows[0].now,
        productos: parseInt(cantidadProductos.rows[0].count)
      },
      entorno: {
        node_env: process.env.NODE_ENV,
        puerto: PORT,
        nombre_bd: process.env.DB_NAME
      }
    });
  } catch (error) {
    res.status(500).json({
      exito: false,
      mensaje: 'Error de conexión',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE CLIENTES - REGISTRO Y LOGIN
// ============================================

app.post('/api/clientes/registro', async (req, res) => {
  try {
    console.log('📝 Intento de registro de cliente:', req.body.usuario);
    
    const { usuario, contrasena, nombre, correo, telefono } = req.body;
    
    if (!usuario || !contrasena || !nombre || !correo) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Campos requeridos: usuario, contrasena, nombre, correo'
      });
    }
    
    const usuarioExistente = await pool.query(
      'SELECT id FROM clientes WHERE usuario = $1 OR correo = $2',
      [usuario, correo]
    );
    
    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'El usuario o correo ya está registrado'
      });
    }
    
    const contrasenaHash = await bcrypt.hash(contrasena, 10);
    
    const resultado = await pool.query(
      `INSERT INTO clientes (usuario, contrasena_hash, nombre, correo, telefono, rol)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, usuario, nombre, correo, telefono, rol, fecha_creacion`,
      [usuario, contrasenaHash, nombre, correo, telefono || null, 'cliente']
    );
    
    console.log('✅ Cliente registrado:', resultado.rows[0].id);
    
    res.status(201).json({
      exito: true,
      mensaje: 'Cliente registrado exitosamente',
      datos: {
        usuario: resultado.rows[0]
      }
    });
    
  } catch (error) {
    console.error('❌ Error en registro de cliente:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error al registrar cliente',
      error: error.message
    });
  }
});

app.post('/api/clientes/login', async (req, res) => {
  try {
    console.log('🔐 Intento de login de cliente:', req.body.identificador);
    
    const { identificador, contrasena } = req.body;
    
    if (!identificador || !contrasena) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Usuario/email y contraseña requeridos'
      });
    }
    
    const resultado = await pool.query(
      'SELECT * FROM clientes WHERE usuario = $1 OR correo = $1',
      [identificador]
    );
    
    if (resultado.rows.length === 0) {
      console.log('❌ Cliente no encontrado:', identificador);
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario no encontrado'
      });
    }
    
    const cliente = resultado.rows[0];
    const contrasenaValida = await bcrypt.compare(contrasena, cliente.contrasena_hash);
    
    if (!contrasenaValida) {
      console.log('❌ Contraseña incorrecta para:', identificador);
      return res.status(401).json({
        exito: false,
        mensaje: 'Contraseña incorrecta'
      });
    }
    
    const token = jwt.sign(
      {
        idUsuario: cliente.id,
        usuario: cliente.usuario,
        nombre: cliente.nombre,
        rol: cliente.rol
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
    
    const { contrasena_hash, ...datosCliente } = cliente;
    
    console.log('✅ Login de cliente exitoso:', cliente.usuario);
    
    res.json({
      exito: true,
      mensaje: 'Login exitoso',
      datos: {
        token: token,
        usuario: datosCliente
      }
    });
    
  } catch (error) {
    console.error('❌ Error en login de cliente:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error en el servidor',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE PRODUCTOS (PÚBLICAS)
// ============================================

app.get("/api/productos", async (req, res) => {
  try {
    const { categoria_id, buscar, limite = 50 } = req.query;

    let consulta = `
      SELECT 
        p.id,
        p.nombre,
        p.categoria_id,
        p.subcategoria_id,
        p.precio,
        p.invertido,
        p.descripcion,
        p.imagen_base64,
        p.stock,
        p.estado,
        p.destacado,
        p.fecha_creacion,
        p.fecha_actualizacion,
        c.nombre AS nombre_categoria, 
        s.nombre AS nombre_subcategoria
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
      WHERE p.estado = 'ACTIVO'
    `;

    const parametros = [];

    if (categoria_id) {
      parametros.push(categoria_id);
      consulta += ` AND p.categoria_id = $${parametros.length}`;
    }

    if (buscar) {
      parametros.push(`%${buscar}%`);
      consulta += ` AND (p.nombre ILIKE $${parametros.length} OR p.descripcion ILIKE $${parametros.length})`;
    }

    consulta += " ORDER BY p.fecha_creacion DESC LIMIT $" + (parametros.length + 1);
    parametros.push(parseInt(limite));

    console.log('📦 Ejecutando consulta de productos:', consulta);
    console.log('📦 Parámetros:', parametros);

    const resultado = await pool.query(consulta, parametros);
    
    console.log(`✅ Productos encontrados: ${resultado.rows.length}`);
    
    res.json({ 
      exito: true, 
      datos: resultado.rows,
      cantidad: resultado.rows.length
    });

  } catch (error) {
    console.error('❌ Error en /api/productos:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo productos',
      error: error.message
    });
  }
});

app.get('/api/productos/:id', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT p.*, c.nombre AS nombre_categoria, s.nombre AS nombre_subcategoria
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
      WHERE p.id = $1 AND LOWER(p.estado) = 'activo'
    `, [req.params.id]);
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Producto no encontrado'
      });
    }
    
    res.json({
      exito: true,
      datos: resultado.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo producto:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo producto',
      error: error.message
    });
  }
});

app.get('/api/categorias', async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT 
        c.id,
        c.nombre,
        COUNT(p.id) as cantidad_productos,
        ARRAY_AGG(DISTINCT jsonb_build_object('id', s.id, 'nombre', s.nombre)) 
          FILTER (WHERE s.id IS NOT NULL) as subcategorias
      FROM categorias c
      LEFT JOIN productos p ON p.categoria_id = c.id AND LOWER(p.estado) = 'activo'
      LEFT JOIN subcategorias s ON s.categoria_id = c.id
      GROUP BY c.id, c.nombre
      ORDER BY c.nombre ASC
    `);
    
    res.json({
      exito: true,
      datos: resultado.rows
    });
    
  } catch (error) {
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo categorías',
      error: error.message
    });
  }
});

app.post('/api/ventas', async (req, res) => {
  try {
    console.log('💰 Creando venta:', req.body);
    
    const { datos_carrito, total, nombre_cliente, correo_cliente, telefono_cliente } = req.body;
    
    if (!datos_carrito || !Array.isArray(datos_carrito) || datos_carrito.length === 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Carrito vacío'
      });
    }
    
    if (!total || total <= 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Total inválido'
      });
    }
    
    const numeroOrden = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const resultado = await pool.query(
      `INSERT INTO ventas (numero_orden, datos_carrito, total, nombre_cliente, correo_cliente, telefono_cliente, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        numeroOrden,
        JSON.stringify(datos_carrito),
        parseFloat(total),
        nombre_cliente || 'Cliente',
        correo_cliente || '',
        telefono_cliente || '',
        'pendiente'
      ]
    );
    
    console.log('✅ Venta creada:', resultado.rows[0].id);
    
    res.status(201).json({
      exito: true,
      mensaje: 'Venta registrada',
      datos: {
        idVenta: resultado.rows[0].id,
        numeroOrden: numeroOrden,
        total: parseFloat(total)
      }
    });
    
  } catch (error) {
    console.error('❌ Error en venta:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error registrando venta',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - AUTENTICACIÓN
// ============================================

app.post('/api/admin/login', async (req, res) => {
  try {
    console.log('🔐 Intento de login admin:', req.body.usuario);
    
    const { usuario, contrasena } = req.body;
    
    if (!usuario || !contrasena) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Usuario y contraseña requeridos'
      });
    }
    
    const resultado = await pool.query(
      'SELECT * FROM administradores WHERE usuario = $1',
      [usuario]
    );
    
    if (resultado.rows.length === 0) {
      console.log('❌ Admin no encontrado:', usuario);
      return res.status(401).json({
        exito: false,
        mensaje: 'Usuario no encontrado'
      });
    }
    
    const admin = resultado.rows[0];
    const contrasenaValida = await bcrypt.compare(contrasena, admin.contrasena_hash);
    
    if (!contrasenaValida) {
      console.log('❌ Contraseña incorrecta para admin:', usuario);
      return res.status(401).json({
        exito: false,
        mensaje: 'Contraseña incorrecta'
      });
    }
    
    const token = jwt.sign(
      {
        idUsuario: admin.id,
        usuario: admin.usuario,
        nombre: admin.nombre,
        rol: admin.rol
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
    
    const { contrasena_hash, ...datosAdmin } = admin;
    
    console.log('✅ Login admin exitoso:', usuario);
    
    res.json({
      exito: true,
      mensaje: 'Login exitoso',
      token: token,
      admin: datosAdmin
    });
    
  } catch (error) {
    console.error('❌ Error en login admin:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error en el servidor',
      error: error.message
    });
  }
});

app.get('/api/admin/verificar', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT id, usuario, nombre, correo, rol FROM administradores WHERE id = $1',
      [req.usuario.idUsuario]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Sesión inválida'
      });
    }
    
    res.json({
      exito: true,
      admin: resultado.rows[0]
    });
    
  } catch (error) {
    res.status(500).json({
      exito: false,
      mensaje: 'Error verificando sesión',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - CATEGORÍAS
// ============================================

app.get("/api/admin/categorias", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT c.id, c.nombre, c.fecha_creacion,
        COUNT(p.id) AS cantidad_productos
      FROM categorias c
      LEFT JOIN productos p ON p.categoria_id = c.id
      GROUP BY c.id
      ORDER BY c.nombre ASC
    `);
    
    res.json({ exito: true, datos: resultado.rows });
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo categorías',
      error: error.message
    });
  }
});

app.post("/api/admin/categorias", autenticarToken, async (req, res) => {
  try {
    const { nombre } = req.body;
    
    if (!nombre) {
      return res.status(400).json({
        exito: false,
        mensaje: 'El nombre de la categoría es requerido'
      });
    }
    
    const resultado = await pool.query(
      "INSERT INTO categorias (nombre) VALUES ($1) RETURNING *",
      [nombre]
    );
    
    console.log('✅ Categoría creada:', resultado.rows[0].id);
    
    res.status(201).json({ 
      exito: true, 
      datos: resultado.rows[0] 
    });
  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error creando categoría',
      error: error.message
    });
  }
});

app.delete("/api/admin/categorias/:id", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      "DELETE FROM categorias WHERE id = $1 RETURNING *", 
      [req.params.id]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Categoría no encontrada'
      });
    }
    
    console.log('✅ Categoría eliminada:', req.params.id);
    
    res.json({ 
      exito: true, 
      mensaje: "Categoría eliminada" 
    });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error eliminando categoría',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - SUBCATEGORÍAS
// ============================================

app.get("/api/admin/categorias/:id/subcategorias", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      "SELECT * FROM subcategorias WHERE categoria_id = $1 ORDER BY nombre ASC",
      [req.params.id]
    );
    
    res.json({ exito: true, datos: resultado.rows });
  } catch (error) {
    console.error('Error obteniendo subcategorías:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo subcategorías',
      error: error.message
    });
  }
});

app.post("/api/admin/subcategorias", autenticarToken, async (req, res) => {
  try {
    const { categoria_id, nombre } = req.body;
    
    if (!categoria_id || !nombre) {
      return res.status(400).json({
        exito: false,
        mensaje: 'categoria_id y nombre son requeridos'
      });
    }
    
    const resultado = await pool.query(
      "INSERT INTO subcategorias (categoria_id, nombre) VALUES ($1, $2) RETURNING *",
      [categoria_id, nombre]
    );
    
    console.log('✅ Subcategoría creada:', resultado.rows[0].id);
    
    res.status(201).json({ 
      exito: true, 
      datos: resultado.rows[0] 
    });
  } catch (error) {
    console.error('Error creando subcategoría:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error creando subcategoría',
      error: error.message
    });
  }
});

app.delete("/api/admin/subcategorias/:id", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      "DELETE FROM subcategorias WHERE id = $1 RETURNING *", 
      [req.params.id]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Subcategoría no encontrada'
      });
    }
    
    console.log('✅ Subcategoría eliminada:', req.params.id);
    
    res.json({ 
      exito: true, 
      mensaje: "Subcategoría eliminada" 
    });
  } catch (error) {
    console.error('Error eliminando subcategoría:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error eliminando subcategoría',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - PRODUCTOS
// ============================================

app.get("/api/admin/productos", autenticarToken, async (req, res) => {
  try {
    const { categoria_id, estado, buscar, limite = 100 } = req.query;
    
    let consulta = `
      SELECT p.*, c.nombre AS nombre_categoria, s.nombre AS nombre_subcategoria
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
      WHERE 1=1
    `;
    
    const parametros = [];
    
    if (categoria_id && categoria_id !== 'all') {
      parametros.push(categoria_id);
      consulta += ` AND p.categoria_id = $${parametros.length}`;
    }
    
    if (estado && estado !== 'all') {
      parametros.push(estado);
      consulta += ` AND p.estado = $${parametros.length}`;
    }
    
    if (buscar) {
      parametros.push(`%${buscar}%`);
      consulta += ` AND (p.nombre ILIKE $${parametros.length} OR p.descripcion ILIKE $${parametros.length})`;
    }
    
    consulta += ' ORDER BY p.fecha_creacion DESC LIMIT $' + (parametros.length + 1);
    parametros.push(parseInt(limite));
    
    const resultado = await pool.query(consulta, parametros);
    
    res.json({ 
      exito: true, 
      datos: resultado.rows,
      cantidad: resultado.rows.length
    });
    
  } catch (error) {
    console.error('Error obteniendo productos admin:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo productos',
      error: error.message
    });
  }
});

app.get('/api/admin/productos/:id', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT p.*, c.nombre AS nombre_categoria, s.nombre AS nombre_subcategoria
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
      WHERE p.id = $1
    `, [req.params.id]);
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Producto no encontrado'
      });
    }
    
    res.json({
      exito: true,
      datos: resultado.rows[0]
    });
    
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo producto',
      error: error.message
    });
  }
});

app.post("/api/admin/productos", autenticarToken, async (req, res) => {
  try {
    const {
      nombre,
      categoria_id,
      subcategoria_id,
      precio,
      invertido,
      descripcion,
      imagen_base64,
      stock,
      estado,
      destacado
    } = req.body;
    
    if (!nombre || !precio) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Nombre y precio son requeridos'
      });
    }
    
    const resultado = await pool.query(
      `INSERT INTO productos (
        nombre, categoria_id, subcategoria_id, precio, invertido,
        descripcion, imagen_base64, stock, estado, destacado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        nombre,
        categoria_id || null,
        subcategoria_id || null,
        parseFloat(precio),
        parseFloat(invertido) || 0,
        descripcion || '',
        imagen_base64 || null,
        parseInt(stock) || 0,
        estado || 'ACTIVO',
        destacado || false
      ]
    );
    
    console.log('✅ Producto creado:', resultado.rows[0].id);
    
    res.status(201).json({
      exito: true,
      datos: resultado.rows[0]
    });
    
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error creando producto',
      error: error.message
    });
  }
});

app.put("/api/admin/productos/:id", autenticarToken, async (req, res) => {
  try {
    const {
      nombre,
      categoria_id,
      subcategoria_id,
      precio,
      invertido,
      descripcion,
      imagen_base64,
      stock,
      estado,
      destacado
    } = req.body;
    
    const resultado = await pool.query(
      `UPDATE productos SET
        nombre = COALESCE($1, nombre),
        categoria_id = COALESCE($2, categoria_id),
        subcategoria_id = COALESCE($3, subcategoria_id),
        precio = COALESCE($4, precio),
        invertido = COALESCE($5, invertido),
        descripcion = COALESCE($6, descripcion),
        imagen_base64 = COALESCE($7, imagen_base64),
        stock = COALESCE($8, stock),
        estado = COALESCE($9, estado),
        destacado = COALESCE($10, destacado),
        fecha_actualizacion = CURRENT_TIMESTAMP
      WHERE id = $11
      RETURNING *`,
      [
        nombre,
        categoria_id,
        subcategoria_id,
        precio ? parseFloat(precio) : null,
        invertido !== undefined ? parseFloat(invertido) : null,
        descripcion,
        imagen_base64,
        stock !== undefined ? parseInt(stock) : null,
        estado,
        destacado,
        req.params.id
      ]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Producto no encontrado'
      });
    }
    
    console.log('✅ Producto actualizado:', req.params.id);
    
    res.json({
      exito: true,
      datos: resultado.rows[0]
    });
    
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error actualizando producto',
      error: error.message
    });
  }
});

app.delete("/api/admin/productos/:id", autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      "DELETE FROM productos WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Producto no encontrado'
      });
    }
    
    console.log('✅ Producto eliminado:', req.params.id);
    
    res.json({
      exito: true,
      mensaje: 'Producto eliminado'
    });
    
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error eliminando producto',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - TABLERO Y VENTAS
// ============================================

app.get('/api/admin/tablero', autenticarToken, async (req, res) => {
  try {
    const totalProductos = await pool.query('SELECT COUNT(*) FROM productos');
    const productosActivos = await pool.query("SELECT COUNT(*) FROM productos WHERE LOWER(estado) = 'activo'");
    const totalCategorias = await pool.query('SELECT COUNT(*) FROM categorias');
    const totalVentas = await pool.query('SELECT COUNT(*), SUM(total) FROM ventas');
    const ventasRecientes = await pool.query(
      'SELECT * FROM ventas ORDER BY fecha_creacion DESC LIMIT 10'
    );
    
    res.json({
      exito: true,
      datos: {
        productos_totales: parseInt(totalProductos.rows[0].count),
        productos_activos: parseInt(productosActivos.rows[0].count),
        categorias_totales: parseInt(totalCategorias.rows[0].count),
        ventas_totales: parseInt(totalVentas.rows[0].count || 0),
        ventas_monto_total: parseFloat(totalVentas.rows[0].sum || 0),
        ventas_recientes: ventasRecientes.rows
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo tablero:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo datos del tablero',
      error: error.message
    });
  }
});

app.get('/api/admin/ventas', autenticarToken, async (req, res) => {
  try {
    const { estado, limite = 50 } = req.query;
    
    let consulta = 'SELECT * FROM ventas WHERE 1=1';
    const parametros = [];
    
    if (estado && estado !== 'all') {
      parametros.push(estado);
      consulta += ` AND estado = ${parametros.length}`;
    }
    
    consulta += ' ORDER BY fecha_creacion DESC LIMIT $' + (parametros.length + 1);
    parametros.push(parseInt(limite));
    
    const resultado = await pool.query(consulta, parametros);
    
    res.json({
      exito: true,
      datos: resultado.rows,
      cantidad: resultado.rows.length
    });
    
  } catch (error) {
    console.error('Error obteniendo ventas:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo ventas',
      error: error.message
    });
  }
});

app.get('/api/admin/ventas/:id', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM ventas WHERE id = $1',
      [req.params.id]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Venta no encontrada'
      });
    }
    
    res.json({
      exito: true,
      datos: resultado.rows[0]
    });
    
  } catch (error) {
    console.error('Error obteniendo venta:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo venta',
      error: error.message
    });
  }
});

app.put('/api/admin/ventas/:id', autenticarToken, async (req, res) => {
  try {
    const { estado } = req.body;
    
    if (!estado) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Estado requerido'
      });
    }
    
    const resultado = await pool.query(
      'UPDATE ventas SET estado = $1 WHERE id = $2 RETURNING *',
      [estado, req.params.id]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Venta no encontrada'
      });
    }
    
    console.log('✅ Venta actualizada:', req.params.id);
    
    res.json({
      exito: true,
      datos: resultado.rows[0]
    });
    
  } catch (error) {
    console.error('Error actualizando venta:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error actualizando venta',
      error: error.message
    });
  }
});

// ============================================
// MANEJO DE ERRORES 404
// ============================================

app.use((req, res) => {
  res.status(404).json({
    exito: false,
    mensaje: 'Ruta no encontrada',
    ruta: req.url
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

async function iniciarServidor() {
  const bdInicializada = await inicializarBaseDatos();
  
  if (!bdInicializada) {
    console.error('❌ No se pudo inicializar la base de datos');
    process.exit(1);
  }
  
  app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('🚀 EL CHICHO SHOP - SERVIDOR INICIADO');
    console.log('='.repeat(50));
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Base de datos: PostgreSQL conectado`);
    console.log(`⏰ Iniciado: ${new Date().toLocaleString()}`);
    console.log('='.repeat(50));
    console.log('');
  });
}

iniciarServidor();