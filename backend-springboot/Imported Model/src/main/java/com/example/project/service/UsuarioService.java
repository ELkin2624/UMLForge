package com.example.project.service;

import com.example.project.entity.Usuario;
import com.example.project.dto.request.UsuarioRequest;
import com.example.project.dto.response.UsuarioResponse;
import com.example.project.repository.UsuarioRepository;
import com.example.project.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class UsuarioService {

    private final UsuarioRepository repository;

    public UsuarioService(UsuarioRepository repository) {
        this.repository = repository;
    }

    public List<UsuarioResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public UsuarioResponse findById(Long id) {
        Usuario entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario not found with id: " + id));
        return mapToResponse(entity);
    }

    public UsuarioResponse create(UsuarioRequest request) {
        Usuario entity = new Usuario();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public UsuarioResponse update(Long id, UsuarioRequest request) {
        Usuario entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Long id) {
        Usuario entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario not found with id: " + id));
        repository.delete(entity);
    }

    private UsuarioResponse mapToResponse(Usuario entity) {
        UsuarioResponse response = new UsuarioResponse();
        response.setId(entity.getId());
        response.setId(entity.getId());
        response.setNombre(entity.getNombre());
        return response;
    }

    private void mapToEntity(UsuarioRequest request, Usuario entity) {
        entity.setId(request.getId());
        entity.setNombre(request.getNombre());
    }
}