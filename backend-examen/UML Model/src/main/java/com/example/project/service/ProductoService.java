package com.example.project.service;

import com.example.project.entity.Producto;
import com.example.project.dto.request.ProductoRequest;
import com.example.project.dto.response.ProductoResponse;
import com.example.project.repository.ProductoRepository;
import com.example.project.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class ProductoService {

    private final ProductoRepository repository;

    public ProductoService(
        ProductoRepository repository    ) {
        this.repository = repository;
    }

    public List<ProductoResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public ProductoResponse findById(Integer id) {
        Producto entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto not found with id: " + id));
        return mapToResponse(entity);
    }

    public ProductoResponse create(ProductoRequest request) {
        Producto entity = new Producto();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public ProductoResponse update(Integer id, ProductoRequest request) {
        Producto entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Integer id) {
        Producto entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto not found with id: " + id));
        repository.delete(entity);
    }

    private ProductoResponse mapToResponse(Producto entity) {
        ProductoResponse response = new ProductoResponse();
        response.setId(entity.getId());
        response.setNombre(entity.getNombre());
        response.setPrecio(entity.getPrecio());
        response.setStock(entity.getStock());
        return response;
    }

    private void mapToEntity(ProductoRequest request, Producto entity) {
        entity.setNombre(request.getNombre());
        entity.setPrecio(request.getPrecio());
        entity.setStock(request.getStock());
    }
}