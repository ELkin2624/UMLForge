package com.conference.app.service;

import com.conference.app.entity.Session;
import com.conference.app.entity.Conference;
import com.conference.app.repository.ConferenceRepository;
import com.conference.app.entity.TopicTrack;
import com.conference.app.repository.TopicTrackRepository;
import com.conference.app.dto.request.SessionRequest;
import com.conference.app.dto.response.SessionResponse;
import com.conference.app.repository.SessionRepository;
import com.conference.app.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class SessionService {

    private final SessionRepository repository;
    private final ConferenceRepository conferenceRepository;
    private final TopicTrackRepository topicTrackRepository;

    public SessionService(
        SessionRepository repository,
        ConferenceRepository conferenceRepository,
        TopicTrackRepository topicTrackRepository    ) {
        this.repository = repository;
        this.conferenceRepository = conferenceRepository;
        this.topicTrackRepository = topicTrackRepository;
    }

    public List<SessionResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public SessionResponse findById(Long id) {
        Session entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found with id: " + id));
        return mapToResponse(entity);
    }

    public SessionResponse create(SessionRequest request) {
        Session entity = new Session();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public SessionResponse update(Long id, SessionRequest request) {
        Session entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Long id) {
        Session entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Session not found with id: " + id));
        repository.delete(entity);
    }

    private SessionResponse mapToResponse(Session entity) {
        SessionResponse response = new SessionResponse();
        response.setId(entity.getId());
        response.setTitle(entity.getTitle());
        response.setDurationMinutes(entity.getDurationMinutes());
        if (entity.getConference() != null) {
            response.setConferenceId(entity.getConference().getId());
        }
        if (entity.getTopicTracks() != null) {
            response.setTopicTrackIds(entity.getTopicTracks().stream()
                .map(TopicTrack::getId)
                .collect(Collectors.toList()));
        }
        return response;
    }

    private void mapToEntity(SessionRequest request, Session entity) {
        entity.setTitle(request.getTitle());
        entity.setDurationMinutes(request.getDurationMinutes());
        if (request.getConferenceId() != null) {
            entity.setConference(
                conferenceRepository.findById(request.getConferenceId())
                    .orElseThrow(() -> new ResourceNotFoundException("Conference not found with id: " + request.getConferenceId()))
            );
        } else {
            entity.setConference(null);
        }
        if (request.getTopicTrackIds() != null && !request.getTopicTrackIds().isEmpty()) {
            List<TopicTrack> targets = topicTrackRepository.findAllById(request.getTopicTrackIds());
            if (targets.size() != request.getTopicTrackIds().size()) {
                throw new ResourceNotFoundException("One or more TopicTrack entities not found with provided IDs");
            }
            entity.setTopicTracks(targets);
        } else if (request.getTopicTrackIds() != null) {
            entity.setTopicTracks(new ArrayList<>());
        }
    }
}