package com.example.project.controller;

import com.example.project.dto.request.VentaProductoRequest;
import com.example.project.dto.response.VentaProductoResponse;
import com.example.project.service.VentaProductoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/venta_productos")
public class VentaProductoController {

    private final VentaProductoService service;

    public VentaProductoController(VentaProductoService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<VentaProductoResponse>> getAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<VentaProductoResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<VentaProductoResponse> create(@Valid @RequestBody VentaProductoRequest request) {
        return new ResponseEntity<>(service.create(request), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<VentaProductoResponse> update(@PathVariable Long id, @Valid @RequestBody VentaProductoRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}