package com.example.project.dto.request;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Instant;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.List;
import java.util.ArrayList;

public class VendedorRequest {

    private String nombre;
    private Integer comision;


    // Getters and Setters
    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }
    public Integer getComision() {
        return comision;
    }

    public void setComision(Integer comision) {
        this.comision = comision;
    }

}