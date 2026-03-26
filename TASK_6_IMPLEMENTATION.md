# Task 6: Low-Stock Alert API Endpoint Implementation

## ✅ Implementation Complete

### Overview
Implemented `GET /inventory/low-stock` endpoint to provide real-time low-stock alerts for inventory managers.

### What Was Implemented

#### 1. **Pydantic Schema: `LowStockItem`** 
Location: [app/schemas/inventory_item.py](app/schemas/inventory_item.py)

```python
class LowStockItem(BaseModel):
    id: int                                    # Inventory item ID
    name: str                                  # Item name
    category: InventoryCategory                # Item category
    unit: str                                  # Unit of measure
    current_stock: int                         # Total quantity from active lots
    threshold: int                             # Stock level threshold
    stock_deficit: int                         # Amount below threshold
```

#### 2. **API Route: `GET /api/v1/inventory/low-stock`**
Location: [app/routers/inventory.py](app/routers/inventory.py)

**Endpoint Details:**
- **URL**: `/api/v1/inventory/low-stock`
- **Method**: GET
- **Auth**: Requires admin user
- **Query Parameters**:
  - `threshold` (optional, int >= 0): Override per-item threshold for all items
- **Response**: `List[LowStockItem]` sorted by `stock_deficit DESC`

**Key Features:**
1. **Stock Calculation**:
   - Sums quantities from all active inventory lots
   - Filters: `deleted_at IS NULL` (active lots)
   - Filters: `expiry_date >= CURRENT_DATE` (non-expired)
   - Formula: `SUM(inventory_lots.quantity)` grouped by `inventory_item_id`

2. **Filtering**:
   - With no `threshold` param: Returns items where `current_stock < item.threshold`
   - With `threshold` param: Returns items where `current_stock < threshold`

3. **Sorting**:
   - Results ordered by `stock_deficit DESC` (most critical first)
   - `stock_deficit = threshold - current_stock`

4. **Response Data**:
   - Item ID, name, category, unit
   - Current active stock total
   - Item's threshold value
   - Stock deficit (how much below threshold)

### Implementation Details

#### Query Logic
```sql
-- Subquery: Calculate active stock per item
SELECT 
    inventory_item_id,
    COALESCE(SUM(quantity), 0) as total_stock
FROM inventory_lots
WHERE deleted_at IS NULL 
  AND expiry_date >= CURRENT_DATE
GROUP BY inventory_item_id

-- Main query: Get items below threshold
SELECT 
    item.id,
    item.name,
    item.category,
    item.unit,
    stock_subquery.total_stock,
    item.threshold,
    item.threshold - stock_subquery.total_stock as stock_deficit
FROM inventory_items item
LEFT JOIN stock_subquery ON item.id = stock_subquery.inventory_item_id
WHERE stock_subquery.total_stock < item.threshold
  -- OR stock_subquery.total_stock < ? (if override threshold provided)
ORDER BY stock_deficit DESC
```

#### Error Handling
- Returns `500 INTERNAL_SERVER_ERROR` if database query fails
- Properly handles cases with no low-stock items (returns empty list)
- Validates threshold parameter (must be >= 0)

### Testing

#### Test Coverage: 6 Comprehensive Tests
Location: [tests/api/test_low_stock_endpoint.py](tests/api/test_low_stock_endpoint.py)

1. **test_low_stock_items_with_default_threshold**
   - Item 1: threshold=50, stock=30 ✓ (appears)
   - Item 2: threshold=50, stock=100 ✓ (hidden)
   - Verifies correct filtering by per-item threshold

2. **test_low_stock_items_with_override_threshold**
   - Tests threshold query parameter override
   - Demonstrates parameter filtering override

3. **test_low_stock_items_excludes_expired_lots**
   - Item with multiple lots
   - Expired lots (expiry_date in past) not counted
   - Only active, non-expired lots included

4. **test_low_stock_items_excludes_deleted_lots**
   - Soft-deleted lots (deleted_at IS NOT NULL) excluded
   - Only active (deleted_at IS NULL) lots counted

