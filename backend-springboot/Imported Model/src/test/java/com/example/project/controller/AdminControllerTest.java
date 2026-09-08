package com.example.project.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest
public class AdminControllerTest {

    @Autowired
    private AdminController controller;

    @Test
    void contextLoads() {
        assertNotNull(controller, "The controller should have been autowired");
    }
}