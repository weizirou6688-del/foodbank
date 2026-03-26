"""Migrate inventory_items.stock to inventory_lots.

Revision ID: 20260326_0007
Revises: 20260326_0006
Create Date: 2026-03-26 00:00:00.000000

Strategy: Convert existing stock into inventory_lots records with far-future expiry dates,
then optionally mark stock column as deprecated (retain for backward compatibility during transition).
"""
from alembic import op
import sqlalchemy as sa


revision = '20260326_0007'
down_revision = '20260326_0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Migrate stock from inventory_items to inventory_lots."""
    
    # Step 1: Create inventory_lots records for all items with stock > 0
    # Use a far-future expiry date (2099-12-31) for migrated stock
    op.execute("""
        INSERT INTO inventory_lots 
        (inventory_item_id, quantity, expiry_date, received_date, batch_reference, created_at, updated_at)
        SELECT 
            id,
            stock,
            '2099-12-31'::DATE,
            CURRENT_DATE,
            'MIGRATED_STOCK',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        FROM inventory_items
        WHERE stock > 0 AND deleted_at IS NULL
    """)
    
    # Step 2: Reset stock to 0 (mark as "now managed via inventory_lots")
    # Keep the column for backward compatibility during transition
    op.execute("""
        UPDATE inventory_items
        SET stock = 0, updated_at = CURRENT_TIMESTAMP
        WHERE stock > 0
    """)
    
    # Step 3: Add a comment to stock column marking it as deprecated
    op.execute("""
        COMMENT ON COLUMN inventory_items.stock IS 
        'DEPRECATED: Use inventory_lots table instead. This column is maintained for backward compatibility only. All inventory is now tracked by lot in inventory_lots table.';
    """)


def downgrade() -> None:
    """Revert inventory stock migration."""
    
    # Step 1: Restore stock values from inventory_lots (MIGRATED_STOCK batches)
    op.execute("""
        UPDATE inventory_items i
        SET stock = COALESCE(
            (SELECT SUM(quantity) FROM inventory_lots il 
             WHERE il.inventory_item_id = i.id 
             AND il.batch_reference = 'MIGRATED_STOCK'
             AND il.deleted_at IS NULL),
            0
        )
    """)
    
    # Step 2: Delete the migrated inventory_lots records
    op.execute("""
        DELETE FROM inventory_lots
        WHERE batch_reference = 'MIGRATED_STOCK'
    """)
    
    # Step 3: Remove deprecation comment
    op.execute("""
        COMMENT ON COLUMN inventory_items.stock IS NULL;
    """)
