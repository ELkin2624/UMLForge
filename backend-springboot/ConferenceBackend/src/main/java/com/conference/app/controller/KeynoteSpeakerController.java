package com.conference.app.controller;

import com.conference.app.dto.request.KeynoteSpeakerRequest;
import com.conference.app.dto.response.KeynoteSpeakerResponse;
import com.conference.app.service.KeynoteSpeakerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/keynote_speakers")
public class KeynoteSpeakerController {

    private final KeynoteSpeakerService service;

    public KeynoteSpeakerController(KeynoteSpeakerService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<KeynoteSpeakerResponse>> getAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<KeynoteSpeakerResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<KeynoteSpeakerResponse> create(@Valid @RequestBody KeynoteSpeakerRequest request) {
        return new ResponseEntity<>(service.create(request), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<KeynoteSpeakerResponse> update(@PathVariable Long id, @Valid @RequestBody KeynoteSpeakerRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}