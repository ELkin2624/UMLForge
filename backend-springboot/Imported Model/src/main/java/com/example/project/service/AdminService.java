package com.example.project.service;

import com.example.project.entity.Admin;
import com.example.project.dto.request.AdminRequest;
import com.example.project.dto.response.AdminResponse;
import com.example.project.repository.AdminRepository;
import com.example.project.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class AdminService {

    private final AdminRepository repository;

    public AdminService(AdminRepository repository) {
        this.repository = repository;
    }

    public List<AdminResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public AdminResponse findById(Long id) {
        Admin entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found with id: " + id));
        return mapToResponse(entity);
    }

    public AdminResponse create(AdminRequest request) {
        Admin entity = new Admin();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public AdminResponse update(Long id, AdminRequest request) {
        Admin entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Long id) {
        Admin entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Admin not found with id: " + id));
        repository.delete(entity);
    }

    private AdminResponse mapToResponse(Admin entity) {
        AdminResponse response = new AdminResponse();
        response.setId(entity.getId());
        response.setId(entity.getId());
        response.setEmail(entity.getEmail());
        return response;
    }

    private void mapToEntity(AdminRequest request, Admin entity) {
        entity.setId(request.getId());
        entity.setEmail(request.getEmail());
    }
}