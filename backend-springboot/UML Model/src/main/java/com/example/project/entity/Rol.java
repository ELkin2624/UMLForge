package com.example.project.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.ArrayList;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "rols")
public class Rol {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "nombre")
    private String nombre;


    @OneToMany(mappedBy = "rol")
    private List<UsuarioRol> usuarioRols = new ArrayList<>();
    

    // Getters and Setters

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }
    
    public List<UsuarioRol> getUsuarioRols() {
        return usuarioRols;
    }

    public void setUsuarioRols(List<UsuarioRol> usuarioRols) {
        this.usuarioRols = usuarioRols;
    }
}