5. **test_low_stock_items_sorted_by_deficit**
   - Results sorted by stock_deficit DESC
   - Most critical items first

6. **test_low_stock_items_empty_result**
   - Well-stocked items don't appear
   - Returns empty list when no low stock

**All tests passing** ✅

### API Usage Examples

#### Example 1: Default Query
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/inventory/low-stock
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Canned Beans",
    "category": "Canned Goods",
    "unit": "cans",
    "current_stock": 30,
    "threshold": 50,
    "stock_deficit": 20
  },
  {
    "id": 4,
    "name": "Milk Powder",
    "category": "Dairy",
    "unit": "boxes",
    "current_stock": 35,
    "threshold": 60,
    "stock_deficit": 25
  }
]
```

#### Example 2: With Threshold Override
```bash
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8000/api/v1/inventory/low-stock?threshold=100"
```

Returns all items with `current_stock < 100`

#### Example 3: CLI Verification
```bash
# Run tests
python -m pytest tests/api/test_low_stock_endpoint.py -v

# Run verification
python verify_low_stock_api.py

# Run scenario demo
python demo_low_stock_scenario.py
```

### Database Models Used

1. **InventoryItem**
   - `id`: PK
   - `name`: Item name
   - `category`: Food category
   - `unit`: Unit of measure
   - `threshold`: Default restock threshold
   - `updated_at`: Audit timestamp

2. **InventoryLot**
   - `id`: PK (batch identifier)
   - `inventory_item_id`: FK to InventoryItem
   - `quantity`: Units in this batch
   - `expiry_date`: When batch expires
   - `received_date`: When batch was received
   - `batch_reference`: Supplier/donation reference
   - `deleted_at`: Soft-delete timestamp (NULL if active)
   - `created_at`, `updated_at`: Audit timestamps

### Integration Points

1. **Authentication**: Uses `require_admin` dependency
2. **Database**: Uses async SQLAlchemy with AsyncSession
3. **Error Handling**: FastAPI HTTPException pattern
4. **Data Validation**: Pydantic models
5. **Route Registration**: Automatically registered in app.main.py

### Specification Compliance

✅ Implements Spec § 2.6 requirement:
- Real-time low-stock alerts for administrative dashboard
- Helps managers restock promptly
- Supports threshold overrides for flexible alerting
- Considers FIFO (via expiry_date filtering)

### Files Modified/Created

1. **Modified**: 
   - [app/schemas/inventory_item.py](app/schemas/inventory_item.py) - Added LowStockItem schema
   - [app/routers/inventory.py](app/routers/inventory.py) - Added get_low_stock_items route

2. **Created**:
   - [tests/api/test_low_stock_endpoint.py](tests/api/test_low_stock_endpoint.py) - Comprehensive tests
   - [verify_low_stock_api.py](verify_low_stock_api.py) - Verification script
   - [demo_low_stock_scenario.py](demo_low_stock_scenario.py) - Scenario demonstration

### Next Steps (If Needed)

1. **Frontend Integration**: Create UI component to display low-stock alerts
2. **Notifications**: Add email/SMS alerts when stock falls below threshold
3. **Analytics**: Track low-stock trends over time
4. **Automation**: Auto-generate restock orders for low items
5. **Caching**: Cache results for frequently accessed endpoint

### Testing Verification Output

```
tests/api/test_low_stock_endpoint.py::test_low_stock_items_with_default_threshold PASSED
tests/api/test_low_stock_endpoint.py::test_low_stock_items_with_override_threshold PASSED
tests/api/test_low_stock_endpoint.py::test_low_stock_items_excludes_expired_lots PASSED
tests/api/test_low_stock_endpoint.py::test_low_stock_items_excludes_deleted_lots PASSED
tests/api/test_low_stock_endpoint.py::test_low_stock_items_sorted_by_deficit PASSED
tests/api/test_low_stock_endpoint.py::test_low_stock_items_empty_result PASSED

✅ 6 passed
```

---

**Status**: ✅ Implementation Complete and Tested
**Date**: March 26, 2026
**Version**: 1.0
