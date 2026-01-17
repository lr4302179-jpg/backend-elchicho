// server.js - VERSIÓN CON CATEGORÍAS RELACIONALES
// Para: El Chicho Shop
// Fecha: 2025 - Versión 3.0

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'elchicho_secret_key_2024';

// ============================================
// CONFIGURACIÓN POSTGRESQL
// ============================================

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'elchichoshop',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'luis.2005',
  max: 10,
  idleTimeoutMillis: 30000
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
  console.log('📄 Inicializando base de datos...');
  
  try {
    const test = await pool.query('SELECT NOW()');
    console.log('✅ PostgreSQL conectado:', test.rows[0].now);

    // Tabla de categorías
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "categories" creada/verificada');

    // Tabla de subcategorías
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subcategories (
        id SERIAL PRIMARY KEY,
        category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category_id, name)
      )
    `);
    console.log('✅ Tabla "subcategories" creada/verificada');

    // Tabla de productos (NUEVA ESTRUCTURA)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
        price DECIMAL(10, 2) NOT NULL,
        invertido DECIMAL(10, 2) DEFAULT 0,
        description TEXT,
        image_base64 TEXT,
        stock INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'ACTIVO',
        featured BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "products" creada/verificada (con IDs relacionales)');

    // Tabla de admins
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "admins" creada/verificada');

    // Tabla de clientes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(50) DEFAULT 'client',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "clients" creada/verificada');

    // Tabla de ventas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        order_number VARCHAR(100) UNIQUE NOT NULL,
        cart_data JSONB NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        client_name VARCHAR(255),
        client_email VARCHAR(255),
        client_phone VARCHAR(20),
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "sales" creada/verificada');

    // RECREAR ADMIN
    await pool.query("DELETE FROM admins WHERE username = $1", [process.env.ADMIN_USERNAME]);
    
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    
    await pool.query(`
      INSERT INTO admins (username, password_hash, name, email, role)
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
    message: '🚀 El Chicho Shop API v3.0',
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
    const productsCount = await pool.query('SELECT COUNT(*) FROM products');
    
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
      'SELECT id FROM clients WHERE username = $1 OR email = $2',
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
      `INSERT INTO clients (username, password_hash, name, email, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, name, email, phone, role, created_at`,
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
      'SELECT * FROM clients WHERE username = $1 OR email = $1',
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
    const validPassword = await bcrypt.compare(password, client.password_hash);
    
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
        username: client.username,
        name: client.name,
        role: client.role
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
    
    const { password_hash, ...clientData } = client;
    
    console.log('✅ Login de cliente exitoso:', client.username);
    
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
// RUTAS DE PRODUCTOS (PÚBLICAS) - ACTUALIZADAS
// ============================================

// ============================================
// CORRECCIÓN: Endpoint /api/products
// ============================================

// ============================================
// CORRECCIÓN COMPLETA: Endpoint /api/products
// ============================================

