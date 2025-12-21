"""
Fuel BI Dashboard - REST API Server
Flask-based API with authentication and data endpoints
"""

import os
import sys
from pathlib import Path
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent.parent))

from dotenv import load_dotenv
from backend.auth.auth_service import AuthService, AuthenticationError
from backend.fifo.fifo_engine import FIFOEngine
from supabase import create_client
from decimal import Decimal

# Load environment
env_path = Path(__file__).parent.parent.parent / 'config' / '.env.local'
load_dotenv(env_path)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend access

# Initialize services
auth_service = AuthService()
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_KEY')

# Create Supabase client
supabase = create_client(supabase_url, supabase_key)

# Force HTTP/1.1 to avoid Windows HTTP/2 socket errors
import httpx
http1_client = httpx.Client(http2=False, timeout=60.0)
supabase.postgrest.session = http1_client

# ============================================================
# MIDDLEWARE & DECORATORS
# ============================================================

def require_auth(f):
    """Decorator to require authentication for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get token from Authorization header
        auth_header = request.headers.get('Authorization')

        if not auth_header:
            return jsonify({'error': 'Authorization header required'}), 401

        try:
            # Extract token (format: "Bearer <token>")
            token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header

            # Verify token
            payload = auth_service.verify_token(token)

            # Add user info to request context
            request.user = payload

            return f(*args, **kwargs)

        except AuthenticationError as e:
            return jsonify({'error': str(e)}), 401
        except Exception as e:
            return jsonify({'error': 'Invalid token'}), 401

    return decorated_function

def require_manager(f):
    """Decorator to require manager or super_admin role"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        role = request.user.get('role')

        if role not in ['manager', 'super_admin']:
            return jsonify({'error': 'Forbidden: Manager or Admin access required'}), 403

        return f(*args, **kwargs)

    return decorated_function

# ============================================================
# AUTHENTICATION ENDPOINTS
# ============================================================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login endpoint"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body required'}), 400

        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        # Authenticate
        result = auth_service.login(email, password)

        return jsonify(result), 200

    except AuthenticationError as e:
        return jsonify({'error': str(e)}), 401
    except Exception as e:
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    """Logout endpoint"""
    try:
        auth_header = request.headers.get('Authorization')
        token = auth_header.split(' ')[1] if ' ' in auth_header else auth_header

        result = auth_service.logout(token)
        return jsonify(result), 200

    except Exception as e:
        return jsonify({'error': 'Logout failed'}), 500

@app.route('/api/auth/verify', methods=['GET'])
@require_auth
def verify():
    """Verify token endpoint"""
    return jsonify({
        'valid': True,
        'user': request.user
    }), 200

