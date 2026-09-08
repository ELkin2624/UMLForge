-- Database Schema for Imported Model

CREATE TABLE IF NOT EXISTS admins (
    id BIGSERIAL PRIMARY KEY,    id VARCHAR(255),    email VARCHAR(255));

CREATE TABLE IF NOT EXISTS categorias (
    id BIGSERIAL PRIMARY KEY,    id VARCHAR(255),    id_padre VARCHAR(255),    nombre VARCHAR(255),    tipo VARCHAR(255),    categoria_id BIGINT    ,
    FOREIGN KEY (categoria_id) REFERENCES categorias(id));

CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,    id VARCHAR(255),    nombre VARCHAR(255));