app.get("/api/products", async (req, res) => {
  try {
    const { category_id, search, limit = 50 } = req.query;

    // 🔧 QUERY CORREGIDO - Sin el doble '='
    let query = `
      SELECT 
        p.id,
        p.name,
        p.category_id,
        p.subcategory_id,
        p.price,
        p.invertido,
        p.description,
        p.image_base64,
        p.stock,
        p.status,
        p.featured,
        p.created_at,
        p.updated_at,
        c.name AS category_name, 
        s.name AS subcategory_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      WHERE p.status = 'ACTIVO'
    `;

    const params = [];

    if (category_id) {
      params.push(category_id);
      query += ` AND p.category_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }

    query += " ORDER BY p.created_at DESC LIMIT $" + (params.length + 1);
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

// ============================================
// CORRECCIÓN ADICIONAL: Endpoint /api/products/:id
// ============================================

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name AS category_name, s.name AS subcategory_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      WHERE p.id = $1 AND LOWER(p.status) = 'activo'
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

// ============================================
// VERIFICACIÓN ADICIONAL: Status de productos
// ============================================

// Endpoint de debugging para verificar productos en DB
app.get('/api/debug/products', async (req, res) => {
  try {
    const allProducts = await pool.query('SELECT id, name, status FROM products');
    const activeProducts = await pool.query("SELECT id, name, status FROM products WHERE LOWER(status) = 'activo'");
    
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

// ============================================
// CORRECCIÓN ADICIONAL: Endpoint /api/products/:id
// ============================================

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name AS category_name, s.name AS subcategory_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      WHERE p.id = $1 AND LOWER(p.status) = 'activo'
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

// ============================================
// VERIFICACIÓN ADICIONAL: Status de productos
// ============================================

// Endpoint de debugging para verificar productos en DB
app.get('/api/debug/products', async (req, res) => {
  try {
    const allProducts = await pool.query('SELECT id, name, status FROM products');
    const activeProducts = await pool.query("SELECT id, name, status FROM products WHERE LOWER(status) = 'activo'");
    
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

app.get('/api/products/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name AS category_name, s.name AS subcategory_name, LOWER(p.status) AS status
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      WHERE p.id = $1 AND LOWER(p.status) = 'activo'
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
    res.status(500).json({
      success: false,
      message: 'Error obteniendo producto',
      error: error.message
    });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name,
        COUNT(p.id) as product_count,
        ARRAY_AGG(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) 
          FILTER (WHERE s.id IS NOT NULL) as subcategories
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id AND LOWER(p.status) = 'activo'
      LEFT JOIN subcategories s ON s.category_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.name ASC
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
      `INSERT INTO sales (order_number, cart_data, total, client_name, client_email, client_phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        orderNumber,
        JSON.stringify(cart_data),
        parseFloat(total),
        client_name || 'Cliente',
        client_email || '',
        client_phone || '',
        'pending'
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
      'SELECT * FROM admins WHERE username = $1',
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
    const validPassword = await bcrypt.compare(password, admin.password_hash);
    
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
        username: admin.username,
        name: admin.name,
        role: admin.role
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
    
    const { password_hash, ...adminData } = admin;
    
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
      'SELECT id, username, name, email, role FROM admins WHERE id = $1',
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
// RUTAS DE ADMIN - CATEGORÍAS (NUEVAS)
// ============================================

app.get("/api/admin/categories", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.created_at,
        COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
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
      "INSERT INTO categories (name) VALUES ($1) RETURNING *",
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
      "DELETE FROM categories WHERE id = $1 RETURNING *", 
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
// RUTAS DE ADMIN - SUBCATEGORÍAS (NUEVAS)
// ============================================

app.get("/api/admin/categories/:id/subcategories", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM subcategories WHERE category_id = $1 ORDER BY name ASC",
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
      "INSERT INTO subcategories (category_id, name) VALUES ($1, $2) RETURNING *",
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
      "DELETE FROM subcategories WHERE id = $1 RETURNING *", 
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
// RUTAS DE ADMIN - PRODUCTOS (ACTUALIZADAS)
// ============================================

app.get("/api/admin/products", authenticateToken, async (req, res) => {
  try {
    const { category_id, status, search, limit = 100 } = req.query;
    
    let query = `
      SELECT p.*, c.name AS category_name, s.name AS subcategory_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (category_id && category_id !== 'all') {
      params.push(category_id);
      query += ` AND p.category_id = $${params.length}`;
    }
    
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND p.status = $${params.length}`;
    }
    
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }
    
    query += ' ORDER BY p.created_at DESC LIMIT $' + (params.length + 1);
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
      SELECT p.*, c.name AS category_name, s.name AS subcategory_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN subcategories s ON s.id = p.subcategory_id
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
    res.status(500).json({
      success: false,
      message: 'Error obteniendo producto por ID',
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
    
    if (!name || !category_id || !price) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: name, category_id, price'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO products (name, category_id, subcategory_id, price, invertido, description, image_base64, stock, status, featured)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        name, 
        category_id, 
        subcategory_id || null, 
        parseFloat(price),
        parseFloat(invertido) || 0,
        description || null, 
        image_base64 || null, 
        parseInt(stock) || 0,
        (
          status?.toLowerCase() === 'inactivo' 
          || status?.toLowerCase() === 'inactive'
        )
        ? 'inactive'
        : 'ACTIVO',

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
    const { id } = req.params;
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
    
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    const allowedFields = {
    name,
    category_id,
    subcategory_id,
    price,
    invertido,
    description,
    image_base64,
    stock,
    featured,

  // 🔥 CORRECCIÓN AQUÍ MISMO
  status:
    (status?.toLowerCase() === "inactivo" ||
     status?.toLowerCase() === "inactive")
      ? "inactive"
      : "ACTIVO"
};

    
    for (const [field, value] of Object.entries(allowedFields)) {
      if (value !== undefined) {
        fields.push(`${field} = ${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }
    
    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }
    
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    
    const query = `
      UPDATE products 
      SET ${fields.join(', ')}
      WHERE id = ${paramCount}
      RETURNING *
    `;
    
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    console.log('✅ Producto actualizado:', id);
    
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

app.delete('/api/admin/products/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM products WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    console.log('✅ Producto eliminado:', id);
    
    res.json({
      success: true,
      message: 'Producto eliminado',
      data: result.rows[0]
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
// RUTAS DE ADMIN - DASHBOARD
// ============================================

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    const products = await pool.query("SELECT * FROM products");

    let totalInvertido = 0;
    let totalVenta = 0;

    products.rows.forEach(p => {
      const inv = Number(p.invertido) || 0;
      const venta = Number(p.price) || 0;
      const stock = Number(p.stock) || 0;

      totalInvertido += inv * stock;
      totalVenta += venta * stock;
    });

    const sales = await pool.query("SELECT * FROM sales ORDER BY created_at DESC");
    
    let productosVendidos = 0;
    let ingresosTotales = 0;

    sales.rows.forEach(s => {
      ingresosTotales += Number(s.total) || 0;

      const cart = s.cart_data || [];
      cart.forEach(item => {
        productosVendidos += Number(item.quantity) || 0;
      });
    });

    res.json({
      success: true,
      data: {
        totalProductos: products.rows.length,
        productosVendidos,
        totalInvertido,
        valorInventario: totalVenta,
        gananciaPotencial: totalVenta - totalInvertido,
        ingresosTotales,
        ventas: sales.rows.slice(0, 10)
      }
    });

  } catch (error) {
    console.error('Error en /api/admin/dashboard:', error);
    res.status(500).json({
      success: false,
      message: "Error cargando dashboard",
      error: error.message
    });
  }
});

app.get('/api/admin/dashboard/top-products', authenticateToken, async (req, res) => {
  try {
    const sales = await pool.query("SELECT cart_data FROM sales");

    const productos = {};

    sales.rows.forEach(s => {
      (s.cart_data || []).forEach(item => {
        if (!productos[item.id]) {
          productos[item.id] = {
            id: item.id,
            name: item.name,
            quantity: 0
          };
        }
        productos[item.id].quantity += Number(item.quantity);
      });
    });

    const top = Object.values(productos)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    res.json({ success: true, data: top });

  } catch (error) {
    console.error('Error en /api/admin/dashboard/top-products:', error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo top productos",
      error: error.message
    });
  }
});

app.get('/api/admin/dashboard/top-categories', authenticateToken, async (req, res) => {
  try {
    const sales = await pool.query("SELECT cart_data FROM sales");

    const categorias = {};

    sales.rows.forEach(s => {
      (s.cart_data || []).forEach(item => {
        const cat = item.category || "Sin categoría";

        if (!categorias[cat]) categorias[cat] = 0;
        categorias[cat] += Number(item.quantity);
      });
    });

    const sorted = Object.entries(categorias)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    res.json({ success: true, data: sorted });

  } catch (error) {
    console.error('Error en /api/admin/dashboard/top-categories:', error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo categorías",
      error: error.message
    });
  }
});

app.get('/api/admin/dashboard/daily-sales', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DATE(created_at) AS fecha, SUM(total) AS total
      FROM sales
      GROUP BY DATE(created_at)
      ORDER BY fecha DESC
      LIMIT 7
    `);

    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error('Error en /api/admin/dashboard/daily-sales:', error);
    res.status(500).json({
      success: false,
      message: "Error obteniendo ventas diarias",
      error: error.message
    });
  }
});

app.get('/api/admin/sales', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const result = await pool.query(
      'SELECT * FROM sales ORDER BY created_at DESC LIMIT $1',
      [parseInt(limit)]
    );
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('Error en /api/admin/sales:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo ventas',
      error: error.message
    });
  }
});

// ============================================
// MANEJO DE ERRORES
// ============================================

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error('🔥 Error:', err);
  res.status(500).json({
    success: false,
    message: 'Error interno del servidor',
    error: err.message
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║   🚀 EL CHICHO SHOP - BACKEND V3.0 (RELACIONAL)       ║
╚═══════════════════════════════════════════════════════╝

✅ Servidor: http://localhost:${PORT}
🛡️ CORS habilitado para localhost
🔐 JWT configurado

📦 ENDPOINTS PÚBLICOS:
   • GET  /api/products
   • GET  /api/products/:id
   • GET  /api/categories
   • POST /api/sales
   • POST /api/clients/register
   • POST /api/clients/login

🔒 ENDPOINTS ADMIN:
   • POST   /api/admin/login
   • GET    /api/admin/verify
   • GET    /api/admin/categories
   • POST   /api/admin/categories
   • DELETE /api/admin/categories/:id
   • GET    /api/admin/categories/:id/subcategories
   • POST   /api/admin/subcategories
   • DELETE /api/admin/subcategories/:id
   • GET    /api/admin/products
   • POST   /api/admin/products
   • PUT    /api/admin/products/:id
   • DELETE /api/admin/products/:id
   • GET    /api/admin/dashboard
   • GET    /api/admin/sales

🔑 CREDENCIALES (desde .env):
   Usuario: ${process.env.ADMIN_USERNAME}
   Contraseña: ${process.env.ADMIN_PASSWORD}

🎉 ¡Servidor listo!
      `);
    });
    
  } catch (error) {
    console.error('❌ Error crítico:', error);
    process.exit(1);
  }
}

startServer();