@app.route('/api/auth/me', methods=['GET'])
@require_auth
def get_current_user():
    """Get current user info"""
    try:
        user_id = request.user['user_id']

        # Get full user info from database
        result = supabase.table('users').select(
            'id, email, full_name, role, company_id, is_active, last_login, login_count'
        ).eq('id', user_id).execute()

        if not result.data:
            return jsonify({'error': 'User not found'}), 404

        user = result.data[0]

        # Get company info
        company_result = supabase.table('companies').select(
            'company_code, company_name, display_name, status'
        ).eq('id', user['company_id']).execute()

        company = company_result.data[0] if company_result.data else None

        return jsonify({
            'user': user,
            'company': company
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================
# DATA ENDPOINTS - PURCHASES
# ============================================================

@app.route('/api/purchases', methods=['GET'])
@require_auth
def get_purchases():
    """Get fuel purchases"""
    try:
        company_id = request.user['company_id']
        role = request.user['role']

        # Build query
        query = supabase.table('fuel_purchases').select('*')

        # Apply RLS (non-super_admin users only see their company)
        if role != 'super_admin':
            query = query.eq('company_id', company_id)

        # Optional filters
        product_code = request.args.get('product_code')
        if product_code:
            query = query.eq('product_code', product_code)

        status = request.args.get('status', 'active')
        if status:
            query = query.eq('batch_status', status)

        # Execute query
        result = query.order('purchase_date', desc=True).limit(100).execute()

        return jsonify({
            'purchases': result.data,
            'count': len(result.data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/purchases/<int:purchase_id>', methods=['GET'])
@require_auth
def get_purchase(purchase_id):
    """Get single purchase by ID"""
    try:
        company_id = request.user['company_id']
        role = request.user['role']

        query = supabase.table('fuel_purchases').select('*').eq('id', purchase_id)

        if role != 'super_admin':
            query = query.eq('company_id', company_id)

        result = query.execute()

        if not result.data:
            return jsonify({'error': 'Purchase not found'}), 404

        return jsonify({'purchase': result.data[0]}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================
# DATA ENDPOINTS - SALES
# ============================================================

@app.route('/api/sales', methods=['GET'])
@require_auth
def get_sales():
    """Get pump sales"""
    try:
        company_id = request.user['company_id']
        role = request.user['role']

        query = supabase.table('pump_sales_intraday').select('*')

        if role != 'super_admin':
            query = query.eq('company_id', company_id)

        # Optional filters
        pump_number = request.args.get('pump')
        if pump_number:
            query = query.eq('pump_number', pump_number)

        product_code = request.args.get('product_code')
        if product_code:
            query = query.eq('product_code', product_code)

        result = query.order('sale_date', desc=True).limit(100).execute()

        return jsonify({
            'sales': result.data,
            'count': len(result.data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================
# DATA ENDPOINTS - INVENTORY
# ============================================================

@app.route('/api/inventory', methods=['GET'])
@require_auth
def get_inventory():
    """Get current inventory"""
    try:
        company_id = request.user['company_id']
        role = request.user['role']

        query = supabase.table('current_inventory').select('*')

        if role != 'super_admin':
            query = query.eq('company_id', company_id)

        result = query.order('product_name').execute()

        return jsonify({
            'inventory': result.data,
            'count': len(result.data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/inventory/adjustments', methods=['GET'])
@require_auth
def get_adjustments():
    """Get inventory adjustments (losses/gains)"""
    try:
        company_id = request.user['company_id']
        role = request.user['role']

        query = supabase.table('inventory_adjustments').select('*')

        if role != 'super_admin':
            query = query.eq('company_id', company_id)

        # Optional filters
        adjustment_type = request.args.get('type')
        if adjustment_type:
            query = query.eq('adjustment_type', adjustment_type)

        result = query.order('adjustment_date', desc=True).limit(100).execute()

        return jsonify({
            'adjustments': result.data,
            'count': len(result.data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================
# DATA ENDPOINTS - PRODUCTS
# ============================================================

@app.route('/api/products', methods=['GET'])
@require_auth
def get_products():
    """Get products"""
    try:
        company_id = request.user['company_id']
        role = request.user['role']

        query = supabase.table('products').select('*')

        if role != 'super_admin':
            query = query.eq('company_id', company_id)

        result = query.eq('is_active', True).order('product_name').execute()

        return jsonify({
            'products': result.data,
            'count': len(result.data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================
# ADMIN ENDPOINTS
# ============================================================

@app.route('/api/admin/companies', methods=['GET'])
@require_auth
def get_companies():
    """Get all companies (super_admin only)"""
    try:
        if request.user['role'] != 'super_admin':
            return jsonify({'error': 'Admin access required'}), 403

        result = supabase.table('companies').select('*').order('company_name').execute()

        return jsonify({
            'companies': result.data,
            'count': len(result.data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
@require_auth
def get_users():
    """Get all users (super_admin only)"""
    try:
        if request.user['role'] != 'super_admin':
            return jsonify({'error': 'Admin access required'}), 403

        result = supabase.table('users').select(
            'id, email, full_name, role, company_id, is_active, last_login, login_count'
        ).order('full_name').execute()

        return jsonify({
            'users': result.data,
            'count': len(result.data)
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ============================================================
# FIFO ENDPOINTS
# ============================================================

@app.route('/api/fifo/report', methods=['GET'])
@require_auth
def get_fifo_report():
    """Get FIFO profit/loss report"""
    try:
        company_id = request.user['company_id']

        # Get fifo_start_date from query params or company settings
        fifo_start_date = request.args.get('start_date')

        # If not provided, check company settings
        if not fifo_start_date:
            company = supabase.table('companies').select('fifo_start_date').eq('id', company_id).execute()
            if company.data and company.data[0].get('fifo_start_date'):
                fifo_start_date = company.data[0]['fifo_start_date']

        # Initialize FIFO engine
        engine = FIFOEngine(company_id=company_id, fifo_start_date=fifo_start_date)

        # Get all sales
        sales_query = supabase.table('pump_sales_intraday').select(
            'id, sale_date, product_code, product_name, volume_sold, '
            'sale_price_per_liter, total_revenue'
        ).eq('company_id', company_id).order('sale_date')

        sales_result = sales_query.execute()
        sales = sales_result.data

        # Process each sale
        results = []
        total_revenue = Decimal('0')
        total_cogs = Decimal('0')

        for sale in sales:
            try:
                cogs_result = engine.calculate_sale_cogs(
                    sale_id=sale['id'],
                    product_code=sale['product_code'],
                    sale_date=sale['sale_date'],
                    volume_sold=Decimal(str(sale['volume_sold'])),
                    update_batches=False
                )

                revenue = Decimal(str(sale['total_revenue']))
                cogs = Decimal(str(cogs_result['total_cogs']))
                profit = revenue - cogs
                margin_pct = (profit / revenue * 100) if revenue > 0 else Decimal('0')

                results.append({
                    'sale_id': sale['id'],
                    'date': sale['sale_date'],
                    'product_code': sale['product_code'],
                    'product_name': sale['product_name'],
                    'volume': float(sale['volume_sold']),
                    'revenue': float(revenue),
                    'cogs': float(cogs),
                    'profit': float(profit),
                    'margin_pct': float(margin_pct)
                })

                total_revenue += revenue
                total_cogs += cogs

            except Exception as e:
                # Skip sales that can't be calculated
                continue

        # Get losses/gains
        adjustments_result = supabase.table('inventory_adjustments').select(
            'product_code, product_name, adjustment_type, volume, total_cost'
        ).eq('company_id', company_id).execute()

        total_loss_volume = Decimal('0')
        total_loss_cost = Decimal('0')
        total_gain_volume = Decimal('0')

        losses = []
        gains = []

        for adj in adjustments_result.data:
            adj_type = adj['adjustment_type']
            volume = Decimal(str(adj['volume']))
            cost = Decimal(str(adj['total_cost'] or 0))

            if adj_type == 'loss':
                total_loss_volume += volume
                total_loss_cost += cost
                losses.append({
                    'product_code': adj['product_code'],
                    'product_name': adj['product_name'],
                    'volume': float(volume),
                    'cost': float(cost)
                })
            elif adj_type == 'gain':
                total_gain_volume += volume
                gains.append({
                    'product_code': adj['product_code'],
                    'product_name': adj['product_name'],
                    'volume': float(volume)
                })

        # Calculate totals
        total_profit = total_revenue - total_cogs
        overall_margin = (total_profit / total_revenue * 100) if total_revenue > 0 else Decimal('0')

        adjusted_profit = total_profit - total_loss_cost
        adjusted_margin = (adjusted_profit / total_revenue * 100) if total_revenue > 0 else Decimal('0')

        return jsonify({
            'fifo_start_date': fifo_start_date,
            'sales_count': len(results),
            'total_revenue': float(total_revenue),
            'total_cogs': float(total_cogs),
            'total_profit': float(total_profit),
            'overall_margin': float(overall_margin),
            'total_loss_volume': float(total_loss_volume),
            'total_loss_cost': float(total_loss_cost),
            'total_gain_volume': float(total_gain_volume),
            'adjusted_profit': float(adjusted_profit),
            'adjusted_margin': float(adjusted_margin),
            'losses': losses,
            'gains': gains,
            'sales': results
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/fifo/settings', methods=['GET'])
@require_auth
def get_fifo_settings():
    """Get company FIFO settings"""
    try:
        company_id = request.user['company_id']

        result = supabase.table('companies').select(
            'fifo_start_date'
        ).eq('id', company_id).execute()

        if not result.data:
            return jsonify({'error': 'Company not found'}), 404

        return jsonify({
            'fifo_start_date': result.data[0].get('fifo_start_date')
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/fifo/settings', methods=['POST'])
@require_auth
def update_fifo_settings():
    """Update company FIFO settings"""
    try:
        company_id = request.user['company_id']
        role = request.user['role']

        # Only regular users and admins can update settings
        if role not in ['user', 'super_admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403

        data = request.get_json()
        fifo_start_date = data.get('fifo_start_date')

        # Update company settings
        supabase.table('companies').update({
            'fifo_start_date': fifo_start_date
        }).eq('id', company_id).execute()

        return jsonify({
            'success': True,
            'fifo_start_date': fifo_start_date
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/fifo/product-analysis', methods=['GET'])
@require_auth
def get_product_analysis():
    """Get detailed FIFO analysis by product"""
    try:
        company_id = request.user['company_id']
        fifo_start_date = request.args.get('start_date')

        # Get FIFO start date from company settings if not provided
        if not fifo_start_date:
            company = supabase.table('companies').select('fifo_start_date').eq('id', company_id).execute()
            if company.data and company.data[0].get('fifo_start_date'):
                fifo_start_date = company.data[0]['fifo_start_date']

        # Initialize FIFO engine
        engine = FIFOEngine(company_id=company_id, fifo_start_date=fifo_start_date)

        # Get all products
        products_result = supabase.table('products').select(
            'product_code, product_name'
        ).eq('company_id', company_id).execute()

        product_analyses = []

        for product in products_result.data:
            product_code = product['product_code']
            product_name = product['product_name']

            # Get all sales for this product
            sales = supabase.table('pump_sales_intraday').select(
                'id, sale_date, volume_sold, sale_price_per_liter, total_revenue'
            ).eq('company_id', company_id).eq(
                'product_code', product_code
            ).order('sale_date', desc=False).execute()

            if not sales.data:
                continue

            # Calculate FIFO COGS for all sales of this product
            total_revenue = Decimal('0')
            total_cogs = Decimal('0')
            total_volume = Decimal('0')

            for sale in sales.data:
                volume = Decimal(str(sale['volume_sold']))
                revenue = Decimal(str(sale['total_revenue']))

                # Calculate COGS using FIFO
                cogs_result = engine.calculate_sale_cogs(
                    sale_id=sale['id'],
                    product_code=product_code,
                    sale_date=sale['sale_date'],
                    volume_sold=volume
                )

                total_volume += volume
                total_revenue += revenue
                total_cogs += Decimal(str(cogs_result['total_cogs']))

            # Get losses for this product
            losses = supabase.table('inventory_adjustments').select(
                'volume, total_cost'
            ).eq('company_id', company_id).eq(
                'product_code', product_code
            ).eq('adjustment_type', 'loss').execute()

            total_loss_volume = sum(Decimal(str(l['volume'])) for l in losses.data)
            total_loss_cost = sum(Decimal(str(l['total_cost'] or 0)) for l in losses.data)

            # Get gains for this product
            gains = supabase.table('inventory_adjustments').select(
                'volume'
            ).eq('company_id', company_id).eq(
                'product_code', product_code
            ).eq('adjustment_type', 'gain').execute()

            total_gain_volume = sum(Decimal(str(g['volume'])) for g in gains.data)

            # Get current inventory
            inventory = supabase.table('fuel_purchases').select(
                'remaining_volume'
            ).eq('company_id', company_id).eq(
                'product_code', product_code
            ).eq('batch_status', 'active').execute()

            current_stock = sum(Decimal(str(i['remaining_volume'])) for i in inventory.data)

            # Calculate profit and margins
            profit = total_revenue - total_cogs
            margin = (profit / total_revenue * 100) if total_revenue > 0 else Decimal('0')

            adjusted_profit = profit - total_loss_cost
            adjusted_margin = (adjusted_profit / total_revenue * 100) if total_revenue > 0 else Decimal('0')

            product_analyses.append({
                'product_code': product_code,
                'product_name': product_name,
                'sales_count': len(sales.data),
                'total_volume_sold': float(total_volume),
                'total_revenue': float(total_revenue),
                'total_cogs': float(total_cogs),
                'profit': float(profit),
                'margin': float(margin),
                'loss_volume': float(total_loss_volume),
                'loss_cost': float(total_loss_cost),
                'gain_volume': float(total_gain_volume),
                'adjusted_profit': float(adjusted_profit),
                'adjusted_margin': float(adjusted_margin),
                'current_stock': float(current_stock)
            })

        return jsonify({
            'fifo_start_date': fifo_start_date,
            'products': product_analyses
        }), 200

    except Exception as e:
        print(f"[ERROR] Product analysis failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ============================================================
# DASHBOARD ENDPOINTS
# ============================================================

@app.route('/api/dashboard/vendas', methods=['GET'])
@require_auth
def get_vendas_dashboard():
    """Get sales dashboard data"""
    try:
        company_id = request.user['company_id']

        # Get date range from query params (default: last 7 days)
        from datetime import datetime, timedelta
        end_date = request.args.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        start_date = request.args.get('start_date', (datetime.now() - timedelta(days=6)).strftime('%Y-%m-%d'))

        # Get all sales in date range with pagination (Supabase default limit is 1000)
        sales_data = []
        offset = 0
        page_size = 1000
        while True:
            sales_query = supabase.table('pump_sales_intraday').select(
                'sale_date, product_code, product_name, volume_sold, sale_price_per_liter, total_revenue'
            ).eq('company_id', company_id).gte('sale_date', start_date).lte('sale_date', end_date).range(offset, offset + page_size - 1).execute()
            sales_data.extend(sales_query.data)
            if len(sales_query.data) < page_size:
                break
            offset += page_size

        # Get ALL purchase costs (not just date range) for accurate margin calculation
        # This ensures we always have cost data even if no purchases in selected period
        purchases_data = []
        offset = 0
        while True:
            purchases_query = supabase.table('purchases').select(
                'canonical_product_code, cost_price, quantity'
            ).eq('company_id', company_id).range(offset, offset + page_size - 1).execute()
            purchases_data.extend(purchases_query.data)
            if len(purchases_query.data) < page_size:
                break
            offset += page_size

        # Calculate weighted average purchase cost per product (total_cost / total_quantity)
        purchase_costs = {}
        for purchase in purchases_data:
            product_code = purchase['canonical_product_code']
            cost_per_liter = Decimal(str(purchase['cost_price']))
            quantity = Decimal(str(purchase['quantity']))

            if product_code not in purchase_costs:
                purchase_costs[product_code] = {
                    'total_cost': Decimal('0'),  # Sum of (cost * quantity)
                    'total_quantity': Decimal('0')
                }

            purchase_costs[product_code]['total_cost'] += cost_per_liter * quantity
            purchase_costs[product_code]['total_quantity'] += quantity

        # Aggregate by product
        product_summary = {}
        daily_volumes = {}

        for sale in sales_data:
            product_code = sale['product_code']
            product_name = sale['product_name']
            volume = Decimal(str(sale['volume_sold']))
            revenue = Decimal(str(sale['total_revenue']))
            price = Decimal(str(sale['sale_price_per_liter']))
            sale_date = sale['sale_date']

            # Skip sales with no date
            if sale_date is None:
                continue

            # Product summary
            if product_code not in product_summary:
                product_summary[product_code] = {
                    'product': product_name,
                    'volume': Decimal('0'),
                    'revenue': Decimal('0'),
                    'price_sum': Decimal('0'),
                    'price_count': 0
                }

            product_summary[product_code]['volume'] += volume
            product_summary[product_code]['revenue'] += revenue
            product_summary[product_code]['price_sum'] += price
            product_summary[product_code]['price_count'] += 1

            # Daily volumes
            if sale_date not in daily_volumes:
                daily_volumes[sale_date] = {
                    'date': sale_date,
                    'GC': 0, 'GA': 0, 'ET': 0, 'DS10': 0, 'DS500': 0, 'total': 0
                }

            daily_volumes[sale_date][product_code] = daily_volumes[sale_date].get(product_code, 0) + float(volume)
            daily_volumes[sale_date]['total'] += float(volume)

        # Format product summary
        products = []
        total_volume = Decimal('0')
        total_revenue = Decimal('0')

        for code, data in product_summary.items():
            avg_price = data['price_sum'] / data['price_count'] if data['price_count'] > 0 else Decimal('0')

            # Get weighted average purchase cost for this product (total_cost / total_quantity)
            avg_cost = Decimal('0')
            if code in purchase_costs and purchase_costs[code]['total_quantity'] > 0:
                avg_cost = purchase_costs[code]['total_cost'] / purchase_costs[code]['total_quantity']

            products.append({
                'product_code': code,
                'product_name': data['product'],
                'volume_sold': float(data['volume']),
                'avg_price': float(avg_price),
                'avg_cost': float(avg_cost),
                'revenue': float(data['revenue'])
            })
            total_volume += data['volume']
            total_revenue += data['revenue']

        # Sort daily volumes by date (filter out None dates)
        evolution = sorted(
            [v for v in daily_volumes.values() if v['date'] is not None],
            key=lambda x: x['date']
        )

        return jsonify({
            'start_date': start_date,
            'end_date': end_date,
            'total_volume': float(total_volume),
            'total_revenue': float(total_revenue),
            'avg_price': float(total_revenue / total_volume) if total_volume > 0 else 0,
            'products': products,
            'evolution': evolution
        }), 200

    except Exception as e:
        print(f"[ERROR] Vendas dashboard failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/dashboard/compras', methods=['GET'])
@require_auth
def get_compras_dashboard():
    """Get purchases dashboard data"""
    try:
        company_id = request.user['company_id']

        # Get date range from query params
        from datetime import datetime, timedelta
        end_date = request.args.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        start_date = request.args.get('start_date', (datetime.now() - timedelta(days=6)).strftime('%Y-%m-%d'))

        # Get all purchases in date range with pagination (Supabase default limit is 1000)
        purchases_data = []
        offset = 0
        page_size = 1000
        while True:
            purchases_query = supabase.table('purchases').select(
                'receipt_date, canonical_product_code, product_name, quantity, cost_price, subtotal, invoice_number, supplier_code, supplier_name'
            ).eq('company_id', company_id).gte('receipt_date', start_date).lte('receipt_date', end_date).range(offset, offset + page_size - 1).execute()
            purchases_data.extend(purchases_query.data)
            if len(purchases_query.data) < page_size:
                break
            offset += page_size

        # Aggregate by product
        product_summary = {}
        supplier_summary = {}
        daily_costs = {}
        product_suppliers = {}  # Track suppliers per product for main supplier calculation

        for purchase in purchases_data:
            product_code = purchase['canonical_product_code']
            product_name = purchase['product_name']  # Use canonical product name
            quantity = Decimal(str(purchase['quantity']))
            cost = Decimal(str(purchase['cost_price']))
            subtotal = Decimal(str(purchase['subtotal']))
            receipt_date = purchase['receipt_date']

            # Get supplier info directly from purchase record
            supplier = purchase.get('supplier_name') or 'Unknown'
            supplier_cnpj = purchase.get('supplier_code') or 'N/A'

            # Product summary
            if product_code not in product_summary:
                product_summary[product_code] = {
                    'product': product_name,
                    'volume': Decimal('0'),
                    'cost_total': Decimal('0'),
                    'cost_sum': Decimal('0'),
                    'cost_count': 0,
                    'cost_prices': []  # Track individual prices for std dev calculation
                }

            product_summary[product_code]['volume'] += quantity
            product_summary[product_code]['cost_total'] += subtotal
            product_summary[product_code]['cost_sum'] += cost
            product_summary[product_code]['cost_count'] += 1
            product_summary[product_code]['cost_prices'].append(float(cost))

            # Track suppliers per product (for main supplier calculation)
            if product_code not in product_suppliers:
                product_suppliers[product_code] = {}
            if supplier not in product_suppliers[product_code]:
                product_suppliers[product_code][supplier] = Decimal('0')
            product_suppliers[product_code][supplier] += quantity

            # Supplier summary - use supplier name as key
            if supplier not in supplier_summary:
                supplier_summary[supplier] = {
                    'volume': Decimal('0'),
                    'cost': Decimal('0'),
                    'cnpj': supplier_cnpj  # Store CNPJ with the summary
                }

            supplier_summary[supplier]['volume'] += quantity
            supplier_summary[supplier]['cost'] += subtotal

            # Daily costs - now track volume and total cost for weighted average
            if receipt_date not in daily_costs:
                daily_costs[receipt_date] = {
                    'date': receipt_date,
                    'total_volume': Decimal('0'),
                    'total_cost': Decimal('0'),
                    'GC': None, 'GA': None, 'ET': None, 'DS10': None, 'DS500': None
                }

            daily_costs[receipt_date]['total_volume'] += quantity
            daily_costs[receipt_date]['total_cost'] += subtotal

            # Only set cost for products that were actually purchased on this day
            if product_code in ['GC', 'GA', 'ET', 'DS10', 'DS500']:
                daily_costs[receipt_date][product_code] = float(cost)

        # Format product summary
        products = []
        total_volume = Decimal('0')
        total_cost = Decimal('0')

        # Import statistics for standard deviation
        import statistics

        for code, data in product_summary.items():
            avg_cost = data['cost_sum'] / data['cost_count'] if data['cost_count'] > 0 else Decimal('0')

            # Calculate standard deviation of cost prices
            cost_std_dev = 0.0
            if len(data['cost_prices']) > 1:
                cost_std_dev = statistics.stdev(data['cost_prices'])

            # Find main supplier for this product (highest volume)
            main_supplier = 'N/A'
            if code in product_suppliers and product_suppliers[code]:
                main_supplier = max(product_suppliers[code].items(), key=lambda x: x[1])[0]

            products.append({
                'product_code': code,
                'product_name': data['product'],
                'volume': float(data['volume']),
                'avg_cost': float(avg_cost),
                'total_cost': float(data['cost_total']),
                'cost_std_dev': cost_std_dev,
                'main_supplier': main_supplier  # Add main supplier
            })
            total_volume += data['volume']
            total_cost += data['cost_total']

        # Format supplier summary
        suppliers = []
        for name, data in supplier_summary.items():
            avg_cost = data['cost'] / data['volume'] if data['volume'] > 0 else Decimal('0')

            suppliers.append({
                'supplier_name': name,
                'cnpj': data.get('cnpj', 'N/A'),
                'volume_purchased': float(data['volume']),
                'volume': float(data['volume']),  # Keep for backward compatibility
                'avg_cost': float(avg_cost),
                'total_cost': float(data['cost'])
            })

        # Sort daily costs by date and add avg_cost
        evolution = []
        for day in sorted(daily_costs.values(), key=lambda x: x['date']):
            # Calculate weighted average cost for the day
            avg_cost = float(day['total_cost'] / day['total_volume']) if day['total_volume'] > 0 else 0
            evolution.append({
                'date': day['date'],
                'avg_cost': avg_cost,
                'GC': day.get('GC', 0),
                'GA': day.get('GA', 0),
                'ET': day.get('ET', 0),
                'DS10': day.get('DS10', 0),
                'DS500': day.get('DS500', 0)
            })

        return jsonify({
            'start_date': start_date,
            'end_date': end_date,
            'total_volume': float(total_volume),
            'total_cost': float(total_cost),
            'avg_cost': float(total_cost / total_volume) if total_volume > 0 else 0,
            'products': products,
            'suppliers': suppliers,
            'evolution': evolution
        }), 200

    except Exception as e:
        print(f"[ERROR] Compras dashboard failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/dashboard/estoque', methods=['GET'])
@require_auth
def get_estoque_dashboard():
    """Get inventory dashboard data - REAL stock + calculated metrics"""
    try:
        company_id = request.user['company_id']

        # Get date range parameters for period entries/exits
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')

        # =========================================================================
        # STEP 1: Get REAL current stock from tank monitoring system
        # =========================================================================
        tank_levels_query = supabase.table('current_tank_levels').select(
            'product_code, product_name, tank_capacity, current_stock, last_measurement'
        ).eq('company_id', company_id).execute()

        # Create dict for quick lookup
        real_stock = {}
        for tank in tank_levels_query.data:
            code = tank['product_code']
            real_stock[code] = {
                'product_code': code,
                'product_name': tank['product_name'],
                'current_stock': float(tank['current_stock']),
                'tank_capacity': float(tank['tank_capacity']),
                'last_measurement': tank['last_measurement']
            }

        print(f"[INFO] Loaded {len(real_stock)} real tank levels")

        # =========================================================================
        # STEP 2: Calculate period entries (purchases in selected date range)
        # =========================================================================
        period_entries = {}
        if start_date and end_date:
            # Use pagination for large datasets
            offset = 0
            page_size = 1000
            while True:
                purchases_query = supabase.table('purchases').select(
                    'canonical_product_code, quantity, receipt_date'
                ).eq('company_id', company_id).gte('receipt_date', start_date).lte('receipt_date', end_date).range(offset, offset + page_size - 1).execute()

                for purchase in purchases_query.data:
                    code = purchase['canonical_product_code']
                    qty = Decimal(str(purchase['quantity']))

                    if code not in period_entries:
                        period_entries[code] = Decimal('0')
                    period_entries[code] += qty

                if len(purchases_query.data) < page_size:
                    break
                offset += page_size

        print(f"[INFO] Period entries: {dict((k, float(v)) for k, v in period_entries.items())}")

        # =========================================================================
        # STEP 3: Calculate period exits (sales in selected date range)
        # =========================================================================
        period_exits = {}
        if start_date and end_date:
            # Use pagination for large datasets
            offset = 0
            page_size = 1000
            while True:
                sales_query = supabase.table('pump_sales_intraday').select(
                    'product_code, volume_sold, sale_date'
                ).eq('company_id', company_id).gte('sale_date', start_date).lte('sale_date', end_date).range(offset, offset + page_size - 1).execute()

                for sale in sales_query.data:
                    code = sale['product_code']
                    qty = Decimal(str(sale['volume_sold']))

                    if code not in period_exits:
                        period_exits[code] = Decimal('0')
                    period_exits[code] += qty

                if len(sales_query.data) < page_size:
                    break
                offset += page_size

        print(f"[INFO] Period exits: {dict((k, float(v)) for k, v in period_exits.items())}")

        # =========================================================================
        # STEP 4: Calculate VMD (Volume Médio Diário) from last 30 days
        # =========================================================================
        from datetime import datetime, timedelta
        thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')

        # Use pagination for large datasets
        vmd = {}
        offset = 0
        page_size = 1000
        while True:
            recent_sales_query = supabase.table('pump_sales_intraday').select(
                'product_code, volume_sold'
            ).eq('company_id', company_id).gte('sale_date', thirty_days_ago).range(offset, offset + page_size - 1).execute()

            for sale in recent_sales_query.data:
                code = sale['product_code']
                qty = Decimal(str(sale['volume_sold']))

                if code not in vmd:
                    vmd[code] = Decimal('0')
                vmd[code] += qty

            if len(recent_sales_query.data) < page_size:
                break
            offset += page_size

        # Divide by 30 days to get daily average
        for code in vmd:
            vmd[code] = vmd[code] / 30

        print(f"[INFO] VMD calculated for {len(vmd)} products")

        # =========================================================================
        # STEP 5: Calculate weighted average cost for stock valuation
        # =========================================================================
        cost_data = {}
        offset = 0
        while True:
            all_purchases_query = supabase.table('purchases').select(
                'canonical_product_code, quantity, subtotal'
            ).eq('company_id', company_id).range(offset, offset + page_size - 1).execute()

            for purchase in all_purchases_query.data:
                code = purchase['canonical_product_code']
                qty = Decimal(str(purchase['quantity']))
                total_cost = Decimal(str(purchase.get('subtotal', 0)))

                if code not in cost_data:
                    cost_data[code] = {
                        'total_quantity': Decimal('0'),
                        'total_cost': Decimal('0')
                    }

                cost_data[code]['total_quantity'] += qty
                cost_data[code]['total_cost'] += total_cost

            if len(all_purchases_query.data) < page_size:
                break
            offset += page_size

        # =========================================================================
        # STEP 6: Merge real stock with calculated metrics
        # =========================================================================
        inventory = []

        for code, stock_data in real_stock.items():
            current_stock = stock_data['current_stock']  # REAL from tank sensors
            tank_capacity = stock_data['tank_capacity']
            daily_avg = float(vmd.get(code, Decimal('0')))
            days_autonomy = current_stock / daily_avg if daily_avg > 0 else 999

            # Calculate weighted average cost per liter
            avg_cost_per_liter = 0
            if code in cost_data and cost_data[code]['total_quantity'] > 0:
                avg_cost_per_liter = float(cost_data[code]['total_cost'] / cost_data[code]['total_quantity'])

            # Calculate total stock cost (current stock × avg cost/L)
            stock_cost = current_stock * avg_cost_per_liter

            # Get period entries and exits
            entries = float(period_entries.get(code, Decimal('0')))
            exits = float(period_exits.get(code, Decimal('0')))

            # Determine status based on days of autonomy
            status = 'adequado'
            if days_autonomy < 3:
                status = 'critico'
            elif days_autonomy < 7:
                status = 'baixo'

            inventory.append({
                'product_code': code,
                'product_name': stock_data['product_name'],
                'current_stock': current_stock,  # REAL from tank levels
                'tank_capacity': tank_capacity,  # NEW: tank capacity
                'period_entries': entries,  # CALCULATED
                'period_exits': exits,  # CALCULATED
                'vmd': daily_avg,  # CALCULATED
                'days_autonomy': days_autonomy,  # CALCULATED
                'avg_cost_per_liter': avg_cost_per_liter,  # CALCULATED
                'stock_cost': stock_cost,  # CALCULATED
                'status': status,  # CALCULATED
                'last_measurement': stock_data['last_measurement']  # NEW: timestamp
            })

        print(f"[INFO] Returning {len(inventory)} inventory items")

        return jsonify({
            'inventory': inventory
        }), 200

    except Exception as e:
        print(f"[ERROR] Estoque dashboard failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/dashboard/estoque/evolution', methods=['GET'])
@require_auth
def get_estoque_evolution():
    """
    Get daily stock evolution for chart
    Uses known opening stock on Sept 1, 2025 and works FORWARDS.
    closing_stock = opening_stock + purchases - sales
    """
    try:
        company_id = request.user['company_id']
        start_date = request.args.get('start_date', '2025-09-01')
        end_date = request.args.get('end_date', '2025-12-08')

        print(f"[INFO] Fetching stock evolution for company {company_id}")
        print(f"[INFO] Date range: {start_date} to {end_date}")

        from datetime import datetime, timedelta

        # KNOWN opening stock on September 1, 2025 (beginning of day)
        # DS500 = Diesel S500 (same as Diesel Comum)
        SEPT1_OPENING_STOCK = {
            'DS500': 3822.0,
            'DS10': 4576.0,
            'ET': 4863.0,
            'GC': 11648.65,
            'GA': 6362.0
        }

        # Get tank capacities
        tank_levels_result = supabase.table('current_tank_levels').select(
            'product_code, tank_capacity'
        ).eq('company_id', company_id).execute()

        tank_capacity = {}
        for tank in tank_levels_result.data:
            tank_capacity[tank['product_code']] = float(tank.get('tank_capacity', 20000))

        total_capacity = sum(tank_capacity.values())
        print(f"[INFO] Tank capacities: {tank_capacity}, Total: {total_capacity}")

        # Products we're tracking
        products = ['GC', 'GA', 'ET', 'DS10', 'DS500']

        # Get ALL purchases from Sept 1 to end_date
        # Use pagination to get all records (Supabase default limit is 1000)
        all_purchases = []
        offset = 0
        page_size = 1000
        while True:
            purchases_result = supabase.table('purchases').select(
                'receipt_date, canonical_product_code, quantity'
            ).eq('company_id', company_id).gte('receipt_date', '2025-09-01').lte('receipt_date', end_date).range(offset, offset + page_size - 1).execute()
            all_purchases.extend(purchases_result.data)
            if len(purchases_result.data) < page_size:
                break
            offset += page_size

        # Get ALL sales from Sept 1 to end_date
        # Use pagination to get all records (Supabase default limit is 1000)
        all_sales = []
        offset = 0
        while True:
            sales_result = supabase.table('pump_sales_intraday').select(
                'sale_date, product_code, volume_sold'
            ).eq('company_id', company_id).gte('sale_date', '2025-09-01').lte('sale_date', end_date).range(offset, offset + page_size - 1).execute()
            all_sales.extend(sales_result.data)
            if len(sales_result.data) < page_size:
                break
            offset += page_size

        print(f"[INFO] Loaded {len(all_purchases)} purchases and {len(all_sales)} sales")

        # Aggregate purchases by date and product
        daily_purchases = {}
        for p in all_purchases:
            date = p['receipt_date']
            product = p['canonical_product_code']
            qty = float(p['quantity'])

            if date not in daily_purchases:
                daily_purchases[date] = {}
            if product not in daily_purchases[date]:
                daily_purchases[date][product] = 0
            daily_purchases[date][product] += qty

        print(f"[INFO] Found purchases on {len(daily_purchases)} days")

        # Aggregate sales by date and product
        daily_sales = {}
        for s in all_sales:
            date = s['sale_date']
            product = s['product_code']
            qty = float(s['volume_sold'])

            if date not in daily_sales:
                daily_sales[date] = {}
            if product not in daily_sales[date]:
                daily_sales[date][product] = 0
            daily_sales[date][product] += qty

        print(f"[INFO] Found sales on {len(daily_sales)} days")

        # Generate all dates from Sept 1 to end_date
        sept1_dt = datetime.strptime('2025-09-01', '%Y-%m-%d')
        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')

        # Calculate stock for ALL days from Sept 1 (need full history for accurate calculation)
        all_dates = []
        current_dt = sept1_dt
        while current_dt <= end_dt:
            all_dates.append(current_dt.strftime('%Y-%m-%d'))
            current_dt += timedelta(days=1)

        # Work FORWARDS from Sept 1 opening stock
        # closing_stock = opening_stock + purchases - sales
        running_stock = SEPT1_OPENING_STOCK.copy()
        all_evolution = {}

        for date in all_dates:
            # Apply today's movements
            for product in products:
                purchases_today = daily_purchases.get(date, {}).get(product, 0)
                sales_today = daily_sales.get(date, {}).get(product, 0)
                running_stock[product] = running_stock.get(product, 0) + purchases_today - sales_today

            # Calculate total (no capping - show real calculated values)
            day_total = sum(max(0, running_stock.get(p, 0)) for p in products)

            # Save today's CLOSING stock (after all transactions)
            # Use max(0, x) to avoid negative display values
            all_evolution[date] = {
                'date': date,
                'GC': round(max(0, running_stock.get('GC', 0)), 0),
                'GA': round(max(0, running_stock.get('GA', 0)), 0),
                'ET': round(max(0, running_stock.get('ET', 0)), 0),
                'DS10': round(max(0, running_stock.get('DS10', 0)), 0),
                'DS500': round(max(0, running_stock.get('DS500', 0)), 0),
                'total': round(day_total, 0)
            }

        # Filter to only return dates in requested range
        evolution = []
        current_dt = start_dt
        while current_dt <= end_dt:
            date_str = current_dt.strftime('%Y-%m-%d')
            if date_str in all_evolution:
                evolution.append(all_evolution[date_str])
            current_dt += timedelta(days=1)

        print(f"[INFO] Returning {len(evolution)} days of stock evolution")

        return jsonify({
            'evolution': evolution,
            'opening_stock_sept1': SEPT1_OPENING_STOCK,
            'tank_capacity': tank_capacity,
            'total_capacity': total_capacity,
            'start_date': start_date,
            'end_date': end_date
        }), 200

    except Exception as e:
        print(f"[ERROR] Stock evolution failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================
# DATA IMPORT
# ============================================================

@app.route('/api/import/daily-sales', methods=['POST'])
@require_auth
def import_daily_sales():
    """Import historical daily sales report"""
    try:
        company_id = request.user['company_id']
        role = request.user['role']

        # Only users and admins can import data
        if role not in ['user', 'super_admin']:
            return jsonify({'error': 'Insufficient permissions'}), 403

        # Check if file was uploaded
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400

        file = request.files['file']

        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Check file extension
        if not file.filename.lower().endswith(('.xlsx', '.xls')):
            return jsonify({'error': 'File must be an Excel file (.xlsx or .xls)'}), 400

        # Get sale date from form data
        sale_date = request.form.get('sale_date')
        if not sale_date:
            return jsonify({'error': 'Sale date is required'}), 400

        # Save file temporarily
        import tempfile
        import os
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, f"import_{company_id}_{sale_date}_{file.filename}")
        file.save(temp_path)

        try:
            # Import the service
            sys.path.append(str(Path(__file__).parent.parent))
            from data_import.import_service import ImportService

            # Process the import
            import_service = ImportService()
            result = import_service.import_daily_sales(temp_path, company_id, sale_date)

            return jsonify(result), 200

        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as e:
        print(f"[ERROR] Import failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'Fuel BI API',
        'version': '1.0.0'
    }), 200

@app.route('/', methods=['GET'])
def root():
    """Root endpoint"""
    return jsonify({
        'message': 'Fuel BI Dashboard API',
        'version': '1.0.0',
        'endpoints': {
            'auth': '/api/auth/*',
            'purchases': '/api/purchases',
            'sales': '/api/sales',
            'inventory': '/api/inventory',
            'products': '/api/products',
            'admin': '/api/admin/*'
        }
    }), 200

# ============================================================
# ERROR HANDLERS
# ============================================================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# ============================================================
# SETTINGS ENDPOINTS
# ============================================================

@app.route('/api/settings', methods=['GET'])
@require_auth
def get_settings():
    """Get company settings"""
    try:
        company_id = request.user['company_id']

        # Get settings from database
        settings_query = supabase.table('company_settings').select('*').eq('company_id', company_id).execute()

        if settings_query.data and len(settings_query.data) > 0:
            settings = settings_query.data[0]['settings_data']
        else:
            # Return default settings if none exist
            settings = {
                'monthly_sales_targets': {
                    'GC': 200000,
                    'GA': 150000,
                    'ET': 100000,
                    'EA': 50000,
                    'DS10': 180000,
                    'DS500': 80000
                },
                'minimum_margin_percent': 10,
                'critical_stock_days': 3,
                'low_stock_days': 7
            }

        return jsonify(settings), 200

    except Exception as e:
        print(f"[ERROR] Failed to fetch settings: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/settings', methods=['PUT'])
@require_auth
def update_settings():
    """Update company settings"""
    try:
        company_id = request.user['company_id']
        new_settings = request.json

        # Check if settings exist
        existing = supabase.table('company_settings').select('id').eq('company_id', company_id).execute()

        if existing.data and len(existing.data) > 0:
            # Update existing settings
            result = supabase.table('company_settings').update({
                'settings_data': new_settings
            }).eq('company_id', company_id).execute()
        else:
            # Insert new settings
            result = supabase.table('company_settings').insert({
                'company_id': company_id,
                'settings_data': new_settings
            }).execute()

        return jsonify({'message': 'Settings updated successfully', 'settings': new_settings}), 200

    except Exception as e:
        print(f"[ERROR] Failed to update settings: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================
# KPIs (METAS) ENDPOINTS
# ============================================================

@app.route('/api/kpis', methods=['GET'])
@require_auth
def get_kpis():
    """Get all KPIs for the company"""
    try:
        company_id = request.user['company_id']

        # Get optional filters
        status = request.args.get('status')  # 'active', 'inactive', etc.
        kpi_type = request.args.get('type')  # 'sales_volume', 'revenue', etc.

        # Build query
        query = supabase.table('kpis').select('*').eq('company_id', company_id)

        if status:
            query = query.eq('status', status)
        if kpi_type:
            query = query.eq('kpi_type', kpi_type)

        # Order by creation date (newest first)
        query = query.order('created_at', desc=True)

        result = query.execute()

        return jsonify({'kpis': result.data}), 200

    except Exception as e:
        print(f"[ERROR] Failed to fetch KPIs: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/kpis', methods=['POST'])
@require_auth
@require_manager
def create_kpi():
    """Create a new KPI (manager/admin only)"""
    try:
        company_id = request.user['company_id']
        user_id = request.user['user_id']
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body required'}), 400

        # Validate required fields
        required_fields = ['kpi_name', 'kpi_type', 'target_value', 'unit', 'period_type', 'start_date', 'end_date']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Prepare KPI data
        kpi_data = {
            'company_id': company_id,
            'kpi_name': data['kpi_name'],
            'kpi_type': data['kpi_type'],
            'product_code': data.get('product_code'),
            'product_name': data.get('product_name'),
            'target_value': data['target_value'],
            'current_value': data.get('current_value', 0),
            'unit': data['unit'],
            'period_type': data['period_type'],
            'start_date': data['start_date'],
            'end_date': data['end_date'],
            'status': data.get('status', 'active'),
            'description': data.get('description'),
            'created_by': user_id
        }

        # Insert into database
        result = supabase.table('kpis').insert(kpi_data).execute()

        return jsonify({'message': 'KPI created successfully', 'kpi': result.data[0]}), 201

    except Exception as e:
        print(f"[ERROR] Failed to create KPI: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/kpis/<kpi_id>', methods=['PUT'])
@require_auth
@require_manager
def update_kpi(kpi_id):
    """Update an existing KPI (manager/admin only)"""
    try:
        company_id = request.user['company_id']
        data = request.get_json()

        if not data:
            return jsonify({'error': 'Request body required'}), 400

        # Check if KPI exists and belongs to user's company
        check_result = supabase.table('kpis').select('id').eq('id', kpi_id).eq('company_id', company_id).execute()

        if not check_result.data:
            return jsonify({'error': 'KPI not found'}), 404

        # Prepare update data (only include fields that are provided)
        update_data = {}
        allowed_fields = [
            'kpi_name', 'kpi_type', 'product_code', 'product_name', 'target_value',
            'current_value', 'unit', 'period_type', 'start_date', 'end_date',
            'status', 'description'
        ]

        for field in allowed_fields:
            if field in data:
                update_data[field] = data[field]

        if not update_data:
            return jsonify({'error': 'No valid fields to update'}), 400

        # Update in database
        result = supabase.table('kpis').update(update_data).eq('id', kpi_id).eq('company_id', company_id).execute()

        return jsonify({'message': 'KPI updated successfully', 'kpi': result.data[0]}), 200

    except Exception as e:
        print(f"[ERROR] Failed to update KPI: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/kpis/<kpi_id>', methods=['DELETE'])
@require_auth
@require_manager
def delete_kpi(kpi_id):
    """Delete a KPI (manager/admin only)"""
    try:
        company_id = request.user['company_id']

        # Check if KPI exists and belongs to user's company
        check_result = supabase.table('kpis').select('id').eq('id', kpi_id).eq('company_id', company_id).execute()

        if not check_result.data:
            return jsonify({'error': 'KPI not found'}), 404

        # Delete from database
        supabase.table('kpis').delete().eq('id', kpi_id).eq('company_id', company_id).execute()

        return jsonify({'message': 'KPI deleted successfully'}), 200

    except Exception as e:
        print(f"[ERROR] Failed to delete KPI: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    use_waitress = os.getenv('USE_WAITRESS', 'true').lower() == 'true'

    print(f"\n{'='*60}")
    print(f"Fuel BI Dashboard API")
    print(f"{'='*60}")
    print(f"Server running on: http://localhost:{port}")
    print(f"Server: {'Waitress (Production)' if use_waitress else 'Flask (Development)'}")
    print(f"{'='*60}\n")

    if use_waitress:
        from waitress import serve
        serve(app, host='0.0.0.0', port=port, threads=8)
    else:
        app.run(host='0.0.0.0', port=port, debug=True)
