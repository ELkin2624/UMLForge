package com.conference.app.service;

import com.conference.app.entity.Conference;
import com.conference.app.dto.request.ConferenceRequest;
import com.conference.app.dto.response.ConferenceResponse;
import com.conference.app.repository.ConferenceRepository;
import com.conference.app.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class ConferenceService {

    private final ConferenceRepository repository;

    public ConferenceService(
        ConferenceRepository repository    ) {
        this.repository = repository;
    }

    public List<ConferenceResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public ConferenceResponse findById(Long id) {
        Conference entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conference not found with id: " + id));
        return mapToResponse(entity);
    }

    public ConferenceResponse create(ConferenceRequest request) {
        Conference entity = new Conference();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public ConferenceResponse update(Long id, ConferenceRequest request) {
        Conference entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conference not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Long id) {
        Conference entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Conference not found with id: " + id));
        repository.delete(entity);
    }

    private ConferenceResponse mapToResponse(Conference entity) {
        ConferenceResponse response = new ConferenceResponse();
        response.setId(entity.getId());
        response.setName(entity.getName());
        response.setCity(entity.getCity());
        response.setYear(entity.getYear());
        return response;
    }

    private void mapToEntity(ConferenceRequest request, Conference entity) {
        entity.setName(request.getName());
        entity.setCity(request.getCity());
        entity.setYear(request.getYear());
    }
}