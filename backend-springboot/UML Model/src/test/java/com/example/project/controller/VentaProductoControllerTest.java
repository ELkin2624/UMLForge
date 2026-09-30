package com.example.project.controller;

import com.example.project.service.VentaProductoService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
public class VentaProductoControllerTest {

    @Mock
    private VentaProductoService service;

    @InjectMocks
    private VentaProductoController controller;

    @Test
    void contextLoads() {
        assertNotNull(controller, "The controller should have been instantiated");
    }
}