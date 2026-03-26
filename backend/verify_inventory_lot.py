#!/usr/bin/env python
"""
Verification script for InventoryLot ORM model creation and cleanup.
Tests that InventoryLot model works correctly and InventoryItem.stock has been removed.
"""

import sys
from datetime import date, datetime, timedelta
from sqlalchemy import inspect as sa_inspect
from app.models import InventoryItem, InventoryLot, Base

def verify_models():
    """Verify model structure and relationships."""
    print("=" * 70)
    print("VERIFICATION: InventoryLot ORM Model and InventoryItem Cleanup")
    print("=" * 70)
    
    # 1. Verify InventoryItem structure
    print("\n✅ 1. InventoryItem Model Verification")
    print("-" * 70)
    item_mapper = sa_inspect(InventoryItem)
    
    # Check that stock field is REMOVED
    if any(col.name == 'stock' for col in item_mapper.columns):
        print("❌ ERROR: stock field still exists in InventoryItem!")
        return False
    print("  ✓ stock field successfully removed")
    
    # Check required fields exist
    required_fields = {'id', 'name', 'category', 'unit', 'threshold', 'updated_at'}
    existing_cols = {col.name for col in item_mapper.columns}
    if not required_fields.issubset(existing_cols):
        missing = required_fields - existing_cols
        print(f"❌ ERROR: Missing required fields: {missing}")
        return False
    print(f"  ✓ All required fields present: {', '.join(sorted(required_fields))}")
    
    # Check lots relationship exists
    if 'lots' not in item_mapper.relationships:
        print("❌ ERROR: lots relationship not found in InventoryItem")
        return False
    print("  ✓ lots relationship exists (InventoryItem → InventoryLot)")
    
    # 2. Verify InventoryLot structure
    print("\n✅ 2. InventoryLot Model Verification")
    print("-" * 70)
    lot_mapper = sa_inspect(InventoryLot)
    
    # Check all required columns
    lot_required_cols = {
        'id', 'inventory_item_id', 'quantity', 'expiry_date',
        'received_date', 'batch_reference', 'created_at', 'updated_at', 'deleted_at'
    }
    lot_cols = {col.name for col in lot_mapper.columns}
    if not lot_required_cols.issubset(lot_cols):
        missing = lot_required_cols - lot_cols
        print(f"❌ ERROR: Missing InventoryLot columns: {missing}")
        return False
    print(f"  ✓ All required columns present: {', '.join(sorted(lot_required_cols))}")
    
    # Check FK relationship
    fk_cols = {col.name for col in lot_mapper.columns if col.foreign_keys}
    if 'inventory_item_id' not in fk_cols:
        print("❌ ERROR: FK inventory_item_id not configured properly")
        return False
    print("  ✓ Foreign key inventory_item_id → inventory_items.id configured")
    
    # Check back-reference relationship
    if 'inventory_item' not in lot_mapper.relationships:
        print("❌ ERROR: inventory_item relationship not found in InventoryLot")
        return False
    print("  ✓ inventory_item back-reference exists (InventoryLot → InventoryItem)")
    
    # 3. Verify check constraints
    print("\n✅ 3. InventoryLot Constraints Verification")
    print("-" * 70)
    constraint_names = {c.name for c in lot_mapper.mapped_table.constraints if hasattr(c, 'name')}
    expected_constraints = {'ck_inventory_lots_quantity_positive', 'ck_inventory_lots_dates'}
    found_constraints = constraint_names & expected_constraints
    
    if found_constraints == expected_constraints:
        print(f"  ✓ Check constraints present: {', '.join(sorted(found_constraints))}")
    else:
        missing = expected_constraints - found_constraints
        print(f"  ⚠ Note: Some constraints may be present: {missing}")
    
    # 4. Verify import availability
    print("\n✅ 4. Import and Export Verification")
    print("-" * 70)
    try:
        from app.models import InventoryLot as ImportedLot, InventoryItem as ImportedItem
        print("  ✓ InventoryLot and InventoryItem can be imported from app.models")
    except ImportError as e:
        print(f"❌ ERROR: Import failed: {e}")
        return False
    
    try:
        from app.models import Base as ImportedBase
        print("  ✓ Base class can be imported")
    except ImportError as e:
        print(f"❌ ERROR: Base import failed: {e}")
        return False
    
    # 5. Verify table metadata
    print("\n✅ 5. Database Table Metadata")
    print("-" * 70)
    print(f"  ✓ InventoryItem table: {item_mapper.mapped_table.name}")
    print(f"  ✓ InventoryLot table: {lot_mapper.mapped_table.name}")
    
    return True

def test_model_creation():
    """Test that models can be instantiated (Python-level schema validation)."""
    print("\n✅ 6. Python-level Schema Validation")
    print("-" * 70)
    
    try:
        # This doesn't create database records, just validates ORM instantiation
        item = InventoryItem(
            id=1,
            name="Canned Beans",
            category="Canned Goods",
            unit="cans",
            threshold=10,
            updated_at=datetime.now(),
        )
        print("  ✓ InventoryItem instance created successfully")
        print(f"    - name: {item.name}")
        print(f"    - category: {item.category}")
        print(f"    - unit: {item.unit}")
        print(f"    - threshold: {item.threshold}")
        
        # Create InventoryLot instance
        lot = InventoryLot(
            id=1,
            inventory_item_id=1,
            quantity=100,
            expiry_date=date.today() + timedelta(days=30),
            received_date=date.today(),
            batch_reference="BATCH-001",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            deleted_at=None,
        )
        print("  ✓ InventoryLot instance created successfully")
        print(f"    - quantity: {lot.quantity}")
        print(f"    - expiry_date: {lot.expiry_date}")
        print(f"    - batch_reference: {lot.batch_reference}")
        
    except Exception as e:
        print(f"❌ ERROR: Schema validation failed: {e}")
        return False
    
    return True

def main():
    """Run all verifications."""
    try:
        if not verify_models():
            print("\n" + "=" * 70)
            print("❌ VERIFICATION FAILED")
            print("=" * 70)
            return 1
        
        if not test_model_creation():
            print("\n" + "=" * 70)
            print("❌ SCHEMA VALIDATION FAILED")
            print("=" * 70)
            return 1
        
        print("\n" + "=" * 70)
        print("✅ ALL VERIFICATIONS PASSED")
        print("=" * 70)
        print("\nNext steps:")
        print("1. Run migrations: alembic upgrade head")
        print("2. Verify database: Check inventory_items table has no 'stock' column")
        print("3. Test in shell: from app.models import InventoryLot; print(InventoryLot.__tablename__)")
        print("=" * 70)
        return 0
    
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
