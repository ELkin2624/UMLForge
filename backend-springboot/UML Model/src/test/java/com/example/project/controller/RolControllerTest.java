package com.example.project.controller;

import com.example.project.service.RolService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
public class RolControllerTest {

    @Mock
    private RolService service;

    @InjectMocks
    private RolController controller;

    @Test
    void contextLoads() {
        assertNotNull(controller, "The controller should have been instantiated");
    }
}