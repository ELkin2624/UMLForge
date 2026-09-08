package com.conference.app.controller;

import com.conference.app.dto.request.ConferenceRequest;
import com.conference.app.dto.response.ConferenceResponse;
import com.conference.app.service.ConferenceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/conferences")
public class ConferenceController {

    private final ConferenceService service;

    public ConferenceController(ConferenceService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<ConferenceResponse>> getAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ConferenceResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<ConferenceResponse> create(@Valid @RequestBody ConferenceRequest request) {
        return new ResponseEntity<>(service.create(request), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ConferenceResponse> update(@PathVariable Long id, @Valid @RequestBody ConferenceRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}