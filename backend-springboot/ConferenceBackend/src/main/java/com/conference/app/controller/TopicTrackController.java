package com.conference.app.controller;

import com.conference.app.dto.request.TopicTrackRequest;
import com.conference.app.dto.response.TopicTrackResponse;
import com.conference.app.service.TopicTrackService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/topic_tracks")
public class TopicTrackController {

    private final TopicTrackService service;

    public TopicTrackController(TopicTrackService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<TopicTrackResponse>> getAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<TopicTrackResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<TopicTrackResponse> create(@Valid @RequestBody TopicTrackRequest request) {
        return new ResponseEntity<>(service.create(request), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TopicTrackResponse> update(@PathVariable Long id, @Valid @RequestBody TopicTrackRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}