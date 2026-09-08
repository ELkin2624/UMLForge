package com.example.project.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.ArrayList;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "usuarios")
@Inheritance(strategy = InheritanceType.JOINED)
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "id")
    private b8964e5c-dad8-52b5-815d-4ee1efc1b5bc id;

    @Column(name = "nombre")
    private 59d13357-a55e-5acb-b205-8d0936632729 nombre;



    // Getters and Setters

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public b8964e5c-dad8-52b5-815d-4ee1efc1b5bc getId() {
        return id;
    }

    public void setId(b8964e5c-dad8-52b5-815d-4ee1efc1b5bc id) {
        this.id = id;
    }
    public 59d13357-a55e-5acb-b205-8d0936632729 getNombre() {
        return nombre;
    }

    public void setNombre(59d13357-a55e-5acb-b205-8d0936632729 nombre) {
        this.nombre = nombre;
    }
    
}