package com.example.project.service;

import com.example.project.entity.Cliente;
import com.example.project.dto.request.ClienteRequest;
import com.example.project.dto.response.ClienteResponse;
import com.example.project.repository.ClienteRepository;
import com.example.project.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class ClienteService {

    private final ClienteRepository repository;

    public ClienteService(
        ClienteRepository repository    ) {
        this.repository = repository;
    }

    public List<ClienteResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public ClienteResponse findById(Integer id) {
        Cliente entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente not found with id: " + id));
        return mapToResponse(entity);
    }

    public ClienteResponse create(ClienteRequest request) {
        Cliente entity = new Cliente();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public ClienteResponse update(Integer id, ClienteRequest request) {
        Cliente entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Integer id) {
        Cliente entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente not found with id: " + id));
        repository.delete(entity);
    }

    private ClienteResponse mapToResponse(Cliente entity) {
        ClienteResponse response = new ClienteResponse();
        response.setId(entity.getId());
        response.setNombre(entity.getNombre());
        response.setGmail(entity.getGmail());
        return response;
    }

    private void mapToEntity(ClienteRequest request, Cliente entity) {
        entity.setNombre(request.getNombre());
        entity.setGmail(request.getGmail());
    }
}