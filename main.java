// StockSyncServer.java
// Spring Boot + WebSocket implementation

package com.stocksync;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

@SpringBootApplication
@EnableScheduling
public class StockSyncServer {
    public static void main(String[] args) {
        SpringApplication.run(StockSyncServer.class, args);
    }
}

// Configuration
@Configuration
@EnableWebSocketMessageBroker
class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
    }
    
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins("*")
                .withSockJS();
    }
}

// Data Models
class Stock {
    private String symbol;
    private List<DataPoint> data;
    private double current;
    private double change;
    private double changePercent;
    private String color;
    private String addedAt;
    
    public Stock() {}
    
    public Stock(String symbol, List<DataPoint> data, double current, 
                 double change, double changePercent, String color) {
        this.symbol = symbol;
        this.data = data;
        this.current = current;
        this.change = change;
        this.changePercent = changePercent;
        this.color = color;
        this.addedAt = LocalDateTime.now().toString();
    }
    
    // Getters and Setters
    public String getSymbol() { return symbol; }
    public void setSymbol(String symbol) { this.symbol = symbol; }
    
    public List<DataPoint> getData() { return data; }
    public void setData(List<DataPoint> data) { this.data = data; }
    
    public double getCurrent() { return current; }
    public void setCurrent(double current) { this.current = current; }
    
    public double getChange() { return change; }
    public void setChange(double change) { this.change = change; }
    
    public double getChangePercent() { return changePercent; }
    public void setChangePercent(double changePercent) { this.changePercent = changePercent; }
    
    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
    
    public String getAddedAt() { return addedAt; }
    public void setAddedAt(String addedAt) { this.addedAt = addedAt; }
}

class DataPoint {
    private String x;
    private double y;
    
    public DataPoint() {}
    
    public DataPoint(String x, double y) {
        this.x = x;
        this.y = y;
    }
    
    public String getX() { return x; }
    public void setX(String x) { this.x = x; }
    
    public double getY() { return y; }
    public void setY(double y) { this.y = y; }
}

class StockRequest {
    private String symbol;
    private String source;
    
    public String getSymbol() { return symbol; }
    public void setSymbol(String symbol) { this.symbol = symbol; }
    
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
}

class PriceUpdate {
    private String symbol;
    private double price;
    private double change;
    
    public PriceUpdate(String symbol, double price, double change) {
        this.symbol = symbol;
        this.price = price;
        this.change = change;
    }
    
    public String getSymbol() { return symbol; }
    public double getPrice() { return price; }
    public double getChange() { return change; }
}

class ApiResponse<T> {
    private boolean success;
    private T data;
    private String error;
    
    public ApiResponse(boolean success, T data, String error) {
        this.success = success;
        this.data = data;
        this.error = error;
    }
    
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null);
    }
    
    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, null, message);
    }
    
    // Getters
    public boolean isSuccess() { return success; }
    public T getData() { return data; }
    public String getError() { return error; }
}

// Stock Service
@Service
class StockService {
    private final Map<String, Stock> stocks = new ConcurrentHashMap<>();
    private final Set<String> clients = ConcurrentHashMap.newKeySet();
    private final Map<String, Double> basePrices = new HashMap<>();
    private final List<String> colors = Arrays.asList(
        "#00f3ff", "#ff00ff", "#00ff88", "#ffaa00",
        "#bc13fe", "#ff0055", "#00ffff", "#ffff00"
    );
    private int colorIndex = 0;
    private final Random random = new Random();
    
    public StockService() {
        // Initialize base prices
        basePrices.put("AAPL", 175.50);
        basePrices.put("GOOGL", 142.30);
        basePrices.put("MSFT", 380.20);
        basePrices.put("AMZN", 155.80);
        basePrices.put("TSLA", 245.60);
        basePrices.put("META", 505.20);
        basePrices.put("NVDA", 485.10);
        basePrices.put("NFLX", 485.90);
        basePrices.put("AMD", 145.30);
        basePrices.put("INTC", 42.50);
    }
    
    private String getNextColor() {
        String color = colors.get(colorIndex % colors.size());
        colorIndex++;
        return color;
    }
    
    public List<DataPoint> generateHistory(String symbol, int days) {
        double base = basePrices.getOrDefault(symbol, 100.0 + random.nextDouble() * 200);
        List<DataPoint> data = new ArrayList<>();
        double current = base;
        LocalDateTime endDate = LocalDateTime.now();
        
        for (int i = days; i >= 0; i--) {
            LocalDateTime date = endDate.minusDays(i);
            double change = (random.nextDouble() - 0.5) * 2 * 0.015;
            current = current * (1 + change);
            data.add(new DataPoint(
                date.format(DateTimeFormatter.ISO_LOCAL_DATE),
                Math.round(current * 100.0) / 100.0
            ));
        }
        
        return data;
    }
    
    public Stock addStock(String symbol) throws Exception {
        symbol = symbol.toUpperCase().trim();
        
        if (stocks.containsKey(symbol)) {
            throw new Exception("Stock already exists");
        }
        
        List<DataPoint> history = generateHistory(symbol, 365);
        double current = history.get(history.size() - 1).getY();
        double previous = history.get(history.size() - 2).getY();
        double change = Math.round((current - previous) * 100.0) / 100.0;
        double changePercent = Math.round((change / previous) * 10000.0) / 100.0;
        
        Stock stock = new Stock(symbol, history, current, change, changePercent, getNextColor());
        stocks.put(symbol, stock);
        
        return stock;
    }
    
