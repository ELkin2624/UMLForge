package com.conference.app.controller;

import com.conference.app.dto.request.AttendeeRequest;
import com.conference.app.dto.response.AttendeeResponse;
import com.conference.app.service.AttendeeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/attendees")
public class AttendeeController {

    private final AttendeeService service;

    public AttendeeController(AttendeeService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<AttendeeResponse>> getAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<AttendeeResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping
    public ResponseEntity<AttendeeResponse> create(@Valid @RequestBody AttendeeRequest request) {
        return new ResponseEntity<>(service.create(request), HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<AttendeeResponse> update(@PathVariable Long id, @Valid @RequestBody AttendeeRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}