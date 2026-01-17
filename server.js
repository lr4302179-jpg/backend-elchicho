// server.js - VERSIÓN COMPLETA EN ESPAÑOL
// Para: El Chicho Shop
// Fecha: 2025 - Versión 4.0 (Todo en español)

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

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token no proporcionado'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }
    req.user = user;
    next();
  });
}

// ============================================
// INICIALIZACIÓN DE BASE DE DATOS
// ============================================

async function initDatabase() {
  console.log('🔄 Inicializando base de datos...');
  
  try {
    const test = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL conectado:', test.rows[0].now);

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

    // Tabla de admins
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(100) UNIQUE NOT NULL,
        contrasena_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        correo VARCHAR(255) NOT NULL,
        rol VARCHAR(50) DEFAULT 'admin',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "admins" creada/verificada');

    // Tabla de clientes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        usuario VARCHAR(100) UNIQUE NOT NULL,
        contrasena_hash VARCHAR(255) NOT NULL,
        nombre VARCHAR(255) NOT NULL,
        correo VARCHAR(255) UNIQUE NOT NULL,
        telefono VARCHAR(20),
        rol VARCHAR(50) DEFAULT 'client',
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

    // RECREAR ADMIN
    await pool.query("DELETE FROM admins WHERE usuario = $1", [process.env.ADMIN_USERNAME]);
    
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    
    await pool.query(`
      INSERT INTO admins (usuario, contrasena_hash, nombre, correo, rol)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      process.env.ADMIN_USERNAME,
      hashedPassword,
      'Administrador Principal',
      process.env.ADMIN_EMAIL,
      'admin'
    ]);
    
    console.log('✅ Administrador recreado desde .env');
    console.log('👤 Usuario:', process.env.ADMIN_USERNAME);
    console.log('🔐 Contraseña:', process.env.ADMIN_PASSWORD);
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
    message: '🚀 El Chicho Shop API v4.0',
    status: 'Operativo',
    env: process.env.NODE_ENV,
    endpoints: {
      public: {
        health: 'GET /api/health',
        products: 'GET /api/products',
        productById: 'GET /api/products/:id',
        categories: 'GET /api/categories',
        createSale: 'POST /api/sales',
        clientRegister: 'POST /api/clients/register',
        clientLogin: 'POST /api/clients/login'
      },
      admin: {
        login: 'POST /api/admin/login',
        verify: 'GET /api/admin/verify',
        categories: 'GET /api/admin/categories',
        createCategory: 'POST /api/admin/categories',
        deleteCategory: 'DELETE /api/admin/categories/:id',
        subcategories: 'GET /api/admin/categories/:id/subcategories',
        createSubcategory: 'POST /api/admin/subcategories',
        deleteSubcategory: 'DELETE /api/admin/subcategories/:id',
        products: 'GET /api/admin/products',
        createProduct: 'POST /api/admin/products',
        updateProduct: 'PUT /api/admin/products/:id',
        deleteProduct: 'DELETE /api/admin/products/:id',
        dashboard: 'GET /api/admin/dashboard',
        sales: 'GET /api/admin/sales'
      }
    }
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const dbTest = await pool.query('SELECT NOW()');
    const productsCount = await pool.query('SELECT COUNT(*) FROM productos');
    
    res.json({
      success: true,
      message: '✅ Servidor funcionando',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        time: dbTest.rows[0].now,
        products: parseInt(productsCount.rows[0].count)
      },
      env: {
        node_env: process.env.NODE_ENV,
        port: PORT,
        db_name: process.env.DB_NAME
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error de conexión',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE CLIENTES - REGISTRO Y LOGIN
// ============================================

app.post('/api/clients/register', async (req, res) => {
  try {
    console.log('📝 Intento de registro de cliente:', req.body.username);
    
    const { username, password, name, email, phone } = req.body;
    
    if (!username || !password || !name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: username, password, name, email'
      });
    }
    
    const existingUser = await pool.query(
      'SELECT id FROM clientes WHERE usuario = $1 OR correo = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El usuario o correo ya está registrado'
      });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      `INSERT INTO clientes (usuario, contrasena_hash, nombre, correo, telefono, rol)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, usuario, nombre, correo, telefono, rol, fecha_creacion`,
      [username, hashedPassword, name, email, phone || null, 'client']
    );
    
    console.log('✅ Cliente registrado:', result.rows[0].id);
    
    res.status(201).json({
      success: true,
      message: 'Cliente registrado exitosamente',
      data: {
        user: result.rows[0]
      }
    });
    
  } catch (error) {
    console.error('❌ Error en registro de cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar cliente',
      error: error.message
    });
  }
});

app.post('/api/clients/login', async (req, res) => {
  try {
    console.log('🔐 Intento de login de cliente:', req.body.identifier);
    
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario/email y contraseña requeridos'
      });
    }
    
    const result = await pool.query(
      'SELECT * FROM clientes WHERE usuario = $1 OR correo = $1',
      [identifier]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Cliente no encontrado:', identifier);
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    const client = result.rows[0];
    const validPassword = await bcrypt.compare(password, client.contrasena_hash);
    
    if (!validPassword) {
      console.log('❌ Contraseña incorrecta para:', identifier);
      return res.status(401).json({
        success: false,
        message: 'Contraseña incorrecta'
      });
    }
    
    const token = jwt.sign(
      {
        userId: client.id,
        username: client.usuario,
        name: client.nombre,
        role: client.rol
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
    
    const { contrasena_hash, ...clientData } = client;
    
    console.log('✅ Login de cliente exitoso:', client.usuario);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token: token,
        user: clientData
      }
    });
    
  } catch (error) {
    console.error('❌ Error en login de cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE PRODUCTOS (PÚBLICAS)
// ============================================

app.get("/api/products", async (req, res) => {
  try {
    const { category_id, search, limit = 50 } = req.query;

    let query = `
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

    const params = [];

    if (category_id) {
      params.push(category_id);
      query += ` AND p.categoria_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.nombre ILIKE $${params.length} OR p.descripcion ILIKE $${params.length})`;
    }

    query += " ORDER BY p.fecha_creacion DESC LIMIT $" + (params.length + 1);
    params.push(parseInt(limit));

    console.log('📦 Ejecutando query de productos:', query);
    console.log('📦 Parámetros:', params);

    const result = await pool.query(query, params);
    
    console.log(`✅ Productos encontrados: ${result.rows.length}`);
    
    res.json({ 
      success: true, 
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('❌ Error en /api/products:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo productos',
      error: error.message
    });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.nombre AS nombre_categoria, s.nombre AS nombre_subcategoria
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
      WHERE p.id = $1 AND LOWER(p.estado) = 'activo'
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo producto',
      error: error.message
    });
  }
});

