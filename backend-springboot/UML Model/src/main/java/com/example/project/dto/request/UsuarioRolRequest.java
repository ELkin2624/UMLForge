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

public class UsuarioRolRequest {


    private Integer usuarioId;
    private Integer rolId;

    // Getters and Setters

    public Integer getUsuarioId() {
        return usuarioId;
    }

    public void setUsuarioId(Integer usuarioId) {
        this.usuarioId = usuarioId;
    }
    public Integer getRolId() {
        return rolId;
    }

    public void setRolId(Integer rolId) {
        this.rolId = rolId;
    }
}