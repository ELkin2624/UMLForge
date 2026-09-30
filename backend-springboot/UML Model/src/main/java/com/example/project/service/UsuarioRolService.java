package com.example.project.service;

import com.example.project.entity.UsuarioRol;
import com.example.project.entity.Usuario;
import com.example.project.repository.UsuarioRepository;
import com.example.project.entity.Rol;
import com.example.project.repository.RolRepository;
import com.example.project.dto.request.UsuarioRolRequest;
import com.example.project.dto.response.UsuarioRolResponse;
import com.example.project.repository.UsuarioRolRepository;
import com.example.project.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class UsuarioRolService {

    private final UsuarioRolRepository repository;
    private final UsuarioRepository usuarioRepository;
    private final RolRepository rolRepository;

    public UsuarioRolService(
        UsuarioRolRepository repository,
        UsuarioRepository usuarioRepository,
        RolRepository rolRepository    ) {
        this.repository = repository;
        this.usuarioRepository = usuarioRepository;
        this.rolRepository = rolRepository;
    }

    public List<UsuarioRolResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public UsuarioRolResponse findById(Long id) {
        UsuarioRol entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("UsuarioRol not found with id: " + id));
        return mapToResponse(entity);
    }

    public UsuarioRolResponse create(UsuarioRolRequest request) {
        UsuarioRol entity = new UsuarioRol();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public UsuarioRolResponse update(Long id, UsuarioRolRequest request) {
        UsuarioRol entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("UsuarioRol not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Long id) {
        UsuarioRol entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("UsuarioRol not found with id: " + id));
        repository.delete(entity);
    }

    private UsuarioRolResponse mapToResponse(UsuarioRol entity) {
        UsuarioRolResponse response = new UsuarioRolResponse();
        response.setId(entity.getId());
        if (entity.getUsuario() != null) {
            response.setUsuarioId(entity.getUsuario().getId());
        }
        if (entity.getRol() != null) {
            response.setRolId(entity.getRol().getId());
        }
        return response;
    }

    private void mapToEntity(UsuarioRolRequest request, UsuarioRol entity) {
        if (request.getUsuarioId() != null) {
            entity.setUsuario(
                usuarioRepository.findById(request.getUsuarioId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usuario not found with id: " + request.getUsuarioId()))
            );
        } else {
            entity.setUsuario(null);
        }
        if (request.getRolId() != null) {
            entity.setRol(
                rolRepository.findById(request.getRolId())
                    .orElseThrow(() -> new ResourceNotFoundException("Rol not found with id: " + request.getRolId()))
            );
        } else {
            entity.setRol(null);
        }
    }
}