app.get('/api/debug/products', async (req, res) => {
  try {
    const allProducts = await pool.query('SELECT id, nombre, estado FROM productos');
    const activeProducts = await pool.query("SELECT id, nombre, estado FROM productos WHERE LOWER(estado) = 'activo'");
    
    res.json({
      success: true,
      total: allProducts.rows.length,
      active: activeProducts.rows.length,
      allProducts: allProducts.rows,
      activeProducts: activeProducts.rows
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
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
      success: true,
      data: result.rows
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error obteniendo categorías',
      error: error.message
    });
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    console.log('💰 Creando venta:', req.body);
    
    const { cart_data, total, client_name, client_email, client_phone } = req.body;
    
    if (!cart_data || !Array.isArray(cart_data) || cart_data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Carrito vacío'
      });
    }
    
    if (!total || total <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Total inválido'
      });
    }
    
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    const result = await pool.query(
      `INSERT INTO ventas (numero_orden, datos_carrito, total, nombre_cliente, correo_cliente, telefono_cliente, estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        orderNumber,
        JSON.stringify(cart_data),
        parseFloat(total),
        client_name || 'Cliente',
        client_email || '',
        client_phone || '',
        'pendiente'
      ]
    );
    
    console.log('✅ Venta creada:', result.rows[0].id);
    
    res.status(201).json({
      success: true,
      message: 'Venta registrada',
      data: {
        saleId: result.rows[0].id,
        orderNumber: orderNumber,
        total: parseFloat(total)
      }
    });
    
  } catch (error) {
    console.error('❌ Error en venta:', error);
    res.status(500).json({
      success: false,
      message: 'Error registrando venta',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - AUTENTICACIÓN
// ============================================

app.post('/api/admin/login', async (req, res) => {
  try {
    console.log('🔐 Intento de login admin:', req.body.username);
    
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Usuario y contraseña requeridos'
      });
    }
    
    const result = await pool.query(
      'SELECT * FROM admins WHERE usuario = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Admin no encontrado:', username);
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    const admin = result.rows[0];
    const validPassword = await bcrypt.compare(password, admin.contrasena_hash);
    
    if (!validPassword) {
      console.log('❌ Contraseña incorrecta para admin:', username);
      return res.status(401).json({
        success: false,
        message: 'Contraseña incorrecta'
      });
    }
    
    const token = jwt.sign(
      {
        userId: admin.id,
        username: admin.usuario,
        name: admin.nombre,
        role: admin.rol
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
    
    const { contrasena_hash, ...adminData } = admin;
    
    console.log('✅ Login admin exitoso:', username);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      token: token,
      admin: adminData
    });
    
  } catch (error) {
    console.error('❌ Error en login admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error en el servidor',
      error: error.message
    });
  }
});

app.get('/api/admin/verify', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, usuario, nombre, correo, rol FROM admins WHERE id = $1',
      [req.user.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Sesión inválida'
      });
    }
    
    res.json({
      success: true,
      admin: result.rows[0]
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verificando sesión',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - CATEGORÍAS
// ============================================

app.get("/api/admin/categories", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.nombre, c.fecha_creacion,
        COUNT(p.id) AS cantidad_productos
      FROM categorias c
      LEFT JOIN productos p ON p.categoria_id = c.id
      GROUP BY c.id
      ORDER BY c.nombre ASC
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo categorías',
      error: error.message
    });
  }
});

app.post("/api/admin/categories", authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de la categoría es requerido'
      });
    }
    
    const result = await pool.query(
      "INSERT INTO categorias (nombre) VALUES ($1) RETURNING *",
      [name]
    );
    
    console.log('✅ Categoría creada:', result.rows[0].id);
    
    res.status(201).json({ 
      success: true, 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creando categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando categoría',
      error: error.message
    });
  }
});

app.delete("/api/admin/categories/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM categorias WHERE id = $1 RETURNING *", 
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Categoría no encontrada'
      });
    }
    
    console.log('✅ Categoría eliminada:', req.params.id);
    
    res.json({ 
      success: true, 
      message: "Categoría eliminada" 
    });
  } catch (error) {
    console.error('Error eliminando categoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando categoría',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - SUBCATEGORÍAS
// ============================================

app.get("/api/admin/categories/:id/subcategories", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM subcategorias WHERE categoria_id = $1 ORDER BY nombre ASC",
      [req.params.id]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error obteniendo subcategorías:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo subcategorías',
      error: error.message
    });
  }
});

app.post("/api/admin/subcategories", authenticateToken, async (req, res) => {
  try {
    const { category_id, name } = req.body;
    
    if (!category_id || !name) {
      return res.status(400).json({
        success: false,
        message: 'category_id y name son requeridos'
      });
    }
    
    const result = await pool.query(
      "INSERT INTO subcategorias (categoria_id, nombre) VALUES ($1, $2) RETURNING *",
      [category_id, name]
    );
    
    console.log('✅ Subcategoría creada:', result.rows[0].id);
    
    res.status(201).json({ 
      success: true, 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error('Error creando subcategoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando subcategoría',
      error: error.message
    });
  }
});

app.delete("/api/admin/subcategories/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM subcategorias WHERE id = $1 RETURNING *", 
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subcategoría no encontrada'
      });
    }
    
    console.log('✅ Subcategoría eliminada:', req.params.id);
    
    res.json({ 
      success: true, 
      message: "Subcategoría eliminada" 
    });
  } catch (error) {
    console.error('Error eliminando subcategoría:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando subcategoría',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - PRODUCTOS
// ============================================

app.get("/api/admin/products", authenticateToken, async (req, res) => {
  try {
    const { category_id, status, search, limit = 100 } = req.query;
    
    let query = `
      SELECT p.*, c.nombre AS nombre_categoria, s.nombre AS nombre_subcategoria
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (category_id && category_id !== 'all') {
      params.push(category_id);
      query += ` AND p.categoria_id = $${params.length}`;
    }
    
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND p.estado = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.nombre ILIKE $${params.length} OR p.descripcion ILIKE $${params.length})`;
    }
    
    query += ' ORDER BY p.fecha_creacion DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    
    res.json({ 
      success: true, 
      data: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Error obteniendo productos admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo productos',
      error: error.message
    });
  }
});

app.get('/api/admin/products/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.nombre AS nombre_categoria, s.nombre AS nombre_subcategoria
      FROM productos p
      LEFT JOIN categorias c ON c.id = p.categoria_id
      LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
      WHERE p.id = $1
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo producto',
      error: error.message
    });
  }
});

app.post("/api/admin/products", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      category_id,
      subcategory_id,
      price,
      invertido,
      description,
      image_base64,
      stock,
      status,
      featured
    } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({
        success: false,
        message: 'Nombre y precio son requeridos'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO productos (
        nombre, categoria_id, subcategoria_id, precio, invertido,
        descripcion, imagen_base64, stock, estado, destacado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        name,
        category_id || null,
        subcategory_id || null,
        parseFloat(price),
        parseFloat(invertido) || 0,
        description || '',
        image_base64 || null,
        parseInt(stock) || 0,
        status || 'ACTIVO',
        featured || false
      ]
    );
    
    console.log('✅ Producto creado:', result.rows[0].id);
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando producto',
      error: error.message
    });
  }
});

app.put("/api/admin/products/:id", authenticateToken, async (req, res) => {
  try {
    const {
      name,
      category_id,
      subcategory_id,
      price,
      invertido,
      description,
      image_base64,
      stock,
      status,
      featured
    } = req.body;
    
    const result = await pool.query(
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
        name,
        category_id,
        subcategory_id,
        price ? parseFloat(price) : null,
        invertido !== undefined ? parseFloat(invertido) : null,
        description,
        image_base64,
        stock !== undefined ? parseInt(stock) : null,
        status,
        featured,
        req.params.id
      ]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    console.log('✅ Producto actualizado:', req.params.id);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando producto',
      error: error.message
    });
  }
});

app.delete("/api/admin/products/:id", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM productos WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    console.log('✅ Producto eliminado:', req.params.id);
    
    res.json({
      success: true,
      message: 'Producto eliminado'
    });
    
  } catch (error) {
    console.error('Error eliminando producto:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando producto',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - DASHBOARD Y VENTAS
// ============================================

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    const totalProducts = await pool.query('SELECT COUNT(*) FROM productos');
    const activeProducts = await pool.query("SELECT COUNT(*) FROM productos WHERE LOWER(estado) = 'activo'");
    const totalCategories = await pool.query('SELECT COUNT(*) FROM categorias');
    const totalSales = await pool.query('SELECT COUNT(*), SUM(total) FROM ventas');
    const recentSales = await pool.query(
      'SELECT * FROM ventas ORDER BY fecha_creacion DESC LIMIT 10'
    );
    
    res.json({
      success: true,
      data: {
        productos_totales: parseInt(totalProducts.rows[0].count),
        productos_activos: parseInt(activeProducts.rows[0].count),
        categorias_totales: parseInt(totalCategories.rows[0].count),
        ventas_totales: parseInt(totalSales.rows[0].count || 0),
        ventas_monto_total: parseFloat(totalSales.rows[0].sum || 0),
        ventas_recientes: recentSales.rows
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo datos del dashboard',
      error: error.message
    });
  }
});

app.get('/api/admin/sales', authenticateToken, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;
    
    let query = 'SELECT * FROM ventas WHERE 1=1';
    const params = [];
    
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND estado = $${params.length}`;
    }
    
    query += ' ORDER BY fecha_creacion DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Error obteniendo ventas:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo ventas',
      error: error.message
    });
  }
});

app.get('/api/admin/sales/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ventas WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error obteniendo venta:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo venta',
      error: error.message
    });
  }
});

app.put('/api/admin/sales/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Estado requerido'
      });
    }
    
    const result = await pool.query(
      'UPDATE ventas SET estado = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Venta no encontrada'
      });
    }
    
    console.log('✅ Venta actualizada:', req.params.id);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
    
  } catch (error) {
    console.error('Error actualizando venta:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando venta',
      error: error.message
    });
  }
});

// ============================================
// MANEJO DE ERRORES 404
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.url
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

async function startServer() {
  const dbInitialized = await initDatabase();
  
  if (!dbInitialized) {
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
    console.log(`🗄️  Base de datos: PostgreSQL conectado`);
    console.log(`⏰ Iniciado: ${new Date().toLocaleString()}`);
    console.log('='.repeat(50));
    console.log('');
  });
}

startServer();