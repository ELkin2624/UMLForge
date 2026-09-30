package com.example.project.service;

import com.example.project.entity.Rol;
import com.example.project.dto.request.RolRequest;
import com.example.project.dto.response.RolResponse;
import com.example.project.repository.RolRepository;
import com.example.project.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class RolService {

    private final RolRepository repository;

    public RolService(
        RolRepository repository    ) {
        this.repository = repository;
    }

    public List<RolResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public RolResponse findById(Integer id) {
        Rol entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Rol not found with id: " + id));
        return mapToResponse(entity);
    }

    public RolResponse create(RolRequest request) {
        Rol entity = new Rol();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public RolResponse update(Integer id, RolRequest request) {
        Rol entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Rol not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Integer id) {
        Rol entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Rol not found with id: " + id));
        repository.delete(entity);
    }

    private RolResponse mapToResponse(Rol entity) {
        RolResponse response = new RolResponse();
        response.setId(entity.getId());
        response.setNombre(entity.getNombre());
        return response;
    }

    private void mapToEntity(RolRequest request, Rol entity) {
        entity.setNombre(request.getNombre());
    }
}