#!/usr/bin/env python3
"""
StockSync Server - Python Backend
Real-time stock market data with WebSocket support
Flask + Flask-SocketIO implementation
"""

import os
import json
import random
import logging
from datetime import datetime, timedelta
from collections import defaultdict
from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# In-memory storage
class StockStore:
    def __init__(self):
        self.stocks = {}  # symbol -> stock data
        self.clients = set()
        self.base_prices = {
            'AAPL': 175.50, 'GOOGL': 142.30, 'MSFT': 380.20,
            'AMZN': 155.80, 'TSLA': 245.60, 'META': 505.20,
            'NVDA': 485.10, 'NFLX': 485.90, 'AMD': 145.30,
            'INTC': 42.50, 'CRM': 285.40, 'ORCL': 115.20,
            'UBER': 65.20, 'COIN': 145.80, 'PLTR': 16.50,
            'SQ': 75.30, 'SHOP': 120.40
        }
        self.colors = [
            '#00f3ff', '#ff00ff', '#00ff88', '#ffaa00',
            '#bc13fe', '#ff0055', '#00ffff', '#ffff00'
        ]
        self.color_index = 0
    
    def get_next_color(self):
        color = self.colors[self.color_index % len(self.colors)]
        self.color_index += 1
        return color
    
    def generate_history(self, symbol, days=365):
        """Generate realistic historical stock data using random walk"""
        base = self.base_prices.get(symbol, 100 + random.random() * 200)
        data = []
        current = base
        end_date = datetime.now()
        
        for i in range(days, -1, -1):
            date = end_date - timedelta(days=i)
            # Random walk with 1.5% volatility
            change = (random.random() - 0.5) * 2 * 0.015
            current = current * (1 + change)
            data.append({
                'x': date.strftime('%Y-%m-%d'),
                'y': round(current, 2)
            })
        
        return data
    
    def add_stock(self, symbol):
        """Add a new stock to the store"""
        symbol = symbol.upper().strip()
        
        if symbol in self.stocks:
            return None, "Stock already exists"
        
        history = self.generate_history(symbol)
        current = history[-1]['y']
        previous = history[-2]['y']
        change = round(current - previous, 2)
        change_percent = round((change / previous) * 100, 2)
        
        stock_data = {
            'symbol': symbol,
            'data': history,
            'current': current,
            'change': change,
            'changePercent': change_percent,
            'color': self.get_next_color(),
            'added_at': datetime.now().isoformat()
        }
        
        self.stocks[symbol] = stock_data
        logger.info(f"Added stock: {symbol} at ${current}")
        return stock_data, None
    
    def remove_stock(self, symbol):
        """Remove a stock from the store"""
        symbol = symbol.upper().strip()
        
        if symbol not in self.stocks:
            return False, "Stock not found"
        
        del self.stocks[symbol]
        logger.info(f"Removed stock: {symbol}")
        return True, None
    
    def update_price(self, symbol):
        """Simulate a price update for a stock"""
        if symbol not in self.stocks:
            return None
        
        stock = self.stocks[symbol]
        last_price = stock['data'][-1]['y']
        change = (random.random() - 0.5) * 2
        new_price = round(last_price + change, 2)
        
        stock['current'] = new_price
        stock['data'].append({
            'x': datetime.now().isoformat(),
            'y': new_price
        })
        
        # Keep only last 365 days
        if len(stock['data']) > 365:
            stock['data'] = stock['data'][-365:]
        
        return {
            'symbol': symbol,
            'price': new_price,
            'change': round(new_price - last_price, 2)
        }
    
    def get_all_stocks(self):
        """Return all tracked stocks"""
        return list(self.stocks.values())
    
    def get_stock(self, symbol):
        """Get specific stock data"""
        return self.stocks.get(symbol.upper().strip())

# Initialize store
store = StockStore()


# HTTP Routes
@app.route('/')
def index():
    """Serve the main application"""
    return app.send_static_file('index.html')


@app.route('/api/stocks')
def get_stocks():
    """REST API: Get all stocks"""
    return jsonify({
        'success': True,
        'data': store.get_all_stocks(),
        'count': len(store.stocks)
    })


@app.route('/api/stocks/<symbol>')
def get_stock(symbol):
    """REST API: Get specific stock"""
    stock = store.get_stock(symbol)
    if not stock:
        return jsonify({'success': False, 'error': 'Stock not found'}), 404
    return jsonify({'success': True, 'data': stock})


