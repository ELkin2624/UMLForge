package com.example.project.service;

import com.example.project.entity.Venta;
import com.example.project.entity.Cliente;
import com.example.project.repository.ClienteRepository;
import com.example.project.entity.Vendedor;
import com.example.project.repository.VendedorRepository;
import com.example.project.dto.request.VentaRequest;
import com.example.project.dto.response.VentaResponse;
import com.example.project.repository.VentaRepository;
import com.example.project.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class VentaService {

    private final VentaRepository repository;
    private final ClienteRepository clienteRepository;
    private final VendedorRepository vendedorRepository;

    public VentaService(
        VentaRepository repository,
        ClienteRepository clienteRepository,
        VendedorRepository vendedorRepository    ) {
        this.repository = repository;
        this.clienteRepository = clienteRepository;
        this.vendedorRepository = vendedorRepository;
    }

    public List<VentaResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public VentaResponse findById(Integer id) {
        Venta entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Venta not found with id: " + id));
        return mapToResponse(entity);
    }

    public VentaResponse create(VentaRequest request) {
        Venta entity = new Venta();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public VentaResponse update(Integer id, VentaRequest request) {
        Venta entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Venta not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Integer id) {
        Venta entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Venta not found with id: " + id));
        repository.delete(entity);
    }

    private VentaResponse mapToResponse(Venta entity) {
        VentaResponse response = new VentaResponse();
        response.setId(entity.getId());
        response.setFecha(entity.getFecha());
        if (entity.getCliente() != null) {
            response.setClienteId(entity.getCliente().getId());
        }
        if (entity.getVendedor() != null) {
            response.setVendedorId(entity.getVendedor().getId());
        }
        return response;
    }

    private void mapToEntity(VentaRequest request, Venta entity) {
        entity.setFecha(request.getFecha());
        if (request.getClienteId() != null) {
            entity.setCliente(
                clienteRepository.findById(request.getClienteId())
                    .orElseThrow(() -> new ResourceNotFoundException("Cliente not found with id: " + request.getClienteId()))
            );
        } else {
            entity.setCliente(null);
        }
        if (request.getVendedorId() != null) {
            entity.setVendedor(
                vendedorRepository.findById(request.getVendedorId())
                    .orElseThrow(() -> new ResourceNotFoundException("Vendedor not found with id: " + request.getVendedorId()))
            );
        } else {
            entity.setVendedor(null);
        }
    }
}