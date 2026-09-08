package com.conference.app.service;

import com.conference.app.entity.KeynoteSpeaker;
import com.conference.app.dto.request.KeynoteSpeakerRequest;
import com.conference.app.dto.response.KeynoteSpeakerResponse;
import com.conference.app.repository.KeynoteSpeakerRepository;
import com.conference.app.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class KeynoteSpeakerService {

    private final KeynoteSpeakerRepository repository;

    public KeynoteSpeakerService(
        KeynoteSpeakerRepository repository    ) {
        this.repository = repository;
    }

    public List<KeynoteSpeakerResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public KeynoteSpeakerResponse findById(Long id) {
        KeynoteSpeaker entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("KeynoteSpeaker not found with id: " + id));
        return mapToResponse(entity);
    }

    public KeynoteSpeakerResponse create(KeynoteSpeakerRequest request) {
        KeynoteSpeaker entity = new KeynoteSpeaker();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public KeynoteSpeakerResponse update(Long id, KeynoteSpeakerRequest request) {
        KeynoteSpeaker entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("KeynoteSpeaker not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Long id) {
        KeynoteSpeaker entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("KeynoteSpeaker not found with id: " + id));
        repository.delete(entity);
    }

    private KeynoteSpeakerResponse mapToResponse(KeynoteSpeaker entity) {
        KeynoteSpeakerResponse response = new KeynoteSpeakerResponse();
        response.setId(entity.getId());
        response.setBiography(entity.getBiography());
        response.setOrganization(entity.getOrganization());
        return response;
    }

    private void mapToEntity(KeynoteSpeakerRequest request, KeynoteSpeaker entity) {
        entity.setBiography(request.getBiography());
        entity.setOrganization(request.getOrganization());
    }
}