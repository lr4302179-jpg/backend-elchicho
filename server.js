// server.js - VERSIÓN COMPLETA CON SOPORTE PARA ARCHIVOS ESTÁTICOS
// Para: El Chicho Shop
// Fecha: 2025 - Versión 5.3 (CON FRONTEND)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
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
// SERVIR ARCHIVOS ESTÁTICOS (FRONTEND)
// ============================================

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Ruta raíz - sirve el login
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.htm'));
});

// Rutas específicas del panel admin (opcional, ya que express.static las maneja)
app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/products.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'products.html'));
});

app.get('/edit-product.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'edit-product.html'));
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
        direccion TEXT,
        ciudad VARCHAR(100),
        pais VARCHAR(100),
        activo BOOLEAN DEFAULT true,
        rol VARCHAR(50) DEFAULT 'cliente',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ultima_sesion TIMESTAMP
      )
    `);
    console.log('✅ Tabla "clientes" creada/verificada');

    // MIGRACIÓN: Agregar columna ultima_sesion si no existe
    try {
      await pool.query(`
        ALTER TABLE clientes 
        ADD COLUMN IF NOT EXISTS ultima_sesion TIMESTAMP
      `);
      console.log('✅ Columna "ultima_sesion" verificada/agregada');
    } catch (error) {
      console.log('ℹ️ Columna ultima_sesion ya existe o error menor:', error.message);
    }

    // Tabla de ventas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ventas (
        id SERIAL PRIMARY KEY,
        numero_orden VARCHAR(100) UNIQUE NOT NULL,
        cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        datos_carrito JSONB NOT NULL,
        total DECIMAL(10, 2) NOT NULL,
        nombre_cliente VARCHAR(255),
        correo_cliente VARCHAR(255),
        telefono_cliente VARCHAR(20),
        direccion_envio TEXT,
        estado VARCHAR(50) DEFAULT 'pendiente',
        metodo_pago VARCHAR(50),
        notas TEXT,
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabla "ventas" creada/verificada');

    // Insertar categorías predeterminadas
    const categoriasExistentes = await pool.query('SELECT COUNT(*) FROM categorias');
    
    if (parseInt(categoriasExistentes.rows[0].count) === 0) {
      console.log('📂 Creando categorías predeterminadas...');
      
      const electroResult = await pool.query(
        "INSERT INTO categorias (nombre) VALUES ($1) RETURNING id",
        ['Electrodomésticos']
      );
      const electroId = electroResult.rows[0].id;
      
      await pool.query(
        "INSERT INTO subcategorias (categoria_id, nombre) VALUES ($1, $2), ($1, $3), ($1, $4), ($1, $5)",
        [electroId, 'Cocina', 'Limpieza', 'Climatización', 'Entretenimiento']
      );
      
      const ropaResult = await pool.query(
        "INSERT INTO categorias (nombre) VALUES ($1) RETURNING id",
        ['Ropa']
      );
      const ropaId = ropaResult.rows[0].id;
      
      await pool.query(
        "INSERT INTO subcategorias (categoria_id, nombre) VALUES ($1, $2), ($1, $3), ($1, $4), ($1, $5)",
        [ropaId, 'Hombres', 'Mujeres', 'Calzado', 'Accesorios']
      );
      
      await pool.query("INSERT INTO categorias (nombre) VALUES ($1)", ['Otros']);
      
      console.log('✅ Categorías creadas');
    }

    // Recrear administrador
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
    
    console.log('✅ Administrador recreado');
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
// RUTAS API - PRODUCTOS PÚBLICOS
// ============================================

app.get('/api/productos', async (req, res) => {
  try {
    const { categoria_id, buscar, limite = 100, destacado } = req.query;
    
    let query = `
      SELECT 
        p.id,
        p.nombre,
        p.precio,
        p.descripcion,
        p.imagen_base64,
        p.stock,
        p.estado,
        p.destacado,
        c.nombre AS nombre_categoria
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.estado = 'ACTIVO'
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (categoria_id) {
      query += ` AND p.categoria_id = $${paramIndex}`;
      params.push(categoria_id);
      paramIndex++;
    }
    
    if (destacado === 'true') {
      query += ` AND p.destacado = true`;
    }
    
    if (buscar) {
      query += ` AND LOWER(p.nombre) LIKE LOWER($${paramIndex})`;
      params.push(`%${buscar}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY p.fecha_creacion DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limite));
    
    const resultado = await pool.query(query, params);
    
    res.json({
      exito: true,
      datos: resultado.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo productos',
      error: error.message
    });
  }
});

app.get('/api/productos/:id', async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT 
        p.*,
        c.nombre AS nombre_categoria,
        s.nombre AS nombre_subcategoria
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
      WHERE p.id = $1`,
      [req.params.id]
    );
    
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

// ============================================
// RUTAS API - CATEGORÍAS PÚBLICAS
// ============================================

app.get('/api/categorias', async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM categorias ORDER BY nombre'
    );
    
    res.json({
      exito: true,
      datos: resultado.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo categorías',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - PRODUCTOS
// ============================================

app.get('/api/admin/productos', autenticarToken, async (req, res) => {
  try {
    const { categoria_id, estado, buscar, limite = 500 } = req.query;
    
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
        c.nombre AS nombre_categoria,
        s.nombre AS nombre_subcategoria
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (categoria_id && categoria_id !== 'all') {
      query += ` AND p.categoria_id = $${paramIndex}`;
      params.push(categoria_id);
      paramIndex++;
    }
    
    if (estado && estado !== 'all') {
      if (estado.toLowerCase() === 'active') {
        query += ` AND UPPER(p.estado) = 'ACTIVO'`;
      } else if (estado.toLowerCase() === 'inactive') {
        query += ` AND UPPER(p.estado) = 'INACTIVO'`;
      }
    }
    
    if (buscar) {
      query += ` AND LOWER(p.nombre) LIKE LOWER($${paramIndex})`;
      params.push(`%${buscar}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY p.fecha_creacion DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limite));
    
    const resultado = await pool.query(query, params);
    
    res.json({
      exito: true,
      datos: resultado.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo productos:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo productos',
      error: error.message
    });
  }
});

app.get('/api/admin/productos/:id', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT 
        p.*,
        c.nombre AS nombre_categoria,
        s.nombre AS nombre_subcategoria
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
      WHERE p.id = $1`,
      [req.params.id]
    );
    
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

app.post('/api/admin/productos', autenticarToken, async (req, res) => {
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
      `INSERT INTO productos 
        (nombre, categoria_id, subcategoria_id, precio, invertido, descripcion, imagen_base64, stock, estado, destacado)
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
      mensaje: 'Producto creado exitosamente',
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

app.put('/api/admin/productos/:id', autenticarToken, async (req, res) => {
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
    
    let query = `
      UPDATE productos SET
        nombre = COALESCE($1, nombre),
        categoria_id = COALESCE($2, categoria_id),
        subcategoria_id = COALESCE($3, subcategoria_id),
        precio = COALESCE($4, precio),
        invertido = COALESCE($5, invertido),
        descripcion = COALESCE($6, descripcion),
        stock = COALESCE($7, stock),
        estado = COALESCE($8, estado),
        destacado = COALESCE($9, destacado),
        fecha_actualizacion = CURRENT_TIMESTAMP
    `;
    
    const params = [
      nombre,
      categoria_id,
      subcategoria_id,
      precio ? parseFloat(precio) : null,
      invertido !== undefined ? parseFloat(invertido) : null,
      descripcion,
      parseInt(stock) || null,
      estado,
      destacado
    ];
    
    if (imagen_base64) {
      query += `, imagen_base64 = $10 WHERE id = $11 RETURNING *`;
      params.push(imagen_base64, req.params.id);
    } else {
      query += ` WHERE id = $10 RETURNING *`;
      params.push(req.params.id);
    }
    
    const resultado = await pool.query(query, params);
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Producto no encontrado'
      });
    }
    
    console.log('✅ Producto actualizado:', req.params.id);
    
    res.json({
      exito: true,
      mensaje: 'Producto actualizado exitosamente',
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

app.delete('/api/admin/productos/:id', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM productos WHERE id = $1 RETURNING id, nombre',
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
      mensaje: 'Producto eliminado exitosamente'
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
// RUTAS DE ADMIN - CATEGORÍAS
// ============================================

app.get('/api/admin/categorias', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM categorias ORDER BY nombre'
    );
    
    res.json({
      exito: true,
      datos: resultado.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo categorías',
      error: error.message
    });
  }
});

app.get('/api/admin/categorias/:id/subcategorias', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT * FROM subcategorias WHERE categoria_id = $1 ORDER BY nombre',
      [req.params.id]
    );
    
    res.json({
      exito: true,
      datos: resultado.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo subcategorías:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo subcategorías',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - DASHBOARD
// ============================================

app.get('/api/admin/dashboard', autenticarToken, async (req, res) => {
  try {
    const statsQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_productos,
        COALESCE(SUM(invertido * stock), 0) as total_invertido,
        COALESCE(SUM(precio * stock), 0) as valor_inventario,
        COALESCE(SUM((precio - invertido) * stock), 0) as ganancia_potencial
      FROM productos
      WHERE estado = 'ACTIVO'
    `);
    
    const stats = statsQuery.rows[0];
    
    res.json({
      success: true,
      data: {
        totalProductos: parseInt(stats.total_productos),
        totalInvertido: parseFloat(stats.total_invertido),
        valorInventario: parseFloat(stats.valor_inventario),
        gananciaPotencial: parseFloat(stats.ganancia_potencial)
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo estadísticas',
      error: error.message
    });
  }
});

app.get('/api/admin/dashboard/top-products', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT 
        p.id,
        p.nombre as name,
        COALESCE(SUM(
          CAST((v.datos_carrito::jsonb -> 'items' ->> 'quantity') AS INTEGER)
        ), 0) as quantity
      FROM productos p
      LEFT JOIN ventas v ON v.datos_carrito::jsonb @> jsonb_build_array(jsonb_build_object('product_id', p.id))
      GROUP BY p.id, p.nombre
      ORDER BY quantity DESC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      data: resultado.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo productos top:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

app.get('/api/admin/dashboard/top-categories', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT 
        c.nombre as category_name,
        COUNT(DISTINCT p.id) as product_count,
        COALESCE(SUM(p.stock), 0) as total_stock
      FROM categorias c
      LEFT JOIN productos p ON p.categoria_id = c.id
      WHERE p.estado = 'ACTIVO'
      GROUP BY c.id, c.nombre
      ORDER BY product_count DESC
      LIMIT 5
    `);
    
    res.json({
      success: true,
      data: resultado.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo categorías top:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

app.get('/api/admin/dashboard/daily-sales', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT 
        DATE(fecha_creacion) as date,
        COUNT(*) as orders,
        SUM(total) as total_sales
      FROM ventas
      WHERE fecha_creacion >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(fecha_creacion)
      ORDER BY date DESC
    `);
    
    res.json({
      success: true,
      data: resultado.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo ventas diarias:', error);
    res.json({
      success: true,
      data: []
    });
  }
});

// ============================================
// RUTAS DE CLIENTES - REGISTRO Y LOGIN
// ============================================

app.post('/api/clientes/registro', async (req, res) => {
  try {
    const { usuario, contrasena, nombre, correo, telefono, direccion, ciudad, pais } = req.body;
    
    if (!usuario || !contrasena || !nombre || !correo) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Usuario, contraseña, nombre y correo son requeridos'
      });
    }
    
    const usuarioExistente = await pool.query(
      'SELECT id FROM clientes WHERE usuario = $1 OR correo = $2',
      [usuario, correo]
    );
    
    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({
        exito: false,
        mensaje: 'El usuario o correo ya están registrados'
      });
    }
    
    const contrasenaHash = await bcrypt.hash(contrasena, 10);
    
    const resultado = await pool.query(
      `INSERT INTO clientes 
        (usuario, contrasena_hash, nombre, correo, telefono, direccion, ciudad, pais)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, usuario, nombre, correo, telefono, direccion, ciudad, pais, rol, fecha_creacion`,
      [usuario, contrasenaHash, nombre, correo, telefono || null, direccion || null, ciudad || null, pais || null]
    );
    
    const token = jwt.sign(
      {
        idUsuario: resultado.rows[0].id,
        usuario: resultado.rows[0].usuario,
        rol: 'cliente'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('✅ Cliente registrado:', resultado.rows[0].id);
    
    res.status(201).json({
      exito: true,
      mensaje: 'Cliente registrado exitosamente',
      datos: {
        token: token,
        cliente: resultado.rows[0]
      }
    });
    
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error en el registro',
      error: error.message
    });
  }
});

app.post('/api/clientes/login', async (req, res) => {
  try {
    const { usuario, contrasena } = req.body;
    
    if (!usuario || !contrasena) {
      return res.status(400).json({
        exito: false,
        mensaje: 'Usuario y contraseña requeridos'
      });
    }
    
    const resultado = await pool.query(
      'SELECT * FROM clientes WHERE usuario = $1 AND activo = true',
      [usuario]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Credenciales inválidas'
      });
    }
    
    const cliente = resultado.rows[0];
    const contrasenaValida = await bcrypt.compare(contrasena, cliente.contrasena_hash);
    
    if (!contrasenaValida) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Credenciales inválidas'
      });
    }
    
    await pool.query(
      'UPDATE clientes SET ultima_sesion = CURRENT_TIMESTAMP WHERE id = $1',
      [cliente.id]
    );
    
    const token = jwt.sign(
      {
        idUsuario: cliente.id,
        usuario: cliente.usuario,
        nombre: cliente.nombre,
        rol: 'cliente'
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const { contrasena_hash, ...datosCliente } = cliente;
    
    res.json({
      exito: true,
      mensaje: 'Login exitoso',
      datos: {
        token: token,
        cliente: datosCliente
      }
    });
    
  } catch (error) {
    console.error('Error en login cliente:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error en el servidor',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - GESTIÓN DE CLIENTES
// ============================================

app.get('/api/admin/clientes', autenticarToken, async (req, res) => {
  try {
    const { buscar, limite = 100, activo } = req.query;
    
    let query = `
      SELECT 
        id, usuario, nombre, correo, telefono, direccion, 
        ciudad, pais, activo, rol, fecha_creacion, ultima_sesion
      FROM clientes
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (activo !== undefined) {
      query += ` AND activo = $${paramIndex}`;
      params.push(activo === 'true');
      paramIndex++;
    }
    
    if (buscar) {
      query += ` AND (
        LOWER(nombre) LIKE LOWER($${paramIndex}) OR 
        LOWER(usuario) LIKE LOWER($${paramIndex}) OR 
        LOWER(correo) LIKE LOWER($${paramIndex})
      )`;
      params.push(`%${buscar}%`);
      paramIndex++;
    }
    
    query += ` ORDER BY fecha_creacion DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limite));
    
    const resultado = await pool.query(query, params);
    
    res.json({
      exito: true,
      datos: resultado.rows
    });
    
  } catch (error) {
    console.error('Error obteniendo clientes:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo clientes',
      error: error.message
    });
  }
});

