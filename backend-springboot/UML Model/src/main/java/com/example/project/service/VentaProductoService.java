package com.example.project.service;

import com.example.project.entity.VentaProducto;
import com.example.project.entity.Venta;
import com.example.project.repository.VentaRepository;
import com.example.project.entity.Producto;
import com.example.project.repository.ProductoRepository;
import com.example.project.dto.request.VentaProductoRequest;
import com.example.project.dto.response.VentaProductoResponse;
import com.example.project.repository.VentaProductoRepository;
import com.example.project.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
@Transactional
public class VentaProductoService {

    private final VentaProductoRepository repository;
    private final VentaRepository ventaRepository;
    private final ProductoRepository productoRepository;

    public VentaProductoService(
        VentaProductoRepository repository,
        VentaRepository ventaRepository,
        ProductoRepository productoRepository    ) {
        this.repository = repository;
        this.ventaRepository = ventaRepository;
        this.productoRepository = productoRepository;
    }

    public List<VentaProductoResponse> findAll() {
        return repository.findAll().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    public VentaProductoResponse findById(Long id) {
        VentaProducto entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("VentaProducto not found with id: " + id));
        return mapToResponse(entity);
    }

    public VentaProductoResponse create(VentaProductoRequest request) {
        VentaProducto entity = new VentaProducto();
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public VentaProductoResponse update(Long id, VentaProductoRequest request) {
        VentaProducto entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("VentaProducto not found with id: " + id));
        mapToEntity(request, entity);
        entity = repository.save(entity);
        return mapToResponse(entity);
    }

    public void delete(Long id) {
        VentaProducto entity = repository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("VentaProducto not found with id: " + id));
        repository.delete(entity);
    }

    private VentaProductoResponse mapToResponse(VentaProducto entity) {
        VentaProductoResponse response = new VentaProductoResponse();
        response.setId(entity.getId());
        response.setCantidad(entity.getCantidad());
        response.setPreunit(entity.getPreunit());
        if (entity.getVenta() != null) {
            response.setVentaId(entity.getVenta().getId());
        }
        if (entity.getProducto() != null) {
            response.setProductoId(entity.getProducto().getId());
        }
        return response;
    }

    private void mapToEntity(VentaProductoRequest request, VentaProducto entity) {
        entity.setCantidad(request.getCantidad());
        entity.setPreunit(request.getPreunit());
        if (request.getVentaId() != null) {
            entity.setVenta(
                ventaRepository.findById(request.getVentaId())
                    .orElseThrow(() -> new ResourceNotFoundException("Venta not found with id: " + request.getVentaId()))
            );
        } else {
            entity.setVenta(null);
        }
        if (request.getProductoId() != null) {
            entity.setProducto(
                productoRepository.findById(request.getProductoId())
                    .orElseThrow(() -> new ResourceNotFoundException("Producto not found with id: " + request.getProductoId()))
            );
        } else {
            entity.setProducto(null);
        }
    }
}