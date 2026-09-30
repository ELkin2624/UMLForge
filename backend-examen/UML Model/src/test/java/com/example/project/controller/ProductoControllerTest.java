package com.example.project.controller;

import com.example.project.service.ProductoService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@ExtendWith(MockitoExtension.class)
public class ProductoControllerTest {

    @Mock
    private ProductoService service;

    @InjectMocks
    private ProductoController controller;

    @Test
    void contextLoads() {
        assertNotNull(controller, "The controller should have been instantiated");
    }
}