package com.conference.app.service;

import com.conference.app.entity.TopicTrack;
import com.conference.app.dto.request.TopicTrackRequest;
import com.conference.app.dto.response.TopicTrackResponse;
import com.conference.app.repository.TopicTrackRepository;
import com.conference.app.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class TopicTrackService {

    private final TopicTrackRepository repository;

    public TopicTrackService(
        TopicTrackRepository repository    ) {
        this.repository = repository;
    }

    public List<TopicTrackResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public TopicTrackResponse findById(Long id) {
        TopicTrack entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TopicTrack not found with id: " + id));
        return mapToResponse(entity);
    }

    public TopicTrackResponse create(TopicTrackRequest request) {
        TopicTrack entity = new TopicTrack();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public TopicTrackResponse update(Long id, TopicTrackRequest request) {
        TopicTrack entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TopicTrack not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Long id) {
        TopicTrack entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TopicTrack not found with id: " + id));
        repository.delete(entity);
    }

    private TopicTrackResponse mapToResponse(TopicTrack entity) {
        TopicTrackResponse response = new TopicTrackResponse();
        response.setId(entity.getId());
        response.setTopicName(entity.getTopicName());
        response.setDifficultyLevel(entity.getDifficultyLevel());
        return response;
    }

    private void mapToEntity(TopicTrackRequest request, TopicTrack entity) {
        entity.setTopicName(request.getTopicName());
        entity.setDifficultyLevel(request.getDifficultyLevel());
    }
}