# WebSocket Events
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    store.clients.add(request.sid)
    logger.info(f"Client connected: {request.sid} (Total: {len(store.clients)})")
    
    # Send current stocks to new client
    emit('initial_data', {
        'stocks': store.get_all_stocks(),
        'client_count': len(store.clients)
    })
    
    # Broadcast updated client count
    emit('client_count', {'count': len(store.clients)}, broadcast=True)


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    store.clients.discard(request.sid)
    logger.info(f"Client disconnected: {request.sid} (Total: {len(store.clients)})")
    emit('client_count', {'count': len(store.clients)}, broadcast=True)


@socketio.on('add_stock')
def handle_add_stock(data):
    """Handle add stock request"""
    symbol = data.get('symbol', '').upper().strip()
    source = data.get('source', 'local')
    
    if not symbol:
        emit('error', {'message': 'Symbol is required'})
        return
    
    stock, error = store.add_stock(symbol)
    
    if error:
        emit('error', {'message': error})
        return
    
    # Broadcast to all clients including sender
    response = {
        'symbol': symbol,
        'stock': stock,
        'source': source,
        'added_by': request.sid
    }
    
    emit('stock_added', response, broadcast=True)
    logger.info(f"Stock {symbol} added by {request.sid}")


@socketio.on('remove_stock')
def handle_remove_stock(data):
    """Handle remove stock request"""
    symbol = data.get('symbol', '').upper().strip()
    source = data.get('source', 'local')
    
    success, error = store.remove_stock(symbol)
    
    if not success:
        emit('error', {'message': error})
        return
    
    response = {
        'symbol': symbol,
        'source': source,
        'removed_by': request.sid
    }
    
    emit('stock_removed', response, broadcast=True)
    logger.info(f"Stock {symbol} removed by {request.sid}")


@socketio.on('get_history')
def handle_get_history(data):
    """Get historical data for a symbol"""
    symbol = data.get('symbol', '').upper().strip()
    days = data.get('days', 365)
    
    stock = store.get_stock(symbol)
    if not stock:
        emit('error', {'message': f'Stock {symbol} not found'})
        return
    
    # Filter data by days
    history = stock['data'][-days:] if days < len(stock['data']) else stock['data']
    
    emit('history_data', {
        'symbol': symbol,
        'data': history
    })


# Background Tasks
def price_update_task():
    """Background task to simulate price updates"""
    import time
    while True:
        socketio.sleep(5)  # Update every 5 seconds
        
        if store.stocks:
            # Pick random stock to update
            symbol = random.choice(list(store.stocks.keys()))
            update = store.update_price(symbol)
            
            if update:
                socketio.emit('price_update', update)
                logger.debug(f"Price update: {symbol} = ${update['price']}")


def random_activity_task():
    """Simulate random user activity"""
    import time
    symbols = ['UBER', 'COIN', 'PLTR', 'SQ', 'SHOP', 'DIS', 'NKE', 'PYPL']
    
    while True:
        socketio.sleep(20)  # Activity every 20 seconds
        
        if random.random() > 0.5 and len(store.clients) > 0:
            action = random.choice(['add', 'remove'])
            
            if action == 'add':
                symbol = random.choice(symbols)
                if symbol not in store.stocks:
                    stock, _ = store.add_stock(symbol)
                    if stock:
                        socketio.emit('stock_added', {
                            'symbol': symbol,
                            'stock': stock,
                            'source': 'remote',
                            'message': f'{symbol} added by another user'
                        })
                        logger.info(f"Simulated: Added {symbol}")
            else:
                if store.stocks:
                    symbol = random.choice(list(store.stocks.keys()))
                    store.remove_stock(symbol)
                    socketio.emit('stock_removed', {
                        'symbol': symbol,
                        'source': 'remote',
                        'message': f'{symbol} removed by another user'
                    })
                    logger.info(f"Simulated: Removed {symbol}")


# Start background tasks
@socketio.on('connect')
def start_background_tasks():
    """Start background tasks on first connection"""
    if len(store.clients) == 1:
        socketio.start_background_task(price_update_task)
        socketio.start_background_task(random_activity_task)


if __name__ == '__main__':
    # Add some default stocks
    for symbol in ['AAPL', 'GOOGL', 'MSFT']:
        store.add_stock(symbol)
    
    logger.info("Starting StockSync Server...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
