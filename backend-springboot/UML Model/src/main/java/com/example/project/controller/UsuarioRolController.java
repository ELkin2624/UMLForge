package com.example.project.controller;

import com.example.project.dto.request.UsuarioRolRequest;
import com.example.project.dto.response.UsuarioRolResponse;
import com.example.project.service.UsuarioRolService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/usuario_rols")
public class UsuarioRolController {

    private final UsuarioRolService service;

    public UsuarioRolController(UsuarioRolService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<UsuarioRolResponse>> getAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UsuarioRolResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<UsuarioRolResponse> create(@Valid @RequestBody UsuarioRolRequest request) {
        return new ResponseEntity<>(service.create(request), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<UsuarioRolResponse> update(@PathVariable Long id, @Valid @RequestBody UsuarioRolRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}