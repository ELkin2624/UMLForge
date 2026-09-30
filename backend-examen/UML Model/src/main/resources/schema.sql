-- Database Schema for UML Model

CREATE TABLE IF NOT EXISTS vendedors (
    id SERIAL PRIMARY KEY,    nombre VARCHAR(255),    comision INTEGER);

CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,    nombre VARCHAR(255),    precio INTEGER,    stock INTEGER);

CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,    nombre VARCHAR(255),    gmail VARCHAR(255));

CREATE TABLE IF NOT EXISTS ventas (
    id SERIAL PRIMARY KEY,    fecha DATE,    cliente_id INTEGER,    vendedor_id INTEGER    ,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),    FOREIGN KEY (vendedor_id) REFERENCES vendedors(id));

CREATE TABLE IF NOT EXISTS venta_productos (
    id BIGSERIAL PRIMARY KEY,    cantidad INTEGER,    preunit INTEGER,    venta_id INTEGER,    producto_id INTEGER    ,
    FOREIGN KEY (venta_id) REFERENCES ventas(id),    FOREIGN KEY (producto_id) REFERENCES productos(id));

