package com.example.project.service;

import com.example.project.entity.Categoria;
import com.example.project.dto.request.CategoriaRequest;
import com.example.project.dto.response.CategoriaResponse;
import com.example.project.repository.CategoriaRepository;
import com.example.project.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class CategoriaService {

    private final CategoriaRepository repository;

    public CategoriaService(CategoriaRepository repository) {
        this.repository = repository;
    }

    public List<CategoriaResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public CategoriaResponse findById(Long id) {
        Categoria entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria not found with id: " + id));
        return mapToResponse(entity);
    }

    public CategoriaResponse create(CategoriaRequest request) {
        Categoria entity = new Categoria();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public CategoriaResponse update(Long id, CategoriaRequest request) {
        Categoria entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Long id) {
        Categoria entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria not found with id: " + id));
        repository.delete(entity);
    }

    private CategoriaResponse mapToResponse(Categoria entity) {
        CategoriaResponse response = new CategoriaResponse();
        response.setId(entity.getId());
        response.setId(entity.getId());
        response.setId_padre(entity.getId_padre());
        response.setNombre(entity.getNombre());
        response.setTipo(entity.getTipo());
        return response;
    }

    private void mapToEntity(CategoriaRequest request, Categoria entity) {
        entity.setId(request.getId());
        entity.setId_padre(request.getId_padre());
        entity.setNombre(request.getNombre());
        entity.setTipo(request.getTipo());
    }
}