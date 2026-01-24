// server.js - VERSIÓN COMPLETA Y CORREGIDA
// Para: El Chicho Shop
// Fecha: 2025 - Versión 5.2 (TODAS LAS FUNCIONES)

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
// RUTAS PÚBLICAS - INFORMACIÓN
// ============================================

app.get('/', (req, res) => {
  res.json({
    mensaje: '🚀 El Chicho Shop API v5.2',
    estado: 'Operativo',
    entorno: process.env.NODE_ENV,
    endpoints: {
      publicos: {
        salud: 'GET /api/salud',
        health: 'GET /api/health',
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
        clientes: 'GET /api/admin/clientes',
        clientePorId: 'GET /api/admin/clientes/:id',
        actualizarCliente: 'PUT /api/admin/clientes/:id',
        eliminarCliente: 'DELETE /api/admin/clientes/:id'
      }
    }
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const pruebaDb = await pool.query('SELECT NOW()');
    const cantidadProductos = await pool.query('SELECT COUNT(*) FROM productos');
    const cantidadClientes = await pool.query('SELECT COUNT(*) FROM clientes');
    
    res.json({
      success: true,
      status: 'online',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        time: pruebaDb.rows[0].now,
        products: parseInt(cantidadProductos.rows[0].count),
        clients: parseInt(cantidadClientes.rows[0].count)
      },
      environment: {
        node_env: process.env.NODE_ENV,
        port: PORT
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
        puerto: PORT
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
    console.log('📝 Intento de registro de cliente:', req.body);
    
    const { usuario, contrasena, nombre, correo, telefono } = req.body;
    
    if (!usuario || !contrasena || !nombre || !correo) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos: usuario, contrasena, nombre, correo'
      });
    }
    
    const usuarioExistente = await pool.query(
      'SELECT id FROM clientes WHERE usuario = $1 OR correo = $2',
      [usuario, correo]
    );
    
    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El usuario o correo ya está registrado'
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
      success: true,
      message: 'Cliente registrado exitosamente',
      data: {
        user: resultado.rows[0]
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

app.post('/api/clientes/login', async (req, res) => {
  try {
    console.log('🔐 Intento de login de cliente:', req.body);
    
    const { identificador, contrasena, password } = req.body;
    const pass = contrasena || password;
    
    if (!identificador || !pass) {
      return res.status(400).json({
        success: false,
        message: 'Usuario/email y contraseña requeridos'
      });
    }
    
    const resultado = await pool.query(
      'SELECT * FROM clientes WHERE usuario = $1 OR correo = $1',
      [identificador]
    );
    
    if (resultado.rows.length === 0) {
      console.log('❌ Cliente no encontrado:', identificador);
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    const cliente = resultado.rows[0];
    
    const contrasenaValida = await bcrypt.compare(pass, cliente.contrasena_hash);
    
    if (!contrasenaValida) {
      console.log('❌ Contraseña incorrecta para:', identificador);
      return res.status(401).json({
        success: false,
        message: 'Contraseña incorrecta'
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
        rol: cliente.rol
      },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '24h' }
    );
    
    const { contrasena_hash, ...datosCliente } = cliente;
    
    console.log('✅ Login de cliente exitoso:', cliente.usuario);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token: token,
        user: datosCliente
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
      WHERE LOWER(COALESCE(p.estado, '')) = 'activo'
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

    const resultado = await pool.query(consulta, parametros);

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

// ============================================
// RUTAS DE ADMIN - CLIENTES
// ============================================

app.get('/api/admin/clientes', autenticarToken, async (req, res) => {
  try {
    const { activo, buscar, limite = 100 } = req.query;
    
    let consulta = `
      SELECT 
        id, usuario, nombre, correo, telefono, direccion, ciudad, pais,
        activo, rol, fecha_creacion, ultima_sesion
      FROM clientes
      WHERE 1=1
    `;
    
    const parametros = [];
    
    if (activo !== undefined && activo !== 'all') {
      parametros.push(activo === 'true');
      consulta += ` AND activo = $${parametros.length}`;
    }
    
    if (buscar) {
      parametros.push(`%${buscar}%`);
      consulta += ` AND (nombre ILIKE $${parametros.length} OR correo ILIKE $${parametros.length} OR usuario ILIKE $${parametros.length})`;
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
      'SELECT id, usuario, nombre, correo, telefono, direccion, ciudad, pais, activo, rol, fecha_creacion, ultima_sesion FROM clientes WHERE id = $1',
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
// MANEJO DE ERRORES 404 - DEBE IR AL FINAL
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
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('🚀 EL CHICHO SHOP - SERVIDOR INICIADO');
    console.log('='.repeat(50));
    console.log(`📡 Puerto: ${PORT}`);
    console.log(`🌐 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Base de datos: PostgreSQL conectado`);
    console.log(`⏰ Iniciado: ${new Date().toLocaleString()}`);
    console.log('');
    console.log('📋 RUTAS DISPONIBLES:');
    console.log('   GET  / (Info general)');
    console.log('   GET  /api/health');
    console.log('   GET  /api/salud');
    console.log('   POST /api/clientes/registro ✅');
    console.log('   POST /api/clientes/login ✅');
    console.log('   GET  /api/productos');
    console.log('   GET  /api/productos/:id');
    console.log('   GET  /api/categorias');
    console.log('   POST /api/ventas');
    console.log('   POST /api/admin/login');
    console.log('   GET  /api/admin/verificar (requiere token)');
    console.log('   GET  /api/admin/clientes (requiere token)');
    console.log('   GET  /api/admin/clientes/:id (requiere token)');
    console.log('   PUT  /api/admin/clientes/:id (requiere token)');
    console.log('   DELETE /api/admin/clientes/:id (requiere token)');
    console.log('='.repeat(50));
    console.log('');
  });
}

iniciarServidor();