    public void removeStock(String symbol) throws Exception {
        symbol = symbol.toUpperCase().trim();
        
        if (!stocks.containsKey(symbol)) {
            throw new Exception("Stock not found");
        }
        
        stocks.remove(symbol);
    }
    
    public PriceUpdate updatePrice(String symbol) {
        if (!stocks.containsKey(symbol)) return null;
        
        Stock stock = stocks.get(symbol);
        double lastPrice = stock.getCurrent();
        double change = (random.nextDouble() - 0.5) * 2;
        double newPrice = Math.round((lastPrice + change) * 100.0) / 100.0;
        
        stock.setCurrent(newPrice);
        stock.getData().add(new DataPoint(
            LocalDateTime.now().toString(),
            newPrice
        ));
        
        // Keep only last 365 entries
        if (stock.getData().size() > 365) {
            stock.setData(new ArrayList<>(stock.getData().subList(
                stock.getData().size() - 365, 
                stock.getData().size()
            )));
        }
        
        return new PriceUpdate(symbol, newPrice, Math.round((newPrice - lastPrice) * 100.0) / 100.0);
    }
    
    public Collection<Stock> getAllStocks() {
        return stocks.values();
    }
    
    public Stock getStock(String symbol) {
        return stocks.get(symbol.toUpperCase().trim());
    }
    
    public Set<String> getClients() {
        return clients;
    }
    
    public void addClient(String clientId) {
        clients.add(clientId);
    }
    
    public void removeClient(String clientId) {
        clients.remove(clientId);
    }
    
    public int getClientCount() {
        return clients.size();
    }
    
    public List<String> getSymbols() {
        return new ArrayList<>(stocks.keySet());
    }
}

// REST Controller
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
class StockController {
    
    @Autowired
    private StockService stockService;
    
    @GetMapping("/stocks")
    public ApiResponse<Collection<Stock>> getAllStocks() {
        return ApiResponse.success(stockService.getAllStocks());
    }
    
    @GetMapping("/stocks/{symbol}")
    public ApiResponse<Stock> getStock(@PathVariable String symbol) {
        Stock stock = stockService.getStock(symbol);
        if (stock == null) {
            return ApiResponse.error("Stock not found");
        }
        return ApiResponse.success(stock);
    }
    
    @PostMapping("/stocks")
    public ApiResponse<Stock> addStock(@RequestBody StockRequest request) {
        try {
            Stock stock = stockService.addStock(request.getSymbol());
            return ApiResponse.success(stock);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
    
    @DeleteMapping("/stocks/{symbol}")
    public ApiResponse<Void> removeStock(@PathVariable String symbol) {
        try {
            stockService.removeStock(symbol);
            return ApiResponse.success(null);
        } catch (Exception e) {
            return ApiResponse.error(e.getMessage());
        }
    }
}

// WebSocket Controller
@Controller
public class WebSocketController {
    
    @Autowired
    private StockService stockService;
    
    @Autowired
    private SimpMessagingTemplate messagingTemplate;
    
    @MessageMapping("/add_stock")
    public void addStock(@Payload StockRequest request) {
        try {
            Stock stock = stockService.addStock(request.getSymbol());
            
            Map<String, Object> response = new HashMap<>();
            response.put("symbol", stock.getSymbol());
            response.put("stock", stock);
            response.put("source", request.getSource());
            
            messagingTemplate.convertAndSend("/topic/stock_added", response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            messagingTemplate.convertAndSend("/topic/error", error);
        }
    }
    
    @MessageMapping("/remove_stock")
    public void removeStock(@Payload StockRequest request) {
        try {
            stockService.removeStock(request.getSymbol());
            
            Map<String, Object> response = new HashMap<>();
            response.put("symbol", request.getSymbol().toUpperCase());
            response.put("source", request.getSource());
            
            messagingTemplate.convertAndSend("/topic/stock_removed", response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("message", e.getMessage());
            messagingTemplate.convertAndSend("/topic/error", error);
        }
    }
    
    @Scheduled(fixedRate = 5000)
    public void simulatePriceUpdates() {
        List<String> symbols = stockService.getSymbols();
        if (symbols.isEmpty()) return;
        
        String symbol = symbols.get(new Random().nextInt(symbols.size()));
        PriceUpdate update = stockService.updatePrice(symbol);
        
        if (update != null) {
            messagingTemplate.convertAndSend("/topic/price_update", update);
        }
    }
    
    @Scheduled(fixedRate = 20000)
    public void simulateUserActivity() {
        String[] symbols = {"UBER", "COIN", "PLTR", "SQ", "SHOP"};
        Random random = new Random();
        
        if (random.nextBoolean() && stockService.getClientCount() > 0) {
            String action = random.nextBoolean() ? "add" : "remove";
            
            if (action.equals("add")) {
                String symbol = symbols[random.nextInt(symbols.length)];
                try {
                    Stock stock = stockService.addStock(symbol);
                    Map<String, Object> response = new HashMap<>();
                    response.put("symbol", symbol);
                    response.put("stock", stock);
                    response.put("source", "remote");
                    messagingTemplate.convertAndSend("/topic/stock_added", response);
                } catch (Exception e) {
                    // Stock might already exist, ignore
                }
            } else {
                List<String> current = stockService.getSymbols();
                if (!current.isEmpty()) {
                    String symbol = current.get(random.nextInt(current.size()));
                    try {
                        stockService.removeStock(symbol);
                        Map<String, Object> response = new HashMap<>();
                        response.put("symbol", symbol);
                        response.put("source", "remote");
                        messagingTemplate.convertAndSend("/topic/stock_removed", response);
                    } catch (Exception e) {
                        // Ignore
                    }
                }
            }
        }
    }
}