app.get('/api/admin/clientes/:id', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT 
        id, usuario, nombre, correo, telefono, direccion, 
        ciudad, pais, activo, rol, fecha_creacion, ultima_sesion
      FROM clientes 
      WHERE id = $1`,
      [req.params.id]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Cliente no encontrado'
      });
    }
    
    res.json({
      exito: true,
      datos: resultado.rows[0]
    });
    
  } catch (error) {
    console.error('Error obteniendo cliente:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error obteniendo cliente',
      error: error.message
    });
  }
});

app.put('/api/admin/clientes/:id', autenticarToken, async (req, res) => {
  try {
    const { nombre, correo, telefono, direccion, ciudad, pais, activo } = req.body;
    
    const resultado = await pool.query(
      `UPDATE clientes SET
        nombre = COALESCE($1, nombre),
        correo = COALESCE($2, correo),
        telefono = COALESCE($3, telefono),
        direccion = COALESCE($4, direccion),
        ciudad = COALESCE($5, ciudad),
        pais = COALESCE($6, pais),
        activo = COALESCE($7, activo)
      WHERE id = $8
      RETURNING id, usuario, nombre, correo, telefono, direccion, ciudad, pais, activo, rol, fecha_creacion`,
      [nombre, correo, telefono, direccion, ciudad, pais, activo, req.params.id]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Cliente no encontrado'
      });
    }
    
    console.log('✅ Cliente actualizado:', req.params.id);
    
    res.json({
      exito: true,
      datos: resultado.rows[0]
    });
    
  } catch (error) {
    console.error('Error actualizando cliente:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error actualizando cliente',
      error: error.message
    });
  }
});

app.delete('/api/admin/clientes/:id', autenticarToken, async (req, res) => {
  try {
    const resultado = await pool.query(
      'DELETE FROM clientes WHERE id = $1 RETURNING id, nombre',
      [req.params.id]
    );
    
    if (resultado.rows.length === 0) {
      return res.status(404).json({
        exito: false,
        mensaje: 'Cliente no encontrado'
      });
    }
    
    console.log('✅ Cliente eliminado:', req.params.id);
    
    res.json({
      exito: true,
      mensaje: 'Cliente eliminado exitosamente'
    });
    
  } catch (error) {
    console.error('Error eliminando cliente:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error eliminando cliente',
      error: error.message
    });
  }
});

// ============================================
// RUTAS DE ADMIN - LOGIN
// ============================================

app.post('/api/admin/login', async (req, res) => {
  try {
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
      return res.status(401).json({
        exito: false,
        mensaje: 'Credenciales inválidas'
      });
    }
    
    const admin = resultado.rows[0];
    const contrasenaValida = await bcrypt.compare(contrasena, admin.contrasena_hash);
    
    if (!contrasenaValida) {
      return res.status(401).json({
        exito: false,
        mensaje: 'Credenciales inválidas'
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
      { expiresIn: '8h' }
    );
    
    const { contrasena_hash, ...datosAdmin } = admin;
    
    res.json({
      exito: true,
      mensaje: 'Login exitoso',
      datos: {
        token: token,
        usuario: datosAdmin
      }
    });
    
  } catch (error) {
    console.error('Error en login admin:', error);
    res.status(500).json({
      exito: false,
      mensaje: 'Error en el servidor',
      error: error.message
    });
  }
});

app.get('/api/admin/verificar', autenticarToken, (req, res) => {
  res.json({
    exito: true,
    usuario: req.usuario
  });
});

// ============================================
// RUTA DE VENTAS
// ============================================

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
// RUTAS DE INFORMACIÓN Y SALUD
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

app.get('/api/salud', (req, res) => {
  res.json({ 
    estado: 'activo', 
    fecha: new Date().toISOString(),
    baseDatos: 'conectada'
  });
});

// ============================================
// MANEJO DE ERRORES 404 - DEBE IR AL FINAL
// ============================================

app.use((req, res) => {
  // No devolver 404 para rutas que no sean API
  if (req.url.startsWith('/api/')) {
    res.status(404).json({
      exito: false,
      mensaje: 'Ruta API no encontrada',
      ruta: req.url
    });
  } else {
    // Para rutas no-API, servir index.htm (SPA fallback)
    res.sendFile(path.join(__dirname, 'public', 'index.htm'));
  }
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
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('🚀 EL CHICHO SHOP - SERVIDOR INICIADO');
    console.log('='.repeat(50));
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌐 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Base de datos: PostgreSQL conectado`);
    console.log(`📁 Frontend: Servido desde /public`);
    console.log(`⏰ Iniciado: ${new Date().toLocaleString()}`);
    console.log('');
    console.log('📋 RUTAS FRONTEND:');
    console.log('   GET  / (Login)');
    console.log('   GET  /dashboard.html');
    console.log('   GET  /products.html');
    console.log('   GET  /edit-product.html');
    console.log('');
    console.log('📋 RUTAS API:');
    console.log('   GET  /api/health');
    console.log('   GET  /api/productos');
    console.log('   GET  /api/productos/:id');
    console.log('   GET  /api/categorias');
    console.log('   POST /api/ventas');
    console.log('   POST /api/admin/login');
    console.log('   GET  /api/admin/verificar (token)');
    console.log('   GET  /api/admin/productos (token)');
    console.log('   POST /api/admin/productos (token)');
    console.log('   PUT  /api/admin/productos/:id (token)');
    console.log('   DELETE /api/admin/productos/:id (token)');
    console.log('   GET  /api/admin/clientes (token)');
    console.log('='.repeat(50));
    console.log('');
  });
}

iniciarServidor();