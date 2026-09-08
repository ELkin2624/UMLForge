package com.conference.app.service;

import com.conference.app.entity.Attendee;
import com.conference.app.dto.request.AttendeeRequest;
import com.conference.app.dto.response.AttendeeResponse;
import com.conference.app.repository.AttendeeRepository;
import com.conference.app.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class AttendeeService {

    private final AttendeeRepository repository;

    public AttendeeService(
        AttendeeRepository repository    ) {
        this.repository = repository;
    }

    public List<AttendeeResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public AttendeeResponse findById(Long id) {
        Attendee entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attendee not found with id: " + id));
        return mapToResponse(entity);
    }

    public AttendeeResponse create(AttendeeRequest request) {
        Attendee entity = new Attendee();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public AttendeeResponse update(Long id, AttendeeRequest request) {
        Attendee entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attendee not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Long id) {
        Attendee entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Attendee not found with id: " + id));
        repository.delete(entity);
    }

    private AttendeeResponse mapToResponse(Attendee entity) {
        AttendeeResponse response = new AttendeeResponse();
        response.setId(entity.getId());
        response.setFullName(entity.getFullName());
        response.setEmail(entity.getEmail());
        return response;
    }

    private void mapToEntity(AttendeeRequest request, Attendee entity) {
        entity.setFullName(request.getFullName());
        entity.setEmail(request.getEmail());
    }
}