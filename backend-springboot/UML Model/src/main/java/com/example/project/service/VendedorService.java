package com.example.project.service;

import com.example.project.entity.Vendedor;
import com.example.project.dto.request.VendedorRequest;
import com.example.project.dto.response.VendedorResponse;
import com.example.project.repository.VendedorRepository;
import com.example.project.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class VendedorService {

    private final VendedorRepository repository;

    public VendedorService(
        VendedorRepository repository    ) {
        this.repository = repository;
    }

    public List<VendedorResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public VendedorResponse findById(Integer id) {
        Vendedor entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vendedor not found with id: " + id));
        return mapToResponse(entity);
    }

    public VendedorResponse create(VendedorRequest request) {
        Vendedor entity = new Vendedor();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public VendedorResponse update(Integer id, VendedorRequest request) {
        Vendedor entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vendedor not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Integer id) {
        Vendedor entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vendedor not found with id: " + id));
        repository.delete(entity);
    }

    private VendedorResponse mapToResponse(Vendedor entity) {
        VendedorResponse response = new VendedorResponse();
        response.setId(entity.getId());
        response.setNombre(entity.getNombre());
        response.setComision(entity.getComision());
        return response;
    }

    private void mapToEntity(VendedorRequest request, Vendedor entity) {
        entity.setNombre(request.getNombre());
        entity.setComision(request.getComision());
    }
}